using System.Text.Json;
using ArcanumMessenger.Contracts.Login;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services;

public class LoginSessionService(IDistributedCache cache)
{
    private const int RedisSessionDurationMinutes = 10;

    private static readonly TimeSpan SessionTtl = TimeSpan.FromMinutes(RedisSessionDurationMinutes);
    private static string Key(string sessionId) => $"login:{sessionId}";

    private async Task SaveAsync(string sessionId, LoginSession session, CancellationToken ct)
    {
        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = SessionTtl
        };
        await cache.SetStringAsync(Key(sessionId), JsonSerializer.Serialize(session), options, ct);
    }



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



    public async Task<LoginSession?> GetAsync(string sessionId, CancellationToken ct)
    {

        var json = await cache.GetStringAsync(Key(sessionId), ct);

        return json == null ? null : JsonSerializer.Deserialize<LoginSession>(json);
    }



    public async Task UpdateAsync(string sessionId, LoginSession loginSession, CancellationToken ct)
    {
        await SaveAsync(sessionId, loginSession, ct);
    }



    public async Task DeleteAsync(string sessionId, CancellationToken ct)
    {
        await cache.RemoveAsync(Key(sessionId), ct);
    }
}