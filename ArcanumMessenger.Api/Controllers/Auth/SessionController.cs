using ArcanumMessenger.Contracts.Auth.Session;
using ArcanumMessenger.Services.AuthServices.LoginServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ArcanumMessenger.Controllers.Auth;

[ApiController]
[Route("api/auth")]
public class SessionController(TokenIssuanceService tokenIssuance) : ControllerBase
{
    [HttpGet("me")]
    [Authorize]
    public ActionResult<MeResponse> Me()
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Ok(new MeResponse(Success: true, UserId: userId));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<RefreshResponse>> Refresh(CancellationToken ct)
    {
        Request.Cookies.TryGetValue("refresh_token", out var refreshToken);

        var (success, accessToken, newRefreshToken, reason) = await tokenIssuance.RefreshAsync(refreshToken, ct);

        if (!success)
        {
            ClearAuthCookies();
            return Unauthorized(new RefreshResponse(false, reason));
        }

        SetAuthCookies(accessToken!, newRefreshToken!);
        return Ok(new RefreshResponse(true));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult> Logout(CancellationToken ct)
    {
        Request.Cookies.TryGetValue("refresh_token", out var refreshToken);
        await tokenIssuance.RevokeAsync(refreshToken, ct);

        ClearAuthCookies();

        return Ok();
    }

    private void SetAuthCookies(string accessToken, string refreshToken)
    {
        var isDevelopment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";

        Response.Cookies.Append("access_token", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = isDevelopment ? SameSiteMode.None : SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddMinutes(10)
        });

        Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = isDevelopment ? SameSiteMode.None : SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(24)
        });
    }

    private void ClearAuthCookies()
    {
        var isDevelopment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";

        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = isDevelopment ? SameSiteMode.None : SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(-1)
        };

        Response.Cookies.Delete("access_token", options);
        Response.Cookies.Delete("refresh_token", options);
    }
}