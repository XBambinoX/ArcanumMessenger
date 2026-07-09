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
    private const int AuthKeySize = 32;
    private const int KdfSaltSize = 16;

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

    [HttpPost("reset-password")]
    public async Task<ActionResult<ResetPasswordResponse>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken ct)
    {
        var session = await recoverySession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new ResetPasswordResponse(false, "session_expired"));

        if (session.Step != 1)
            return BadRequest(new ResetPasswordResponse(false, "invalid_step"));

        if (!PasswordHasher.IsBase64OfLength(request.AuthKey, AuthKeySize) ||
            !PasswordHasher.IsBase64OfLength(request.KdfSalt, KdfSaltSize))
            return StatusCode(StatusCodes.Status422UnprocessableEntity, new ResetPasswordResponse(false, "invalid_key_format"));

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == session.UserId && !u.IsDeleted, ct);
        if (user is null)
            return StatusCode(StatusCodes.Status410Gone, new ResetPasswordResponse(false, "session_expired"));

        user.PasswordHash = PasswordHasher.Hash(request.AuthKey);
        user.KdfSalt = request.KdfSalt;

        await db.SaveChangesAsync(ct);
        await recoverySession.DeleteAsync(request.SessionId, ct);

        return Ok(new ResetPasswordResponse(true));
    }
}