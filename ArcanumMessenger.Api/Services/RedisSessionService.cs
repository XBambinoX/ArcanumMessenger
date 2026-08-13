using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace ArcanumMessenger.Services;

public abstract class RedisSessionService<TSession>(IDistributedCache cache) where TSession : class
{
    protected const int RedisSessionDurationMinutes = 10;
    protected abstract string KeyPrefix { get; }
    protected abstract TimeSpan SessionTtl { get; }

    protected virtual string BuildKey(string sessionId) => $"{KeyPrefix}:{sessionId}";

    public virtual async Task<string> CreateAsync(TSession session, CancellationToken ct)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        await SaveAsync(sessionId, session, ct);
        return sessionId;
    }

    public async Task<TSession?> GetAsync(string sessionId, CancellationToken ct)
    {
        var json = await cache.GetStringAsync(BuildKey(sessionId), ct);
        return json is null ? null : JsonSerializer.Deserialize<TSession>(json);
    }

    public Task UpdateAsync(string sessionId, TSession session, CancellationToken ct)
        => SaveAsync(sessionId, session, ct);

    public Task DeleteAsync(string sessionId, CancellationToken ct)
        => cache.RemoveAsync(BuildKey(sessionId), ct);

    public Task SaveAsync(string sessionId, TSession session, CancellationToken ct)
    {
        return cache.SetStringAsync(
            BuildKey(sessionId),
            JsonSerializer.Serialize(session),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = SessionTtl },
            ct
        );
    }
}