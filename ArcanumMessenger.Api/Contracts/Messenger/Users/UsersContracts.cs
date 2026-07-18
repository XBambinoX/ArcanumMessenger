namespace ArcanumMessenger.Contracts.Messenger.Users;


public record GetUserResponce(string? Name, string? Id, DateTime? LastSeen, string? PublicEmail, string? PublicBio, bool success, string? reason);