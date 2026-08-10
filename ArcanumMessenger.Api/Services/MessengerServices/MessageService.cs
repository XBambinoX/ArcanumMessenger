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
    // Content is a client-encrypted ciphertext blob now (base64(nonce ||
    // ciphertext+tag)), not the plaintext the user typed - this is a limit
    // on that blob's length, generous enough to cover the base64/AES-GCM
    // overhead over what used to be a 4000-character plaintext cap.
    private const int MaxContentLength = 20000;

    private static ChatMessageDto BuildDto(Message message, string senderName, MediaAsset? media, Guid callerId) =>
        new(
            message.Id, message.ChatId, message.SenderId, senderName,
            message.ReplyToId, message.Content ?? "", message.Type,
            media is not null ? MediaAssetDto.FromEntity(media) : null,
            message.IsEdited, message.CreatedAt, message.SenderId == callerId,
            message.ForwardedFromSenderId, message.ForwardedFromSenderName
        );

    public async Task<(List<ChatMessageDto> Messages, bool HasMore, List<ChatReadStateDto> ReadStates, string? Reason)> GetHistoryAsync(
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
                return ([], false, [], "invalid_cursor");
        }

        var query = db.Messages.AsNoTracking().Where(m => m.ChatId == chatId && !m.IsDeleted);
        if (beforeMessageId is { } cursor)
            query = query.Where(m => m.CreatedAt < beforeCreatedAt ||
                (m.CreatedAt == beforeCreatedAt && m.Id < cursor));

        var page = await query
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(take + 1)
            .Select(m => new {
                m.Id, m.ChatId, m.SenderId, m.ReplyToId, m.Content, m.Type, m.MediaId, m.IsEdited, m.CreatedAt,
                m.ForwardedFromSenderId, m.ForwardedFromSenderName,
            })
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
            m.IsEdited, m.CreatedAt, m.SenderId == callerId,
            m.ForwardedFromSenderId, m.ForwardedFromSenderName
        )).ToList();

        //Read states
        var readStates = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == chatId && cm.UserId != callerId)
            .Select(cm => new ChatReadStateDto(cm.UserId, cm.LastReadAt))
            .ToListAsync(ct);

        return (messages, hasMore, readStates, null);
    }

    public async Task<(List<ChatMediaItemDto> Items, bool HasMore, string? Reason)> GetMediaAsync(
        Guid chatId, Guid? beforeMessageId, int take, string? kind, CancellationToken ct)
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

        var query = db.Messages.AsNoTracking()
            .Where(m => m.ChatId == chatId && !m.IsDeleted && m.MediaId != null);
        // The chat-info panel splits gifs into their own tab - they can pile
        // up fast (stickers, reactions) and would otherwise crowd out actual
        // photos/videos in the same grid. "media" is everything else
        // (photo/video/file), not just photo/video, so the two tabs stay a
        // clean partition of the same list rather than dropping files.
        query = kind switch
        {
            "gif" => query.Where(m => m.Type == "gif"),
            "media" => query.Where(m => m.Type != "gif"),
            _ => query,
        };
        if (beforeMessageId is { } cursor)
            query = query.Where(m => m.CreatedAt < beforeCreatedAt ||
                (m.CreatedAt == beforeCreatedAt && m.Id < cursor));

        var page = await query
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(take + 1)
            .Select(m => new { m.Id, m.MediaId, m.CreatedAt })
            .ToListAsync(ct);

        var hasMore = page.Count > take;
        var trimmed = page.Take(take).ToList();

        var mediaIds = trimmed.Select(m => m.MediaId!.Value).ToList();
        var mediaById = await db.MediaAssets.AsNoTracking()
            .Where(m => mediaIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var items = trimmed
            .Where(m => mediaById.ContainsKey(m.MediaId!.Value))
            .Select(m => new ChatMediaItemDto(m.Id, m.CreatedAt, MediaAssetDto.FromEntity(mediaById[m.MediaId!.Value])))
            .ToList();

        return (items, hasMore, null);
    }

    public async Task<(int MessageCount, int MediaCount)> GetStatsAsync(Guid chatId, CancellationToken ct)
    {
        var messageCount = await db.Messages.AsNoTracking().CountAsync(m => m.ChatId == chatId && !m.IsDeleted, ct);
        var mediaCount = await db.Messages.AsNoTracking()
            .CountAsync(m => m.ChatId == chatId && !m.IsDeleted && m.MediaId != null, ct);
        return (messageCount, mediaCount);
    }

    public async Task<(ChatMessageDto? Message, string? Reason)> SendMessageAsync(
        ChatMember membership, string? content, Guid? replyToId, Guid? mediaId, bool asGif, CancellationToken ct)
    {
        var trimmed = content?.Trim() ?? "";
        if (trimmed.Length > MaxContentLength)
            return (null, "too_long");

        // Anyone who can already see this media (uploaded it themselves, or
        // received it in a chat they're in) can attach it to a new message -
        // that's how the "send as gif" reclassification below reuses a
        // caller's own just-uploaded video. Chat media is encrypted with
        // that chat's own key though, so this only works within the SAME
        // chat the media was uploaded/received in - moving it to a
        // different chat (forwarding, saved GIFs) requires the client to
        // re-encrypt and re-upload it first, not just pass the old id here.
        MediaAsset? media = null;
        if (mediaId is { } mid)
        {
            media = await mediaAccess.GetAccessibleAsync(mid, membership.UserId, ct);
            if (media is null)
                return (null, "invalid_media");

            // "Send as GIF" is Telegram's own trick: the file stays a real
            // video (still efficient, still has real dimensions/duration),
            // it just gets classified and displayed as a gif from here on -
            // autoplay/loop instead of playback controls, eligible to be
            // saved to the gif shelf. Once reclassified this way it stays
            // that way for every future message that reuses this media too.
            if (asGif && media.Kind == "video")
            {
                await db.MediaAssets.Where(m => m.Id == media.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(m => m.Kind, "gif"), ct);
                media.Kind = "gif";
            }
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
        var dto = BuildDto(message, names.GetValueOrDefault(membership.UserId, "Unknown user"), media, membership.UserId);

        var otherMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == membership.ChatId && cm.UserId != membership.UserId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        // The sender gets their own copy back too, IsOwn: true - the HTTP
        // response already has it for the open chat window, but the sidebar's
        // chat list only learns about a new "last message" through this hub
        // event, and it has no other way to find out about your own sends.
        await hub.Clients.User(membership.UserId.ToString()).ReceiveMessage(dto);
        var dtoForOthers = dto with { IsOwn = false };
        foreach (var id in otherMemberIds)
            await hub.Clients.User(id.ToString()).ReceiveMessage(dtoForOthers);

        return (dto, null);
    }

    // Deletes for everyone - there's no per-viewer "delete for me" yet, just
    // the one shared IsDeleted flag the rest of the app already filters on.
    public async Task<(bool Success, string? Reason)> DeleteMessageAsync(
        Guid chatId, Guid messageId, Guid callerId, CancellationToken ct)
    {
        var message = await db.Messages
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == chatId && !m.IsDeleted, ct);
        if (message is null)
            return (false, "not_found");
        if (message.SenderId != callerId)
            return (false, "forbidden");

        message.IsDeleted = true;
        await db.SaveChangesAsync(ct);

        // The chat list's preview only knows about a chat's "last message" as
        // plain text/time, not which message id it came from - so deleting
        // whatever that message actually was needs the real new one sent back,
        // not just "something changed", or the sidebar can't tell whether the
        // deleted message even was the one it's showing.
        var newLast = await db.Messages.AsNoTracking()
            .Where(m => m.ChatId == chatId && !m.IsDeleted)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new { m.Content, m.Type, m.CreatedAt })
            .FirstOrDefaultAsync(ct);

        var allMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == chatId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        foreach (var id in allMemberIds)
            await hub.Clients.User(id.ToString()).MessageDeleted(chatId, messageId, newLast?.Content, newLast?.Type, newLast?.CreatedAt);

        return (true, null);
    }

    public async Task<(ChatMessageDto? Message, string? Reason)> EditMessageAsync(
        Guid chatId, Guid messageId, Guid callerId, string? content, CancellationToken ct)
    {
        var message = await db.Messages
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ChatId == chatId && !m.IsDeleted, ct);
        if (message is null)
            return (null, "not_found");
        if (message.SenderId != callerId)
            return (null, "forbidden");

        var trimmed = content?.Trim() ?? "";
        if (trimmed.Length > MaxContentLength)
            return (null, "too_long");
        // A media caption can be cleared out entirely, but a text message
        // can't be edited down to nothing - that's what delete is for.
        if (trimmed.Length == 0 && message.Type == "text")
            return (null, "empty_content");

        message.Content = trimmed.Length > 0 ? trimmed : null;
        message.IsEdited = true;
        message.EditedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var media = message.MediaId is { } mid
            ? await db.MediaAssets.AsNoTracking().FirstOrDefaultAsync(m => m.Id == mid, ct)
            : null;

        var names = await displayNames.GetDisplayNamesAsync([callerId], ct);
        var dto = BuildDto(message, names.GetValueOrDefault(callerId, "Unknown user"), media, callerId);

        var otherMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == chatId && cm.UserId != callerId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        // The caller gets their own copy too - same reasoning as SendMessageAsync,
        // the sidebar's chat list needs this event even for your own edits.
        await hub.Clients.User(callerId.ToString()).MessageEdited(dto);
        var dtoForOthers = dto with { IsOwn = false };
        foreach (var id in otherMemberIds)
            await hub.Clients.User(id.ToString()).MessageEdited(dtoForOthers);

        return (dto, null);
    }

    public async Task<(List<ChatMessageDto>? Messages, string? Reason)> ForwardMessagesAsync(
        ChatMember targetMembership, List<ForwardItemRequest> items, CancellationToken ct)
    {
        if (items.Count == 0)
            return (null, "empty_selection");

        var messageIds = items.Select(i => i.SourceMessageId).ToList();
        if (messageIds.Distinct().Count() != messageIds.Count)
            return (null, "invalid_messages");

        if (targetMembership.Chat.Type == "direct")
        {
            var otherId = await db.ChatMembers.AsNoTracking()
                .Where(cm => cm.ChatId == targetMembership.ChatId && cm.UserId != targetMembership.UserId)
                .Select(cm => (Guid?)cm.UserId)
                .FirstOrDefaultAsync(ct);
            if (otherId is { } other && await blocks.IsBlockedEitherWayAsync(targetMembership.UserId, other, ct))
                return (null, "blocked");
        }

        var sources = await db.Messages
            .Where(m => messageIds.Contains(m.Id) && !m.IsDeleted)
            .ToListAsync(ct);
        if (sources.Count != messageIds.Count)
            return (null, "invalid_messages");

        // Forwarding only requires having been able to see the message in the
        // first place - not sending it, not owning it, just membership in
        // whatever chat it actually lives in.
        var sourceChatIds = sources.Select(m => m.ChatId).Distinct().ToList();
        var memberChatIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.UserId == targetMembership.UserId && sourceChatIds.Contains(cm.ChatId))
            .Select(cm => cm.ChatId)
            .ToListAsync(ct);
        if (sources.Any(m => !memberChatIds.Contains(m.ChatId)))
            return (null, "forbidden");

        var senderNames = await displayNames.GetDisplayNamesAsync(
            sources.Select(m => m.SenderId).Append(targetMembership.UserId), ct);
        var sourceById = sources.ToDictionary(m => m.Id);
        var forwarderName = senderNames.GetValueOrDefault(targetMembership.UserId, "Unknown user");
        // Each item's EncryptedContent is already sealed under the
        // DESTINATION chat's key by the client - the server never sees the
        // source chat's key, so it couldn't have re-encrypted this itself.
        var contentById = items.ToDictionary(i => i.SourceMessageId, i => i.EncryptedContent);
        var newMediaIdBySource = items.ToDictionary(i => i.SourceMessageId, i => i.NewMediaId);

        // A source message with media requires a real replacement asset the
        // caller already uploaded, encrypted under the destination chat's
        // key - media can't be transcoded across chats by reference the way
        // EncryptedContent above can, it needs a real re-upload client-side.
        var newMediaIds = newMediaIdBySource.Values.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        var newMediaById = await db.MediaAssets.AsNoTracking()
            .Where(m => newMediaIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);
        foreach (var id in messageIds)
        {
            if (sourceById[id].MediaId is null) continue;
            if (newMediaIdBySource[id] is not { } newMediaId ||
                !newMediaById.TryGetValue(newMediaId, out var newAsset) ||
                newAsset.UploaderId != targetMembership.UserId)
                return (null, "invalid_media");
        }

        // messageIds carries the order the caller selected them in (chronological,
        // since that's the order they appear in the chat) - preserve it here too.
        var newMessages = messageIds.Select(id =>
        {
            var src = sourceById[id];
            var content = contentById[id];
            return new Message
            {
                ChatId = targetMembership.ChatId,
                SenderId = targetMembership.UserId,
                Type = src.Type,
                Content = string.IsNullOrEmpty(content) ? null : content,
                MediaId = newMediaIdBySource[id],
                ForwardedFromSenderId = src.SenderId,
                ForwardedFromSenderName = senderNames.GetValueOrDefault(src.SenderId, "Unknown user"),
            };
        }).ToList();

        db.Messages.AddRange(newMessages);
        targetMembership.LastReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var mediaIds = newMessages.Where(m => m.MediaId.HasValue).Select(m => m.MediaId!.Value).Distinct().ToList();
        var mediaById = await db.MediaAssets.AsNoTracking()
            .Where(m => mediaIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var dtos = newMessages.Select(m => BuildDto(
            m, forwarderName,
            m.MediaId is { } mid && mediaById.TryGetValue(mid, out var asset) ? asset : null,
            targetMembership.UserId
        )).ToList();

        var otherMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == targetMembership.ChatId && cm.UserId != targetMembership.UserId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        foreach (var dto in dtos)
        {
            // Same reasoning as a plain send - the forwarder's own sidebar
            // needs this event to update the target chat's preview live too.
            await hub.Clients.User(targetMembership.UserId.ToString()).ReceiveMessage(dto);
            var dtoForOthers = dto with { IsOwn = false };
            foreach (var id in otherMemberIds)
                await hub.Clients.User(id.ToString()).ReceiveMessage(dtoForOthers);
        }

        return (dtos, null);
    }
}
