namespace ArcanumMessenger.Entities;

public class MediaAsset
{
    public Guid Id { get; set; }
    public Guid UploaderId { get; set; }
    // "image" | "video" | "gif" | "audio" | "file" - same free-form string
    // convention as Chat.Type / ChatMember.Role, not a real enum.
    public string Kind { get; set; } = null!;
    public string MimeType { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = null!;
    public string? ThumbnailStorageKey { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public double? DurationSeconds { get; set; }
    public DateTime CreatedAt { get; set; }

    public User Uploader { get; set; } = null!;
}
