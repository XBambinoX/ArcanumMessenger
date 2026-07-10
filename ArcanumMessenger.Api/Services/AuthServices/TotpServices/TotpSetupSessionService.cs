using System.Text.Json;
using ArcanumMessenger.Contracts.Auth.Totp;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services.AuthServices.TotpServices;

public class TotpSetupSessionService(IDistributedCache cache)
{
    private const int RedisSessionDurationMinutes = 10;

    private static readonly TimeSpan SessionTtl = TimeSpan.FromMinutes(RedisSessionDurationMinutes);
    private static string Key(string sessionId) => $"totp-setup:{sessionId}";

    public async Task<string> CreateAsync(Guid userId, string secret, CancellationToken ct)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        var session = new TotpSetupSession
        {
            UserId = userId,
            Secret = secret,
        };

        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = SessionTtl
        };
        await cache.SetStringAsync(Key(sessionId), JsonSerializer.Serialize(session), options, ct);
        return sessionId;
    }

    public async Task<TotpSetupSession?> GetAsync(string sessionId, CancellationToken ct)
    {
        var json = await cache.GetStringAsync(Key(sessionId), ct);
        return json == null ? null : JsonSerializer.Deserialize<TotpSetupSession>(json);
    }

    public async Task DeleteAsync(string sessionId, CancellationToken ct)
    {
        await cache.RemoveAsync(Key(sessionId), ct);
    }
}
