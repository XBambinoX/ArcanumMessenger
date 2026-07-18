namespace ArcanumMessenger.Contracts.Messenger.Users;


public record GetCurrentUserResponce(string? Name, string? Id, DateTime? LastSeen, bool success, string? reason);