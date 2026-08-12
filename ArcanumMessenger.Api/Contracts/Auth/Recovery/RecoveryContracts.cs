namespace ArcanumMessenger.Contracts.Auth.Recovery
{
    public record StartRecoveryResponse(bool Success, string? SessionId, string? Reason = null);

    public record VerifyRecoveryRequest(string SessionId, string Email, string PhraseAuth);
    public record VerifyRecoveryResponse(bool Success, string? Reason = null);

    // A password reset via recovery phrase can't know the old password, so it
    // can't recover the old encKey either - the account gets a brand-new E2EE
    // identity keypair here, wrapped with the new encKey. Every chat this user
    // is in keeps its symmetric key; only this user's wrapped copy of it goes
    // stale until another member's client re-seals it to the new public key.
    public record ResetPasswordRequest(
        string SessionId, string AuthKey, string KdfSalt,
        string EcdhPublicKey, string WrappedEcdhPrivateKey);
    public record ResetPasswordResponse(bool Success, string? Reason = null);
}