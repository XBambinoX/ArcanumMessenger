using Microsoft.AspNetCore.Mvc;
using ArcanumMessenger.Contracts.Auth.Totp;
using ArcanumMessenger.Data;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.TotpServices;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
namespace ArcanumMessenger.Controllers.Auth;

[ApiController]
[Route("api/totp")]
public class TotpController(
    AppDbContext db,
    EncryptionService encryption,
    TotpService totp,
    TotpSetupSessionService totpSession,
    AuthService authService) : ControllerBase
{
    [HttpPost("start")]
    [Authorize]
    public async Task<ActionResult<StartTotpSetupResponse>> Start(
        CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await authService.GetUserAsync(u => u.Id == userId, ct, includeSettings: true);

        if (user is null)
            return NotFound(new StartTotpSetupResponse(Success: false, SessionId: null, Secret: null, OtpauthUri: null, Reason: "user_not_found"));

        if (user.UserSettings.TwoFactorEnabled)
            return BadRequest(new StartTotpSetupResponse(Success: false, SessionId: null, Secret: null, OtpauthUri: null, Reason: "already_enabled"));

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var username = encryption.Decrypt(user.UserSettings.UsernameEnc, dek);

        var secret = totp.GenerateSecret();
        var otpauthUri = totp.BuildOtpauthUri(username, secret);
        var sessionId = await totpSession.CreateAsync(user.Id, secret, ct);

        return Ok(new StartTotpSetupResponse(Success: true, SessionId: sessionId, Secret: secret, OtpauthUri: otpauthUri, Reason: null));
    }



    [HttpPost("confirm")]
    [Authorize]
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

        var user = await authService.GetUserAsync(u => u.Id == session.UserId, ct, includeSettings: true);

        if (user is null)
            return NotFound(new ConfirmTotpSetupResponse(Success: false, Reason: "user_not_found"));

        var dek = encryption.UnwrapDek(user.WrappedDek);
        user.UserSettings.TwoFactorSecretEnc = encryption.Encrypt(session.Secret, dek);
        user.UserSettings.TwoFactorEnabled = true;
        await db.SaveChangesAsync(ct);

        await totpSession.DeleteAsync(request.SessionId, ct);

        return Ok(new ConfirmTotpSetupResponse(Success: true, Reason: null));
    }
}
