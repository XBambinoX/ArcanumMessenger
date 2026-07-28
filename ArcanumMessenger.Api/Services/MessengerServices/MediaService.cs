using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace ArcanumMessenger.Services.MessengerServices;

public record MediaByteRange(long Start, long? End);

public record MediaStream(Stream Content, string ContentType, long TotalLength, MediaByteRange? ServedRange);

public class MediaService(AppDbContext db, IAmazonS3 s3, IConfiguration config)
{
    private const long MaxImageOrGifBytes = 25L * 1024 * 1024;
    private const long MaxOtherBytes = 200L * 1024 * 1024;
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
}
