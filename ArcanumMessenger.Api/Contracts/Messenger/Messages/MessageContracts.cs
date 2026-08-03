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

public record ChatReadStateDto(Guid UserId, DateTime LastReadAt);

public record MessageHistoryResponse(
    bool Success,
    IReadOnlyList<ChatMessageDto>? Messages,
    bool HasMore = false,
    string? Reason = null,
    IReadOnlyList<ChatReadStateDto>? ReadStates = null);

public record SendMessageRequest(string? Content, Guid? ReplyToId, Guid? MediaId, bool AsGif = false);

public record SendMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);

public record DeleteMessageResponse(bool Success, string? Reason = null);

public record EditMessageRequest(string? Content);

public record EditMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);

// Forwarding across chats with different keys can't be done server-side
// under E2EE - the client decrypts each source message (it already has the
// plaintext on screen) and re-encrypts it under the DESTINATION chat's key.
public record ForwardItemRequest(Guid SourceMessageId, string EncryptedContent);
public record ForwardMessagesRequest(List<ForwardItemRequest> Items);

public record ForwardMessagesResponse(bool Success, List<ChatMessageDto>? Messages, string? Reason = null);
