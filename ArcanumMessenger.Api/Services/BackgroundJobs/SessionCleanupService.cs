using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.BackgroundJobs;

// Runs periodically and hard-deletes Session rows (refresh-token history)
// that are no longer usable: naturally expired, or revoked long enough
// ago that they can no longer matter. RevokedGracePeriod stays well past
// TokenIssuanceService's own 10-second refresh-race grace window, so a
// session doesn't get purged while it could still legitimately be
// resolved as someone's "just rotated" predecessor.
public class SessionCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<SessionCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan RevokedGracePeriod = TimeSpan.FromHours(1);
    private static readonly TimeSpan RunInterval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Session cleanup run failed");
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var revokedCutoff = now - RevokedGracePeriod;

        var deleted = await db.Sessions
            .Where(s => s.ExpiresAt < now || (s.RevokedAt != null && s.RevokedAt <= revokedCutoff))
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
            logger.LogInformation("Purged {Count} expired/revoked sessions", deleted);
    }
}
