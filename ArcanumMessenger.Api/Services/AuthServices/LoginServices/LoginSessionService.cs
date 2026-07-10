using ArcanumMessenger.Contracts.Auth.Login;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services;

public class LoginSessionService(IDistributedCache cache)
    : RedisSessionService<LoginSession>(cache)
{
    protected override string KeyPrefix => "login";
    protected override TimeSpan SessionTtl => TimeSpan.FromMinutes(10);

    public async Task<string> CreateAsync(string emailHash, string? kdfSalt, CancellationToken ct)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        var session = new LoginSession                                     
        {
            KdfSalt = kdfSalt,
            EmailHash = emailHash,
            Step = 0,
        };
        await SaveAsync(sessionId, session, ct);
        return sessionId;
    }
}
