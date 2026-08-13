using System.Security.Cryptography;
using System.Text;

namespace ArcanumMessenger.Services.AuthServices;

// PublicIdEnc is encrypted per-user (different key each time), so it can't
// be searched in the database directly - same problem EmailHash already
// solves for email. Hash gives an exact-match lookup; HashPrefix hashes
// just the first group ("XXXX" of "XXXX-XXXX-XXXX-XXXX") so a search can
// narrow candidates down before decrypting anyone, for when only part of
// the id is known.
public class PublicIdHasher(IConfiguration config)
{
    public const int FullLength = 16;
    public const int PrefixLength = 4;

    private readonly byte[] _pepper = Convert.FromBase64String(
        config["Hashing:PublicIdPepper"]
            ?? throw new InvalidOperationException("Hashing:PublicIdPepper is not configured"));

    public static string Normalize(string publicId) =>
        publicId.Replace("-", "").Trim().ToLowerInvariant();

    public string Hash(string normalizedPublicId) => HashRaw(normalizedPublicId);

    public string HashPrefix(string normalizedPublicId)
    {
        var prefix = normalizedPublicId.Length <= PrefixLength
            ? normalizedPublicId
            : normalizedPublicId[..PrefixLength];
        return HashRaw(prefix);
    }

    private string HashRaw(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var hash = HMACSHA256.HashData(_pepper, bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
