using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using ArcanumMessenger.Contracts.Messenger.Settings;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.LoginServices;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/settings")]
public class SettingsController(AppDbContext db, EncryptionService encryption, TokenIssuanceService tokenIssuance, EmailHasher emailHasher, ILogger<SettingsController> logger) : MessengerControllerBase
{
    [HttpGet("get")]
    [Authorize]
    public async Task<ActionResult<UserSettingsResponse>> GetMySettings(CancellationToken ct)
    {
        logger.LogInformation("Fetching user settings");
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var user = await db.Users
            .Include(u => u.UserSettings)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == userId, ct);

        if (user is null)
            return NotFound();

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var settings = user.UserSettings;

        var response = new UserSettingsResponse(
            Username: encryption.Decrypt(settings.UsernameEnc, dek),
            Bio: settings.BioEnc is not null ? encryption.Decrypt(settings.BioEnc, dek) : "",
            Phone: settings.PhoneEnc is not null ? encryption.Decrypt(settings.PhoneEnc, dek) : "",
            Email: settings.EmailEnc is not null ? encryption.Decrypt(settings.EmailEnc, dek) : "",
            NotificationsEnabled: settings.NotificationsEnabled,
            GroupNotifications: settings.GroupNotificationsEnabled,
            NotificationSound: settings.NotificationSound,
            TotpEnabled: settings.TwoFactorEnabled,
            ShowLastSeen: settings.ShowLastSeen,
            ShowOnlineStatus: settings.ShowOnlineStatus,
            ReadReceiptsEnabled: settings.ReadReceiptsEnabled,
            ShowPhoneNumber: settings.ShowPhoneNumber.ToApiString(),
            ShowBio: settings.ShowBio.ToApiString(),
            ShowAvatar: settings.ShowAvatar.ToApiString(),
            ShowEmail: settings.ShowEmail.ToApiString(),
            WhoCanAddMe: settings.WhoCanAddMe.ToApiString(),
            Theme: settings.Theme,
            Language: settings.Language,
            Wallpaper: settings.Wallpaper,
            LinkPreviewsEnabled: settings.LinkPreviewsEnabled,
            AutoDownloadMedia: settings.AutoDownloadMedia
        );

