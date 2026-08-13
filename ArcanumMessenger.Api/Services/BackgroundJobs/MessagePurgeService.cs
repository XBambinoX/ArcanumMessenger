using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.BackgroundJobs;

// Runs periodically and hard-deletes messages/chats that have been
// soft-deleted for longer than the grace period. A deleted chat's
// Messages/ChatMembers/MessageReactions cascade-delete with it
// (AppDbContext's own FK config) - this only needs to remove the Chat
// row itself for that case, plus any standalone deleted message whose
// chat is still alive.
public class MessagePurgeService(
    IServiceScopeFactory scopeFactory,
    ILogger<MessagePurgeService> logger) : BackgroundService
{
    private static readonly TimeSpan GracePeriod = TimeSpan.FromDays(30);
    private static readonly TimeSpan RunInterval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Message/chat purge run failed");
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task PurgeAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - GracePeriod;

        var chatsDeleted = await db.Chats
            .Where(c => c.IsDeleted && c.DeletedAt != null && c.DeletedAt <= cutoff)
            .ExecuteDeleteAsync(ct);

        var messagesDeleted = await db.Messages
            .Where(m => m.IsDeleted && m.DeletedAt != null && m.DeletedAt <= cutoff)
            .ExecuteDeleteAsync(ct);

        if (chatsDeleted > 0 || messagesDeleted > 0)
        {
            logger.LogInformation(
                "Purged {ChatCount} chats and {MessageCount} standalone messages past grace period",
                chatsDeleted, messagesDeleted);
        }
    }
}
