using ArcanumMessenger.Contracts.Messenger.Media;
using ArcanumMessenger.Contracts.Messenger.Messages;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using ArcanumMessenger.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class MessageService(
    AppDbContext db, UserDisplayNameService displayNames, IHubContext<ChatHub, IChatClient> hub,
    BlockService blocks, MediaAccessService mediaAccess)
{
    private const int DefaultTake = 30;
    private const int MaxTake = 100;
    private const int MaxContentLength = 4000;

    public async Task<(List<ChatMessageDto> Messages, bool HasMore, string? Reason)> GetHistoryAsync(
        Guid chatId, Guid callerId, Guid? beforeMessageId, int take, CancellationToken ct)
    {
        take = Math.Clamp(take <= 0 ? DefaultTake : take, 1, MaxTake);

        DateTime? beforeCreatedAt = null;
        if (beforeMessageId is { } beforeId)
        {
            beforeCreatedAt = await db.Messages.AsNoTracking()
                .Where(m => m.Id == beforeId && m.ChatId == chatId)
                .Select(m => (DateTime?)m.CreatedAt)
                .FirstOrDefaultAsync(ct);
            if (beforeCreatedAt is null)
                return ([], false, "invalid_cursor");
        }

        var query = db.Messages.AsNoTracking().Where(m => m.ChatId == chatId && !m.IsDeleted);
        if (beforeMessageId is { } cursor)
            query = query.Where(m => m.CreatedAt < beforeCreatedAt ||
                (m.CreatedAt == beforeCreatedAt && m.Id < cursor));

        var page = await query
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(take + 1)
            .Select(m => new { m.Id, m.ChatId, m.SenderId, m.ReplyToId, m.Content, m.Type, m.MediaId, m.IsEdited, m.CreatedAt })
            .ToListAsync(ct);

        var hasMore = page.Count > take;
        var trimmed = page.Take(take).Reverse().ToList();

        var names = await displayNames.GetDisplayNamesAsync(trimmed.Select(m => m.SenderId), ct);

        var mediaIds = trimmed.Where(m => m.MediaId.HasValue).Select(m => m.MediaId!.Value).ToList();
        var mediaById = await db.MediaAssets.AsNoTracking()
            .Where(m => mediaIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var messages = trimmed.Select(m => new ChatMessageDto(
            m.Id, m.ChatId, m.SenderId, names.GetValueOrDefault(m.SenderId, "Unknown user"),
            m.ReplyToId, m.Content ?? "", m.Type,
            m.MediaId is { } mid && mediaById.TryGetValue(mid, out var asset) ? MediaAssetDto.FromEntity(asset) : null,
            m.IsEdited, m.CreatedAt, m.SenderId == callerId
        )).ToList();

        return (messages, hasMore, null);
    }

    public async Task<(ChatMessageDto? Message, string? Reason)> SendMessageAsync(
        ChatMember membership, string? content, Guid? replyToId, Guid? mediaId, CancellationToken ct)
    {
        var trimmed = content?.Trim() ?? "";
        if (trimmed.Length > MaxContentLength)
            return (null, "too_long");

        // Anyone who can already see this media (uploaded it themselves, or
        // received it in a chat they're in) can attach it to a new message -
        // that's how forwarding/resending a saved gif works. The same media
        // can end up referenced by more than one message; nothing about
        // storage or access control assumes it's used only once.
        MediaAsset? media = null;
        if (mediaId is { } mid)
        {
            media = await mediaAccess.GetAccessibleAsync(mid, membership.UserId, ct);
            if (media is null)
                return (null, "invalid_media");
        }

        if (trimmed.Length == 0 && media is null)
            return (null, "empty_content");

        if (membership.Chat.Type == "direct")
        {
            var otherId = await db.ChatMembers.AsNoTracking()
                .Where(cm => cm.ChatId == membership.ChatId && cm.UserId != membership.UserId)
                .Select(cm => (Guid?)cm.UserId)
                .FirstOrDefaultAsync(ct);
            if (otherId is { } other && await blocks.IsBlockedEitherWayAsync(membership.UserId, other, ct))
                return (null, "blocked");
        }

        if (replyToId is { } rid &&
            !await db.Messages.AnyAsync(m => m.Id == rid && m.ChatId == membership.ChatId && !m.IsDeleted, ct))
            return (null, "invalid_reply_to");

        var message = new Message
        {
            ChatId = membership.ChatId,
            SenderId = membership.UserId,
            Type = media?.Kind ?? "text",
            Content = trimmed.Length > 0 ? trimmed : null,
            MediaId = media?.Id,
            ReplyToId = replyToId,
        };
        db.Messages.Add(message);
        membership.LastReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var names = await displayNames.GetDisplayNamesAsync([membership.UserId], ct);

        var dto = new ChatMessageDto(
            message.Id, message.ChatId, message.SenderId,
            names.GetValueOrDefault(membership.UserId, "Unknown user"),
            message.ReplyToId, message.Content ?? "", message.Type,
            media is not null ? MediaAssetDto.FromEntity(media) : null,
            message.IsEdited, message.CreatedAt, true
        );

        var otherMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == membership.ChatId && cm.UserId != membership.UserId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        var dtoForOthers = dto with { IsOwn = false };
        foreach (var id in otherMemberIds)
            await hub.Clients.User(id.ToString()).ReceiveMessage(dtoForOthers);

        return (dto, null);
    }
}
