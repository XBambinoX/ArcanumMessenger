using System.Security.Cryptography.X509Certificates;
using ArcanumMessenger.Contracts.Messenger.Users;
using ArcanumMessenger.Data;
using ArcanumMessenger.Services.AuthServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/users")]
public class UsersController(AppDbContext db, EncryptionService encryption) : MessengerControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<GetCurrentUserResponce>> GetMe(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var user = await db.Users
                        .AsNoTracking()
                        .Where(u => u.Id == userId)
                        .Select(u => new { u.UsernameEnc, u.PublicIdEnc, u.LastSeen, u.WrappedDek, u.IsDeleted })
                        .FirstOrDefaultAsync(ct);

        if (user is null || user.IsDeleted)
            return NotFound(new GetCurrentUserResponce(Name: null, Id: null, LastSeen: null, success: false, "not_found"));

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var username = encryption.Decrypt(user.UsernameEnc, dek);
        var publicId = encryption.Decrypt(user.PublicIdEnc, dek);

        return new GetCurrentUserResponce(username, publicId, user.LastSeen, success: true, reason: null);
    }
}