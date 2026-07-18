namespace ArcanumMessenger.Contracts.Messenger.Users;


public record GetUserResponce(string? Name, string? Id, DateTime? LastSeen, string? PublicEmail, string? PublicBio, string? PublicPhone, bool IsContact, bool success, string? reason);

public record UserSearchResultDto(Guid Id, string Name, string PublicId);

public record SearchUsersResponse(bool Success, IReadOnlyList<UserSearchResultDto>? Results, string? Reason = null);