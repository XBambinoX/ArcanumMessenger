namespace ArcanumMessenger.Contracts.Auth
{
    public record CheckUsernameResponse(bool Available, string? Reason = null);

    public record StartRegistrationRequest(string Username);
    public record StartRegistrationResponse(bool Success,string? SessionId, string? Reason = null);

    public record SubmitEmailRequest(string SessionId, string Email, bool EmailVisibilityConsent);
    public record SubmitEmailResponse(bool Success, string? Reason = null);

    public record VerifyCodeRequest(string SessionId, string Code);
    public record VerifyCodeResponse(bool Success, string? Reason = null);

    public record ResendCodeRequest(string SessionId);
    public record ResendCodeResponse(bool Success, string? Reason = null);

    public record SubmitPasswordRequest(string SessionId, string Password);
    public record SubmitPasswordResponse(bool Success, string? Reason = null);

    public record GenerateRecoveryResponse(bool Success, string? Phrase1, string? Phrase2, string? Reason = null);
    public record ConfirmRecoveryRequest(string SessionId);
    public record ConfirmRecoveryResponse(bool Success, string? Reason = null);

    public record FinalizeRegistrationRequest(string SessionId);
    public record FinalizeRegistrationResponse(bool Success, string? Reason = null);
}