using System.Security.Cryptography;
using System.Text;

namespace ArcanumMessenger.Services.AuthServices.LoginServices;

public static class RefreshTokenHasher
{
    public static string Generate() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
}