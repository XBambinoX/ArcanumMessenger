using ArcanumMessenger.Contracts.Messenger.Chats;
using ArcanumMessenger.Contracts.Messenger.Messages;
using ArcanumMessenger.Data;
using ArcanumMessenger.Services.MessengerServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ArcanumMessenger.Hubs;

public interface IChatClient
{
    Task ReceiveMessage(ChatMessageDto message);
    Task ChatCreated(ChatSummaryDto chat);
    Task MessageDeleted(Guid chatId, Guid messageId, string? lastMessageText, DateTime? lastMessageAt);
    Task MessageEdited(ChatMessageDto message);
    Task UserOnline(Guid userId);
    Task UserOffline(Guid userId, DateTime? lastSeen);
}

[Authorize]
public class ChatHub(
    PresenceService presence,
    IServiceScopeFactory scopeFactory,
    IHubContext<ChatHub, IChatClient> hubContext,
    ILogger<ChatHub> logger) : Hub<IChatClient>
{
    private static readonly TimeSpan OfflineGracePeriod = TimeSpan.FromMilliseconds(100);

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        logger.LogInformation("Connected: user={UserId} connection={ConnectionId}", userId, Context.ConnectionId);

        var justCameOnline = await presence.AddConnectionAsync(userId, Context.ConnectionId);

        if (justCameOnline)
        {
            logger.LogInformation("User {UserId} came online", userId);
            await BroadcastPresenceAsync(userId, isOnline: true, lastSeen: null);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        logger.LogInformation(
            "Disconnected: user={UserId} connection={ConnectionId} exception={Exception}",
            userId, Context.ConnectionId, exception?.Message);

        var mightBeOffline = await presence.RemoveConnectionAsync(userId, Context.ConnectionId);
        logger.LogInformation("mightBeOffline={MightBeOffline} for user {UserId}", mightBeOffline, userId);

        if (mightBeOffline)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(OfflineGracePeriod);

                    if (await presence.IsOnlineAsync(userId))
                    {
                        logger.LogInformation("User {UserId} reconnected during grace period, skipping offline broadcast", userId);
                        return;
                    }

                    var now = DateTime.UtcNow;

                    using var scope = scopeFactory.CreateScope();
                    var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    var user = await scopedDb.Users.FirstOrDefaultAsync(u => u.Id == userId);
                    if (user is not null)
                    {
                        user.LastSeen = now;
                        await scopedDb.SaveChangesAsync();
                    }

                    logger.LogInformation("Broadcasting offline for user {UserId}", userId);
                    await BroadcastPresenceViaContextAsync(scopedDb, userId, isOnline: false, lastSeen: now);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to process offline transition for user {UserId}", userId);
                }
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    // Used from within a live hub method (OnConnectedAsync) — this.Clients
    // is safe here since the hub instance is still alive.
    private async Task BroadcastPresenceAsync(Guid userId, bool isOnline, DateTime? lastSeen)
    {
        using var scope = scopeFactory.CreateScope();
        var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var (recipients, visibleLastSeen) = await ResolveBroadcastAsync(scopedDb, userId, lastSeen);
        if (recipients is null) return;

        if (isOnline)
            await Clients.Users(recipients).UserOnline(userId);
        else
            await Clients.Users(recipients).UserOffline(userId, visibleLastSeen.Value);
    }

    private async Task BroadcastPresenceViaContextAsync(AppDbContext scopedDb, Guid userId, bool isOnline, DateTime? lastSeen)
    {
        var (recipients, visibleLastSeen) = await ResolveBroadcastAsync(scopedDb, userId, lastSeen);
        if (recipients is null) return;

        if (isOnline)
            await hubContext.Clients.Users(recipients).UserOnline(userId);
        else
            await hubContext.Clients.Users(recipients).UserOffline(userId, visibleLastSeen.Value);
    }


    private async Task<(List<string>? Recipients, DateTime? VisibleLastSeen)> ResolveBroadcastAsync(
        AppDbContext scopedDb, Guid userId, DateTime? lastSeen)
    {
        var settings = await scopedDb.UserSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (settings is not null && !settings.ShowOnlineStatus)
        {
            logger.LogInformation("User {UserId} has ShowOnlineStatus=false, skipping broadcast", userId);
            return (null, null);
        }

        var visibleLastSeen = (settings is not null && !settings.ShowLastSeen) ? null : lastSeen;

        var coMemberIds = await scopedDb.ChatMembers
            .Where(cm => scopedDb.ChatMembers
                .Where(m => m.UserId == userId)
                .Select(m => m.ChatId)
                .Contains(cm.ChatId))
            .Where(cm => cm.UserId != userId)
            .Where(cm => !scopedDb.Contacts.Any(c => c.IsBlocked &&
                ((c.UserId == userId && c.ContactId == cm.UserId) ||
                 (c.UserId == cm.UserId && c.ContactId == userId))))
            .Select(cm => cm.UserId)
            .Distinct()
            .ToListAsync();

        logger.LogInformation("Broadcasting presence for {UserId} to {Count} co-members: {Recipients}",
            userId, coMemberIds.Count, string.Join(",", coMemberIds));

        if (coMemberIds.Count == 0)
            return (null, null);

        return (coMemberIds.Select(id => id.ToString()).ToList(), visibleLastSeen);
    }

    private Guid GetUserId()
    {
        var sub = Context.User?.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? throw new HubException("Missing user id claim");
        return Guid.Parse(sub);
    }
}