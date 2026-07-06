namespace ArcanumMessenger.Contracts.Auth.Login
{
    public record StartLoginRequest(string? Email);
    public record StartLoginResponse(bool Success, string? SessionId, string? KdfSalt, string? Reason);

    public record SubmitLoginPasswordRequest(string? SessionId, string? AuthKey);
    public record SubmitLoginPasswordResponse(bool Success, bool RequiresTotp, string? Reason);

    public record SubmitLoginTotpRequest(string? SessionId, string? Code);
    public record SubmitLoginTotpResponse(bool Success, string? Reason);
}
