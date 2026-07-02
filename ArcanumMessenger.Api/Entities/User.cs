namespace ArcanumMessenger.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string EmailHash { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string RecoveryPhrase1Hash { get; set; } = null!;
    public string RecoveryPhrase2Hash { get; set; } = null!;
    public string? PublicEmailEnc { get; set; }
    public string? PublicPhoneEnc { get; set; }
    public string? Bio { get; set; }
    public DateTime? LastSeen { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
}
