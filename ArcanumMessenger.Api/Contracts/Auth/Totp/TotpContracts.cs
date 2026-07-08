namespace ArcanumMessenger.Contracts.Auth.Totp
{
    // Stopgap: UserId is sent by the client because there is no auth/session
    // cookie yet. Once that lands, drop UserId from this request and read
    // the current user from the session instead.
    public record StartTotpSetupRequest(Guid UserId);
    public record StartTotpSetupResponse(bool Success, string? SessionId, string? Secret, string? OtpauthUri, string? Reason);

    public record ConfirmTotpSetupRequest(string? SessionId, string? Code);
    public record ConfirmTotpSetupResponse(bool Success, string? Reason);
}
