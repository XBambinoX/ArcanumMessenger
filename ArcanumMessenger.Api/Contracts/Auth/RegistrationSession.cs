namespace ArcanumMessenger.Contracts.Auth;

public class RegistrationSession
{
    public string Username { get; set; } = null!;
    public bool EmailVisibilityConsent { get; set; }
    public bool EmailVerified { get; set; }
    public int Step { get; set; }
    public DateTime CreatedAt { get; set; }

    public string? VerificationCode { get; set; }
    public DateTime? CodeExpiresAt { get; set; }
    public int CodeAttempts { get; set; }
    public string? PlainEmail { get; set; }

    public int ResendCount { get; set; }
    public DateTime? LastCodeSentAt { get; set; }                  

    public string? PasswordHash { get; set; }

    public string? RecoveryPhrase1 { get; set; }
    public string? RecoveryPhrase2 { get; set; }
    public bool RecoveryConfirmed { get; set; }
}