using ArcanumMessenger.Contracts.Auth.Recovery;
using ArcanumMessenger.Services.AuthServices.RecoveryServices;
using Microsoft.AspNetCore.Mvc;

namespace ArcanumMessenger.Controllers.Auth;

[ApiController]
[Route("api/recovery")]
public class RecoveryController(RecoveryService recoveryService) : ControllerBase
{
    [HttpPost("start")]
    public async Task<ActionResult<StartRecoveryResponse>> Start(CancellationToken ct)
    {
        var (result, sessionId) = await recoveryService.StartAsync(ct);
        return Ok(new StartRecoveryResponse(result.Success, sessionId));
    }

    [HttpPost("verify")]
    public async Task<ActionResult<VerifyRecoveryResponse>> Verify(
        [FromBody] VerifyRecoveryRequest request,
        CancellationToken ct)
    {
        var result = await recoveryService.VerifyAsync(request.SessionId, request.Email, request.PhraseAuth, ct);

        if (!result.Success)
        {
            return result.Reason switch
            {
                "session_expired" => StatusCode(StatusCodes.Status410Gone, new VerifyRecoveryResponse(false, result.Reason)),
                "too_many_attempts" => StatusCode(StatusCodes.Status429TooManyRequests, new VerifyRecoveryResponse(false, result.Reason)),
                _ => Ok(new VerifyRecoveryResponse(false, result.Reason))
            };
        }

        return Ok(new VerifyRecoveryResponse(true));
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult<ResetPasswordResponse>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken ct)
    {
        var result = await recoveryService.ResetPasswordAsync(
            request.SessionId, request.AuthKey, request.KdfSalt,
            request.EcdhPublicKey, request.WrappedEcdhPrivateKey, ct);

        if (!result.Success)
        {
            return result.Reason switch
            {
                "session_expired" => StatusCode(StatusCodes.Status410Gone, new ResetPasswordResponse(false, result.Reason)),
                "invalid_key_format" => StatusCode(StatusCodes.Status422UnprocessableEntity, new ResetPasswordResponse(false, result.Reason)),
                _ => BadRequest(new ResetPasswordResponse(false, result.Reason))
            };
        }

        return Ok(new ResetPasswordResponse(true));
    }
}