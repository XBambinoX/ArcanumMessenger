using System.Linq.Expressions;
using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;
using ArcanumMessenger.Services.AuthServices.TotpServices;
using ArcanumMessenger.Entities;

namespace ArcanumMessenger.Services.AuthServices;

public class AuthService(AppDbContext db, EncryptionService encryption, TotpService totp)
{

    public async Task<bool> IsEmailExist(string emailHash, CancellationToken ct)
    {
        return await db.Users
                .AsNoTracking()
                .AnyAsync(u => u.EmailHash == emailHash && !u.IsDeleted, ct);
    }


    public async Task<string?> GetKdfSaltAsync(string emailHash, CancellationToken ct)
    {
        return await db.Users
                .Where(u => u.EmailHash == emailHash)
                .Select(u => u.KdfSalt)
                .FirstOrDefaultAsync(ct);
    }


    public async Task<(bool IsCorrect, bool RequiresTotp)> CheckPassAsync(string emailHash, string AuthKey, CancellationToken ct)
    {
        var user = await GetUserAsync(u => u.EmailHash == emailHash, ct);

        var passHash = user?.PasswordHash ?? PasswordHasher.DummyPasswordHash;
        var isCorrect = PasswordHasher.Verify(AuthKey, passHash);

        return (isCorrect, isCorrect && (user?.TwoFactorEnabled ?? false));
    }


    public async Task<bool> CheckTotpAsync(string emailHash, string code, CancellationToken ct)
    {
        var user = await GetUserAsync(u => u.EmailHash == emailHash, ct);

        if (user is null || !user.TwoFactorEnabled || user.TwoFactorSecretEnc is null)
            return false;

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var secret = encryption.Decrypt(user.TwoFactorSecretEnc, dek);

        return totp.VerifyCode(secret, code);
    }


    public async Task<User?> GetUserAsync(Expression<Func<User, bool>> predicate, CancellationToken ct)
    {
        return await db.Users
            .Where(u => !u.IsDeleted)
            .Where(predicate)
            .FirstOrDefaultAsync(ct);
    }


    public async Task<bool> UserRequiresTotpAsync(string emailHash, CancellationToken ct)
    {
        return await db.Users
            .Where(u => u.EmailHash == emailHash && !u.IsDeleted)
            .Select(u => u.TwoFactorEnabled)
            .FirstOrDefaultAsync(ct);
    }

}