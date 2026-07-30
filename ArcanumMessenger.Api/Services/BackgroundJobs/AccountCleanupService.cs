using System.Security.Cryptography;
using ArcanumMessenger.Data;
using ArcanumMessenger.Services.AuthServices;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.BackgroundJobs;

// Runs periodically and anonymizes users who have been soft-deleted for
// longer than the grace period.
public class AccountCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<AccountCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan GracePeriod = TimeSpan.FromDays(7);
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
                logger.LogError(ex, "Account cleanup run failed");
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - GracePeriod;

        var usersToPurge = await db.Users
            .Where(u => u.IsDeleted && u.DeletedAt != null && u.DeletedAt <= cutoff)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (usersToPurge.Count == 0)
            return;

        logger.LogInformation("Anonymizing {Count} accounts past grace period", usersToPurge.Count);

        foreach (var userId in usersToPurge)
        {
            await AnonymizeUserAsync(db, userId, ct);
        }
    }

    private static async Task AnonymizeUserAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        // Messages don't cascade-delete on the sender FK (Restrict), and we
        // don't want to blow away chat history for other participants -
        // so the message rows are kept but detached from this user's
        // identity instead of deleted outright.
        var messages = await db.Messages
            .Where(m => m.SenderId == userId)
            .ToListAsync(ct);

        foreach (var message in messages)
        {
            message.Content = "[deleted user]";
            message.IsEdited = true;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is not null)
        {
            // The row itself can't be removed - Chat.CreatedBy, Contact.ContactId
            // and MediaAsset.UploaderId all reference it with Restrict, on top of
            // Message.SenderId above, so an outright delete fails the same way
            // this method used to. Crypto-shredding the wrapped DEK instead makes
            // every *Enc field this user ever had (username, bio, phone, email,
            // 2FA secret) permanently undecryptable without touching each one
            // individually or needing the row gone; clearing the password/recovery
            // material on top makes the account unrecoverable and unloggable-into.
            user.WrappedDek = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            user.PasswordHash = PasswordHasher.DummyPasswordHash;
            user.RecoveryPhrase1Hash = "";
            user.RecoveryPhrase2Hash = "";
            user.KdfSalt = "";
        }

        await db.SaveChangesAsync(ct);
    }
}