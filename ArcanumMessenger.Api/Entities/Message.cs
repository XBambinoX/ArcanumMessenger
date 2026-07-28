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

    public Chat Chat { get; set; } = null!;
    public User Sender { get; set; } = null!;
    public Message? ReplyTo { get; set; }
    public MediaAsset? Media { get; set; }
    public ICollection<MessageRead> Reads { get; set; } = [];
}
