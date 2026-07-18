namespace ArcanumMessenger.Contracts.Messenger.Users;


public record GetUserResponce(string? Name, string? Id, DateTime? LastSeen, string? PublicEmail, string? PublicBio, string? PublicPhone, bool success, string? reason);