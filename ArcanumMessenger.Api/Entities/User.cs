namespace ArcanumMessenger.Entities;

public class User
{
    public Guid Id { get; set; }
    public string UsernameEnc { get; set; } = null!;
    public string EmailHash { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string KdfSalt { get; set; } = null!;
    public string RecoveryPhrase1Hash { get; set; } = null!;
    public string RecoveryPhrase2Hash { get; set; } = null!;
    // DEK for this user, wrapped (encrypted) with the master KEK. Unwrap with
    // EncryptionService.UnwrapDek() before decrypting any *Enc field below.
    public string WrappedDek { get; set; } = null!;
    public string? PublicEmailEnc { get; set; }
    public string? PublicPhoneEnc { get; set; }
    public string? PublicBioEnc { get; set; }
    public DateTime? LastSeen { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
}
