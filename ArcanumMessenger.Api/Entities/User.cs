namespace ArcanumMessenger.Entities;

public class User
{
    public Guid Id { get; set; }
    public string PublicIdEnc { get; set; } = null!;
    // Deterministic HMACs of PublicIdEnc's plaintext (see PublicIdHasher) -
    // PublicIdEnc can't be searched directly, its encryption key is
    // different for every user. IdHash is the full id, for exact-match
    // lookup; IdPrefixHash is just the first group, to narrow candidates
    // down before decrypting anyone when only part of the id is known.
    public string PublicIdHash { get; set; } = null!;
    public string PublicIdPrefixHash { get; set; } = null!;
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
    public bool TwoFactorEnabled { get; set; }
    // Base32 TOTP secret, encrypted with this user's DEK (same pattern as
    // the other *Enc fields). Unlike PasswordHash, this must be reversible —
    // verifying a code means decrypting it back, not hashing and comparing.
    public string? TwoFactorSecretEnc { get; set; }
    public DateTime? LastSeen { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
}
