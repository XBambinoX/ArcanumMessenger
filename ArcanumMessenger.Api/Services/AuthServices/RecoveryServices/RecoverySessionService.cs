using ArcanumMessenger.Contracts.Auth.Recovery;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services.AuthServices.RecoveryServices;

public class RecoverySessionService(IDistributedCache cache)
    : RedisSessionService<RecoverySession>(cache)
{
    protected override string KeyPrefix => "recovery";
    protected override TimeSpan SessionTtl => TimeSpan.FromMinutes(RedisSessionDurationMinutes);

    public async Task<string> CreateAsync(CancellationToken ct)
    {
        var session = new RecoverySession
        {
            Step = 0,
            Attempts = 0,
            CreatedAt = DateTime.UtcNow
        };

        return await CreateAsync(session, ct);
    }
}