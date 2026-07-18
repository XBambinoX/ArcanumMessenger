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
    public async Task<ActionResult<GetUserResponce>> GetMe(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var response = await BuildProfileAsync(userId, ct);
        return response.success ? response : NotFound(response);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<GetUserResponce>> GetUser(Guid id, CancellationToken ct)
    {
        var response = await BuildProfileAsync(id, ct);
        return response.success ? response : NotFound(response);
    }

    private async Task<GetUserResponce> BuildProfileAsync(Guid id, CancellationToken ct)
    {
        var user = await db.Users
                        .AsNoTracking()
                        .Where(u => u.Id == id)
                        .Select(u => new
                        {
                            u.UsernameEnc,
                            u.IsDeleted,
                            u.PublicIdEnc,
                            u.LastSeen,
                            u.WrappedDek,
                            u.PublicBioEnc,
                            u.PublicEmailEnc
                        })
                        .FirstOrDefaultAsync(ct);

        if (user is null || user.IsDeleted)
            return new GetUserResponce(Name: null, Id: null, LastSeen: null, PublicEmail: null, PublicBio: null, success: false, reason: "not_found");

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var username = encryption.Decrypt(user.UsernameEnc, dek);
        var publicId = encryption.Decrypt(user.PublicIdEnc, dek);
        var publicbio = user.PublicBioEnc is null ? null : encryption.Decrypt(user.PublicBioEnc, dek);
        var publicEmail = user.PublicEmailEnc is null ? null : encryption.Decrypt(user.PublicEmailEnc, dek);

        return new GetUserResponce(username, publicId, user.LastSeen, publicEmail, publicbio, success: true, reason: null);
    }
}
