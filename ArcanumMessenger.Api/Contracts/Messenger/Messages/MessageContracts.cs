namespace ArcanumMessenger.Contracts.Messenger.Messages;

public record ChatMessageDto(
    Guid Id,
    Guid ChatId,
    Guid SenderId,
    string SenderName,
    Guid? ReplyToId,
    string Content,
    bool IsEdited,
    DateTime CreatedAt,
    bool IsOwn);

public record MessageHistoryResponse(bool Success, IReadOnlyList<ChatMessageDto>? Messages, bool HasMore = false, string? Reason = null);

public record SendMessageRequest(string Content, Guid? ReplyToId);

public record SendMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);
