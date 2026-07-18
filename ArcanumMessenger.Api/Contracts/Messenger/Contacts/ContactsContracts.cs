using ArcanumMessenger.Contracts.Messenger.Users;

namespace ArcanumMessenger.Contracts.Messenger.Contacts;

public record ContactsListResponse(bool Success, IReadOnlyList<UserSearchResultDto>? Contacts, string? Reason = null);

public record AddContactRequest(Guid ContactId);

public record AddContactResponse(bool Success, string? Reason = null);
