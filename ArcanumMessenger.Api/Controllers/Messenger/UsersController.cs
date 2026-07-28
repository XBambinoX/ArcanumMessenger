using ArcanumMessenger.Contracts.Messenger.Users;
using ArcanumMessenger.Data;
using ArcanumMessenger.Services.AuthServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using ArcanumMessenger.Services.MessengerServices;
using ArcanumMessenger.Entities;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/users")]
public class UsersController(AppDbContext db, EncryptionService encryption, PublicIdHasher publicIdHasher, PresenceService presence) : MessengerControllerBase
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
                .Where(u => !db.Contacts.Any(c => c.IsBlocked &&
                    ((c.UserId == callerId && c.ContactId == u.Id) || (c.UserId == u.Id && c.ContactId == callerId))))
                .Select(u => new { u.Id, u.UserSettings.UsernameEnc, u.PublicIdEnc, u.WrappedDek })
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
            .Where(u => !db.Contacts.Any(c => c.IsBlocked &&
                ((c.UserId == callerId && c.ContactId == u.Id) || (c.UserId == u.Id && c.ContactId == callerId))))
            .Select(u => new { u.Id, u.UserSettings.UsernameEnc, u.PublicIdEnc, u.WrappedDek })
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
                            u.UserSettings.UsernameEnc,
                            u.IsDeleted,
                            u.PublicIdEnc,
                            u.LastSeen,
                            u.WrappedDek,
                            u.UserSettings.EmailEnc,
                            u.UserSettings.BioEnc,
                            u.UserSettings.PhoneEnc,
                            u.UserSettings.ShowPhoneNumber,
                        })
                        .FirstOrDefaultAsync(ct);

        if (user is null || user.IsDeleted)
            return new GetUserResponce(Name: null,
                                       Id: null,
                                       LastSeen: null,
                                       Email: null,
                                       IsContact: false,
                                       IsBlocked: false,
                                       IsBlockedByOther: false,
                                       success: false,
                                       reason: "not_found",
                                       Bio: null,
                                       Phone: null );

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var username = encryption.Decrypt(user.UsernameEnc, dek);
        var publicId = encryption.Decrypt(user.PublicIdEnc, dek);
        var publicEmail = string.IsNullOrEmpty(user.EmailEnc) ? null : encryption.Decrypt(user.EmailEnc, dek);
        var isBlocked = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == callerId && c.ContactId == id && c.IsBlocked, ct);
        var isBlockedByOther = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == id && c.ContactId == callerId && c.IsBlocked, ct);
        var isContact = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == callerId && c.ContactId == id && !c.IsBlocked, ct);
        var bio = string.IsNullOrEmpty(user.BioEnc) ? null : encryption.Decrypt(user.BioEnc, dek);
        var showPhoneToThisViewer = user.ShowPhoneNumber switch
        {
            PhoneVisibility.Everyone => true,
            PhoneVisibility.Contacts => isContact || id == callerId,
            PhoneVisibility.Nobody => id == callerId,
            _ => false
        };

        var phone = (!string.IsNullOrEmpty(user.PhoneEnc) && showPhoneToThisViewer)
            ? encryption.Decrypt(user.PhoneEnc, dek)
            : null;
    
        return new GetUserResponce(Name:username,
                                   Id: publicId,
                                   LastSeen:user.LastSeen,
                                   Email:publicEmail,
                                   IsContact:isContact,
                                   IsBlocked: isBlocked,
                                   IsBlockedByOther: isBlockedByOther,
                                   success: true,
                                   reason: null,
                                   Bio: bio,
                                   Phone: phone);
    }

    [HttpGet("{targetUserId:guid}/presence")]
    [Authorize]
    public async Task<ActionResult<UserPresenceResponse>> GetPresence(
        Guid targetUserId, CancellationToken ct)
    {
        if (!TryGetUserId(out var callerId))
            return Unauthorized();

        if (await db.Contacts.AnyAsync(c => c.IsBlocked &&
                ((c.UserId == callerId && c.ContactId == targetUserId) ||
                 (c.UserId == targetUserId && c.ContactId == callerId)), ct))
            return Ok(new UserPresenceResponse(false, null));

        var user = await db.Users
            .AsNoTracking()
            .Where(u => u.Id == targetUserId && !u.IsDeleted)
            .Select(u => new
            {
                u.LastSeen,
                ShowOnlineStatus = u.UserSettings.ShowOnlineStatus,
                ShowLastSeen = u.UserSettings.ShowLastSeen,
            })
            .FirstOrDefaultAsync(ct);

        if (user is null)
            return NotFound();

        var isOnline = await presence.IsOnlineAsync(targetUserId);

        if (!user.ShowOnlineStatus)
            return Ok(new UserPresenceResponse(false, null));

        if (!user.ShowLastSeen)
            return Ok(new UserPresenceResponse(isOnline, null));

        return Ok(new UserPresenceResponse(isOnline, isOnline ? null : user.LastSeen));
    }

    [HttpPost("presence/bulk")]
    [Authorize]
    public async Task<ActionResult<BulkPresenceResponse>> GetPresenceBulk(
        [FromBody] BulkPresenceRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var callerId))
            return Unauthorized();

        if (request.UserIds.Count == 0)
            return Ok(new BulkPresenceResponse([]));

        // Cap to something sane — this is meant for "all direct chats visible
        // in the sidebar", not an arbitrary bulk-lookup endpoint.
        var ids = request.UserIds.Distinct().Take(200).ToList();

        var blockedIds = await db.Contacts.AsNoTracking()
            .Where(c => c.IsBlocked &&
                ((c.UserId == callerId && ids.Contains(c.ContactId)) ||
                 (c.ContactId == callerId && ids.Contains(c.UserId))))
            .Select(c => c.UserId == callerId ? c.ContactId : c.UserId)
            .ToListAsync(ct);
        var blockedSet = blockedIds.ToHashSet();

        var users = await db.Users
            .AsNoTracking()
            .Where(u => ids.Contains(u.Id) && !u.IsDeleted)
            .Select(u => new
            {
                u.Id,
                u.LastSeen,
                ShowOnlineStatus = u.UserSettings.ShowOnlineStatus,
                ShowLastSeen = u.UserSettings.ShowLastSeen,
            })
            .ToListAsync(ct);

        var items = new List<BulkPresenceItem>();

        foreach (var user in users)
        {
            if (blockedSet.Contains(user.Id))
            {
                items.Add(new BulkPresenceItem(user.Id, false, null));
                continue;
            }

            var isOnline = await presence.IsOnlineAsync(user.Id);

            if (!user.ShowOnlineStatus)
            {
                items.Add(new BulkPresenceItem(user.Id, false, null));
                continue;
            }

            var lastSeen = (!user.ShowLastSeen || isOnline) ? null : user.LastSeen;
            items.Add(new BulkPresenceItem(user.Id, isOnline, lastSeen));
        }

        return Ok(new BulkPresenceResponse(items));
    }
}
