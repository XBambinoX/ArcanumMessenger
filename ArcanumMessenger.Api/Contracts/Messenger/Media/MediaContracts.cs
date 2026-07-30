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

public record SavedGifsResponse(bool Success, IReadOnlyList<MediaAssetDto>? Gifs, string? Reason = null);

public record SaveGifResponse(bool Success, string? Reason = null);

public record StartChunkedUploadRequest(string FileName, string MimeType, long TotalSize);

public record StartChunkedUploadResponse(bool Success, string? SessionId, string? Reason = null);

public record ChunkedUploadStatusResponse(
    bool Success, IReadOnlyList<int>? UploadedPartNumbers, long? TotalSize, string? Reason = null);

public record ChunkedUploadActionResponse(bool Success, string? Reason = null);
