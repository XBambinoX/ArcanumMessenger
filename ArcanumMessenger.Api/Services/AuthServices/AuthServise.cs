using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.AuthServices;

public class AuthService(AppDbContext db)
{
    public async Task<string?> GetKdfSaltAsync(string emailHash, CancellationToken ct)
    {
        return await db.Users
            .Where(u => u.EmailHash == emailHash)
            .Select(u => u.KdfSalt)
            .FirstOrDefaultAsync(ct);
    }


    public async Task<bool> CheckPassAsync(string emailHash, string AuthKey, CancellationToken ct)
    {
        var user = await db.Users
                            .Where(u => u.EmailHash == emailHash && !u.IsDeleted)
                            .FirstOrDefaultAsync(ct);

        var passHash = user?.PasswordHash ?? PasswordHasher.DummyPasswordHash;

        return PasswordHasher.Verify(AuthKey, passHash);
    }
}