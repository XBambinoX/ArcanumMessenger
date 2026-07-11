using System.Text.Json;
using ArcanumMessenger.Contracts.Auth.Totp;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services.AuthServices.TotpServices;

public class TotpSetupSessionService(IDistributedCache cache)
    : RedisSessionService<TotpSetupSession>(cache)
{
    protected override string KeyPrefix => "totp-setup";
    protected override TimeSpan SessionTtl => TimeSpan.FromMinutes(RedisSessionDurationMinutes);

    public async Task<string> CreateAsync(Guid userId, string secret, CancellationToken ct)
    {
        var session = new TotpSetupSession
        {
            UserId = userId,
            Secret = secret,
        };

        return await CreateAsync(session, ct);
    }
}
