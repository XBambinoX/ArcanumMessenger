using ArcanumMessenger.Contracts.Auth;
using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using ArcanumMessenger.Services;
using ArcanumMessenger.Entities;

namespace ArcanumMessenger.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, RegistrationSessionService registrationSession, EmailService emailService, EncryptionService encryption) : ControllerBase
{
    private static readonly Regex UsernameRegex = new("^[a-zA-Z0-9_]{3,32}$", RegexOptions.Compiled);
    private static readonly Random Rng = Random.Shared;

    private const int AttemptsLimit = 3;
    private const int CodeDurationMinutesVerif = 3;
    private const int ResendCodeCooldownSeconds = 30;
    private const int ResendCountMax = 2;

    private const int MinPasswordLength = 8;



    [HttpPost("register/start")]
    public async Task<ActionResult<StartRegistrationResponse>> StartRegistration(
        [FromBody] StartRegistrationRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || !UsernameRegex.IsMatch(request.Username))
            return BadRequest(new StartRegistrationResponse(Success: false, SessionId: null, Reason: "invalid_format"));

        var sessionId = await registrationSession.CreateAsync(request.Username, ct);
        return Ok(new StartRegistrationResponse(Success: true, SessionId: sessionId));
    }



    [HttpPost("register/email")]
    public async Task<ActionResult<SubmitEmailResponse>> SubmitEmail(
    [FromBody] SubmitEmailRequest request,
    CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new SubmitEmailResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 0)
            return BadRequest(new SubmitEmailResponse(Success: false, Reason: "invalid_step"));

        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return BadRequest(new SubmitEmailResponse(Success: false, Reason: "invalid_email"));

        var emailHash = Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(request.Email.ToLowerInvariant().Trim())
            )
        ).ToLower();

        var emailExists = await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.EmailHash == emailHash && !u.IsDeleted, ct);

        if (emailExists)
            return Conflict(new SubmitEmailResponse(Success: false, Reason: "email_taken"));

        var code = Rng.Next(0, 1_000_000).ToString("D6");

        session.EmailVisibilityConsent = request.EmailVisibilityConsent;
        session.PlainEmail = request.Email.Trim();
        session.VerificationCode = code;
        session.CodeExpiresAt = DateTime.UtcNow.AddMinutes(CodeDurationMinutesVerif);
        session.CodeAttempts = 0;
        session.LastCodeSentAt = DateTime.UtcNow;
        session.Step = 1;

        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        try
        {
            await emailService.SendVerificationCodeAsync(session.PlainEmail, code, ct);
        }
        catch
        {
            return StatusCode(StatusCodes.Status502BadGateway, new SubmitEmailResponse(Success: false, Reason: "email_send_failed"));
        }

        return Ok(new SubmitEmailResponse(Success: true));
    }



    [HttpPost("register/verify-code")]
    public async Task<ActionResult<VerifyCodeResponse>> VerifyCode(
        [FromBody] VerifyCodeRequest request,
        CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new VerifyCodeResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 1)
            return BadRequest(new VerifyCodeResponse(Success: false, Reason: "invalid_step"));

        if (session.CodeExpiresAt is null || session.CodeExpiresAt < DateTime.UtcNow)
            return StatusCode(StatusCodes.Status410Gone, new VerifyCodeResponse(Success: false, Reason: "code_expired"));

        if (session.CodeAttempts >= AttemptsLimit)
            return StatusCode(StatusCodes.Status429TooManyRequests, new VerifyCodeResponse(Success: false, Reason: "too_many_attempts"));

        session.CodeAttempts++;

        if (string.IsNullOrWhiteSpace(request.Code) || session.VerificationCode != request.Code)
        {
            await registrationSession.UpdateAsync(request.SessionId, session, ct);
            return StatusCode(StatusCodes.Status422UnprocessableEntity, new VerifyCodeResponse(Success: false, Reason: "invalid_code"));
        }

        session.Step = 2;
        session.VerificationCode = null;
        session.EmailVerified = true;
        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        return Ok(new VerifyCodeResponse(Success: true));
    }



    [HttpPost("register/resend-code")]
    public async Task<ActionResult<ResendCodeResponse>> ResendCode(
            [FromBody] ResendCodeRequest request,
            CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new ResendCodeResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 1 || string.IsNullOrEmpty(session.PlainEmail))
            return BadRequest(new ResendCodeResponse(Success: false, Reason: "invalid_step"));

        if (session.ResendCount >= ResendCountMax)
            return StatusCode(StatusCodes.Status429TooManyRequests, new ResendCodeResponse(Success: false, Reason: "resend_limit_reached"));

        if (session.LastCodeSentAt is not null &&
            DateTime.UtcNow < session.LastCodeSentAt.Value.AddSeconds(ResendCodeCooldownSeconds))
            return StatusCode(StatusCodes.Status429TooManyRequests, new ResendCodeResponse(Success: false, Reason: "cooldown_active"));

        var code = Rng.Next(0, 1_000_000).ToString("D6");
        session.VerificationCode = code;
        session.CodeExpiresAt = DateTime.UtcNow.AddMinutes(CodeDurationMinutesVerif);
        session.CodeAttempts = 0;
        session.ResendCount++;
        session.LastCodeSentAt = DateTime.UtcNow;

        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        try
        {
            await emailService.SendVerificationCodeAsync(session.PlainEmail, code, ct);
        }
        catch
        {
            return StatusCode(StatusCodes.Status502BadGateway, new ResendCodeResponse(Success: false, Reason: "email_send_failed"));
        }

        return Ok(new ResendCodeResponse(Success: true));
    }



    [HttpPost("register/password")]
    public async Task<ActionResult<SubmitPasswordResponse>> SubmitPassword(
            [FromBody] SubmitPasswordRequest request,
            CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new SubmitPasswordResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 2)
            return BadRequest(new SubmitPasswordResponse(Success: false, Reason: "invalid_step"));

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < MinPasswordLength)
            return StatusCode(StatusCodes.Status422UnprocessableEntity, new SubmitPasswordResponse(Success: false, Reason: "weak_password"));

        session.PasswordHash = PasswordHasher.Hash(request.Password);
        session.Step = 3;

        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        return Ok(new SubmitPasswordResponse(Success: true));
    }



    [HttpPost("register/recovery/generate")]
    public async Task<ActionResult<GenerateRecoveryResponse>> GenerateRecovery(
            [FromBody] ConfirmRecoveryRequest request,
            CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new GenerateRecoveryResponse(Success: false, Phrase1: null, Phrase2: null, Reason: "session_expired"));

        if (session.Step != 3)
            return BadRequest(new GenerateRecoveryResponse(Success: false, Phrase1: null, Phrase2: null, Reason: "invalid_step"));

        // If the phrases have already been generated (the user reloaded the page), we return the same ones
        if (string.IsNullOrEmpty(session.RecoveryPhrase1))
        {
            session.RecoveryPhrase1 = RecoveryPhraseService.Generate();
            session.RecoveryPhrase2 = RecoveryPhraseService.Generate();
            await registrationSession.UpdateAsync(request.SessionId, session, ct);
        }

        return Ok(new GenerateRecoveryResponse(Success: true, Phrase1: session.RecoveryPhrase1, Phrase2: session.RecoveryPhrase2));
    }



    [HttpPost("register/recovery/confirm")]
    public async Task<ActionResult<ConfirmRecoveryResponse>> ConfirmRecovery(
        [FromBody] ConfirmRecoveryRequest request,
        CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new ConfirmRecoveryResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 3)
            return BadRequest(new ConfirmRecoveryResponse(Success: false, Reason: "invalid_step"));

        if (string.IsNullOrEmpty(session.RecoveryPhrase1) || string.IsNullOrEmpty(session.RecoveryPhrase2))
            return BadRequest(new ConfirmRecoveryResponse(Success: false, Reason: "not_generated"));

        session.RecoveryConfirmed = true;
        session.Step = 4;
        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        return Ok(new ConfirmRecoveryResponse(Success: true));
    }



    [HttpPost("register/finalize")]
    public async Task<ActionResult<FinalizeRegistrationResponse>> FinalizeRegistration(
            [FromBody] FinalizeRegistrationRequest request,
            CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new FinalizeRegistrationResponse(Success: false, Reason: "session_expired"));

        if (!session.RecoveryConfirmed)
            return Conflict(new FinalizeRegistrationResponse(Success: false, Reason: "recovery_not_confirmed"));

        if (session.PasswordHash is null || session.PlainEmail is null ||
            session.RecoveryPhrase1 is null || session.RecoveryPhrase2 is null)
            return Conflict(new FinalizeRegistrationResponse(Success: false, Reason: "incomplete_session"));

        var emailHash = Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(session.PlainEmail.ToLowerInvariant().Trim())
            )
        ).ToLower();

        var emailExists = await db.Users
            .AnyAsync(u => u.EmailHash == emailHash && !u.IsDeleted, ct);
        if (emailExists)
            return Conflict(new FinalizeRegistrationResponse(Success: false, Reason: "email_taken"));

        var phrase1Hash = PasswordHasher.Hash(session.RecoveryPhrase1);
        var phrase2Hash = PasswordHasher.Hash(session.RecoveryPhrase2);

        string? publicEmailEnc = null;
        if (session.EmailVisibilityConsent)
        {
            publicEmailEnc = encryption.Encrypt(session.PlainEmail);
        }

        var now = DateTime.UtcNow;
        var user = new User
        {
            Username = session.Username,
            EmailHash = emailHash,
            PasswordHash = session.PasswordHash,
            RecoveryPhrase1Hash = phrase1Hash,
            RecoveryPhrase2Hash = phrase2Hash,
            PublicEmailEnc = publicEmailEnc,
            LastSeen = now,
            CreatedAt = now,
            IsDeleted = false,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        await registrationSession.DeleteAsync(request.SessionId, ct);

        return Ok(new FinalizeRegistrationResponse(Success: true));
    }
}