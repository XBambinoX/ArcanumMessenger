using Microsoft.AspNetCore.Mvc;
using ArcanumMessenger.Contracts.Auth.Login;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.LoginServices;
namespace ArcanumMessenger.Controllers.Auth;


[ApiController]
[Route("api/login")]
public class LoginController(
    LoginSessionService loginSession,
    EmailHasher emailHasher,
    AuthService authService,
    TokenIssuanceService tokenIssuance,
    ILogger<LoginController> logger) : ControllerBase
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
        var kdfSalt = await authService.GetKdfSaltAsync(emailHash, ct);

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

        var (isPassCorrect, requiresTotp) = await authService.CheckPassAsync(session.EmailHash!, request.AuthKey, ct);

        if (isPassCorrect)
        {
            session.Step++;
            await loginSession.UpdateAsync(request.SessionId, session, ct);
        }

        return isPassCorrect ? Ok(new SubmitLoginPasswordResponse(Success: true, RequiresTotp: requiresTotp, Reason: null))
                             : BadRequest(new SubmitLoginPasswordResponse(Success: false, RequiresTotp: false, Reason: "pass_or_email_is_not_correct"));
    }



    [HttpPost("loginTotp")]
    public async Task<ActionResult<SubmitLoginTotpResponse>> submitLoginTotp(
        [FromBody] SubmitLoginTotpRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.SessionId))
            return StatusCode(StatusCodes.Status410Gone, new SubmitLoginTotpResponse(Success: false, Reason: "session_expired"));

        var session = await loginSession.GetAsync(request.SessionId, ct);

        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new SubmitLoginTotpResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 1)
            return BadRequest(new SubmitLoginTotpResponse(Success: false, Reason: "invalid_step"));

        if (string.IsNullOrEmpty(request.Code) || request.Code.Length != 6 || !request.Code.All(char.IsDigit))
            return BadRequest(new SubmitLoginTotpResponse(Success: false, Reason: "invalid_format"));

        var isCodeCorrect = await authService.CheckTotpAsync(session.EmailHash!, request.Code, ct);

        if (isCodeCorrect)
        {
            session.Step++;
            await loginSession.UpdateAsync(request.SessionId, session, ct);
        }

        return isCodeCorrect ? Ok(new SubmitLoginTotpResponse(Success: true, Reason: null))
                             : BadRequest(new SubmitLoginTotpResponse(Success: false, Reason: "invalid_code"));
    }

    [HttpPost("complete")]
    public async Task<ActionResult<CompleteLoginResponse>> CompleteLogin(
        [FromBody] CompleteLoginRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(request.SessionId))
            return StatusCode(StatusCodes.Status410Gone, new CompleteLoginResponse(Success: false, Reason: "session_expired"));

        var session = await loginSession.GetAsync(request.SessionId, ct);

        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new CompleteLoginResponse(Success: false, Reason: "session_expired"));

        var user = await authService.GetUserAsync(u => u.EmailHash == session.EmailHash, ct);
        if (user is null)
            return StatusCode(StatusCodes.Status410Gone, new CompleteLoginResponse(Success: false, Reason: "session_expired"));

        logger.LogInformation("CompleteLogin session step: {Step}", session.Step);

        var expectedStep = user.TwoFactorEnabled ? 2 : 1;
        if (session.Step != expectedStep)
            return BadRequest(new CompleteLoginResponse(Success: false, Reason: "invalid_step"));

        var deviceName = Request.Headers.UserAgent.ToString();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var (accessToken, refreshToken) = await tokenIssuance.IssueAsync(
            user.Id, deviceName, deviceType: null, ipAddress, ct);

        Response.SetAuthCookies(accessToken, refreshToken);

        await loginSession.DeleteAsync(request.SessionId, ct);

        return Ok(new CompleteLoginResponse(Success: true));
    }
}