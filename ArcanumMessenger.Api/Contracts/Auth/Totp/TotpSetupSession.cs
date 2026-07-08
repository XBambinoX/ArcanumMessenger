namespace ArcanumMessenger.Contracts.Auth.Totp;

public class TotpSetupSession
{
    public Guid UserId { get; set; }
    public string Secret { get; set; } = null!;
}
