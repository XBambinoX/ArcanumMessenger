namespace ArcanumMessenger.Entities;

public class SavedGif
{
    public Guid UserId { get; set; }
    public Guid MediaId { get; set; }
    public DateTime SavedAt { get; set; }

    public User User { get; set; } = null!;
    public MediaAsset Media { get; set; } = null!;
}
