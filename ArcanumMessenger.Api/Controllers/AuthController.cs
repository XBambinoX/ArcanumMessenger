using ArcanumMessenger.Contracts.Auth;
using ArcanumMessenger.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace ArcanumMessenger.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db) : ControllerBase
{
    private static readonly Regex UsernameRegex = new("^[a-zA-Z0-9_]{3,32}$", RegexOptions.Compiled);

    [HttpGet("check-username")]
    public async Task<ActionResult<CheckUsernameResponse>> CheckUsername(
        [FromQuery] string username,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(username) || !UsernameRegex.IsMatch(username))
            return Ok(new CheckUsernameResponse(false, "invalid_format"));

        var exists = await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Username == username && !u.IsDeleted, ct);

        return Ok(new CheckUsernameResponse(!exists, exists ? "taken" : null));
    }
}