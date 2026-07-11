using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.AuthServices.LoginServices;

public class TokenIssuanceService(AppDbContext db, JwtService jwtService)
{
    public const int SessionDurationHours = 24;

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

    public async Task<(bool Success, string? AccessToken, string? RefreshToken, string? Reason)> RefreshAsync(
        string? refreshToken, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(refreshToken))
            return (false, null, null, "no_session");

        var tokenHash = RefreshTokenHasher.Hash(refreshToken);

        var session = await db.Sessions.FirstOrDefaultAsync(
            s => s.RefreshTokenHash == tokenHash && s.RevokedAt == null, ct);

        if (session is null || session.ExpiresAt < DateTime.UtcNow)
            return (false, null, null, "session_expired");

        session.RevokedAt = DateTime.UtcNow;

        var newRefreshToken = RefreshTokenHasher.Generate();
        var now = DateTime.UtcNow;

        db.Sessions.Add(new Session
        {
            UserId = session.UserId,
            RefreshTokenHash = RefreshTokenHasher.Hash(newRefreshToken),
            DeviceName = session.DeviceName,
            DeviceType = session.DeviceType,
            IpAddress = session.IpAddress,
            CreatedAt = now,
            ExpiresAt = now.AddHours(SessionDurationHours),
            LastUsedAt = now
        });

        var accessToken = jwtService.GenerateAccessToken(session.UserId);

        await db.SaveChangesAsync(ct);

        return (true, accessToken, newRefreshToken, null);
    }

    public async Task RevokeAsync(string? refreshToken, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(refreshToken))
            return;

        var tokenHash = RefreshTokenHasher.Hash(refreshToken);
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.RefreshTokenHash == tokenHash, ct);

        if (session is not null)
        {
            session.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }
}