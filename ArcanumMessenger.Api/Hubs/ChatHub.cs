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
    Task UserOnline(Guid userId);
    Task UserOffline(Guid userId, DateTime lastSeen);
}

[Authorize]
public class ChatHub(AppDbContext db, PresenceService presence, IServiceScopeFactory scopeFactory) : Hub<IChatClient>
{
    // How long to wait after a user's last connection drops before treating
    // them as actually offline.
    private static readonly TimeSpan OfflineGracePeriod = TimeSpan.FromSeconds(5);

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();

        var justCameOnline = await presence.AddConnectionAsync(userId, Context.ConnectionId);

        if (justCameOnline)
        {
            await BroadcastPresenceAsync(userId, isOnline: true, lastSeen: null);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();

        var mightBeOffline = await presence.RemoveConnectionAsync(userId, Context.ConnectionId);

        if (mightBeOffline)
        {
            // Don't broadcast yet — give a reconnect a chance to land first.
            _ = Task.Run(async () =>
            {
                await Task.Delay(OfflineGracePeriod);

                if (await presence.IsOnlineAsync(userId))
                    return;

                var now = DateTime.UtcNow;

                using var scope = scopeFactory.CreateScope();
                var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var user = await scopedDb.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user is not null)
                {
                    user.LastSeen = now;
                    await scopedDb.SaveChangesAsync();
                }

                await BroadcastPresenceAsync(userId, isOnline: false, lastSeen: now);
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task BroadcastPresenceAsync(Guid userId, bool isOnline, DateTime? lastSeen)
    {
        using var scope = scopeFactory.CreateScope();
        var scopedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var settings = await scopedDb.UserSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId);

        // Respect the privacy toggle: if the user has hidden their online
        // status, don't tell anyone it changed at all.
        if (settings is not null && !settings.ShowOnlineStatus)
            return;

        var contactIds = await scopedDb.Contacts
            .Where(c => c.UserId == userId)
            .Select(c => c.ContactId)
            .ToListAsync();

        if (contactIds.Count == 0)
            return;

        var recipients = contactIds.Select(id => id.ToString()).ToList();

        if (isOnline)
            await Clients.Users(recipients).UserOnline(userId);
        else
            await Clients.Users(recipients).UserOffline(userId, lastSeen!.Value);
    }

    private Guid GetUserId()
    {
        var sub = Context.User?.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? throw new HubException("Missing user id claim");
        return Guid.Parse(sub);
    }
}