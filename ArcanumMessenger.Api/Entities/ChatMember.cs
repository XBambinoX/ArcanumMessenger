namespace ArcanumMessenger.Entities;

public class ChatMember
{
    public Guid ChatId { get; set; }
    public Guid UserId { get; set; }
    public string Role { get; set; } = "member";
    public DateTime JoinedAt { get; set; }
    public DateTime LastReadAt { get; set; }
    public bool IsMuted { get; set; }
    public DateTime? MutedUntil { get; set; }
    public bool IsArchived { get; set; }
    // This member's copy of the chat's symmetric key, sealed to their own
    // ECDH public key (see crypto/ecdh.ts's seal()/unseal()) - only their
    // own device can open it. Null means "needs (re)provisioning": right
    // after the chat/membership is created before the sealed key lands, or
    // after this user's identity keypair was rotated (e.g. password
    // recovery) and their old wrap went stale.
    public string? WrappedChatKey { get; set; }

    public Chat Chat { get; set; } = null!;
    public User User { get; set; } = null!;
}
