namespace ArcanumMessenger.Contracts.Auth;

public record SubmitEmailResponse(bool Success, string? Reason = null);