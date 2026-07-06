using System.Text.Json;
using ArcanumMessenger.Contracts.Auth.Register;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services.AuthServices.RegisterServices;

public class RegistrationSessionService(IDistributedCache cache)
{
    private const int RedisSessionDurationMinutes = 10;

    private static readonly TimeSpan SessionTtl = TimeSpan.FromMinutes(RedisSessionDurationMinutes);
    private static string Key(string sessionId) => $"reg:{sessionId}";

    public async Task<string> CreateAsync(string username, CancellationToken ct)
    {
        var sessionId = Guid.NewGuid().ToString("N");
        var session = new RegistrationSession
        {
            Username = username,
            Step = 0,
            CreatedAt = DateTime.UtcNow
        };
        await SaveAsync(sessionId, session, ct);
        return sessionId;
    }

    public async Task<RegistrationSession?> GetAsync(string sessionId, CancellationToken ct)
    {
        var json = await cache.GetStringAsync(Key(sessionId), ct);
        return json is null ? null : JsonSerializer.Deserialize<RegistrationSession>(json);
    }

    public async Task UpdateAsync(string sessionId, RegistrationSession session, CancellationToken ct)
        => await SaveAsync(sessionId, session, ct);

    public async Task DeleteAsync(string sessionId, CancellationToken ct)
        => await cache.RemoveAsync(Key(sessionId), ct);

    private async Task SaveAsync(string sessionId, RegistrationSession session, CancellationToken ct)
    {
        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = SessionTtl
        };
        await cache.SetStringAsync(Key(sessionId), JsonSerializer.Serialize(session), options, ct);
    }
}