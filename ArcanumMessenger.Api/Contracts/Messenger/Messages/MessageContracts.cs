using ArcanumMessenger.Contracts.Messenger.Media;

namespace ArcanumMessenger.Contracts.Messenger.Messages;

public record ChatMessageDto(
    Guid Id,
    Guid ChatId,
    Guid SenderId,
    string SenderName,
    Guid? ReplyToId,
    string Content,
    string Type,
    MediaAssetDto? Media,
    bool IsEdited,
    DateTime CreatedAt,
    bool IsOwn);

public record MessageHistoryResponse(bool Success, IReadOnlyList<ChatMessageDto>? Messages, bool HasMore = false, string? Reason = null);

public record SendMessageRequest(string? Content, Guid? ReplyToId, Guid? MediaId, bool AsGif = false);

public record SendMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);

public record DeleteMessageResponse(bool Success, string? Reason = null);
