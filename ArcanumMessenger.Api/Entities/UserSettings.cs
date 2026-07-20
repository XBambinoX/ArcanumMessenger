namespace ArcanumMessenger.Entities;

public class UserSettings
{
    public Guid UserId { get; set; }

    public string? BioEnc { get; set; }
    public string? PhoneEnc { get; set; }
    public bool NotificationsEnabled { get; set; } = true;
    public bool ShowLastSeen { get; set; } = true;
    public bool ShowOnlineStatus { get; set; } = true;
    public string Theme { get; set; } = "system";
    public string Language { get; set; } = "uk";
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
