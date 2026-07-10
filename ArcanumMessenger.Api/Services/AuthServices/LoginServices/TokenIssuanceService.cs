using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;

namespace ArcanumMessenger.Services.AuthServices.LoginServices;

public class TokenIssuanceService(AppDbContext db, JwtService jwtService)
{
    private const int SessionDurationHours = 24;

    public async Task<(string AccessToken, string RefreshToken)> IssueAsync(
        Guid userId,
        string? deviceName,
        string? deviceType,
        string? ipAddress,
        CancellationToken ct)
    {
        var accessToken = jwtService.GenerateAccessToken(userId);
        var refreshToken = RefreshTokenHasher.Generate();

        var now = DateTime.UtcNow;

        db.Sessions.Add(new Session
        {
            UserId = userId,
            RefreshTokenHash = RefreshTokenHasher.Hash(refreshToken),
            DeviceName = deviceName,
            DeviceType = deviceType,
            IpAddress = ipAddress,
            CreatedAt = now,
            ExpiresAt = now.AddHours(SessionDurationHours),
            LastUsedAt = now
        });

        await db.SaveChangesAsync(ct);

        return (accessToken, refreshToken);
    }
}