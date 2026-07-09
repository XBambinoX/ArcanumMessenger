using ArcanumMessenger.Contracts.Auth.Recovery;
using ArcanumMessenger.Services;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace ArcanumMessenger.Controllers;

[ApiController]
[Route("api/auth/recovery")]
public class RecoveryController(AppDbContext db, RecoverySessionService recoverySession, EmailHasher emailHasher) : ControllerBase
{
    private static readonly Regex PhraseAuthRegex = new("^[0-9a-f]{64}$", RegexOptions.Compiled);
    private const int AttemptsLimit = 3;

    [HttpPost("start")]
    public async Task<ActionResult<StartRecoveryResponse>> Start(CancellationToken ct)
    {
        var sessionId = await recoverySession.CreateAsync(ct);
        return Ok(new StartRecoveryResponse(true, sessionId));
    }

    [HttpPost("verify")]
    public async Task<ActionResult<VerifyRecoveryResponse>> Verify(
        [FromBody] VerifyRecoveryRequest request,
        CancellationToken ct)
    {
        var session = await recoverySession.GetAsync(request.SessionId, ct);
        if (session is null)
            return Ok(new VerifyRecoveryResponse(false, "session_expired"));

        if (session.Step != 0)
            return Ok(new VerifyRecoveryResponse(false, "invalid_step"));

        if (session.Attempts >= AttemptsLimit)
            return Ok(new VerifyRecoveryResponse(false, "too_many_attempts"));

        session.Attempts++;

        const string genericError = "invalid_credentials";

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.PhraseAuth))
        {
            await recoverySession.UpdateAsync(request.SessionId, session, ct);
            return Ok(new VerifyRecoveryResponse(false, genericError));
        }

        if (!PhraseAuthRegex.IsMatch(request.PhraseAuth))
        {
            await recoverySession.UpdateAsync(request.SessionId, session, ct);
            return Ok(new VerifyRecoveryResponse(false, genericError));
        }

        var emailHash = emailHasher.Hash(request.Email);

        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.EmailHash == emailHash && !u.IsDeleted, ct);

        if (user is null)
        {
            await recoverySession.UpdateAsync(request.SessionId, session, ct);
            return Ok(new VerifyRecoveryResponse(false, genericError));
        }

        var phraseMatches =
            PasswordHasher.Verify(request.PhraseAuth, user.RecoveryPhrase1Hash) ||
            PasswordHasher.Verify(request.PhraseAuth, user.RecoveryPhrase2Hash);
            
        if (!phraseMatches)
        {
            await recoverySession.UpdateAsync(request.SessionId, session, ct);
            return Ok(new VerifyRecoveryResponse(false, genericError));
        }

        session.UserId = user.Id;
        session.Step = 1;
        await recoverySession.UpdateAsync(request.SessionId, session, ct);

        return Ok(new VerifyRecoveryResponse(true));
    }
}