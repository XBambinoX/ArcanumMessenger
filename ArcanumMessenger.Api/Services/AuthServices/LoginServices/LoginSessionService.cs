using ArcanumMessenger.Contracts.Auth.Login;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services.AuthServices.LoginServices;

public class LoginSessionService(IDistributedCache cache)
    : RedisSessionService<LoginSession>(cache)
{
    protected override string KeyPrefix => "login";
    protected override TimeSpan SessionTtl => TimeSpan.FromMinutes(RedisSessionDurationMinutes);

    public async Task<string> CreateAsync(string emailHash, string? kdfSalt, CancellationToken ct)
    {
        var session = new LoginSession
        {
            KdfSalt = kdfSalt,
            EmailHash = emailHash,
            Step = 0,
        };

        return await CreateAsync(session, ct);
    }
}
