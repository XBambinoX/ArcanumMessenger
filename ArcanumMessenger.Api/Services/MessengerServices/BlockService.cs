using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class BlockService(AppDbContext db)
{
    public Task<bool> IsBlockedEitherWayAsync(Guid userA, Guid userB, CancellationToken ct) =>
        db.Contacts.AnyAsync(c => c.IsBlocked &&
            ((c.UserId == userA && c.ContactId == userB) || (c.UserId == userB && c.ContactId == userA)), ct);

    public async Task BlockAsync(Guid userId, Guid targetId, CancellationToken ct)
    {
        var row = await db.Contacts.FirstOrDefaultAsync(c => c.UserId == userId && c.ContactId == targetId, ct);
        if (row is null)
            db.Contacts.Add(new Contact { UserId = userId, ContactId = targetId, IsBlocked = true });
        else
            row.IsBlocked = true;
        await db.SaveChangesAsync(ct);
    }

    public async Task UnblockAsync(Guid userId, Guid targetId, CancellationToken ct)
    {
        var row = await db.Contacts.FirstOrDefaultAsync(c => c.UserId == userId && c.ContactId == targetId, ct);
        if (row is not null)
        {
            row.IsBlocked = false;
            await db.SaveChangesAsync(ct);
        }
    }
}
