using ArcanumMessenger.Contracts.Messenger.Chats;
using ArcanumMessenger.Contracts.Messenger.Messages;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using ArcanumMessenger.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class ChatService(
    AppDbContext db, UserDisplayNameService displayNames, IHubContext<ChatHub, IChatClient> hub, BlockService blocks)
{
    private sealed record RawChatSummary(
        Guid ChatId, string Type, string? Title, DateTime ChatCreatedAt,
        bool IsMuted, bool IsArchived,
        string? LastMessageContent, DateTime? LastMessageAt,
        int UnreadCount, Guid? OtherMemberId, bool IsBlocked, string? WrappedChatKey);

    private static IQueryable<RawChatSummary> ProjectSummaries(AppDbContext db, IQueryable<ChatMember> memberships, Guid callerId) =>
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
                    : null,
                cm.Chat.Type == "direct" && cm.Chat.Members.Any(m => m.UserId != callerId &&
                    db.Contacts.Any(c => c.IsBlocked &&
                        ((c.UserId == callerId && c.ContactId == m.UserId) ||
                         (c.UserId == m.UserId && c.ContactId == callerId)))),
                cm.WrappedChatKey));

    private async Task<List<ChatSummaryDto>> MaterializeAsync(List<RawChatSummary> raw, CancellationToken ct)
    {
        // Resolves to "Deleted User" for a since-deleted other member -
        // see UserDisplayNameService's own comment.
        var otherMemberIds = raw.Where(r => r.OtherMemberId.HasValue).Select(r => r.OtherMemberId!.Value);
        var names = await displayNames.GetDisplayNamesAsync(otherMemberIds, ct);

        return raw
            .Select(r => new
            {
                Dto = new ChatSummaryDto(
                    r.ChatId,
                    r.Type,
                    r.Type switch
                    {
                        "direct" => r.OtherMemberId is { } otherId ? names.GetValueOrDefault(otherId, "Unknown user") : "Unknown user",
                        "saved" => "Saved Messages",
                        _ => r.Title ?? "Untitled group",
                    },
                    r.LastMessageContent,
                    r.LastMessageAt,
                    r.UnreadCount,
                    r.IsMuted,
                    r.IsArchived,
                    r.OtherMemberId,
                    r.IsBlocked,
                    r.WrappedChatKey),
                SortKey = r.Type == "saved" ? DateTime.MaxValue : (r.LastMessageAt ?? r.ChatCreatedAt),
            })
            .OrderByDescending(x => x.SortKey)
            .Select(x => x.Dto)
            .ToList();
    }

    private async Task EnsureSavedMessagesChatAsync(Guid userId, CancellationToken ct)
    {
        var exists = await db.ChatMembers.AsNoTracking()
            .AnyAsync(cm => cm.UserId == userId && cm.Chat.Type == "saved", ct);
        if (exists)
            return;

        var chat = new Chat { Type = "saved", CreatedBy = userId };
        db.Chats.Add(chat);

        var now = DateTime.UtcNow;
        db.ChatMembers.Add(new ChatMember { Chat = chat, UserId = userId, Role = "member", JoinedAt = now, LastReadAt = now });
        await db.SaveChangesAsync(ct);
    }

    public async Task<List<ChatSummaryDto>> GetChatSummariesAsync(Guid userId, CancellationToken ct)
    {
        await EnsureSavedMessagesChatAsync(userId, ct);
        var raw = await ProjectSummaries(db, db.ChatMembers.AsNoTracking().Where(cm => cm.UserId == userId), userId)
            .ToListAsync(ct);
        return await MaterializeAsync(raw, ct);
    }

    public async Task<ChatSummaryDto?> GetChatSummaryAsync(Guid chatId, Guid userId, CancellationToken ct)
    {
        var raw = await ProjectSummaries(
                db, db.ChatMembers.AsNoTracking().Where(cm => cm.UserId == userId && cm.ChatId == chatId), userId)
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

    // Callers whose WhoCanAddMe is set to Contacts can still be reached by
    // anyone who already has them added back - this only blocks the add for
    // people the target hasn't reciprocated with.
    private async Task<List<Guid>> FilterAddRestrictedAsync(Guid callerId, List<Guid> targetIds, CancellationToken ct)
    {
        var restrictedTargets = await db.UserSettings.AsNoTracking()
            .Where(s => targetIds.Contains(s.UserId) && s.WhoCanAddMe == AddPermission.Contacts)
            .Select(s => s.UserId)
            .ToListAsync(ct);

        if (restrictedTargets.Count == 0)
            return [];

        var callerIsContactOf = await db.Contacts.AsNoTracking()
            .Where(c => restrictedTargets.Contains(c.UserId) && c.ContactId == callerId && !c.IsBlocked)
            .Select(c => c.UserId)
            .ToListAsync(ct);

        return restrictedTargets.Except(callerIsContactOf).ToList();
    }

    public async Task<(ChatSummaryDto? Chat, string? Reason)> CreateDirectChatAsync(
        Guid callerId, Guid otherUserId, List<MemberKeyDto>? memberKeys, CancellationToken ct)
    {
        if (callerId == otherUserId)
            return (null, "self_chat");

        if (!await db.Users.AnyAsync(u => u.Id == otherUserId && !u.IsDeleted, ct))
            return (null, "user_not_found");

        if (await blocks.IsBlockedEitherWayAsync(callerId, otherUserId, ct))
            return (null, "blocked");

        if ((await FilterAddRestrictedAsync(callerId, [otherUserId], ct)).Count > 0)
            return (null, "add_restricted");

        var existingChatId = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.UserId == callerId && cm.Chat.Type == "direct" && !cm.Chat.IsDeleted)
            .Where(cm => db.ChatMembers.Any(cm2 => cm2.ChatId == cm.ChatId && cm2.UserId == otherUserId))
            .Select(cm => (Guid?)cm.ChatId)
            .FirstOrDefaultAsync(ct);

        if (existingChatId is { } id)
            return (await GetChatSummaryAsync(id, callerId, ct), null);

        var keyByUserId = (memberKeys ?? []).ToDictionary(k => k.UserId, k => k.WrappedChatKey);

        var chat = new Chat { Type = "direct", CreatedBy = callerId };
        db.Chats.Add(chat);

        var now = DateTime.UtcNow;
        db.ChatMembers.Add(new ChatMember
        {
            Chat = chat, UserId = callerId, Role = "member", JoinedAt = now, LastReadAt = now,
            WrappedChatKey = keyByUserId.GetValueOrDefault(callerId),
        });
        db.ChatMembers.Add(new ChatMember
        {
            Chat = chat, UserId = otherUserId, Role = "member", JoinedAt = now, LastReadAt = now,
            WrappedChatKey = keyByUserId.GetValueOrDefault(otherUserId),
        });
        await db.SaveChangesAsync(ct);

        await NotifyChatCreatedAsync(chat.Id, [otherUserId], ct);

        return (await GetChatSummaryAsync(chat.Id, callerId, ct), null);
    }

    public async Task<(ChatSummaryDto? Chat, string? Reason)> CreateGroupChatAsync(
        Guid callerId, string? title, string? description, List<Guid>? memberIds,
        List<MemberKeyDto>? memberKeys, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(title))
            return (null, "missing_title");

        var members = (memberIds ?? []).Distinct().Where(id => id != callerId).ToList();
        if (members.Count == 0)
            return (null, "missing_members");

        var foundCount = await db.Users.CountAsync(u => members.Contains(u.Id) && !u.IsDeleted, ct);
        if (foundCount != members.Count)
            return (null, "invalid_members");

        if ((await FilterAddRestrictedAsync(callerId, members, ct)).Count > 0)
            return (null, "restricted_members");

        var keyByUserId = (memberKeys ?? []).ToDictionary(k => k.UserId, k => k.WrappedChatKey);

        var chat = new Chat
        {
            Type = "group",
            CreatedBy = callerId,
            Title = title.Trim(),
            Description = description?.Trim(),
        };
        db.Chats.Add(chat);

        var now = DateTime.UtcNow;
        db.ChatMembers.Add(new ChatMember
        {
            Chat = chat, UserId = callerId, Role = "admin", JoinedAt = now, LastReadAt = now,
            WrappedChatKey = keyByUserId.GetValueOrDefault(callerId),
        });
        foreach (var memberId in members)
            db.ChatMembers.Add(new ChatMember
            {
                Chat = chat, UserId = memberId, Role = "member", JoinedAt = now, LastReadAt = now,
                WrappedChatKey = keyByUserId.GetValueOrDefault(memberId),
            });
        await db.SaveChangesAsync(ct);

        await NotifyChatCreatedAsync(chat.Id, members, ct);

        return (await GetChatSummaryAsync(chat.Id, callerId, ct), null);
    }

    public async Task<DateTime> MarkReadAsync(ChatMember membership, CancellationToken ct)
    {
        membership.LastReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var settings = await db.UserSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == membership.UserId, ct);
        if (settings is null || settings.ReadReceiptsEnabled)
        {
            var otherMemberIds = await db.ChatMembers.AsNoTracking()
                .Where(cm => cm.ChatId == membership.ChatId && cm.UserId != membership.UserId)
                .Select(cm => cm.UserId)
                .ToListAsync(ct);

            foreach (var id in otherMemberIds)
                await hub.Clients.User(id.ToString()).ChatRead(membership.ChatId, membership.UserId, membership.LastReadAt);
        }

        return membership.LastReadAt;
    }

    public async Task<(string? Description, List<ChatMemberDto> Members)> GetChatMembersAsync(
        ChatMember membership, CancellationToken ct)
    {
        var rows = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == membership.ChatId)
            .Select(cm => new { cm.UserId, cm.Role })
            .ToListAsync(ct);

        var names = await displayNames.GetDisplayNamesAsync(rows.Select(r => r.UserId), ct);

        var members = rows
            .Select(r => new ChatMemberDto(
                r.UserId, names.GetValueOrDefault(r.UserId, "Unknown user"), r.Role,
                r.UserId == membership.UserId, r.UserId == membership.Chat.CreatedBy))
            .OrderByDescending(m => m.IsOwner)
            .ThenByDescending(m => m.Role == "admin")
            .ThenBy(m => m.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return (membership.Chat.Description, members);
    }

    // Only the group's owner (its creator) can grant or revoke admin - admins
    // themselves can't promote/demote each other. "Perks" that come with
    // being an admin land later; today the role is just a badge.
    public async Task<string?> PromoteToAdminAsync(ChatMember callerMembership, Guid targetUserId, CancellationToken ct)
    {
        if (callerMembership.Chat.Type != "group")
            return "not_a_group";
        if (callerMembership.UserId != callerMembership.Chat.CreatedBy)
            return "forbidden";
        if (targetUserId == callerMembership.Chat.CreatedBy)
            return null;

        var target = await db.ChatMembers
            .FirstOrDefaultAsync(cm => cm.ChatId == callerMembership.ChatId && cm.UserId == targetUserId, ct);
        if (target is null)
            return "not_found";

        if (target.Role != "admin")
        {
            target.Role = "admin";
            await db.SaveChangesAsync(ct);
        }

        await BroadcastRoleChangeAsync(callerMembership.ChatId, targetUserId, "admin", ct);
        return null;
    }

    public async Task<string?> DemoteToMemberAsync(ChatMember callerMembership, Guid targetUserId, CancellationToken ct)
    {
        if (callerMembership.Chat.Type != "group")
            return "not_a_group";
        if (callerMembership.UserId != callerMembership.Chat.CreatedBy)
            return "forbidden";
        if (targetUserId == callerMembership.Chat.CreatedBy)
            return "forbidden";

        var target = await db.ChatMembers
            .FirstOrDefaultAsync(cm => cm.ChatId == callerMembership.ChatId && cm.UserId == targetUserId, ct);
        if (target is null)
            return "not_found";

        if (target.Role != "admin")
            return null;

        target.Role = "member";
        await db.SaveChangesAsync(ct);

        await BroadcastRoleChangeAsync(callerMembership.ChatId, targetUserId, "member", ct);
        return null;
    }

    private async Task BroadcastRoleChangeAsync(Guid chatId, Guid targetUserId, string role, CancellationToken ct)
    {
        var memberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == chatId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);
        foreach (var id in memberIds)
            await hub.Clients.User(id.ToString()).ChatMemberRoleChanged(chatId, targetUserId, role);
    }

    // The owner's own row is stored with Role "admin" too, so this single
    // check already covers "admin or owner" without a separate branch.
    public async Task<(List<ChatMemberDto>? Members, string? Reason)> AddMembersAsync(
        ChatMember callerMembership, List<Guid>? userIds, List<MemberKeyDto>? memberKeys, CancellationToken ct)
    {
        if (callerMembership.Chat.Type != "group")
            return (null, "not_a_group");
        if (callerMembership.Role != "admin")
            return (null, "forbidden");

        var requested = (userIds ?? []).Distinct().ToList();
        if (requested.Count == 0)
            return (null, "missing_members");

        var foundCount = await db.Users.CountAsync(u => requested.Contains(u.Id) && !u.IsDeleted, ct);
        if (foundCount != requested.Count)
            return (null, "invalid_members");

        var existingMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == callerMembership.ChatId && requested.Contains(cm.UserId))
            .Select(cm => cm.UserId)
            .ToListAsync(ct);
        var newMemberIds = requested.Except(existingMemberIds).ToList();
        if (newMemberIds.Count == 0)
            return (null, "already_members");

        if ((await FilterAddRestrictedAsync(callerMembership.UserId, newMemberIds, ct)).Count > 0)
            return (null, "restricted_members");

        // The chat's symmetric key doesn't change - the adder's client already
        // holds it (that's how it got here at all) and reseals that same key
        // to each new member's public key, rather than the group getting a
        // fresh key every time someone joins.
        var keyByUserId = (memberKeys ?? []).ToDictionary(k => k.UserId, k => k.WrappedChatKey);

        var now = DateTime.UtcNow;
        foreach (var userId in newMemberIds)
            db.ChatMembers.Add(new ChatMember
            {
                ChatId = callerMembership.ChatId, UserId = userId, Role = "member", JoinedAt = now, LastReadAt = now,
                WrappedChatKey = keyByUserId.GetValueOrDefault(userId),
            });

        var names = await displayNames.GetDisplayNamesAsync(newMemberIds.Append(callerMembership.UserId), ct);
        var adderName = names.GetValueOrDefault(callerMembership.UserId, "Unknown user");
        var addedNames = string.Join(", ", newMemberIds.Select(id => names.GetValueOrDefault(id, "Unknown user")));

        var systemMessage = new Message
        {
            ChatId = callerMembership.ChatId,
            SenderId = callerMembership.UserId,
            Type = "system",
            Content = $"{adderName} added {addedNames}",
        };
        db.Messages.Add(systemMessage);
        await db.SaveChangesAsync(ct);

        var existingMemberIdsAll = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == callerMembership.ChatId && !newMemberIds.Contains(cm.UserId))
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        var systemDto = new ChatMessageDto(
            systemMessage.Id, callerMembership.ChatId, callerMembership.UserId, adderName, null,
            systemMessage.Content, "system", null, false, systemMessage.CreatedAt, false);
        foreach (var id in existingMemberIdsAll)
            await hub.Clients.User(id.ToString()).ReceiveMessage(systemDto);

        // New members get the normal "a chat appeared" treatment, existing
        // ones get told a member joined so their open member list stays live.
        await NotifyChatCreatedAsync(callerMembership.ChatId, newMemberIds, ct);

        var (_, members) = await GetChatMembersAsync(callerMembership, ct);
        var newDtos = members.Where(m => newMemberIds.Contains(m.UserId)).ToList();
        foreach (var id in existingMemberIdsAll)
            foreach (var dto in newDtos)
                await hub.Clients.User(id.ToString()).ChatMemberAdded(callerMembership.ChatId, dto);

        return (members, null);
    }

    public async Task<string?> RemoveMemberAsync(ChatMember callerMembership, Guid targetUserId, CancellationToken ct)
    {
        if (callerMembership.Chat.Type != "group")
            return "not_a_group";
        if (callerMembership.Role != "admin")
            return "forbidden";
        if (targetUserId == callerMembership.Chat.CreatedBy)
            return "forbidden";
        if (targetUserId == callerMembership.UserId)
            return "forbidden";

        var target = await db.ChatMembers
            .FirstOrDefaultAsync(cm => cm.ChatId == callerMembership.ChatId && cm.UserId == targetUserId, ct);
        if (target is null)
            return "not_found";

        var names = await displayNames.GetDisplayNamesAsync([targetUserId], ct);
        var targetName = names.GetValueOrDefault(targetUserId, "Unknown user");

        db.ChatMembers.Remove(target);
        await db.SaveChangesAsync(ct);

        var remainingMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == callerMembership.ChatId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        var systemMessage = new Message
        {
            ChatId = callerMembership.ChatId,
            SenderId = callerMembership.UserId,
            Type = "system",
            Content = $"{targetName} was removed from the group",
        };
        db.Messages.Add(systemMessage);
        await db.SaveChangesAsync(ct);

        var systemDto = new ChatMessageDto(
            systemMessage.Id, callerMembership.ChatId, callerMembership.UserId, "", null,
            systemMessage.Content, "system", null, false, systemMessage.CreatedAt, false);
        foreach (var id in remainingMemberIds)
        {
            await hub.Clients.User(id.ToString()).ReceiveMessage(systemDto);
            await hub.Clients.User(id.ToString()).ChatMemberRemoved(callerMembership.ChatId, targetUserId);
        }

        await hub.Clients.User(targetUserId.ToString()).ChatDeleted(callerMembership.ChatId);

        return null;
    }

    public async Task SetArchivedAsync(ChatMember membership, bool isArchived, CancellationToken ct)
    {
        membership.IsArchived = isArchived;
        await db.SaveChangesAsync(ct);
    }

    // A group has no "for me"/"for everyone" split like a direct chat does -
    // only its owner (the one who created it) can delete it outright, and
    // doing so always wipes it for every member. Admins can't - they can only
    // leave, same as anyone else, via LeaveGroupAsync.
    public async Task<string?> DeleteChatAsync(ChatMember membership, bool forEveryone, CancellationToken ct)
    {
        if (membership.Chat.Type == "saved")
            return "cannot_delete_saved";

        if (membership.Chat.Type == "group")
        {
            if (membership.UserId != membership.Chat.CreatedBy)
                return "forbidden";

            membership.Chat.IsDeleted = true;
            await db.SaveChangesAsync(ct);

            var groupMemberIds = await db.ChatMembers.AsNoTracking()
                .Where(cm => cm.ChatId == membership.ChatId)
                .Select(cm => cm.UserId)
                .ToListAsync(ct);
            foreach (var id in groupMemberIds)
                await hub.Clients.User(id.ToString()).ChatDeleted(membership.ChatId);

            return null;
        }

        if (forEveryone)
        {
            membership.Chat.IsDeleted = true;
            await db.SaveChangesAsync(ct);

            var allMemberIds = await db.ChatMembers.AsNoTracking()
                .Where(cm => cm.ChatId == membership.ChatId)
                .Select(cm => cm.UserId)
                .ToListAsync(ct);
            foreach (var id in allMemberIds)
                await hub.Clients.User(id.ToString()).ChatDeleted(membership.ChatId);
        }
        else
        {
            var chatId = membership.ChatId;
            var userId = membership.UserId;
            db.ChatMembers.Remove(membership);
            await db.SaveChangesAsync(ct);

            // Only the caller loses this chat - their other devices need to
            // hear about it too, but the other member's view is untouched.
            await hub.Clients.User(userId.ToString()).ChatDeleted(chatId);
        }

        return null;
    }

    public async Task<string?> LeaveGroupAsync(ChatMember membership, CancellationToken ct)
    {
        if (membership.Chat.Type != "group")
            return "not_a_group";

        var chatId = membership.ChatId;
        var userId = membership.UserId;

        // Snapshot the name now, same reasoning as ForwardedFromSenderName -
        // the message should keep saying what was true when they left, even
        // after a later rename or account deletion.
        var names = await displayNames.GetDisplayNamesAsync([userId], ct);
        var leaverName = names.GetValueOrDefault(userId, "Unknown user");

        db.ChatMembers.Remove(membership);
        await db.SaveChangesAsync(ct);

        var remainingMemberIds = await db.ChatMembers.AsNoTracking()
            .Where(cm => cm.ChatId == chatId)
            .Select(cm => cm.UserId)
            .ToListAsync(ct);

        if (remainingMemberIds.Count == 0)
        {
            await db.Chats.Where(c => c.Id == chatId).ExecuteUpdateAsync(s => s.SetProperty(c => c.IsDeleted, true), ct);
        }
        else
        {
            var systemMessage = new Message
            {
                ChatId = chatId,
                SenderId = userId,
                Type = "system",
                Content = $"{leaverName} left the group",
            };
            db.Messages.Add(systemMessage);
            await db.SaveChangesAsync(ct);

            var dto = new ChatMessageDto(
                systemMessage.Id, chatId, userId, leaverName, null, systemMessage.Content, "system",
                null, false, systemMessage.CreatedAt, false);

            foreach (var id in remainingMemberIds)
                await hub.Clients.User(id.ToString()).ReceiveMessage(dto);
        }

        await hub.Clients.User(userId.ToString()).ChatDeleted(chatId);

        return null;
    }
}
