namespace ArcanumMessenger.Contracts.Auth.Register
{
    public record StartRegistrationRequest(string Username);
    public record StartRegistrationResponse(bool Success, string? SessionId, string? Reason = null);

    public record SubmitEmailRequest(string SessionId, string Email, bool EmailVisibilityConsent);
    public record SubmitEmailResponse(bool Success, string? Reason = null);

    public record VerifyCodeRequest(string SessionId, string Code);
    public record VerifyCodeResponse(bool Success, string? Reason = null);

    public record ResendCodeRequest(string SessionId);
    public record ResendCodeResponse(bool Success, string? Reason = null);

    // AuthKey is derived from the password on the client (Argon2id + HKDF).
    // The server never sees the plain password. EcdhPublicKey/WrappedEcdhPrivateKey
    // are this account's E2EE identity keypair, generated client-side in the same
    // step - the private key is wrapped with encKey (from the same derivation),
    // so the server only ever stores ciphertext it can't unwrap.
    public record SubmitPasswordRequest(
        string SessionId, string AuthKey, string KdfSalt,
        string EcdhPublicKey, string WrappedEcdhPrivateKey);
    public record SubmitPasswordResponse(bool Success, string? Reason = null);

    // Phrase auths are SHA-256 hashes of the recovery phrases.
    // The phrases themselves are generated on the client and never sent.
    public record ConfirmRecoveryRequest(string SessionId, string Phrase1Auth, string Phrase2Auth);
    public record ConfirmRecoveryResponse(bool Success, string? Reason = null);

    public record FinalizeRegistrationRequest(string SessionId, string? Language = null, string? Theme = null);
    public record FinalizeRegistrationResponse(
        bool Success, string? Reason = null,
        string? EcdhPublicKey = null, string? WrappedEcdhPrivateKey = null);
}