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
}
