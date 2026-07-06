using ArcanumMessenger.Contracts.Auth.Register;
using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.RegisterServices;
using ArcanumMessenger.Entities;

namespace ArcanumMessenger.Controllers.Auth;

[ApiController]
[Route("api/register")]
public class RegisterController(AppDbContext db, RegistrationSessionService registrationSession, EmailService emailService, EncryptionService encryption, EmailHasher emailHasher) : ControllerBase
{
    private static readonly Regex UsernameRegex = new("^[a-zA-Z0-9_]{3,32}$", RegexOptions.Compiled);
    private static readonly Regex PhraseAuthRegex = new("^[0-9a-f]{64}$", RegexOptions.Compiled);
    private static readonly Random Rng = Random.Shared;

    private const int AttemptsLimit = 3;
    private const int CodeDurationMinutesVerif = 3;
    private const int ResendCodeCooldownSeconds = 30;
    private const int ResendCountMax = 2;

    private const int AuthKeySize = 32;
    private const int KdfSaltSize = 16;


    [HttpPost("start")]
    public async Task<ActionResult<StartRegistrationResponse>> StartRegistration(
        [FromBody] StartRegistrationRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || !UsernameRegex.IsMatch(request.Username))
            return BadRequest(new StartRegistrationResponse(Success: false, SessionId: null, Reason: "invalid_format"));

        var sessionId = await registrationSession.CreateAsync(request.Username, ct);
        return Ok(new StartRegistrationResponse(Success: true, SessionId: sessionId));
    }



    [HttpPost("email")]
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

        var emailHash = emailHasher.Hash(request.Email);

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



    [HttpPost("verify-code")]
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



    [HttpPost("resend-code")]
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



    [HttpPost("password")]
    public async Task<ActionResult<SubmitPasswordResponse>> SubmitPassword(
            [FromBody] SubmitPasswordRequest request,
            CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new SubmitPasswordResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 2)
            return BadRequest(new SubmitPasswordResponse(Success: false, Reason: "invalid_step"));

        // The client sends an Argon2id-derived authKey instead of the password,
        // so password strength can only be checked on the client. Here we can
        // only check the key format.
        if (!PasswordHasher.IsBase64OfLength(request.AuthKey, AuthKeySize) || !PasswordHasher.IsBase64OfLength(request.KdfSalt, KdfSaltSize))
            return StatusCode(StatusCodes.Status422UnprocessableEntity, new SubmitPasswordResponse(Success: false, Reason: "invalid_key_format"));

        // Argon2id again on the server: a DB dump must not contain ready-to-use login keys
        session.PasswordHash = PasswordHasher.Hash(request.AuthKey);
        session.KdfSalt = request.KdfSalt;
        session.Step = 3;

        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        return Ok(new SubmitPasswordResponse(Success: true));
    }



    [HttpPost("recovery/confirm")]
    public async Task<ActionResult<ConfirmRecoveryResponse>> ConfirmRecovery(
        [FromBody] ConfirmRecoveryRequest request,
        CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new ConfirmRecoveryResponse(Success: false, Reason: "session_expired"));

        if (session.Step != 3)
            return BadRequest(new ConfirmRecoveryResponse(Success: false, Reason: "invalid_step"));

        // The phrases are generated on the client; we only receive their SHA-256 hashes
        if (!PhraseAuthRegex.IsMatch(request.Phrase1Auth ?? "") || !PhraseAuthRegex.IsMatch(request.Phrase2Auth ?? ""))
            return StatusCode(StatusCodes.Status422UnprocessableEntity, new ConfirmRecoveryResponse(Success: false, Reason: "invalid_phrase_format"));

        session.RecoveryPhrase1Hash = PasswordHasher.Hash(request.Phrase1Auth!);
        session.RecoveryPhrase2Hash = PasswordHasher.Hash(request.Phrase2Auth!);
        session.RecoveryConfirmed = true;
        session.Step = 4;
        await registrationSession.UpdateAsync(request.SessionId, session, ct);

        return Ok(new ConfirmRecoveryResponse(Success: true));
    }



    [HttpPost("finalize")]
    public async Task<ActionResult<FinalizeRegistrationResponse>> FinalizeRegistration(
            [FromBody] FinalizeRegistrationRequest request,
            CancellationToken ct)
    {
        var session = await registrationSession.GetAsync(request.SessionId, ct);
        if (session is null)
            return StatusCode(StatusCodes.Status410Gone, new FinalizeRegistrationResponse(Success: false, Reason: "session_expired"));

        if (!session.RecoveryConfirmed)
            return Conflict(new FinalizeRegistrationResponse(Success: false, Reason: "recovery_not_confirmed"));

        if (session.PasswordHash is null || session.KdfSalt is null || session.PlainEmail is null ||
            session.RecoveryPhrase1Hash is null || session.RecoveryPhrase2Hash is null)
            return Conflict(new FinalizeRegistrationResponse(Success: false, Reason: "incomplete_session"));

        var emailHash = emailHasher.Hash(session.PlainEmail);

        var emailExists = await db.Users
            .AnyAsync(u => u.EmailHash == emailHash && !u.IsDeleted, ct);
        if (emailExists)
            return Conflict(new FinalizeRegistrationResponse(Success: false, Reason: "email_taken"));

        // One DEK per user encrypts all of their profile fields. It is stored
        // only in its wrapped (KEK-encrypted) form — the KEK itself never
        // enters the database.
        var dek = encryption.GenerateDek();
        var wrappedDek = encryption.WrapDek(dek);
        var usernameEnc = encryption.Encrypt(session.Username, dek);

        string? publicEmailEnc = null;
        if (session.EmailVisibilityConsent)
        {
            publicEmailEnc = encryption.Encrypt(session.PlainEmail, dek);
        }

        var now = DateTime.UtcNow;
        var user = new User
        {
            UsernameEnc = usernameEnc,
            EmailHash = emailHash,
            PasswordHash = session.PasswordHash,
            KdfSalt = session.KdfSalt,
            RecoveryPhrase1Hash = session.RecoveryPhrase1Hash,
            RecoveryPhrase2Hash = session.RecoveryPhrase2Hash,
            WrappedDek = wrappedDek,
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