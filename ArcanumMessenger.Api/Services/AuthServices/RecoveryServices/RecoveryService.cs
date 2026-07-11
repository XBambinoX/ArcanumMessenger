using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.AuthServices.RecoveryServices;

public class RecoveryService(AppDbContext db, RecoverySessionService recoverySession, EmailHasher emailHasher)
{
    private const int AttemptsLimit = 3;
    private const int AuthKeySize = 32;
    private const int KdfSaltSize = 16;

    public async Task<(RecoveryResult Result, string? SessionId)> StartAsync(CancellationToken ct)
    {
        var sessionId = await recoverySession.CreateAsync(ct);
        return (RecoveryResult.Ok(), sessionId);
    }

    public async Task<RecoveryResult> VerifyAsync(string sessionId, string email, string phraseAuth, CancellationToken ct)
    {
        var session = await recoverySession.GetAsync(sessionId, ct);
        if (session is null)
            return RecoveryResult.Fail("session_expired");

        if (session.Step != 0)
            return RecoveryResult.Fail("invalid_step");

        if (session.Attempts >= AttemptsLimit)
            return RecoveryResult.Fail("too_many_attempts");

        session.Attempts++;

        const string genericError = "invalid_credentials";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(phraseAuth) ||
            !PasswordHasher.IsHexOfLength(phraseAuth, 64))
        {
            await recoverySession.UpdateAsync(sessionId, session, ct);
            return RecoveryResult.Fail(genericError);
        }

        var emailHash = emailHasher.Hash(email);

        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.EmailHash == emailHash && !u.IsDeleted, ct);

        if (user is null)
        {
            PasswordHasher.Verify(phraseAuth, PasswordHasher.DummyPasswordHash);
            await recoverySession.UpdateAsync(sessionId, session, ct);
            return RecoveryResult.Fail(genericError);
        }

        var phraseMatches =
            PasswordHasher.Verify(phraseAuth, user.RecoveryPhrase1Hash) ||
            PasswordHasher.Verify(phraseAuth, user.RecoveryPhrase2Hash);

        if (!phraseMatches)
        {
            await recoverySession.UpdateAsync(sessionId, session, ct);
            return RecoveryResult.Fail(genericError);
        }

        session.UserId = user.Id;
        session.Step = 1;
        await recoverySession.UpdateAsync(sessionId, session, ct);

        return RecoveryResult.Ok();
    }

    public async Task<RecoveryResult> ResetPasswordAsync(string sessionId, string authKey, string kdfSalt, CancellationToken ct)
    {
        var session = await recoverySession.GetAsync(sessionId, ct);
        if (session is null)
            return RecoveryResult.Fail("session_expired");

        if (session.Step != 1)
            return RecoveryResult.Fail("invalid_step");

        if (!PasswordHasher.IsBase64OfLength(authKey, AuthKeySize) ||
            !PasswordHasher.IsBase64OfLength(kdfSalt, KdfSaltSize))
            return RecoveryResult.Fail("invalid_key_format");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == session.UserId && !u.IsDeleted, ct);
        if (user is null)
            return RecoveryResult.Fail("session_expired");

        user.PasswordHash = PasswordHasher.Hash(authKey);
        user.KdfSalt = kdfSalt;

        await db.SaveChangesAsync(ct);
        await recoverySession.DeleteAsync(sessionId, ct);

        return RecoveryResult.Ok();
    }
}