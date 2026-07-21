namespace ArcanumMessenger.Contracts.Messenger.Settings;

public record UserSettingsResponse(
    string Username,
    string Bio,
    string Phone
);