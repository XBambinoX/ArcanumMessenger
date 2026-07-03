using System.Security.Cryptography;
using System.Text;

namespace ArcanumMessenger.Services;

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

    public string WrapDek(byte[] dek) => EncryptBytes(dek, _kek);

    public byte[] UnwrapDek(string wrappedDek) => DecryptBytes(wrappedDek, _kek);

    public string Encrypt(string plainText, byte[] dek) =>
        EncryptBytes(Encoding.UTF8.GetBytes(plainText), dek);

    public string Decrypt(string cipherText, byte[] dek) =>
        Encoding.UTF8.GetString(DecryptBytes(cipherText, dek));

    private static string EncryptBytes(byte[] plainBytes, byte[] key)
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

        return Convert.ToBase64String(result);
    }

    private static byte[] DecryptBytes(string cipherText, byte[] key)
    {
        var fullBytes = Convert.FromBase64String(cipherText);

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
