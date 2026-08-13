namespace ArcanumMessenger.Contracts.Auth.Recovery;

public class RecoverySession
{
    public Guid UserId { get; set; }
    public int Step { get; set; }
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; }
}