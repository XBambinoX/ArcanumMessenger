namespace ArcanumMessenger.Entities;

public class Chat
{
    public Guid Id { get; set; }
    public string Type { get; set; } = null!;
    public string? Title { get; set; }
    public string? Description { get; set; }
    public Guid CreatedBy { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }

    public User Creator { get; set; } = null!;
    public ICollection<ChatMember> Members { get; set; } = [];
    public ICollection<Message> Messages { get; set; } = [];
}
