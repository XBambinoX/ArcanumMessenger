public class LoginResult
{
    public bool Success { get; }
    public string? Reason { get; }
    private LoginResult(bool success, string? reason) { Success = success; Reason = reason; }
    public static LoginResult Ok() => new(true, null);
    public static LoginResult Fail(string reason) => new(false, reason);
}