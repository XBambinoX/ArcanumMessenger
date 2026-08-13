using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.SignalR;

namespace ArcanumMessenger.Hubs;

// SignalR's default IUserIdProvider reads ClaimTypes.NameIdentifier, which
// only has a value because of JWT claim-type remapping. Program.cs turns
// that remapping off (see the comment there), so "sub" stays "sub" - this
// reads it directly, the same way MessengerControllerBase does for REST.
public class SubjectUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) =>
        connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
}
