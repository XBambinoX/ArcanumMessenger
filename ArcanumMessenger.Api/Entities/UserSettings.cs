namespace ArcanumMessenger.Entities;

public class UserSettings
{
    public Guid UserId { get; set; }

    // Account
    public string UsernameEnc { get; set; } = null!;
    public string? BioEnc { get; set; }
    public string? PhoneEnc { get; set; }
    public string? EmailEnc { get; set; }

    // Notifications
    public bool NotificationsEnabled { get; set; } = true;
    public bool MessagePreviewEnabled { get; set; } = true;
    public bool GroupNotificationsEnabled { get; set; } = true;
    public string NotificationSound { get; set; } = "bubble";

    // Privacy
    public bool ShowLastSeen { get; set; } = true;
    public bool ShowOnlineStatus { get; set; } = true;
    public bool ReadReceiptsEnabled { get; set; } = true;
    public PhoneVisibility ShowPhoneNumber { get; set; } = PhoneVisibility.Contacts;
    public AddPermission WhoCanAddMe { get; set; } = AddPermission.Everyone;
    public bool TwoFactorEnabled { get; set; } = false;
    // Base32 TOTP secret, encrypted with this user's DEK (same pattern as
    // the other *Enc fields). Unlike PasswordHash, this must be reversible —
    // verifying a code means decrypting it back, not hashing and comparing.
    public string? TwoFactorSecretEnc { get; set; }

    // Chat appearance
    public string Theme { get; set; } = "system";
    public string Language { get; set; } = "en";
    public string Wallpaper { get; set; } = "default";
    public bool LinkPreviewsEnabled { get; set; } = true;
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

public enum Themes
{
    System,
    Dark,
    Light
}

public enum Notifications
{
    Bubble,
    Chime,
    Bell
}