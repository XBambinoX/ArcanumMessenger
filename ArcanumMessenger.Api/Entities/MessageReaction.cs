namespace ArcanumMessenger.Entities;

public class MessageReaction
{
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public string Emoji { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
