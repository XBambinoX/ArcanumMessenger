namespace ArcanumMessenger.Contracts.Auth;

public record SubmitEmailRequest(
    string SessionId,
    string Email,
    bool EmailVisibilityConsent);