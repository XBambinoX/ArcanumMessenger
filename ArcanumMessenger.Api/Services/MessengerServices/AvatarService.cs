using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using SkiaSharp;

namespace ArcanumMessenger.Services.MessengerServices;

public record AvatarStream(Stream Content, string ContentType, long Length);

// Unlike chat media, an avatar has no DB row at all - there's only ever one
// "current" avatar per user, so a deterministic key (avatars/{userId}) that
// gets overwritten on every change is enough. Whether a user has an avatar
// becomes a plain existence check against MinIO instead of something that
// needs its own column/migration to track.
public class AvatarService(IAmazonS3 s3, IConfiguration config)
{
    private const long MaxUploadBytes = 10L * 1024 * 1024;
    private const int MaxEdge = 512;

    private string Bucket => config["Media:Bucket"]!;

    private static string KeyFor(Guid userId) => $"avatars/{userId}";

    public async Task<(bool Success, string? Reason)> UploadAvatarAsync(
        Guid userId, Stream content, long length, string mimeType, CancellationToken ct)
    {
        if (length <= 0)
            return (false, "empty_file");
        if (length > MaxUploadBytes)
            return (false, "too_large");
        if (!mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return (false, "invalid_image");

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        using var original = SKBitmap.Decode(bytes);
        if (original is null)
            return (false, "invalid_image");

        var scale = Math.Min(1.0, (double)MaxEdge / Math.Max(original.Width, original.Height));
        var targetWidth = Math.Max(1, (int)Math.Round(original.Width * scale));
        var targetHeight = Math.Max(1, (int)Math.Round(original.Height * scale));

        using var resized = scale < 1.0
            ? original.Resize(new SKImageInfo(targetWidth, targetHeight), SKSamplingOptions.Default)
            : null;
        using var image = SKImage.FromBitmap(resized ?? original);
        using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, 85);

        using var uploadStream = new MemoryStream();
        encoded.SaveTo(uploadStream);
        uploadStream.Position = 0;

        await s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = Bucket,
            Key = KeyFor(userId),
            InputStream = uploadStream,
            ContentType = "image/jpeg",
        }, ct);

        return (true, null);
    }

    public async Task DeleteAvatarAsync(Guid userId, CancellationToken ct)
    {
        await s3.DeleteObjectAsync(Bucket, KeyFor(userId), ct);
    }

    public async Task<AvatarStream?> OpenAvatarStreamAsync(Guid userId, CancellationToken ct)
    {
        try
        {
            var response = await s3.GetObjectAsync(new GetObjectRequest
            {
                BucketName = Bucket,
                Key = KeyFor(userId),
            }, ct);

            return new AvatarStream(response.ResponseStream, "image/jpeg", response.ContentLength);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
