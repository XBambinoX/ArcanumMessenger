namespace ArcanumMessenger.Contracts.Messenger.Users;


// EcdhPublicKey is this user's E2EE identity public key - unlike phone/bio/email
// it's never visibility-gated, since anyone who can message this user needs it
// to seal a chat key to them. Null only for accounts that predate E2EE and
// haven't logged in since (see UsersController.SetIdentityKey).
public record GetUserResponce(string? Name, string? Id, DateTime? LastSeen, string? Email, string? Bio, string? Phone, bool IsContact, bool IsBlocked, bool IsBlockedByOther, bool success, string? reason, string? EcdhPublicKey = null);

public record UserSearchResultDto(Guid Id, string Name, string PublicId, string? EcdhPublicKey = null);

public record SearchUsersResponse(bool Success, IReadOnlyList<UserSearchResultDto>? Results, string? Reason = null);

public record UploadAvatarResponse(bool Success, string? Reason = null);

// For accounts that predate E2EE and still have no identity keypair. Only
// ever sets a caller's FIRST keypair - never overwrites an existing one
// (that's what password recovery's own reset flow does, since it also has
// to invalidate every chat's stale wrapped key for this user).
public record SetIdentityKeyRequest(string EcdhPublicKey, string WrappedEcdhPrivateKey);
public record SetIdentityKeyResponse(bool Success, string? Reason = null);