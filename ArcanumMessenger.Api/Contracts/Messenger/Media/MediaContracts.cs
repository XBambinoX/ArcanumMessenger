using ArcanumMessenger.Entities;

namespace ArcanumMessenger.Contracts.Messenger.Media;

public record MediaAssetDto(
    Guid Id,
    string Kind,
    string MimeType,
    string FileName,
    long SizeBytes,
    int? Width,
    int? Height,
    double? DurationSeconds,
    bool HasThumbnail)
{
    public static MediaAssetDto FromEntity(MediaAsset asset) => new(
        asset.Id, asset.Kind, asset.MimeType, asset.FileName, asset.SizeBytes,
        asset.Width, asset.Height, asset.DurationSeconds, asset.ThumbnailStorageKey is not null);
}

public record UploadMediaResponse(bool Success, MediaAssetDto? Media, string? Reason = null);

// SourceMediaId is what a client needs to recognize "this gif I'm looking
// at in a chat is already saved" without decrypting every saved copy just
// to compare bytes - see SavedGif.cs.
public record SavedGifDto(MediaAssetDto Media, Guid SourceMediaId);

public record SavedGifsResponse(bool Success, IReadOnlyList<SavedGifDto>? Gifs, string? Reason = null);

// NewMediaId is a fresh MediaAsset the client already uploaded, re-encrypted
// under its own Saved Messages chat key - saving can't just reference the
// original chat-scoped media the way it used to before media was encrypted
// per-chat.
public record SaveGifRequest(Guid NewMediaId);

public record SaveGifResponse(bool Success, string? Reason = null);

public record StartChunkedUploadRequest(
    string FileName, string MimeType, long TotalSize,
    int? Width = null, int? Height = null, double? DurationSeconds = null);

public record StartChunkedUploadResponse(bool Success, string? SessionId, string? Reason = null);

public record ChunkedUploadStatusResponse(
    bool Success, IReadOnlyList<int>? UploadedPartNumbers, long? TotalSize, string? Reason = null);

public record ChunkedUploadActionResponse(bool Success, string? Reason = null);
