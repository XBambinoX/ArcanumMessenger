namespace ArcanumMessenger.Entities;

public class SavedGif
{
    public Guid UserId { get; set; }
    // A fresh MediaAsset, re-encrypted client-side under the caller's own
    // Saved Messages chat key - it can't just point at the original chat
    // message's media, since that's encrypted with a different chat's key.
    public Guid MediaId { get; set; }
    // The original media id (in whatever chat it was actually seen in) this
    // was saved from - a snapshot, not a live FK, so lets the client
    // recognize "this in-chat gif is already saved" without decrypting
    // every saved copy to compare bytes. The original may later be deleted;
    // that doesn't affect the saved copy.
    public Guid SourceMediaId { get; set; }
    public DateTime SavedAt { get; set; }

    public User User { get; set; } = null!;
    public MediaAsset Media { get; set; } = null!;
}
