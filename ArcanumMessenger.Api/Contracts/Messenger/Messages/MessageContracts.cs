using ArcanumMessenger.Contracts.Messenger.Media;

namespace ArcanumMessenger.Contracts.Messenger.Messages;

public record MessageReactionDto(string Emoji, int Count, bool ReactedByMe);

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
    string? ForwardedFromSenderName = null,
    IReadOnlyList<MessageReactionDto>? Reactions = null);

public record ChatReadStateDto(Guid UserId, DateTime LastReadAt);

public record MessageHistoryResponse(
    bool Success,
    IReadOnlyList<ChatMessageDto>? Messages,
    bool HasMore = false,
    string? Reason = null,
    IReadOnlyList<ChatReadStateDto>? ReadStates = null);

public record SendMessageRequest(string? Content, Guid? ReplyToId, Guid? MediaId, bool AsGif = false, bool AsVideoNote = false);

public record SendMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);

public record DeleteMessageResponse(bool Success, string? Reason = null);

public record EditMessageRequest(string? Content);

public record EditMessageResponse(bool Success, ChatMessageDto? Message, string? Reason = null);

// Forwarding across chats with different keys can't be done server-side
// under E2EE - the client decrypts each source message (it already has the
// plaintext on screen) and re-encrypts it under the DESTINATION chat's key.
// Media works the same way but can't be transcoded in place like a short
// text string can: NewMediaId is a brand new MediaAsset the client already
// downloaded, decrypted, and re-uploaded encrypted under the destination
// chat's key before calling this - required whenever the source message
// actually has media attached, ignored otherwise.
public record ForwardItemRequest(Guid SourceMessageId, string EncryptedContent, Guid? NewMediaId = null);
public record ForwardMessagesRequest(List<ForwardItemRequest> Items);

public record ForwardMessagesResponse(bool Success, List<ChatMessageDto>? Messages, string? Reason = null);

public record ChatMediaItemDto(Guid MessageId, DateTime CreatedAt, MediaAssetDto Media);

public record ChatMediaResponse(
    bool Success, IReadOnlyList<ChatMediaItemDto>? Items = null, bool HasMore = false, string? Reason = null);

public record ChatStatsResponse(bool Success, int MessageCount = 0, int MediaCount = 0, string? Reason = null);

// Add and remove are separate (not a toggle) - one person can stack the
// same emoji on a message more than once, capped in total per person per
// message in MessageService. Remove always drops exactly one copy.
public record AddReactionRequest(string Emoji);

public record ReactionMutationResponse(bool Success, IReadOnlyList<MessageReactionDto>? Reactions = null, string? Reason = null);
