using ArcanumMessenger.Contracts.Messenger.Messages;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class MessageService(AppDbContext db, UserDisplayNameService displayNames)
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
            .Select(m => new { m.Id, m.ChatId, m.SenderId, m.ReplyToId, m.Content, m.IsEdited, m.CreatedAt })
            .ToListAsync(ct);

        var hasMore = page.Count > take;
        var trimmed = page.Take(take).Reverse().ToList();

        var names = await displayNames.GetDisplayNamesAsync(trimmed.Select(m => m.SenderId), ct);

        var messages = trimmed.Select(m => new ChatMessageDto(
            m.Id, m.ChatId, m.SenderId, names.GetValueOrDefault(m.SenderId, "Unknown user"),
            m.ReplyToId, m.Content ?? "", m.IsEdited, m.CreatedAt, m.SenderId == callerId
        )).ToList();

        return (messages, hasMore, null);
    }

    public async Task<(ChatMessageDto? Message, string? Reason)> SendMessageAsync(
        ChatMember membership, string content, Guid? replyToId, CancellationToken ct)
    {
        var trimmed = content?.Trim() ?? "";
        if (trimmed.Length == 0)
            return (null, "empty_content");
        if (trimmed.Length > MaxContentLength)
            return (null, "too_long");

        if (replyToId is { } rid &&
            !await db.Messages.AnyAsync(m => m.Id == rid && m.ChatId == membership.ChatId && !m.IsDeleted, ct))
            return (null, "invalid_reply_to");

        var message = new Message
        {
            ChatId = membership.ChatId,
            SenderId = membership.UserId,
            Content = trimmed,
            ReplyToId = replyToId,
        };
        db.Messages.Add(message);
        membership.LastReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var names = await displayNames.GetDisplayNamesAsync([membership.UserId], ct);

        return (new ChatMessageDto(
            message.Id, message.ChatId, message.SenderId,
            names.GetValueOrDefault(membership.UserId, "Unknown user"),
            message.ReplyToId, message.Content, message.IsEdited, message.CreatedAt, true
        ), null);
    }
}
