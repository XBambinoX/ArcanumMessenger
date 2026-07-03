namespace ArcanumMessenger.Contracts.Auth
{
    public record CheckUsernameResponse(bool Available, string? Reason = null);

    public record StartRegistrationRequest(string Username);
    public record StartRegistrationResponse(bool Success, string? SessionId, string? Reason = null);

    public record SubmitEmailRequest(string SessionId, string Email, bool EmailVisibilityConsent);
    public record SubmitEmailResponse(bool Success, string? Reason = null);

    public record VerifyCodeRequest(string SessionId, string Code);
    public record VerifyCodeResponse(bool Success, string? Reason = null);

    public record ResendCodeRequest(string SessionId);
    public record ResendCodeResponse(bool Success, string? Reason = null);

    // AuthKey is derived from the password on the client (Argon2id + HKDF).
    // The server never sees the plain password.
    public record SubmitPasswordRequest(string SessionId, string AuthKey, string KdfSalt);
    public record SubmitPasswordResponse(bool Success, string? Reason = null);

    // Phrase auths are SHA-256 hashes of the recovery phrases.
    // The phrases themselves are generated on the client and never sent.
    public record ConfirmRecoveryRequest(string SessionId, string Phrase1Auth, string Phrase2Auth);
    public record ConfirmRecoveryResponse(bool Success, string? Reason = null);

    public record FinalizeRegistrationRequest(string SessionId);
    public record FinalizeRegistrationResponse(bool Success, string? Reason = null);
}