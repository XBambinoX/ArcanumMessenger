using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class MediaAccessService(AppDbContext db)
{
    // The uploader can always reach their own upload (previewing before a
    // message is even sent, or just re-viewing what they sent). Anyone else
    // needs a message in a chat they're a member of that actually
    // references this media.
    public async Task<MediaAsset?> GetAccessibleAsync(Guid mediaId, Guid callerId, CancellationToken ct)
    {
        var asset = await db.MediaAssets.AsNoTracking().FirstOrDefaultAsync(m => m.Id == mediaId, ct);
        if (asset is null)
            return null;

        if (asset.UploaderId == callerId)
            return asset;

        var accessible = await db.Messages.AnyAsync(m =>
            m.MediaId == mediaId && !m.IsDeleted &&
            db.ChatMembers.Any(cm => cm.ChatId == m.ChatId && cm.UserId == callerId), ct);

        return accessible ? asset : null;
    }
}