        logger.LogInformation("User settings fetched successfully for user {UserId}", userId);
        return Ok(response);
    }

    [HttpPatch("update-account")]
    [Authorize]
    public async Task<IActionResult> UpdateAccountFields(
        [FromBody] UpdateAccountFieldsRequest request,
        CancellationToken ct)
    {
        logger.LogInformation("Updating account fields for user");
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var user = await db.Users
            .Include(u => u.UserSettings)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user is null || user.UserSettings is null)
            return NotFound();

        var dek = encryption.UnwrapDek(user.WrappedDek);

        if (request.Username is not null)
            user.UserSettings.UsernameEnc = encryption.Encrypt(request.Username, dek);

        if (request.Bio is not null)
            user.UserSettings.BioEnc = request.Bio.Length > 0 ? encryption.Encrypt(request.Bio, dek) : null;

        if (request.Phone is not null)
            user.UserSettings.PhoneEnc = request.Phone.Length > 0 ? encryption.Encrypt(request.Phone, dek) : null;

        // Unlike phone/bio, email isn't a free-text "contact info" field -
        // it has to be the same address this account was actually
        // registered with, checked the same way login checks it (a hash,
        // since the real address is never stored in plain form). Skipping
        // the registration consent just means this starts empty instead of
        // being pre-filled, not that any email can be typed in here.
        if (request.Email is not null)
        {
            if (request.Email.Length > 0)
            {
                if (emailHasher.Hash(request.Email) != user.EmailHash)
                    return BadRequest(new { success = false, reason = "email_mismatch" });

                user.UserSettings.EmailEnc = encryption.Encrypt(request.Email, dek);
            }
            else
            {
                user.UserSettings.EmailEnc = null;
            }
        }

        user.UserSettings.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        logger.LogInformation("Account fields updated successfully for user {UserId}", userId);
        return NoContent();
    }

    [HttpPost("delete-account")]
    [Authorize]
    public async Task<IActionResult> DeleteAccount(
        [FromBody] DeleteAccountRequest request,
        CancellationToken ct)
    {
        logger.LogInformation("Start deleting account for user");
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);
        if (user is null)
            return NotFound();

        if (!PasswordHasher.Verify(request.AuthKey, user.PasswordHash))
            return StatusCode(StatusCodes.Status422UnprocessableEntity, new { reason = "invalid_password" });

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;

        var sessions = await db.Sessions
            .Where(s => s.UserId == userId && s.RevokedAt == null)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var session in sessions)
            session.RevokedAt = now;

        await db.SaveChangesAsync(ct);

        Request.Cookies.TryGetValue("refresh_token", out var refreshToken);
        if (!string.IsNullOrEmpty(refreshToken))
            await tokenIssuance.RevokeAsync(refreshToken, ct);

        Response.ClearAuthCookies();

        logger.LogInformation("Account deleted successfully for user {UserId}", userId);
        return Ok();
    }

    [HttpGet("kdf-salt")]
    [Authorize]
    public async Task<ActionResult<KdfSaltResponse>> GetKdfSalt(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);

        if (user is null)
            return NotFound();

        return Ok(new KdfSaltResponse(user.KdfSalt));
    }

    [HttpGet("identity-keys")]
    [Authorize]
    public async Task<ActionResult<IdentityKeysResponse>> GetIdentityKeys(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);

        if (user is null)
            return NotFound();

        return Ok(new IdentityKeysResponse(user.EcdhPublicKey, user.WrappedEcdhPrivateKey));
    }

    [HttpPatch("notifications")]
    [Authorize]
    public async Task<IActionResult> UpdateNotificationSettings(
        [FromBody] UpdateNotificationSettingsRequest request,
        CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var settings = await db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
            return NotFound();

        if (request.NotificationsEnabled is not null)
            settings.NotificationsEnabled = request.NotificationsEnabled.Value;

        if (request.GroupNotifications is not null)
            settings.GroupNotificationsEnabled = request.GroupNotifications.Value;

        if (request.NotificationSound is not null)
        {
            if (!PrivacyEnumConverters.TryParseNotifications(request.NotificationSound, out var notification))
                return BadRequest(new { reason = "invalid_sound" });

            settings.NotificationSound = request.NotificationSound;
        }

        settings.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPatch("privacy")]
    [Authorize]
    public async Task<IActionResult> UpdatePrivacySettings(
        [FromBody] UpdatePrivacySettingsRequest request,
        CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var settings = await db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
            return NotFound();

        if (request.ShowLastSeen is not null)
            settings.ShowLastSeen = request.ShowLastSeen.Value;

        if (request.ShowOnlineStatus is not null)
            settings.ShowOnlineStatus = request.ShowOnlineStatus.Value;

        if (request.ReadReceiptsEnabled is not null)
            settings.ReadReceiptsEnabled = request.ReadReceiptsEnabled.Value;

        if (request.ShowPhoneNumber is not null)
        {
            if (!PrivacyEnumConverters.TryParsePhoneVisibility(request.ShowPhoneNumber, out var phoneVisibility))
                return BadRequest(new { reason = "invalid_show_phone_number" });

            settings.ShowPhoneNumber = phoneVisibility;
        }

        if (request.ShowBio is not null)
        {
            if (!PrivacyEnumConverters.TryParsePhoneVisibility(request.ShowBio, out var bioVisibility))
                return BadRequest(new { reason = "invalid_show_bio" });

            settings.ShowBio = bioVisibility;
        }

        if (request.ShowAvatar is not null)
        {
            if (!PrivacyEnumConverters.TryParsePhoneVisibility(request.ShowAvatar, out var avatarVisibility))
                return BadRequest(new { reason = "invalid_show_avatar" });

            settings.ShowAvatar = avatarVisibility;
        }

        if (request.ShowEmail is not null)
        {
            if (!PrivacyEnumConverters.TryParsePhoneVisibility(request.ShowEmail, out var emailVisibility))
                return BadRequest(new { reason = "invalid_show_email" });

            settings.ShowEmail = emailVisibility;
        }

        if (request.WhoCanAddMe is not null)
        {
            if (!PrivacyEnumConverters.TryParseAddPermission(request.WhoCanAddMe, out var addPermission))
                return BadRequest(new { reason = "invalid_who_can_add_me" });

            settings.WhoCanAddMe = addPermission;
        }

        if (request.TotpEnabled is not null)
            settings.TwoFactorEnabled = request.TotpEnabled.Value;

        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPatch("chats")]
    [Authorize]
    public async Task<IActionResult> UpdateChatSettings(
        [FromBody] UpdateChatSettingsRequest request,
        CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var settings = await db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
            return NotFound();

        if (request.Theme is not null)
        {
            if (!PrivacyEnumConverters.TryParseThemes(request.Theme, out var theme))
                return BadRequest(new { reason = "invalid_theme" });
            settings.Theme = request.Theme;
        }

        if (request.Language is not null)
        {
            if (!PrivacyEnumConverters.TryParseLanguages(request.Language, out _))
                return BadRequest(new { reason = "invalid_language" });
            settings.Language = request.Language;
        }

        if (request.Wallpaper is not null)
            settings.Wallpaper = request.Wallpaper;

        if (request.LinkPreviewsEnabled is not null)
            settings.LinkPreviewsEnabled = request.LinkPreviewsEnabled.Value;

        if (request.AutoDownloadMedia is not null)
            settings.AutoDownloadMedia = request.AutoDownloadMedia.Value;

        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}