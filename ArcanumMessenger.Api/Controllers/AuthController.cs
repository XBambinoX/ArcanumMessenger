using ArcanumMessenger.Contracts.Auth;
using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using ArcanumMessenger.Services;

namespace ArcanumMessenger.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, RegistrationSessionService registrationSession, EmailService emailService) : ControllerBase
{
    private static readonly Regex UsernameRegex = new("^[a-zA-Z0-9_]{3,32}$", RegexOptions.Compiled);
    private static readonly Random Rng = Random.Shared;

    [HttpGet("check-username")]

    public async Task<ActionResult<CheckUsernameResponse>> CheckUsername(
        [FromQuery] string username,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(username) || !UsernameRegex.IsMatch(username))
            return Ok(new CheckUsernameResponse(false, "invalid_format"));

        var exists = await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Username == username && !u.IsDeleted, ct);

        return Ok(new CheckUsernameResponse(!exists, exists ? "taken" : null));
    }

    [HttpPost("register/start")]

    public async Task<ActionResult<StartRegistrationResponse>> StartRegistration(
        [FromBody] StartRegistrationRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || !UsernameRegex.IsMatch(request.Username))
            return Ok(new StartRegistrationResponse(false, null, "invalid_format"));

        var exists = await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Username == request.Username && !u.IsDeleted, ct);

        if (exists)
            return Ok(new StartRegistrationResponse(false, null, "taken"));

        var sessionId = await registrationSession.CreateAsync(request.Username, ct);
        return Ok(new StartRegistrationResponse(true, sessionId));
    }

    [HttpPost("register/email")]
    public async Task<ActionResult<SubmitEmailResponse>> SubmitEmail(
        [FromBody] SubmitEmailRequest request,
        CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return Ok(new SubmitEmailResponse(false, "session_expired"));

        if (session.Step != 0)
            return Ok(new SubmitEmailResponse(false, "invalid_step"));

        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return Ok(new SubmitEmailResponse(false, "invalid_email"));

        var emailHash = Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(request.Email.ToLowerInvariant().Trim())
            )
        ).ToLower();

        var emailExists = await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.EmailHash == emailHash && !u.IsDeleted, ct);

        if (emailExists)
            return Ok(new SubmitEmailResponse(false, "email_taken"));

        var code = Rng.Next(0, 1_000_000).ToString("D6");

        session.EmailHash = emailHash;
        session.EmailVisibilityConsent = request.EmailVisibilityConsent;
        session.PlainEmail = request.Email.Trim();
        session.VerificationCode = code;
        session.CodeExpiresAt = DateTime.UtcNow.AddMinutes(10);
        session.CodeAttempts = 0;
        session.Step = 1;

        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        try
        {
            await emailService.SendVerificationCodeAsync(session.PlainEmail, code, ct);
        }
        catch
        {
            return Ok(new SubmitEmailResponse(false, "email_send_failed"));
        }

        return Ok(new SubmitEmailResponse(true));
    }
}