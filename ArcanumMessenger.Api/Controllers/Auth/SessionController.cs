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
            Response.ClearAuthCookies();
            return Unauthorized(new RefreshResponse(false, reason));
        }

        Response.SetAuthCookies(accessToken!, newRefreshToken!);
        return Ok(new RefreshResponse(true));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult> Logout(CancellationToken ct)
    {
        Request.Cookies.TryGetValue("refresh_token", out var refreshToken);
        await tokenIssuance.RevokeAsync(refreshToken, ct);

        Response.ClearAuthCookies();

        return Ok();
    }
}