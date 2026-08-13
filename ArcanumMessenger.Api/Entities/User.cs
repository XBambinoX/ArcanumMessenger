namespace ArcanumMessenger.Entities;

public class User
{
    public Guid Id { get; set; }
    public string PublicIdEnc { get; set; } = null!;
    // Deterministic HMACs of PublicIdEnc's plaintext (see PublicIdHasher) -
    // PublicIdEnc can't be searched directly, i ts encryption key is
    // different for every user. IdHash is the full id, for exact-match
    // lookup; IdPrefixHash is just the first group, to narrow candidates
    // down before decrypting anyone when only part of the id is known.
    public string PublicIdHash { get; set; } = null!;
    public string PublicIdPrefixHash { get; set; } = null!;
    public string EmailHash { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string KdfSalt { get; set; } = null!;
    public string RecoveryPhrase1Hash { get; set; } = null!;
    public string RecoveryPhrase2Hash { get; set; } = null!;
    // DEK for this user, wrapped (encrypted) with the master KEK. Unwrap with
    // EncryptionService.UnwrapDek() before decrypting any *Enc field below.
    public string WrappedDek { get; set; } = null!;
    // ECDH (P-256) identity keypair for E2EE. PublicKey is plaintext - it's
    // not sensitive, and other users need it to seal chat keys to this
    // account. WrappedPrivateKey is encrypted client-side with this user's
    // own encKey (derived from their password) - the server only ever
    // stores that ciphertext and can never unwrap it. Null for accounts
    // created before this feature shipped, until they next log in.
    public string? EcdhPublicKey { get; set; }
    public string? WrappedEcdhPrivateKey { get; set; }
    public DateTime? LastSeen { get; set; }
    public bool IsDeleted { get; set; }
    // When IsDeleted was set - drives AccountCleanupService's grace period
    // before this account actually gets anonymized.
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public UserSettings UserSettings { get; set; } = null!;
}
