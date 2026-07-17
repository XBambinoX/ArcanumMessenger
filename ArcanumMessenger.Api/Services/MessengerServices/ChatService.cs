using ArcanumMessenger.Contracts.Messenger.Chats;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using ArcanumMessenger.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class ChatService(AppDbContext db, UserDisplayNameService displayNames, IHubContext<ChatHub, IChatClient> hub)
{
    private sealed record RawChatSummary(
        Guid ChatId, string Type, string? Title, DateTime ChatCreatedAt,
        bool IsMuted, bool IsArchived,
        string? LastMessageContent, DateTime? LastMessageAt,
        int UnreadCount, Guid? OtherMemberId);

    private static IQueryable<RawChatSummary> ProjectSummaries(IQueryable<ChatMember> memberships, Guid callerId) =>
        memberships
            .Where(cm => !cm.Chat.IsDeleted)
            .Select(cm => new RawChatSummary(
                cm.ChatId, cm.Chat.Type, cm.Chat.Title, cm.Chat.CreatedAt,
                cm.IsMuted, cm.IsArchived,
                cm.Chat.Messages.Where(m => !m.IsDeleted)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.Content).FirstOrDefault(),
                cm.Chat.Messages.Where(m => !m.IsDeleted)
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => (DateTime?)m.CreatedAt).FirstOrDefault(),
                cm.Chat.Messages.Count(m => !m.IsDeleted && m.SenderId != callerId && m.CreatedAt > cm.LastReadAt),
                cm.Chat.Type == "direct"
                    ? cm.Chat.Members.Where(m => m.UserId != callerId).Select(m => (Guid?)m.UserId).FirstOrDefault()
                    : null));

    private async Task<List<ChatSummaryDto>> MaterializeAsync(List<RawChatSummary> raw, CancellationToken ct)
    {
        var otherMemberIds = raw.Where(r => r.OtherMemberId.HasValue).Select(r => r.OtherMemberId!.Value);
        var names = await displayNames.GetDisplayNamesAsync(otherMemberIds, ct);

        return raw
            .Select(r => new
            {
                Dto = new ChatSummaryDto(
                    r.ChatId,
                    r.Type,
                    r.Type == "direct"
                        ? names.GetValueOrDefault(r.OtherMemberId!.Value, "Unknown user")
                        : r.Title ?? "Untitled group",
                    r.LastMessageContent,
                    r.LastMessageAt,
                    r.UnreadCount,
                    r.IsMuted,
                    r.IsArchived),
                SortKey = r.LastMessageAt ?? r.ChatCreatedAt,
            })
            .OrderByDescending(x => x.SortKey)
            .Select(x => x.Dto)
            .ToList();
    }

    public async Task<List<ChatSummaryDto>> GetChatSummariesAsync(Guid userId, CancellationToken ct)
    {
        var raw = await ProjectSummaries(db.ChatMembers.AsNoTracking().Where(cm => cm.UserId == userId), userId)
            .ToListAsync(ct);
        return await MaterializeAsync(raw, ct);
    }

    public async Task<ChatSummaryDto?> GetChatSummaryAsync(Guid chatId, Guid userId, CancellationToken ct)
    {
        var raw = await ProjectSummaries(
                db.ChatMembers.AsNoTracking().Where(cm => cm.UserId == userId && cm.ChatId == chatId), userId)
            .FirstOrDefaultAsync(ct);
        if (raw is null)
            return null;

        return (await MaterializeAsync([raw], ct)).SingleOrDefault();
    }

    // Each recipient needs their own perspective's DTO - a direct chat's
    // Title is the other member's name, so it differs per recipient.
    private async Task NotifyChatCreatedAsync(Guid chatId, IEnumerable<Guid> memberIds, CancellationToken ct)
    {
        foreach (var id in memberIds)
        {
            var recipientView = await GetChatSummaryAsync(chatId, id, ct);
            if (recipientView is not null)
                await hub.Clients.User(id.ToString()).ChatCreated(recipientView);
        }
    }

    public async Task<(ChatSummaryDto? Chat, string? Reason)> CreateDirectChatAsync(
        Guid callerId, Guid otherUserId, CancellationToken ct)
    {
        if (callerId == otherUserId)
            return (null, "self_chat");

        if (!await db.Users.AnyAsync(u => u.Id == otherUserId && !u.IsDeleted, ct))
            return (null, "user_not_found");

        var existingChatId = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.UserId == callerId && cm.Chat.Type == "direct" && !cm.Chat.IsDeleted)
            .Where(cm => db.ChatMembers.Any(cm2 => cm2.ChatId == cm.ChatId && cm2.UserId == otherUserId))
            .Select(cm => (Guid?)cm.ChatId)
            .FirstOrDefaultAsync(ct);

        if (existingChatId is { } id)
            return (await GetChatSummaryAsync(id, callerId, ct), null);

        var chat = new Chat { Type = "direct", CreatedBy = callerId };
        db.Chats.Add(chat);

        var now = DateTime.UtcNow;
        db.ChatMembers.Add(new ChatMember { Chat = chat, UserId = callerId, Role = "member", JoinedAt = now, LastReadAt = now });
        db.ChatMembers.Add(new ChatMember { Chat = chat, UserId = otherUserId, Role = "member", JoinedAt = now, LastReadAt = now });
        await db.SaveChangesAsync(ct);

        await NotifyChatCreatedAsync(chat.Id, [otherUserId], ct);

        return (await GetChatSummaryAsync(chat.Id, callerId, ct), null);
    }

    public async Task<(ChatSummaryDto? Chat, string? Reason)> CreateGroupChatAsync(
        Guid callerId, string? title, string? description, List<Guid>? memberIds, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(title))
            return (null, "missing_title");

        var members = (memberIds ?? []).Distinct().Where(id => id != callerId).ToList();
        if (members.Count == 0)
            return (null, "missing_members");

        var foundCount = await db.Users.CountAsync(u => members.Contains(u.Id) && !u.IsDeleted, ct);
        if (foundCount != members.Count)
            return (null, "invalid_members");

        var chat = new Chat
        {
            Type = "group",
            CreatedBy = callerId,
            Title = title.Trim(),
            Description = description?.Trim(),
        };
        db.Chats.Add(chat);

        var now = DateTime.UtcNow;
        db.ChatMembers.Add(new ChatMember { Chat = chat, UserId = callerId, Role = "admin", JoinedAt = now, LastReadAt = now });
        foreach (var memberId in members)
            db.ChatMembers.Add(new ChatMember { Chat = chat, UserId = memberId, Role = "member", JoinedAt = now, LastReadAt = now });
        await db.SaveChangesAsync(ct);

        await NotifyChatCreatedAsync(chat.Id, members, ct);

        return (await GetChatSummaryAsync(chat.Id, callerId, ct), null);
    }

    public async Task<DateTime> MarkReadAsync(ChatMember membership, CancellationToken ct)
    {
        membership.LastReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return membership.LastReadAt;
    }

    public async Task SetArchivedAsync(ChatMember membership, bool isArchived, CancellationToken ct)
    {
        membership.IsArchived = isArchived;
        await db.SaveChangesAsync(ct);
    }
}
