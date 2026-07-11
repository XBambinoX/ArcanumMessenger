using Microsoft.AspNetCore.Http;

namespace ArcanumMessenger.Services.AuthServices.LoginServices;

public static class AuthCookieExtensions
{
    public static void SetAuthCookies(this HttpResponse response, string accessToken, string refreshToken)
    {
        var sameSite = IsDevelopment() ? SameSiteMode.None : SameSiteMode.Strict;

        response.Cookies.Append("access_token", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = sameSite,
            Expires = DateTimeOffset.UtcNow.AddMinutes(JwtService.AccessTokenMinutes)
        });

        response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = sameSite,
            Expires = DateTimeOffset.UtcNow.AddHours(TokenIssuanceService.SessionDurationHours)
        });
    }

    public static void ClearAuthCookies(this HttpResponse response)
    {
        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = IsDevelopment() ? SameSiteMode.None : SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(-1)
        };

        response.Cookies.Delete("access_token", options);
        response.Cookies.Delete("refresh_token", options);
    }

    private static bool IsDevelopment() =>
        Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
}
