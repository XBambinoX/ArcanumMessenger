using ArcanumMessenger.Contracts.Messenger.Users;
using ArcanumMessenger.Data;
using ArcanumMessenger.Services.AuthServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/users")]
public class UsersController(AppDbContext db, EncryptionService encryption, PublicIdHasher publicIdHasher) : MessengerControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<GetUserResponce>> GetMe(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var response = await BuildProfileAsync(userId, userId, ct);
        return response.success ? response : NotFound(response);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<GetUserResponce>> GetUser(Guid id, CancellationToken ct)
    {
        if (!TryGetUserId(out var callerId))
            return Unauthorized();

        var response = await BuildProfileAsync(id, callerId, ct);
        return response.success ? response : NotFound(response);
    }

    // Exact match on the full id is one indexed lookup. A partial id can
    // only narrow by its first group (see PublicIdHasher) - candidates
    // sharing that group get decrypted and checked against the rest of
    // what was typed, but that set should stay small in practice.
    [HttpGet("search")]
    public async Task<ActionResult<SearchUsersResponse>> Search([FromQuery] string? query, CancellationToken ct)
    {
        if (!TryGetUserId(out var callerId))
            return Unauthorized();

        var normalized = PublicIdHasher.Normalize(query ?? "");
        if (normalized.Length < PublicIdHasher.PrefixLength)
            return Ok(new SearchUsersResponse(true, [], "too_short"));

        if (normalized.Length == PublicIdHasher.FullLength)
        {
            var fullHash = publicIdHasher.Hash(normalized);
            var exact = await db.Users.AsNoTracking()
                .Where(u => u.PublicIdHash == fullHash && u.Id != callerId && !u.IsDeleted)
                .Select(u => new { u.Id, u.UsernameEnc, u.PublicIdEnc, u.WrappedDek })
                .FirstOrDefaultAsync(ct);

            if (exact is null)
                return Ok(new SearchUsersResponse(true, []));

            var dek = encryption.UnwrapDek(exact.WrappedDek);
            var name = encryption.Decrypt(exact.UsernameEnc, dek);
            var publicId = encryption.Decrypt(exact.PublicIdEnc, dek);
            return Ok(new SearchUsersResponse(true, [new UserSearchResultDto(exact.Id, name, publicId)]));
        }

        var prefixHash = publicIdHasher.HashPrefix(normalized);
        var candidates = await db.Users.AsNoTracking()
            .Where(u => u.PublicIdPrefixHash == prefixHash && u.Id != callerId && !u.IsDeleted)
            .Select(u => new { u.Id, u.UsernameEnc, u.PublicIdEnc, u.WrappedDek })
            .ToListAsync(ct);

        var results = new List<UserSearchResultDto>();
        foreach (var candidate in candidates)
        {
            var dek = encryption.UnwrapDek(candidate.WrappedDek);
            var candidatePublicId = encryption.Decrypt(candidate.PublicIdEnc, dek);
            if (PublicIdHasher.Normalize(candidatePublicId).StartsWith(normalized, StringComparison.Ordinal))
                results.Add(new UserSearchResultDto(candidate.Id, encryption.Decrypt(candidate.UsernameEnc, dek), candidatePublicId));
        }

        return Ok(new SearchUsersResponse(true, results));
    }

    private async Task<GetUserResponce> BuildProfileAsync(Guid id, Guid callerId, CancellationToken ct)
    {
        var user = await db.Users
                        .AsNoTracking()
                        .Where(u => u.Id == id)
                        .Select(u => new
                        {
                            u.UsernameEnc,
                            u.IsDeleted,
                            u.PublicIdEnc,
                            u.LastSeen,
                            u.WrappedDek,
                            u.PublicEmailEnc,
                        })
                        .FirstOrDefaultAsync(ct);

        if (user is null || user.IsDeleted)
            return new GetUserResponce(Name: null, Id: null, LastSeen: null, PublicEmail: null, IsContact: false, success: false, reason: "not_found");

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var username = encryption.Decrypt(user.UsernameEnc, dek);
        var publicId = encryption.Decrypt(user.PublicIdEnc, dek);
        var publicEmail = string.IsNullOrEmpty(user.PublicEmailEnc) ? null : encryption.Decrypt(user.PublicEmailEnc, dek);
        var isContact = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == callerId && c.ContactId == id, ct);

        return new GetUserResponce(username, publicId, user.LastSeen, publicEmail, isContact, success: true, reason: null);
    }
}
