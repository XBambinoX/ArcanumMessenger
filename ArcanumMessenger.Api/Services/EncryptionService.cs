using System.Security.Cryptography;
using System.Text;

namespace ArcanumMessenger.Services;

public class EncryptionService(IConfiguration config)
{
    private const int NonceSize = 12; // 96 bits, required size for GCM
    private const int TagSize = 16;   // 128 bits, authentication tag

    private readonly byte[] _key = Convert.FromBase64String(
        config["Encryption:EmailKey"]
            ?? throw new InvalidOperationException("Encryption:EmailKey is not configured"));

    public string Encrypt(string plainText)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using (var aesGcm = new AesGcm(_key, TagSize))
        {
            aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);
        }

        var result = new byte[nonce.Length + tag.Length + cipherBytes.Length];
        nonce.CopyTo(result, 0);
        tag.CopyTo(result, nonce.Length);
        cipherBytes.CopyTo(result, nonce.Length + tag.Length);

        return Convert.ToBase64String(result);
    }

    public string Decrypt(string cipherText)
    {
        var fullBytes = Convert.FromBase64String(cipherText);

        var nonce = fullBytes[..NonceSize];
        var tag = fullBytes[NonceSize..(NonceSize + TagSize)];
        var cipherBytes = fullBytes[(NonceSize + TagSize)..];

        var plainBytes = new byte[cipherBytes.Length];

        using (var aesGcm = new AesGcm(_key, TagSize))
        {
            aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);
        }

        return Encoding.UTF8.GetString(plainBytes);
    }
}
