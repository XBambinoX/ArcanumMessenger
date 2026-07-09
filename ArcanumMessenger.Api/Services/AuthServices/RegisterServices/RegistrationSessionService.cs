using ArcanumMessenger.Contracts.Auth.Register;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services;

public class RegistrationSessionService(IDistributedCache cache)
    : RedisSessionService<RegistrationSession>(cache)
{
    protected override string KeyPrefix => "registration";
    protected override TimeSpan SessionTtl => TimeSpan.FromMinutes(10);

    public async Task<string> CreateAsync(string username, CancellationToken ct)
    {
        var session = new RegistrationSession
        {
            Username = username,
            Step = 0,
            CreatedAt = DateTime.UtcNow
        };

        return await CreateAsync(session, ct);
    }
}