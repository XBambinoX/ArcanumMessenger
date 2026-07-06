using System.Security.Cryptography;
using System.Text;

namespace ArcanumMessenger.Services;

public class EmailHasher(IConfiguration config)
{
    private readonly byte[] _pepper = Convert.FromBase64String(
        config["Hashing:EmailPepper"]
            ?? throw new InvalidOperationException("Hashing:EmailPepper is not configured"));

    public string Hash(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = HMACSHA256.HashData(_pepper, bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <summary>
    /// Used to create a fake salt for case with email that
    /// does not exist to pass it through step 0 in the login flow
    /// </summary>
    public string GenerateFakeSalt(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var bytes = Encoding.UTF8.GetBytes("fake-kdf-salt:" + normalized);
        var hash = HMACSHA256.HashData(_pepper, bytes);
        return Convert.ToBase64String(hash[..16]);
    }
}
