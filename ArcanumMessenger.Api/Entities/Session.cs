namespace ArcanumMessenger.Entities;

public class Session
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? DeviceName { get; set; }
    public string? DeviceType { get; set; }
    public string? IpAddress { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime LastUsedAt { get; set; }

    public User User { get; set; } = null!;
}
