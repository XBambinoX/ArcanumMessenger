namespace ArcanumMessenger.Contracts.Messenger.Chats;

// WrappedChatKey is the CALLER's own copy of this chat's symmetric key,
// sealed to their ECDH public key - nobody else's key material, including
// the server's, can open it. Null means it still needs (re)provisioning
// (see the chats self-heal flow). LastMessageText is ciphertext (unless
// LastMessageType is "system") - the client decrypts it with WrappedChatKey
// before ever displaying it.
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
    bool IsBlocked,
    string? WrappedChatKey = null,
    string? LastMessageType = null);

public record ChatListResponse(bool Success, IReadOnlyList<ChatSummaryDto>? Chats, string? Reason = null);

// One sealed copy of a chat's new symmetric key per initial member (including
// the creator's own) - generated and sealed entirely client-side, see
// crypto/chatKey.ts and crypto/ecdh.ts's seal().
public record MemberKeyDto(Guid UserId, string WrappedChatKey);

// ChatId is only meaningful (and only ever sent) for group chats - the
// client has to encrypt Title/Description with the chat's own key before
// this request even exists, and that encryption needs a chat id as
// authenticated data before the server has assigned one. The client
// generates it instead; a random v4 GUID collision is astronomically
// unlikely, and the DB's primary key would just reject the insert if it
// somehow happened, not corrupt anything.
public record CreateChatRequest(
    string Type, Guid? OtherUserId, string? Title, string? Description,
    List<Guid>? MemberIds, List<MemberKeyDto>? MemberKeys = null, Guid? ChatId = null);

public record CreateChatResponse(bool Success, ChatSummaryDto? Chat, string? Reason = null);

public record MarkChatReadResponse(bool Success, DateTime? LastReadAt = null, string? Reason = null);

public record SetArchivedRequest(bool IsArchived);

public record SetArchivedResponse(bool Success, bool? IsArchived = null, string? Reason = null);

public record DeleteChatResponse(bool Success, string? Reason = null);

public record LeaveChatResponse(bool Success, string? Reason = null);

// HasChatKey/EcdhPublicKey let any member's client notice a gap (this
// member has no wrapped copy of the chat's key yet - freshly added before
// the seal landed, or their identity keypair rotated via password recovery)
// and opportunistically reseal + upload one for them - see the chats
// self-heal flow. HasChatKey only reveals presence/absence, never the key
// itself.
public record ChatMemberDto(Guid UserId, string Name, string Role, bool IsSelf, bool IsOwner,
    bool HasChatKey = false, string? EcdhPublicKey = null);

// WrappedChatKey here is the chat's EXISTING symmetric key, resealed by the
// caller (who must already hold it) to the target member's public key - it
// only ever fills a currently-null slot, never overwrites one.
public record SetMemberChatKeyRequest(string WrappedChatKey);
public record SetMemberChatKeyResponse(bool Success, string? Reason = null);

public record ChatMembersResponse(
    bool Success, string? Description = null, IReadOnlyList<ChatMemberDto>? Members = null, string? Reason = null);

public record PromoteMemberResponse(bool Success, string? Reason = null);

public record DemoteMemberResponse(bool Success, string? Reason = null);

// MemberKeys carries one sealed copy of the chat's *existing* symmetric key
// per new member being added, sealed by the adder's own client (which must
// already hold that key to add anyone in the first place).
public record AddMembersRequest(List<Guid>? UserIds, List<MemberKeyDto>? MemberKeys = null);

public record AddMembersResponse(bool Success, IReadOnlyList<ChatMemberDto>? Members = null, string? Reason = null);

public record RemoveMemberResponse(bool Success, string? Reason = null);

public record UploadChatAvatarResponse(bool Success, string? Reason = null);
