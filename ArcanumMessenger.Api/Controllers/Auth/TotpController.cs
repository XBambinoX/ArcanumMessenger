using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArcanumMessenger.Contracts.Auth.Totp;
using ArcanumMessenger.Data;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.TotpServices;
namespace ArcanumMessenger.Controllers.Auth;

[ApiController]
[Route("api/totp")]
public class TotpController(
    AppDbContext db,
    EncryptionService encryption,
    TotpService totp,
    TotpSetupSessionService totpSession) : ControllerBase
{
    [HttpPost("start")]
    public async Task<ActionResult<StartTotpSetupResponse>> Start(
        [FromBody] StartTotpSetupRequest request,
        CancellationToken ct)
    {
        var user = await db.Users
            .Where(u => u.Id == request.UserId && !u.IsDeleted)
            .FirstOrDefaultAsync(ct);

        if (user is null)
            return NotFound(new StartTotpSetupResponse(Success: false, SessionId: null, Secret: null, OtpauthUri: null, Reason: "user_not_found"));

        if (user.TwoFactorEnabled)
            return BadRequest(new StartTotpSetupResponse(Success: false, SessionId: null, Secret: null, OtpauthUri: null, Reason: "already_enabled"));

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var username = encryption.Decrypt(user.UsernameEnc, dek);

        var secret = totp.GenerateSecret();
        var otpauthUri = totp.BuildOtpauthUri(username, secret);
        var sessionId = await totpSession.CreateAsync(user.Id, secret, ct);

        return Ok(new StartTotpSetupResponse(Success: true, SessionId: sessionId, Secret: secret, OtpauthUri: otpauthUri, Reason: null));
    }



    [HttpPost("confirm")]
    public async Task<ActionResult<ConfirmTotpSetupResponse>> Confirm(
        [FromBody] ConfirmTotpSetupRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.SessionId))
            return StatusCode(StatusCodes.Status410Gone, new ConfirmTotpSetupResponse(Success: false, Reason: "session_expired"));

        var session = await totpSession.GetAsync(request.SessionId, ct);

        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new ConfirmTotpSetupResponse(Success: false, Reason: "session_expired"));

        if (string.IsNullOrEmpty(request.Code) || request.Code.Length != 6 || !request.Code.All(char.IsDigit))
            return BadRequest(new ConfirmTotpSetupResponse(Success: false, Reason: "invalid_format"));

        if (!totp.VerifyCode(session.Secret, request.Code))
            return BadRequest(new ConfirmTotpSetupResponse(Success: false, Reason: "invalid_code"));

        var user = await db.Users
            .Where(u => u.Id == session.UserId && !u.IsDeleted)
            .FirstOrDefaultAsync(ct);

        if (user is null)
            return NotFound(new ConfirmTotpSetupResponse(Success: false, Reason: "user_not_found"));

        var dek = encryption.UnwrapDek(user.WrappedDek);
        user.TwoFactorSecretEnc = encryption.Encrypt(session.Secret, dek);
        user.TwoFactorEnabled = true;
        await db.SaveChangesAsync(ct);

        await totpSession.DeleteAsync(request.SessionId, ct);

        return Ok(new ConfirmTotpSetupResponse(Success: true, Reason: null));
    }
}
