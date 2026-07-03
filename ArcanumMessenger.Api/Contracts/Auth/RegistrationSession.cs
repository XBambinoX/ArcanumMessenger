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

    // Argon2id over the client-derived authKey; the plain password never reaches the server
    public string? PasswordHash { get; set; }
    // Salt the client used to derive authKey from the password; needed again at login
    public string? KdfSalt { get; set; }

    // Argon2id over the client-side phrase hashes; plaintext phrases never reach the server
    public string? RecoveryPhrase1Hash { get; set; }
    public string? RecoveryPhrase2Hash { get; set; }
    public bool RecoveryConfirmed { get; set; }
}
