namespace ArcanumMessenger.Contracts.Auth
{
    public record StartRegistrationResponse(
    bool Success,
    string? SessionId,
    string? Reason = null);
}