namespace ArcanumMessenger.Contracts.Auth.Totp
{
    public record StartTotpSetupResponse(bool Success, string? SessionId, string? Secret, string? OtpauthUri, string? Reason);
    public record ConfirmTotpSetupRequest(string? SessionId, string? Code);
    public record ConfirmTotpSetupResponse(bool Success, string? Reason);
}
