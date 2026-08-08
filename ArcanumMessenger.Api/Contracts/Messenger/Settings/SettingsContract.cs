namespace ArcanumMessenger.Contracts.Messenger.Settings;

public record UserSettingsResponse(
    string Username,
    string Bio,
    string Phone,
    string Email,
    bool NotificationsEnabled,
    bool GroupNotifications,
    string NotificationSound,
    bool TotpEnabled,
    bool ShowLastSeen,
    bool ShowOnlineStatus,
    bool ReadReceiptsEnabled,
    string ShowPhoneNumber,   // "everyone" | "contacts" | "nobody"
    string ShowBio,           // "everyone" | "contacts" | "nobody"
    string ShowAvatar,        // "everyone" | "contacts" | "nobody"
    string ShowEmail,         // "everyone" | "contacts" | "nobody"
    string WhoCanAddMe,       // "everyone" | "contacts"
    string Theme,
    string Language,
    string Wallpaper,
    bool LinkPreviewsEnabled,
    bool AutoDownloadMedia
);

public record UpdateAccountFieldsRequest(
    string? Username,
    string? Bio,
    string? Phone,
    string? Email);

public record DeleteAccountRequest(string AuthKey);

public record KdfSaltResponse(string KdfSalt);

public record UpdateNotificationSettingsRequest(
    bool? NotificationsEnabled,
    bool? GroupNotifications,
    string? NotificationSound
);

public record UpdatePrivacySettingsRequest(
    bool? ShowLastSeen,
    bool? ShowOnlineStatus,
    bool? ReadReceiptsEnabled,
    string? ShowPhoneNumber,
    string? ShowBio,
    string? ShowAvatar,
    string? ShowEmail,
    string? WhoCanAddMe,
    bool? TotpEnabled
);

public record UpdateChatSettingsRequest(
    string? Theme,
    string? Language,
    string? Wallpaper,
    bool? LinkPreviewsEnabled,
    bool? AutoDownloadMedia
);