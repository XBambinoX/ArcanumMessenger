namespace ArcanumMessenger.Contracts.Messenger.Users;


public record GetUserResponce(string? Name, string? Id, DateTime? LastSeen, string? Email, string? Bio, string? Phone, bool IsContact, bool IsBlocked, bool IsBlockedByOther, bool success, string? reason);

public record UserSearchResultDto(Guid Id, string Name, string PublicId);

public record SearchUsersResponse(bool Success, IReadOnlyList<UserSearchResultDto>? Results, string? Reason = null);