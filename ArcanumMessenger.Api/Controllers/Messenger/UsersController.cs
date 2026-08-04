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
public class UsersController(AppDbContext db, EncryptionService encryption, PublicIdHasher publicIdHasher, PresenceService presence, AvatarService avatars) : MessengerControllerBase
{
    private const long MaxAvatarUploadBytes = 10_000_000;
    private const int EcdhPublicKeySize = 65; // uncompressed P-256 point
    private const int WrappedPrivateKeyMaxSize = 512;

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
                .Select(u => new { u.Id, u.UserSettings.UsernameEnc, u.PublicIdEnc, u.WrappedDek, u.EcdhPublicKey })
                .FirstOrDefaultAsync(ct);

            if (exact is null)
                return Ok(new SearchUsersResponse(true, []));

            var dek = encryption.UnwrapDek(exact.WrappedDek);
            var name = encryption.Decrypt(exact.UsernameEnc, dek);
            var publicId = encryption.Decrypt(exact.PublicIdEnc, dek);
            return Ok(new SearchUsersResponse(true, [new UserSearchResultDto(exact.Id, name, publicId, exact.EcdhPublicKey)]));
        }

        var prefixHash = publicIdHasher.HashPrefix(normalized);
        var candidates = await db.Users.AsNoTracking()
            .Where(u => u.PublicIdPrefixHash == prefixHash && u.Id != callerId && !u.IsDeleted)
            .Where(u => !db.Contacts.Any(c => c.IsBlocked &&
                ((c.UserId == callerId && c.ContactId == u.Id) || (c.UserId == u.Id && c.ContactId == callerId))))
            .Select(u => new { u.Id, u.UserSettings.UsernameEnc, u.PublicIdEnc, u.WrappedDek, u.EcdhPublicKey })
            .ToListAsync(ct);

        var results = new List<UserSearchResultDto>();
        foreach (var candidate in candidates)
        {
            var dek = encryption.UnwrapDek(candidate.WrappedDek);
            var candidatePublicId = encryption.Decrypt(candidate.PublicIdEnc, dek);
            if (PublicIdHasher.Normalize(candidatePublicId).StartsWith(normalized, StringComparison.Ordinal))
                results.Add(new UserSearchResultDto(
                    candidate.Id, encryption.Decrypt(candidate.UsernameEnc, dek), candidatePublicId, candidate.EcdhPublicKey));
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
                            u.UserSettings.ShowBio,
                            u.UserSettings.ShowEmail,
                            u.EcdhPublicKey,
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
                                       Phone: null,
                                       EcdhPublicKey: null );

        var dek = encryption.UnwrapDek(user.WrappedDek);
        var username = encryption.Decrypt(user.UsernameEnc, dek);
        var publicId = encryption.Decrypt(user.PublicIdEnc, dek);
        var isBlocked = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == callerId && c.ContactId == id && c.IsBlocked, ct);
        var isBlockedByOther = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == id && c.ContactId == callerId && c.IsBlocked, ct);
        // isContact ("have I added them") drives the Add/Remove-contact button
        // and is a caller-centric fact about the caller's own contact list.
        // Contacts-tier privacy is a different question - "does the PROFILE
        // OWNER'S contact list include the caller" - answered by a separate,
        // oppositely-directed check, the same way isBlockedByOther already
        // mirrors isBlocked in the other direction.
        var isContact = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == callerId && c.ContactId == id && !c.IsBlocked, ct);
        var isCallerInOwnersContacts = id != callerId && await db.Contacts.AnyAsync(c => c.UserId == id && c.ContactId == callerId && !c.IsBlocked, ct);
        var showPhoneToThisViewer = user.ShowPhoneNumber switch
        {
            PhoneVisibility.Everyone => true,
            PhoneVisibility.Contacts => isCallerInOwnersContacts || id == callerId,
            PhoneVisibility.Nobody => id == callerId,
            _ => false
        };
        var showBioToThisViewer = user.ShowBio switch
        {
            PhoneVisibility.Everyone => true,
            PhoneVisibility.Contacts => isCallerInOwnersContacts || id == callerId,
            PhoneVisibility.Nobody => id == callerId,
            _ => false
        };
        var showEmailToThisViewer = user.ShowEmail switch
        {
            PhoneVisibility.Everyone => true,
            PhoneVisibility.Contacts => isCallerInOwnersContacts || id == callerId,
            PhoneVisibility.Nobody => id == callerId,
            _ => false
        };

        var phone = (!string.IsNullOrEmpty(user.PhoneEnc) && showPhoneToThisViewer)
            ? encryption.Decrypt(user.PhoneEnc, dek)
            : null;
        var bio = (!string.IsNullOrEmpty(user.BioEnc) && showBioToThisViewer)
            ? encryption.Decrypt(user.BioEnc, dek)
            : null;
        var publicEmail = (!string.IsNullOrEmpty(user.EmailEnc) && showEmailToThisViewer)
            ? encryption.Decrypt(user.EmailEnc, dek)
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
                                   Phone: phone,
                                   EcdhPublicKey: user.EcdhPublicKey);
    }

    // Only for legacy accounts that registered before E2EE shipped and still
    // have no identity keypair - the client calls this right after login
    // completion when CompleteLoginResponse comes back with no key. Rejects
    // if a key is already set: overwriting it is password recovery's job
    // (RecoveryService.ResetPasswordAsync), which also invalidates every
    // chat's now-stale wrapped key for this user.
    [HttpPost("me/identity-key")]
    public async Task<ActionResult<SetIdentityKeyResponse>> SetIdentityKey(
        [FromBody] SetIdentityKeyRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (!PasswordHasher.IsBase64OfLength(request.EcdhPublicKey, EcdhPublicKeySize) ||
            !PasswordHasher.IsBase64OfMaxLength(request.WrappedEcdhPrivateKey, WrappedPrivateKeyMaxSize))
            return StatusCode(StatusCodes.Status422UnprocessableEntity, new SetIdentityKeyResponse(false, "invalid_key_format"));

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, ct);
        if (user is null)
            return NotFound(new SetIdentityKeyResponse(false, "not_found"));

        if (user.EcdhPublicKey is not null)
            return Conflict(new SetIdentityKeyResponse(false, "already_set"));

        user.EcdhPublicKey = request.EcdhPublicKey;
        user.WrappedEcdhPrivateKey = request.WrappedEcdhPrivateKey;
        await db.SaveChangesAsync(ct);

        return Ok(new SetIdentityKeyResponse(true));
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

    // RequestFormLimits isn't needed here the way MediaController's upload
    // needed it - 10MB is comfortably under the 128MB multipart-form default,
    // so the two limits never disagree at this size.
    [HttpPost("me/avatar")]
    [RequestSizeLimit(MaxAvatarUploadBytes)]
    public async Task<ActionResult<UploadAvatarResponse>> UploadAvatar(IFormFile? file, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (file is null || file.Length == 0)
            return BadRequest(new UploadAvatarResponse(false, "empty_file"));

        await using var stream = file.OpenReadStream();
        var (success, reason) = await avatars.UploadAvatarAsync(
            userId, stream, file.Length, file.ContentType ?? "application/octet-stream", ct);

        return success ? Ok(new UploadAvatarResponse(true)) : BadRequest(new UploadAvatarResponse(false, reason));
    }

    [HttpDelete("me/avatar")]
    public async Task<ActionResult<UploadAvatarResponse>> DeleteAvatar(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        await avatars.DeleteAvatarAsync(userId, ct);
        return Ok(new UploadAvatarResponse(true));
    }

    [HttpGet("me/avatar")]
    public Task<IActionResult> GetMyAvatar(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Task.FromResult<IActionResult>(Unauthorized());

        return GetAvatarById(userId, ct);
    }

    // Same open-by-default model GetUser already has (no chat-membership
    // check) - but now subject to the owner's own ShowAvatar preference,
    // same as phone/bio.
    [HttpGet("{id:guid}/avatar")]
    public async Task<IActionResult> GetAvatarById(Guid id, CancellationToken ct)
    {
        if (!TryGetUserId(out var callerId))
            return Unauthorized();

        var showAvatar = await db.Users.AsNoTracking()
            .Where(u => u.Id == id && !u.IsDeleted)
            .Select(u => (PhoneVisibility?)u.UserSettings.ShowAvatar)
            .FirstOrDefaultAsync(ct);

        if (showAvatar is null || !await IsVisibleToAsync(showAvatar.Value, id, callerId, ct))
            return NotFound();

        var result = await avatars.OpenAvatarStreamAsync(id, ct);
        if (result is null)
            return NotFound();

        Response.ContentLength = result.Length;
        Response.Headers.CacheControl = "private, max-age=300";
        return File(result.Content, result.ContentType);
    }

    // A standalone helper (rather than reusing BuildProfileAsync's inline
    // logic) since this method needs the check without already computing
    // anything else about the caller/target pair along the way. Same
    // direction as BuildProfileAsync's Contacts-tier checks: visible when
    // the PROFILE OWNER (targetId) has the caller in their own contact list,
    // not the other way around.
    private async Task<bool> IsVisibleToAsync(PhoneVisibility visibility, Guid targetId, Guid callerId, CancellationToken ct)
    {
        if (targetId == callerId) return true;
        return visibility switch
        {
            PhoneVisibility.Everyone => true,
            PhoneVisibility.Contacts => await db.Contacts.AnyAsync(
                c => c.UserId == targetId && c.ContactId == callerId && !c.IsBlocked, ct),
            PhoneVisibility.Nobody => false,
            _ => false,
        };
    }
}
