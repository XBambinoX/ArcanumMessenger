using Microsoft.AspNetCore.Mvc;
using ArcanumMessenger.Contracts.Login;
using ArcanumMessenger.Services;
namespace ArcanumMessenger.Controllers;


[ApiController]
[Route("api/login")]
public class LoginController(LoginSessionService loginSession, EmailHasher emailHasher, LoginService loginService) : ControllerBase
{

    private const int AuthKeySize = 32;


    [HttpPost("start")]
    public async Task<ActionResult<StartLoginResponse>> StartLogin(
        [FromBody] StartLoginRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new StartLoginResponse(Success: false, SessionId: null, KdfSalt: null, Reason: "invalid_format"));

        var emailHash = emailHasher.Hash(request.Email);
        var kdfSalt = await loginService.GetKdfSaltAsync(emailHash, ct);

        var sessionId = await loginSession.CreateAsync(emailHash, kdfSalt, ct);

        kdfSalt ??= emailHasher.GenerateFakeSalt(request.Email);

        return Ok(new StartLoginResponse(Success: true, SessionId: sessionId, KdfSalt: kdfSalt, Reason: null));
    }



    [HttpPost("loginPassword")]
    public async Task<ActionResult<SubmitLoginPasswordResponse>> submitLoginPassword(
        [FromBody] SubmitLoginPasswordRequest request,
        CancellationToken ct)
    {

        if (string.IsNullOrEmpty(request.SessionId))
            return StatusCode(StatusCodes.Status410Gone,
            new SubmitLoginPasswordResponse(Success: false, RequiresTotp: false, Reason: "session_expired"));

        var session = await loginSession.GetAsync(request.SessionId, ct);

        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new SubmitLoginPasswordResponse(Success: false, RequiresTotp: false, Reason: "session_expired"));

        if (session?.Step != 0)
            return BadRequest(new SubmitLoginPasswordResponse(Success: false, RequiresTotp: false, Reason: "invalid_step"));

        if (request.AuthKey == null || !PasswordHasher.IsBase64OfLength(request.AuthKey, AuthKeySize))
            return BadRequest(new SubmitLoginPasswordResponse(Success: false, RequiresTotp: false, Reason: "invalid_format"));

        bool isPassCorrect = await loginService.CheckPassAsync(session.EmailHash!, request.AuthKey, ct);

        if (isPassCorrect)
        {
            session.Step++;
            await loginSession.UpdateAsync(request.SessionId, session, ct);
        }

        return isPassCorrect ? Ok(new SubmitLoginPasswordResponse(Success: true, RequiresTotp: false, Reason: null))
                             : BadRequest(new SubmitLoginPasswordResponse(Success: false, RequiresTotp: false, Reason: "pass_or_email_is_not_correct"));
    }



    [HttpPost("loginTotp")]
    public async Task<ActionResult<SubmitLoginTotpResponse>> submitLoginTotp(
        [FromBody] SubmitLoginTotpRequest request,
        CancellationToken ct)
    {
        return Ok(new SubmitLoginTotpResponse(Success: true, Reason: null));
    }
}