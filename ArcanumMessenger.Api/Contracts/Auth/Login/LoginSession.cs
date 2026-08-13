namespace ArcanumMessenger.Contracts.Auth.Login;

public class LoginSession
{
    public string? EmailHash { get; set; }
    public int Step { get; set; }
    public string? KdfSalt { get; set; }

}
