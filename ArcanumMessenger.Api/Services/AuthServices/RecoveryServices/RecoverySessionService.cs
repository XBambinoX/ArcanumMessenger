using ArcanumMessenger.Contracts.Auth.Recovery;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace ArcanumMessenger.Services;

public class RecoverySessionService(IDistributedCache cache)
    : RedisSessionService<RecoverySession>(cache)
{
    protected override string KeyPrefix => "recovery";
    protected override TimeSpan SessionTtl => TimeSpan.FromMinutes(10);

        public async Task<string> CreateAsync(CancellationToken ct)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        var session = new RecoverySession
        {
            Step = 0,
            Attempts = 0,
            CreatedAt = DateTime.UtcNow
        };

        await cache.SetStringAsync(
            $"recovery:{sessionId}",
            JsonSerializer.Serialize(session),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = SessionTtl },
            ct
        );

        return sessionId;
    }
}