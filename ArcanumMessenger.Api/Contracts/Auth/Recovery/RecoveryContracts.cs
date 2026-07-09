namespace ArcanumMessenger.Contracts.Auth.Recovery
{
    public record StartRecoveryRequest(string Email);
    public record StartRecoveryResponse(bool Success, string? SessionId, string? Reason = null);

    public record VerifyRecoveryRequest(string SessionId, string Email, string PhraseAuth);
    public record VerifyRecoveryResponse(bool Success, string? Reason = null);

    public record ResetPasswordRequest(string SessionId, string AuthKey, string KdfSalt);
    public record ResetPasswordResponse(bool Success, string? Reason = null);            
}