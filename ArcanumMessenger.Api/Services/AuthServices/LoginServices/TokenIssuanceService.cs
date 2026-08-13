using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.AuthServices.LoginServices;

public class TokenIssuanceService(AppDbContext db, JwtService jwtService)
{
    public const int SessionDurationHours = 24;
    // A refresh token is single-use - redeeming it revokes it and issues
    // a new one. Two legitimate near-simultaneous refresh calls (e.g. a
    // proactive keepalive timer and a reactive 401 retry, both firing
    // right as a long-backgrounded mobile tab wakes up) race to redeem
    // the SAME cookie; the loser would otherwise get a hard failure and
    // have its cookies wiped, even though the winner's request was
    // completely legitimate. Within this window, a token that was *just*
    // rotated out gets resolved against whatever replaced it instead of
    // failing outright - same reuse-grace-period pattern used by
    // Auth0/Okta-style refresh rotation. A genuinely stolen/replayed old
    // token was already a full compromise regardless of this window, so
    // it doesn't weaken anything real.
    private const int RefreshRaceGraceSeconds = 10;

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

        // Not the normal case - only reached when this exact token was
        // already redeemed by a near-simultaneous request. Recover it via
        // the grace window instead of failing outright (see the constant's
        // own comment above).
        session ??= await ResolveRacingPredecessorAsync(tokenHash, ct);

        if (session is null || session.ExpiresAt < DateTime.UtcNow)
            return (false, null, null, "session_expired");

        return await RotateAsync(session, ct);
    }

    // Walks a just-revoked session's ReplacedBySessionId chain to whichever
    // session at the tip is still live. Only ever finds anything within
    // RefreshRaceGraceSeconds of the revoke - past that, a presented token
    // is treated as genuinely dead, same as before this existed.
    private async Task<Session?> ResolveRacingPredecessorAsync(string tokenHash, CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddSeconds(-RefreshRaceGraceSeconds);
        var revoked = await db.Sessions.FirstOrDefaultAsync(
            s => s.RefreshTokenHash == tokenHash && s.RevokedAt != null && s.RevokedAt > cutoff, ct);
        if (revoked is null)
            return null;

        var current = revoked;
        while (current.ReplacedBySessionId is { } nextId)
        {
            var next = await db.Sessions.FindAsync([nextId], ct);
            if (next is null || next.RevokedAt is not null)
                break;
            current = next;
        }

        return current.Id == revoked.Id ? null : current;
    }

    private async Task<(bool Success, string? AccessToken, string? RefreshToken, string? Reason)> RotateAsync(
        Session session, CancellationToken ct)
    {
        var newRefreshToken = RefreshTokenHasher.Generate();
        var now = DateTime.UtcNow;

        var newSession = new Session
        {
            // Generated here, not left to the DB default, so it can be
            // linked from the old row's ReplacedBySessionId in this same
            // SaveChangesAsync.
            Id = Guid.NewGuid(),
            UserId = session.UserId,
            RefreshTokenHash = RefreshTokenHasher.Hash(newRefreshToken),
            DeviceName = session.DeviceName,
            DeviceType = session.DeviceType,
            IpAddress = session.IpAddress,
            CreatedAt = now,
            ExpiresAt = now.AddHours(SessionDurationHours),
            LastUsedAt = now
        };
        db.Sessions.Add(newSession);

        session.RevokedAt = now;
        session.ReplacedBySessionId = newSession.Id;

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