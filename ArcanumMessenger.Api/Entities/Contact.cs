namespace ArcanumMessenger.Entities;

public class Contact
{
    public Guid UserId { get; set; }
    public Guid ContactId { get; set; }
    public string? Nickname { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public User ContactUser { get; set; } = null!;
}
