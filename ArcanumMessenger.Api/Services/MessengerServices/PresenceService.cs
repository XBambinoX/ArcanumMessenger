using StackExchange.Redis;

namespace ArcanumMessenger.Services.MessengerServices;

public class PresenceService(IConnectionMultiplexer redis)
{
    private static readonly TimeSpan ConnectionSetTtl = TimeSpan.FromMinutes(5);
    private IDatabase Db => redis.GetDatabase();

    private static string ConnectionsKey(Guid userId) => $"presence:conns:{userId}";

    /// <summary>
    /// Registers a new SignalR connection for the user.
    /// </summary>
    public async Task<bool> AddConnectionAsync(Guid userId, string connectionId)
    {
        var key = ConnectionsKey(userId);

        var wasEmpty = await Db.SetLengthAsync(key) == 0;

        await Db.SetAddAsync(key, connectionId);
        await Db.KeyExpireAsync(key, ConnectionSetTtl);

        return wasEmpty;
    }

    /// <summary>
    /// Removes a connection. Returns true if the user has no remaining active connections
    /// </summary>
    public async Task<bool> RemoveConnectionAsync(Guid userId, string connectionId)
    {
        var key = ConnectionsKey(userId);
        await Db.SetRemoveAsync(key, connectionId);
        return await Db.SetLengthAsync(key) == 0;
    }

    public async Task<bool> IsOnlineAsync(Guid userId)
    {
        return await Db.SetLengthAsync(ConnectionsKey(userId)) > 0;
    }
}