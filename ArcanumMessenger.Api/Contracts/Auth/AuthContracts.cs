namespace ArcanumMessenger.Contracts.Auth
{
    public record CheckUsernameResponse(bool Available, string? Reason = null);

    public record StartRegistrationRequest(string Username);
    public record StartRegistrationResponse(bool Success,string? SessionId, string? Reason = null);

    public record SubmitEmailRequest(string SessionId, string Email, bool EmailVisibilityConsent);
    public record SubmitEmailResponse(bool Success, string? Reason = null);

    public record VerifyCodeRequest(string SessionId, string Code);
    public record VerifyCodeResponse(bool Success, string? Reason = null);
}