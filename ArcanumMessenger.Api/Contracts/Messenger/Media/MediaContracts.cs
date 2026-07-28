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
    bool HasThumbnail);

public record UploadMediaResponse(bool Success, MediaAssetDto? Media, string? Reason = null);

public record SavedGifsResponse(bool Success, IReadOnlyList<MediaAssetDto>? Gifs, string? Reason = null);

public record SaveGifResponse(bool Success, string? Reason = null);
