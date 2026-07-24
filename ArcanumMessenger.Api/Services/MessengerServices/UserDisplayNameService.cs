using ArcanumMessenger.Data;
using ArcanumMessenger.Services.AuthServices;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class UserDisplayNameService(AppDbContext db, EncryptionService encryption)
{
    // No !IsDeleted filter here on purpose - a direct chat's other member or an
    // old message's sender may since have been soft-deleted, but their name
    // should still resolve for historical display instead of showing blank.
    public async Task<Dictionary<Guid, string>> GetDisplayNamesAsync(IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
            return [];

        var rows = await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.UserSettings.UsernameEnc, u.WrappedDek })
            .ToListAsync(ct);

        return rows.ToDictionary(
            r => r.Id,
            r => encryption.Decrypt(r.UsernameEnc, encryption.UnwrapDek(r.WrappedDek)));
    }
}
