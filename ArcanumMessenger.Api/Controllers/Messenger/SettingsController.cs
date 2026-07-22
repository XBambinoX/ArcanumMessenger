using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using ArcanumMessenger.Contracts.Messenger.Settings;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.LoginServices;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/settings")]
public class SettingsController(AppDbContext db, EncryptionService encryption, TokenIssuanceService tokenIssuance, ILogger<SettingsController> logger) : MessengerControllerBase
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
        
        var response = new UserSettingsResponse(
            Username:encryption.Decrypt(user.UserSettings.UsernameEnc, dek),
            Bio: user.UserSettings.BioEnc is not null ? encryption.Decrypt(user.UserSettings.BioEnc, dek) : "",
            Phone: user.UserSettings.PhoneEnc is not null ? encryption.Decrypt(user.UserSettings.PhoneEnc, dek) : "",
            NotificationsEnabled: user.UserSettings.NotificationsEnabled,
            GroupNotifications: user.UserSettings.GroupNotificationsEnabled,
            NotificationSound: user.UserSettings.NotificationSound
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

        settings.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}