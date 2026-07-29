namespace ArcanumMessenger.Entities;

public class Message
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public Guid SenderId { get; set; }
    public Guid? ReplyToId { get; set; }
    public string Type { get; set; } = "text";
    public string? Content { get; set; }
    public Guid? MediaId { get; set; }
    public bool IsEdited { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }

    // A snapshot, not a live join - the original sender may later leave, get
    // purged, or (once real E2E lands) have their display name re-keyed, and
    // "Forwarded from X" should keep showing what it said at forward time.
    public Guid? ForwardedFromSenderId { get; set; }
    public string? ForwardedFromSenderName { get; set; }

    public Chat Chat { get; set; } = null!;
    public User Sender { get; set; } = null!;
    public Message? ReplyTo { get; set; }
    public MediaAsset? Media { get; set; }
    public ICollection<MessageRead> Reads { get; set; } = [];
}
