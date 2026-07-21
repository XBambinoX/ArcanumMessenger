using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using ArcanumMessenger.Contracts.Messenger.Settings;
using ArcanumMessenger.Services.AuthServices;

namespace ArcanumMessenger.Controllers.Messenger;

public class SettingsController(AppDbContext db, EncryptionService encryption, ILogger<SettingsController> logger) : MessengerControllerBase
{
    [HttpGet("api/settings")]
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
            Bio: user.UserSettings.BioEnc is not null ? user.UserSettings.BioEnc : "",
            Phone: user.UserSettings.PhoneEnc is not null ?  user.UserSettings.PhoneEnc : ""
        );

        logger.LogInformation("User settings fetched successfully for user {UserId}", userId);
        return Ok(response);
    }
}