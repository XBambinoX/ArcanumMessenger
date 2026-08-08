using System.Security.Cryptography;
using System.Text;

namespace ArcanumMessenger.Services.AuthServices;

/// <summary>
/// Envelope encryption: one random DEK per user encrypts that user's profile
/// fields (username, email, bio, phone). The DEK itself is encrypted
/// ("wrapped") with a single master KEK and stored in the DB only in that
/// wrapped form — the KEK never enters the DB. A stolen DB dump alone
/// exposes only ciphertext + wrapped keys, not plaintext.
/// </summary>
public class EncryptionService(IConfiguration config)
{
    private const int KeySize = 32;   // 256-bit keys (KEK, DEK)
    private const int NonceSize = 12; // 96 bits, required size for GCM
    private const int TagSize = 16;   // 128 bits, authentication tag

    private readonly byte[] _kek = Convert.FromBase64String(
        config["Encryption:Kek"]
            ?? throw new InvalidOperationException("Encryption:Kek is not configured"));

    public byte[] GenerateDek() => RandomNumberGenerator.GetBytes(KeySize);

    public string WrapDek(byte[] dek) => Convert.ToBase64String(EncryptBytes(dek, _kek));

    public byte[] UnwrapDek(string wrappedDek) => DecryptBytes(Convert.FromBase64String(wrappedDek), _kek);

    public string Encrypt(string plainText, byte[] dek) =>
        Convert.ToBase64String(EncryptBytes(Encoding.UTF8.GetBytes(plainText), dek));

    public string Decrypt(string cipherText, byte[] dek) =>
        Encoding.UTF8.GetString(DecryptBytes(Convert.FromBase64String(cipherText), dek));

    // Raw (non-base64) variants for binary blobs going straight into object
    // storage (e.g. avatars) rather than a text DB column - same
    // nonce||tag||ciphertext layout, just without the base64 wrapping the
    // string-based Encrypt/Decrypt above add for text columns.
    public static byte[] EncryptBytes(byte[] plainBytes, byte[] key)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using (var aesGcm = new AesGcm(key, TagSize))
        {
            aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);
        }

        var result = new byte[nonce.Length + tag.Length + cipherBytes.Length];
        nonce.CopyTo(result, 0);
        tag.CopyTo(result, nonce.Length);
        cipherBytes.CopyTo(result, nonce.Length + tag.Length);

        return result;
    }

    public static byte[] DecryptBytes(byte[] fullBytes, byte[] key)
    {
        var nonce = fullBytes[..NonceSize];
        var tag = fullBytes[NonceSize..(NonceSize + TagSize)];
        var cipherBytes = fullBytes[(NonceSize + TagSize)..];

        var plainBytes = new byte[cipherBytes.Length];

        using (var aesGcm = new AesGcm(key, TagSize))
        {
            aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);
        }

        return plainBytes;
    }
}
