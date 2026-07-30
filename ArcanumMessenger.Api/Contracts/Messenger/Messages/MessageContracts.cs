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
    bool IsOwn,
    Guid? ForwardedFromSenderId = null,
    string? ForwardedFromSenderName = null);

public record MessageHistoryResponse(bool Success, IReadOnlyList<ChatMessageDto>? Messages, bool HasMore = false, string? Reason = null);

public record SendMessageRequest(string? Content, Guid? ReplyToId, Guid? MediaId, bool AsGif = false);

public record SendMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);

public record DeleteMessageResponse(bool Success, string? Reason = null);

public record EditMessageRequest(string? Content);

public record EditMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);

public record ForwardMessagesRequest(List<Guid> MessageIds);

public record ForwardMessagesResponse(bool Success, List<ChatMessageDto>? Messages, string? Reason = null);
