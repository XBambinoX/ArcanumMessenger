namespace ArcanumMessenger.Contracts.Auth.Session;

public record MeResponse(bool Success, string? UserId);
public record RefreshResponse(bool Success, string? Reason = null);