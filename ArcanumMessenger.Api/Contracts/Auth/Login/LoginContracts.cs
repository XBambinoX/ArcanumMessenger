namespace ArcanumMessenger.Contracts.Auth.Login
{
    public record StartLoginRequest(string? Email);
    public record StartLoginResponse(bool Success, string? SessionId, string? KdfSalt, string? Reason);

    public record SubmitLoginPasswordRequest(string? SessionId, string? AuthKey);
    public record SubmitLoginPasswordResponse(bool Success, bool RequiresTotp, string? Reason);

    public record SubmitLoginTotpRequest(string? SessionId, string? Code);
    public record SubmitLoginTotpResponse(bool Success, string? Reason);

    public record CompleteLoginRequest(string SessionId);
    // EcdhPublicKey/WrappedEcdhPrivateKey are null only for accounts created
    // before E2EE shipped - the client bootstraps a fresh keypair for those
    // via POST /api/users/me/identity-key right after this completes.
    public record CompleteLoginResponse(
        bool Success, string? Reason = null,
        string? EcdhPublicKey = null, string? WrappedEcdhPrivateKey = null);
}
