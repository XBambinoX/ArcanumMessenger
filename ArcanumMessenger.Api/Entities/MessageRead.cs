namespace ArcanumMessenger.Entities;

public class MessageRead
{
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public DateTime ReadAt { get; set; }

    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
