using ArcanumMessenger.Services.MessengerServices;

namespace ArcanumMessenger.Services.BackgroundJobs;

// Runs periodically and hard-deletes MediaAsset rows (DB row + S3/MinIO
// object) no longer referenced by any Message or SavedGif. Most of these
// are media whose message/chat MessagePurgeService already hard-deleted -
// the two don't need to run in lockstep, whatever one orphans just gets
// caught on the other's next cycle. See MediaService.PurgeOrphanedAsync
// for the actual query/deletion and why MinAge exists.
public class MediaCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<MediaCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan MinAge = TimeSpan.FromHours(24);
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
                logger.LogError(ex, "Media cleanup run failed");
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var media = scope.ServiceProvider.GetRequiredService<MediaService>();

        var purged = await media.PurgeOrphanedAsync(MinAge, ct);
        if (purged > 0)
            logger.LogInformation("Purged {Count} orphaned media assets", purged);
    }
}
