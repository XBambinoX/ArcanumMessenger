namespace ArcanumMessenger.Contracts.Messenger.Chats;

public record ChatSummaryDto(
    Guid Id,
    string Type,
    string Title,
    string? LastMessageText,
    DateTime? LastMessageAt,
    int UnreadCount,
    bool IsMuted,
    bool IsArchived,
    Guid? OtherUserId,
    bool IsBlocked);

public record ChatListResponse(bool Success, IReadOnlyList<ChatSummaryDto>? Chats, string? Reason = null);

public record CreateChatRequest(string Type, Guid? OtherUserId, string? Title, string? Description, List<Guid>? MemberIds);

public record CreateChatResponse(bool Success, ChatSummaryDto? Chat, string? Reason = null);

public record MarkChatReadResponse(bool Success, DateTime? LastReadAt = null, string? Reason = null);

public record SetArchivedRequest(bool IsArchived);

public record SetArchivedResponse(bool Success, bool? IsArchived = null, string? Reason = null);

public record DeleteChatResponse(bool Success, string? Reason = null);

public record LeaveChatResponse(bool Success, string? Reason = null);

public record ChatMemberDto(Guid UserId, string Name, string Role, bool IsSelf, bool IsOwner);

public record ChatMembersResponse(
    bool Success, string? Description = null, IReadOnlyList<ChatMemberDto>? Members = null, string? Reason = null);

public record PromoteMemberResponse(bool Success, string? Reason = null);

public record DemoteMemberResponse(bool Success, string? Reason = null);

public record AddMembersRequest(List<Guid>? UserIds);

public record AddMembersResponse(bool Success, IReadOnlyList<ChatMemberDto>? Members = null, string? Reason = null);

public record RemoveMemberResponse(bool Success, string? Reason = null);

public record UploadChatAvatarResponse(bool Success, string? Reason = null);
