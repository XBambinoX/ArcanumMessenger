namespace ArcanumMessenger.Contracts.Auth;

public class RegistrationSession
{
    public string Username { get; set; } = null!;
    public string? EmailHash { get; set; }
    public string? PublicEmailEnc { get; set; }
    public bool EmailVisibilityConsent { get; set; }
    public bool EmailVerified { get; set; }
    public int Step { get; set; }
    public DateTime CreatedAt { get; set; }

    public string? VerificationCode { get; set; }
    public DateTime? CodeExpiresAt { get; set; }
    public int CodeAttempts { get; set; }
    public string? PlainEmail { get; set; }
}