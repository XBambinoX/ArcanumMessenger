using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using ArcanumMessenger.Contracts.Messenger.Media;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace ArcanumMessenger.Services.MessengerServices;

public record MediaByteRange(long Start, long? End);

public record MediaStream(Stream Content, string ContentType, long TotalLength, MediaByteRange? ServedRange);

public class MediaService(AppDbContext db, IAmazonS3 s3, IConfiguration config, MediaUploadSessionService uploadSessions)
{
    private const long MaxImageOrGifBytes = 50L * 1024 * 1024;
    private const long MaxOtherBytes = 200L * 1024 * 1024;
    private const long MaxChunkedTotalBytes = 5L * 1024 * 1024 * 1024; // 5 GB ceiling for the chunked path
    private const int ThumbnailMaxEdge = 320;

    private string Bucket => config["Media:Bucket"]!;

    public static string DeriveKind(string mimeType) => mimeType switch
    {
        "image/gif" => "gif",
        _ when mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) => "image",
        _ when mimeType.StartsWith("video/", StringComparison.OrdinalIgnoreCase) => "video",
        _ => "file",
    };

    private static long MaxBytesFor(string kind) => kind is "image" or "gif" ? MaxImageOrGifBytes : MaxOtherBytes;

    public async Task<(MediaAsset? Asset, string? Reason)> UploadAsync(
        Stream content, long length, string fileName, string mimeType, Guid uploaderId, CancellationToken ct)
    {
        if (length <= 0)
            return (null, "empty_file");

        var kind = DeriveKind(mimeType);
        if (length > MaxBytesFor(kind))
            return (null, "too_large");

        var storageKey = $"{uploaderId}/{Guid.NewGuid()}";
        int? width = null, height = null;
        string? thumbnailKey = null;

        if (kind is "image" or "gif")
        {
            // The bytes get read twice (decode + re-upload). Decoding from a
            // byte[] rather than a Stream avoids SkiaSharp taking ownership
            // of (and disposing) whatever stream it's handed.
            using var buffer = new MemoryStream();
            await content.CopyToAsync(buffer, ct);
            var bytes = buffer.ToArray();

            using (var original = SKBitmap.Decode(bytes))
            {
                if (original is not null)
                {
                    width = original.Width;
                    height = original.Height;

                    var scale = Math.Min(1.0, (double)ThumbnailMaxEdge / Math.Max(original.Width, original.Height));
                    var thumbWidth = Math.Max(1, (int)Math.Round(original.Width * scale));
                    var thumbHeight = Math.Max(1, (int)Math.Round(original.Height * scale));

                    using var resized = original.Resize(new SKImageInfo(thumbWidth, thumbHeight), SKSamplingOptions.Default);
                    using var image = SKImage.FromBitmap(resized is not null ? resized : original);
                    using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, 80);

                    using var thumbStream = new MemoryStream();
                    encoded.SaveTo(thumbStream);
                    thumbStream.Position = 0;

                    thumbnailKey = $"{storageKey}-thumb";
                    await s3.PutObjectAsync(new PutObjectRequest
                    {
                        BucketName = Bucket,
                        Key = thumbnailKey,
                        InputStream = thumbStream,
                        ContentType = "image/jpeg",
                    }, ct);
                }
                // else: claimed an image/gif mime type but isn't decodable as
                // one - still store the file, just without a thumbnail/dimensions.
            }

            using var uploadStream = new MemoryStream(bytes);
            await s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = Bucket,
                Key = storageKey,
                InputStream = uploadStream,
                ContentType = mimeType,
            }, ct);
        }
        else
        {
            await s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = Bucket,
                Key = storageKey,
                InputStream = content,
                ContentType = mimeType,
            }, ct);
        }

        var asset = new MediaAsset
        {
            UploaderId = uploaderId,
            Kind = kind,
            MimeType = mimeType,
            FileName = fileName,
            SizeBytes = length,
            StorageKey = storageKey,
            ThumbnailStorageKey = thumbnailKey,
            Width = width,
            Height = height,
        };
        db.MediaAssets.Add(asset);
        await db.SaveChangesAsync(ct);

        return (asset, null);
    }

    public async Task<(bool Success, string? Reason)> DeleteUnusedAsync(Guid mediaId, Guid callerId, CancellationToken ct)
    {
        var asset = await db.MediaAssets.FirstOrDefaultAsync(m => m.Id == mediaId, ct);
        if (asset is null)
            return (false, "not_found");
        if (asset.UploaderId != callerId)
            return (false, "forbidden");

        var inUse = await db.Messages.AnyAsync(m => m.MediaId == mediaId, ct) ||
            await db.SavedGifs.AnyAsync(s => s.MediaId == mediaId, ct);
        if (inUse)
            return (false, "in_use");

        await s3.DeleteObjectAsync(Bucket, asset.StorageKey, ct);
        if (asset.ThumbnailStorageKey is { } thumbnailKey)
            await s3.DeleteObjectAsync(Bucket, thumbnailKey, ct);

        db.MediaAssets.Remove(asset);
        await db.SaveChangesAsync(ct);

        return (true, null);
    }

    // The DB row can outlive the actual object in storage (e.g. it was
    // removed directly in the bucket) - that's a missing file, not a server
    // error, so it should surface as a clean 404 rather than a crash.
    public async Task<MediaStream?> OpenReadStreamAsync(MediaAsset asset, MediaByteRange? range, CancellationToken ct)
    {
        var request = new GetObjectRequest { BucketName = Bucket, Key = asset.StorageKey };

        MediaByteRange? servedRange = null;
        if (range is { } r)
        {
            var end = r.End ?? asset.SizeBytes - 1;
            request.ByteRange = new ByteRange(r.Start, end);
            servedRange = new MediaByteRange(r.Start, end);
        }

        try
        {
            var response = await s3.GetObjectAsync(request, ct);
            return new MediaStream(response.ResponseStream, asset.MimeType, asset.SizeBytes, servedRange);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<MediaStream?> OpenThumbnailStreamAsync(MediaAsset asset, CancellationToken ct)
    {
        if (asset.ThumbnailStorageKey is null)
            return null;

        try
        {
            var response = await s3.GetObjectAsync(new GetObjectRequest
            {
                BucketName = Bucket,
                Key = asset.ThumbnailStorageKey,
            }, ct);

            return new MediaStream(response.ResponseStream, "image/jpeg", response.ContentLength, null);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task EnsureBucketExistsAsync(CancellationToken ct)
    {
        if (!await Amazon.S3.Util.AmazonS3Util.DoesS3BucketExistV2Async(s3, Bucket))
            await s3.PutBucketAsync(Bucket, ct);
    }

    // A truly-abandoned chunked upload (browser closed, never resumed) would
    // otherwise leave its uploaded parts sitting in storage forever once the
    // Redis session itself expires - this is S3/MinIO's own cleanup for
    // exactly that, independent of anything this app tracks.
    //
    // As deployed, this MinIO version rejects the request outright ("XML you
    // provided was not well-formed") for AbortIncompleteMultipartUpload
    // specifically - confirmed it's not just this shape of request by trying
    // several variations, and separately that `mc ilm rule add` has no flag
    // for this action at all, so it looks like a real gap in this MinIO
    // version's lifecycle support rather than a request-formatting mistake.
    // The caller treats a failure here as non-fatal - it's cleanup, not core
    // functionality - so this stays in place for whenever it does work.
    public async Task EnsureIncompleteUploadLifecycleRuleAsync(CancellationToken ct)
    {
        await s3.PutLifecycleConfigurationAsync(new PutLifecycleConfigurationRequest
        {
            BucketName = Bucket,
            Configuration = new LifecycleConfiguration
            {
                Rules =
                [
                    new LifecycleRule
                    {
                        Id = "abort-incomplete-chunked-uploads",
                        Status = LifecycleRuleStatus.Enabled,
                        Filter = new LifecycleFilter
                        {
                            LifecycleFilterPredicate = new LifecyclePrefixPredicate { Prefix = "" },
                        },
                        AbortIncompleteMultipartUpload = new LifecycleRuleAbortIncompleteMultipartUpload
                        {
                            DaysAfterInitiation = 3,
                        },
                    },
                ],
            },
        }, ct);
    }

    // S3/MinIO's own multipart upload protocol - a different concept from
    // HTTP multipart/form-data - lets a large object be uploaded as
    // independently-retryable parts instead of one request for the whole
    // file. These four methods mirror Initiate/UploadPart/Complete/Abort.

    public async Task<(string? SessionId, string? Reason)> InitiateChunkedUploadAsync(
        string fileName, string mimeType, long totalSize, Guid uploaderId, CancellationToken ct)
    {
        if (totalSize <= 0)
            return (null, "empty_file");
        if (totalSize > MaxChunkedTotalBytes)
            return (null, "too_large");

        var storageKey = $"{uploaderId}/{Guid.NewGuid()}";

        var initiateResponse = await s3.InitiateMultipartUploadAsync(new InitiateMultipartUploadRequest
        {
            BucketName = Bucket,
            Key = storageKey,
            ContentType = mimeType,
        }, ct);

        var session = new MediaUploadSession
        {
            UploaderId = uploaderId,
            FileName = fileName,
            MimeType = mimeType,
            TotalSize = totalSize,
            StorageKey = storageKey,
            S3UploadId = initiateResponse.UploadId,
        };

        var sessionId = await uploadSessions.CreateAsync(session, ct);
        return (sessionId, null);
    }

    public async Task<(bool Success, string? Reason)> UploadChunkAsync(
        string sessionId, int partNumber, Stream content, long partSize, Guid callerId, CancellationToken ct)
    {
        var session = await uploadSessions.GetAsync(sessionId, ct);
        if (session is null)
            return (false, "not_found");
        if (session.UploaderId != callerId)
            return (false, "forbidden");

        var response = await s3.UploadPartAsync(new UploadPartRequest
        {
            BucketName = Bucket,
            Key = session.StorageKey,
            UploadId = session.S3UploadId,
            PartNumber = partNumber,
            InputStream = content,
            PartSize = partSize,
        }, ct);

        // Re-uploading a part that was already confirmed (a retry) replaces
        // it rather than duplicating it.
        session.Parts.RemoveAll(p => p.PartNumber == partNumber);
        session.Parts.Add(new UploadedPart { PartNumber = partNumber, ETag = response.ETag });
        await uploadSessions.UpdateAsync(sessionId, session, ct);

        return (true, null);
    }

    public async Task<(MediaUploadSession? Session, string? Reason)> GetChunkedUploadStatusAsync(
        string sessionId, Guid callerId, CancellationToken ct)
    {
        var session = await uploadSessions.GetAsync(sessionId, ct);
        if (session is null)
            return (null, "not_found");
        if (session.UploaderId != callerId)
            return (null, "forbidden");

        return (session, null);
    }

    public async Task<(MediaAsset? Asset, string? Reason)> CompleteChunkedUploadAsync(
        string sessionId, Guid callerId, CancellationToken ct)
    {
        var session = await uploadSessions.GetAsync(sessionId, ct);
        if (session is null)
            return (null, "not_found");
        if (session.UploaderId != callerId)
            return (null, "forbidden");
        if (session.Parts.Count == 0)
            return (null, "no_parts_uploaded");

        await s3.CompleteMultipartUploadAsync(new CompleteMultipartUploadRequest
        {
            BucketName = Bucket,
            Key = session.StorageKey,
            UploadId = session.S3UploadId,
            PartETags = session.Parts
                .OrderBy(p => p.PartNumber)
                .Select(p => new PartETag(p.PartNumber, p.ETag))
                .ToList(),
        }, ct);

        var asset = new MediaAsset
        {
            UploaderId = session.UploaderId,
            Kind = DeriveKind(session.MimeType),
            MimeType = session.MimeType,
            FileName = session.FileName,
            SizeBytes = session.TotalSize,
            StorageKey = session.StorageKey,
        };
        db.MediaAssets.Add(asset);
        await db.SaveChangesAsync(ct);

        await uploadSessions.DeleteAsync(sessionId, ct);

        return (asset, null);
    }

    public async Task<(bool Success, string? Reason)> AbortChunkedUploadAsync(
        string sessionId, Guid callerId, CancellationToken ct)
    {
        var session = await uploadSessions.GetAsync(sessionId, ct);
        if (session is null)
            return (false, "not_found");
        if (session.UploaderId != callerId)
            return (false, "forbidden");

        await s3.AbortMultipartUploadAsync(Bucket, session.StorageKey, session.S3UploadId, ct);
        await uploadSessions.DeleteAsync(sessionId, ct);

        return (true, null);
    }
}
