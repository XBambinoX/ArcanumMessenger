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
    Guid? OtherUserId);

public record ChatListResponse(bool Success, IReadOnlyList<ChatSummaryDto>? Chats, string? Reason = null);

public record CreateChatRequest(string Type, Guid? OtherUserId, string? Title, string? Description, List<Guid>? MemberIds);

public record CreateChatResponse(bool Success, ChatSummaryDto? Chat, string? Reason = null);

public record MarkChatReadResponse(bool Success, DateTime? LastReadAt = null, string? Reason = null);

public record SetArchivedRequest(bool IsArchived);

public record SetArchivedResponse(bool Success, bool? IsArchived = null, string? Reason = null);
