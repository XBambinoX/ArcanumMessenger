using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using ArcanumMessenger.Services.AuthServices;
using SkiaSharp;

namespace ArcanumMessenger.Services.MessengerServices;

public record AvatarStream(Stream Content, string ContentType, long Length);

// Unlike chat media, an avatar has no DB row at all - there's only ever one
// "current" avatar per owner, so a deterministic key that gets overwritten
// on every change is enough. Whether an owner has an avatar becomes a plain
// existence check against MinIO instead of something that needs its own
// column/migration to track. Users and group chats share this same scheme -
// only the key prefix differs, so one implementation covers both.
//
// User avatars are encrypted at rest with that user's own DEK (dek passed in
// by the caller, which already has it unwrapped from WrappedDek) - same
// server-decryptable model as username/bio, not the chat-key E2E model.
// Chat avatars have no DEK to use (chats don't have one) and stay
// unencrypted for now - dek is null on that path.
public class AvatarService(IAmazonS3 s3, IConfiguration config)
{
    private const long MaxUploadBytes = 10L * 1024 * 1024;
    private const int MaxEdge = 1024;
    private const int JpegQuality = 92;

    private string Bucket => config["Media:Bucket"]!;

    public Task<(bool Success, string? Reason)> UploadAvatarAsync(
        Guid userId, Stream content, long length, string mimeType, byte[] dek, CancellationToken ct) =>
        UploadAsync($"avatars/{userId}", content, length, mimeType, dek, ct);

    public Task DeleteAvatarAsync(Guid userId, CancellationToken ct) =>
        DeleteAsync($"avatars/{userId}", ct);

    public Task<AvatarStream?> OpenAvatarStreamAsync(Guid userId, byte[] dek, CancellationToken ct) =>
        OpenStreamAsync($"avatars/{userId}", dek, ct);

    public Task<(bool Success, string? Reason)> UploadChatAvatarAsync(
        Guid chatId, Stream content, long length, string mimeType, CancellationToken ct) =>
        UploadAsync($"chat-avatars/{chatId}", content, length, mimeType, dek: null, ct);

    public Task DeleteChatAvatarAsync(Guid chatId, CancellationToken ct) =>
        DeleteAsync($"chat-avatars/{chatId}", ct);

    public Task<AvatarStream?> OpenChatAvatarStreamAsync(Guid chatId, CancellationToken ct) =>
        OpenStreamAsync($"chat-avatars/{chatId}", dek: null, ct);

    private async Task<(bool Success, string? Reason)> UploadAsync(
        string key, Stream content, long length, string mimeType, byte[]? dek, CancellationToken ct)
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
        using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, JpegQuality);

        using var jpegStream = new MemoryStream();
        encoded.SaveTo(jpegStream);
        var jpegBytes = jpegStream.ToArray();

        var uploadBytes = dek is null ? jpegBytes : EncryptionService.EncryptBytes(jpegBytes, dek);

        using var uploadStream = new MemoryStream(uploadBytes);
        await s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = Bucket,
            Key = key,
            InputStream = uploadStream,
            ContentType = "image/jpeg",
        }, ct);

        return (true, null);
    }

    private async Task DeleteAsync(string key, CancellationToken ct)
    {
        await s3.DeleteObjectAsync(Bucket, key, ct);
    }

    private async Task<AvatarStream?> OpenStreamAsync(string key, byte[]? dek, CancellationToken ct)
    {
        try
        {
            var response = await s3.GetObjectAsync(new GetObjectRequest
            {
                BucketName = Bucket,
                Key = key,
            }, ct);

            if (dek is null)
                return new AvatarStream(response.ResponseStream, "image/jpeg", response.ContentLength);

            using var buffer = new MemoryStream();
            await response.ResponseStream.CopyToAsync(buffer, ct);
            var plainBytes = EncryptionService.DecryptBytes(buffer.ToArray(), dek);

            return new AvatarStream(new MemoryStream(plainBytes), "image/jpeg", plainBytes.Length);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
