using System;

namespace ArcanumMessenger.Contracts.Auth
{
    public record CheckUsernameResponse(bool Available, string? Reason = null);
}
