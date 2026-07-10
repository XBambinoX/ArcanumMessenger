namespace ArcanumMessenger.Services.AuthServices.RecoveryServices;

public class RecoveryResult
{
    public bool Success { get; }
    public string? Reason { get; }

    private RecoveryResult(bool success, string? reason)
    {
        Success = success;
        Reason = reason;
    }

    public static RecoveryResult Ok() => new(true, null);
    public static RecoveryResult Fail(string reason) => new(false, reason);
}  