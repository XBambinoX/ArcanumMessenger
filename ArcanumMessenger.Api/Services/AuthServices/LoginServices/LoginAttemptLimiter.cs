using StackExchange.Redis;

namespace ArcanumMessenger.Services.AuthServices.LoginServices;

public class LoginAttemptLimiter(IConnectionMultiplexer redis)
{
    private const int MaxFailures = 5;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    public enum Step { Password, Totp }

    private IDatabase Db => redis.GetDatabase();

    private static string Key(Step step, string emailHash) =>
        $"login-failures:{step.ToString().ToLowerInvariant()}:{emailHash}";

    public async Task<bool> IsBlockedAsync(Step step, string emailHash) =>
        (int?)await Db.StringGetAsync(Key(step, emailHash)) >= MaxFailures;

    public async Task RecordFailureAsync(Step step, string emailHash)
    {
        var key = Key(step, emailHash);
        await Db.StringIncrementAsync(key);
        await Db.KeyExpireAsync(key, Window, ExpireWhen.HasNoExpiry);
    }

    public Task ResetAsync(string emailHash) =>
        Db.KeyDeleteAsync([Key(Step.Password, emailHash), Key(Step.Totp, emailHash)]);
}
