namespace ArcanumMessenger.Contracts.Messenger.Settings;

public record UserSettingsResponse(
    string Username,
    string Bio,
    string Phone,
    bool NotificationsEnabled,
    bool GroupNotifications,
    string NotificationSound,
    bool TotpEnabled,
    bool ShowLastSeen,
    bool ShowOnlineStatus,
    bool ReadReceiptsEnabled,
    string ShowPhoneNumber,   // "everyone" | "contacts" | "nobody"
    string WhoCanAddMe,       // "everyone" | "contacts"
    string Theme,
    string Wallpaper,
    bool LinkPreviewsEnabled,
    bool AutoDownloadMedia
);

public record UpdateAccountFieldsRequest(
    string? Username, 
    string? Bio, 
    string? Phone);

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
    string? WhoCanAddMe,
    bool? TotpEnabled
);

public record UpdateChatSettingsRequest(
    string? Theme,
    string? Wallpaper,
    bool? LinkPreviewsEnabled,
    bool? AutoDownloadMedia
);