namespace ArcanumMessenger.Contracts.Messenger.Media;

public class MediaUploadSession
{
    public Guid UploaderId { get; set; }
    public string FileName { get; set; } = null!;
    public string MimeType { get; set; } = null!;
    public long TotalSize { get; set; }
    // Dimensions/duration are supplied by the client at session start - the
    // server never sees plaintext bytes for chat media anymore, so it can no
    // longer probe these itself (see MediaService.UploadAsync).
    public int? Width { get; set; }
    public int? Height { get; set; }
    public double? DurationSeconds { get; set; }
    public string StorageKey { get; set; } = null!;
    // The S3/MinIO multipart upload's own id - a different concept from this
    // session id, needed to address the in-progress upload on every part
    // request and again when completing it.
    public string S3UploadId { get; set; } = null!;
    public List<UploadedPart> Parts { get; set; } = [];
}

public class UploadedPart
{
    public int PartNumber { get; set; }
    public string ETag { get; set; } = null!;
}
