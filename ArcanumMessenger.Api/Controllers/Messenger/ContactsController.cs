using ArcanumMessenger.Contracts.Messenger.Contacts;
using ArcanumMessenger.Contracts.Messenger.Users;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using ArcanumMessenger.Services.AuthServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/contacts")]
public class ContactsController(AppDbContext db, EncryptionService encryption) : MessengerControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ContactsListResponse>> List(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var contacts = await db.Contacts.AsNoTracking()
            .Where(c => c.UserId == userId && !c.ContactUser.IsDeleted)
            .Select(c => new { c.ContactId, c.ContactUser.UsernameEnc, c.ContactUser.PublicIdEnc, c.ContactUser.WrappedDek })
            .ToListAsync(ct);

        var results = contacts.Select(c =>
        {
            var dek = encryption.UnwrapDek(c.WrappedDek);
            return new UserSearchResultDto(
                c.ContactId,
                encryption.Decrypt(c.UsernameEnc, dek),
                encryption.Decrypt(c.PublicIdEnc, dek));
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
}
