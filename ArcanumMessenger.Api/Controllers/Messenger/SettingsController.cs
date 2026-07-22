using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using ArcanumMessenger.Contracts.Messenger.Settings;
using ArcanumMessenger.Services.AuthServices;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/settings")]
public class SettingsController(AppDbContext db, EncryptionService encryption, ILogger<SettingsController> logger) : MessengerControllerBase
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
            Phone: user.UserSettings.PhoneEnc is not null ? encryption.Decrypt(user.UserSettings.PhoneEnc, dek) : ""
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
}