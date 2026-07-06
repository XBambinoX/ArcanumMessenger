using Konscious.Security.Cryptography;
using System.Security.Cryptography;
using System.Text;

namespace ArcanumMessenger.Services;

public static class PasswordHasher
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int DegreeOfParallelism = 4;
    private const int Iterations = 4;
    private const int MemorySizeKb = 65536; // 64 MB

    // A valid "salt.hash" string with no real account behind it - hashed from
    // "Password123" purely so it's obviously a placeholder to anyone reading
    // this file, not a leaked real hash (zxcvbn would reject this password on
    // the client anyway). Verify() against this when a user isn't found, so a
    // nonexistent account and a wrong password both pay the same Argon2id
    // cost - otherwise "no such user" returns fast while "wrong password"
    // takes ~0.5s, and that timing gap alone tells an attacker which emails
    // are registered.
    public const string DummyPasswordHash =
        "GYj8l/RzkrCTbyutGLX7mA==.jTutlWAl0e1GNmnwa/cqS1EK2aWj4vzuITdBfmUwStk=";

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = ComputeHash(password, salt);

        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 2) return false;

        var salt = Convert.FromBase64String(parts[0]);
        var expectedHash = Convert.FromBase64String(parts[1]);

        var actualHash = ComputeHash(password, salt);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    public static bool IsBase64OfLength(string? value, int expectedBytes)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        Span<byte> buffer = stackalloc byte[expectedBytes];
        return Convert.TryFromBase64String(value, buffer, out var written) && written == expectedBytes;
    }

    private static byte[] ComputeHash(string password, byte[] salt)
    {
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = DegreeOfParallelism,
            Iterations = Iterations,
            MemorySize = MemorySizeKb
        };

        return argon2.GetBytes(HashSize);
    }
}