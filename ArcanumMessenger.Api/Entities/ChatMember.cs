namespace ArcanumMessenger.Entities;

public class ChatMember
{
    public Guid ChatId { get; set; }
    public Guid UserId { get; set; }
    public string Role { get; set; } = "member";
    public DateTime JoinedAt { get; set; }
    public DateTime LastReadAt { get; set; }
    public bool IsMuted { get; set; }
    public DateTime? MutedUntil { get; set; }
    public bool IsArchived { get; set; }

    public Chat Chat { get; set; } = null!;
    public User User { get; set; } = null!;
}
