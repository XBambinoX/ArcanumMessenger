namespace ArcanumMessenger.Entities;

public class UserSettings
{
    public Guid UserId { get; set; }

    // Account
    public string UsernameEnc { get; set; } = null!;
    public string? BioEnc { get; set; }
    public string? PhoneEnc { get; set; }

    // Notifications
    public bool NotificationsEnabled { get; set; } = true;
    public bool MessagePreviewEnabled { get; set; } = true;
    public bool GroupNotificationsEnabled { get; set; } = true;
    public string NotificationSound { get; set; } = "default";

    // Privacy
    public bool ShowLastSeen { get; set; } = true;
    public bool ShowOnlineStatus { get; set; } = true;
    public bool ReadReceiptsEnabled { get; set; } = true;
    public PhoneVisibility ShowPhoneNumber { get; set; } = PhoneVisibility.Contacts;
    public AddPermission WhoCanAddMe { get; set; } = AddPermission.Everyone;

    // Chat appearance
    public string Theme { get; set; } = "system";
    public string Language { get; set; } = "en";
    public string Wallpaper { get; set; } = "default";
    public int FontSize { get; set; } = 15;
    public bool AutoDownloadMedia { get; set; } = true;

    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}

public enum PhoneVisibility
{
    Everyone,
    Contacts,
    Nobody
}

public enum AddPermission
{
    Everyone,
    Contacts
}