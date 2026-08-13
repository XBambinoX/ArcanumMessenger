namespace ArcanumMessenger.Entities;

public class Session
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string RefreshTokenHash { get; set; } = null!;
    public string? DeviceName { get; set; }
    public string? DeviceType { get; set; }
    public string? IpAddress { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime LastUsedAt { get; set; }
    // Set when this session gets rotated out - lets a refresh request
    // that presents this (now revoked) token within a short grace window
    // be treated as "still good" and resolved against whichever session
    // replaced it, instead of failing outright. See TokenIssuanceService's
    // own comment on why this matters.
    public Guid? ReplacedBySessionId { get; set; }

    public User User { get; set; } = null!;
}