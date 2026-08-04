using ArcanumMessenger.Contracts.Messenger.Contacts;
using ArcanumMessenger.Contracts.Messenger.Users;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.MessengerServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/contacts")]
public class ContactsController(AppDbContext db, EncryptionService encryption, BlockService blocks) : MessengerControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ContactsListResponse>> List(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var contacts = await db.Contacts.AsNoTracking()
            .Where(c => c.UserId == userId && !c.IsBlocked && !c.ContactUser.IsDeleted)
            .Select(c => new {
                c.ContactId, c.ContactUser.UserSettings.UsernameEnc, c.ContactUser.PublicIdEnc,
                c.ContactUser.WrappedDek, c.ContactUser.EcdhPublicKey,
            })
            .ToListAsync(ct);

        var results = contacts.Select(c =>
        {
            var dek = encryption.UnwrapDek(c.WrappedDek);
            return new UserSearchResultDto(
                c.ContactId,
                encryption.Decrypt(c.UsernameEnc, dek),
                encryption.Decrypt(c.PublicIdEnc, dek),
                c.EcdhPublicKey);
        }).ToList();

        return Ok(new ContactsListResponse(true, results));
    }

    [HttpPost]
    public async Task<ActionResult<AddContactResponse>> Add([FromBody] AddContactRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (request.ContactId == userId)
            return BadRequest(new AddContactResponse(false, "self_contact"));

        if (!await db.Users.AnyAsync(u => u.Id == request.ContactId && !u.IsDeleted, ct))
            return NotFound(new AddContactResponse(false, "not_found"));

        var alreadyAdded = await db.Contacts.AnyAsync(c => c.UserId == userId && c.ContactId == request.ContactId, ct);
        if (!alreadyAdded)
        {
            db.Contacts.Add(new Contact { UserId = userId, ContactId = request.ContactId });
            await db.SaveChangesAsync(ct);
        }

        return Ok(new AddContactResponse(true));
    }

    [HttpDelete("{contactId:guid}")]
    public async Task<ActionResult<AddContactResponse>> Remove(Guid contactId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var existing = await db.Contacts
            .FirstOrDefaultAsync(c => c.UserId == userId && c.ContactId == contactId, ct);
        if (existing is not null)
        {
            db.Contacts.Remove(existing);
            await db.SaveChangesAsync(ct);
        }

        return Ok(new AddContactResponse(true));
    }

    [HttpGet("blocked")]
    public async Task<ActionResult<BlockedUsersListResponse>> ListBlocked(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var blocked = await db.Contacts.AsNoTracking()
            .Where(c => c.UserId == userId && c.IsBlocked && !c.ContactUser.IsDeleted)
            .Select(c => new {
                c.ContactId, c.ContactUser.UserSettings.UsernameEnc, c.ContactUser.PublicIdEnc,
                c.ContactUser.WrappedDek, c.ContactUser.EcdhPublicKey,
            })
            .ToListAsync(ct);

        var results = blocked.Select(c =>
        {
            var dek = encryption.UnwrapDek(c.WrappedDek);
            return new UserSearchResultDto(
                c.ContactId,
                encryption.Decrypt(c.UsernameEnc, dek),
                encryption.Decrypt(c.PublicIdEnc, dek),
                c.EcdhPublicKey);
        }).ToList();

        return Ok(new BlockedUsersListResponse(true, results));
    }

    [HttpPost("{contactId:guid}/block")]
    public async Task<ActionResult<BlockUserResponse>> Block(Guid contactId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (contactId == userId)
            return BadRequest(new BlockUserResponse(false, "self_block"));

        if (!await db.Users.AnyAsync(u => u.Id == contactId && !u.IsDeleted, ct))
            return NotFound(new BlockUserResponse(false, "not_found"));

        await blocks.BlockAsync(userId, contactId, ct);
        return Ok(new BlockUserResponse(true));
    }

    [HttpPost("{contactId:guid}/unblock")]
    public async Task<ActionResult<BlockUserResponse>> Unblock(Guid contactId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        await blocks.UnblockAsync(userId, contactId, ct);
        return Ok(new BlockUserResponse(true));
    }
}
