using ArcanumMessenger.Contracts.Messenger.Chats;
using ArcanumMessenger.Services.MessengerServices;
using Microsoft.AspNetCore.Mvc;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/chats")]
public class ChatsController(ChatService chatService, ChatAccessService chatAccess, AvatarService avatars) : MessengerControllerBase
{
    private const long MaxAvatarUploadBytes = 10_000_000;

    [HttpGet]
    public async Task<ActionResult<ChatListResponse>> List(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var chats = await chatService.GetChatSummariesAsync(userId, ct);
        return Ok(new ChatListResponse(true, chats));
    }

    [HttpPost]
    public async Task<ActionResult<CreateChatResponse>> Create([FromBody] CreateChatRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        (ChatSummaryDto? Chat, string? Reason) result = request.Type switch
        {
            "direct" when request.OtherUserId is { } otherId =>
                await chatService.CreateDirectChatAsync(userId, otherId, request.MemberKeys, ct),
            "direct" => (null, "missing_other_user"),
            "group" => await chatService.CreateGroupChatAsync(
                userId, request.Title, request.Description, request.MemberIds, request.MemberKeys, ct),
            _ => (null, "invalid_type"),
        };

        if (result.Chat is null)
            return result.Reason == "user_not_found"
                ? NotFound(new CreateChatResponse(false, null, result.Reason))
                : BadRequest(new CreateChatResponse(false, null, result.Reason));

        return Ok(new CreateChatResponse(true, result.Chat));
    }

    [HttpPost("{chatId:guid}/read")]
    public async Task<ActionResult<MarkChatReadResponse>> MarkRead(Guid chatId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new MarkChatReadResponse(false, Reason: "not_found"));

        var lastReadAt = await chatService.MarkReadAsync(membership, ct);
        return Ok(new MarkChatReadResponse(true, lastReadAt));
    }

    [HttpPut("{chatId:guid}/archive")]
    public async Task<ActionResult<SetArchivedResponse>> SetArchived(
        Guid chatId, [FromBody] SetArchivedRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new SetArchivedResponse(false, Reason: "not_found"));

        await chatService.SetArchivedAsync(membership, request.IsArchived, ct);
        return Ok(new SetArchivedResponse(true, request.IsArchived));
    }

    // RequestFormLimits isn't needed here the way MediaController's upload
    // needed it - 10MB is comfortably under the 128MB multipart-form default,
    // so the two limits never disagree at this size.
    [HttpPost("{chatId:guid}/avatar")]
    [RequestSizeLimit(MaxAvatarUploadBytes)]
    public async Task<ActionResult<UploadChatAvatarResponse>> UploadAvatar(Guid chatId, IFormFile? file, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new UploadChatAvatarResponse(false, "not_found"));
        if (membership.Chat.Type != "group")
            return BadRequest(new UploadChatAvatarResponse(false, "not_a_group"));
        if (membership.Role != "admin")
            return BadRequest(new UploadChatAvatarResponse(false, "forbidden"));

        if (file is null || file.Length == 0)
            return BadRequest(new UploadChatAvatarResponse(false, "empty_file"));

        await using var stream = file.OpenReadStream();
        var (success, reason) = await avatars.UploadChatAvatarAsync(
            chatId, stream, file.Length, file.ContentType ?? "application/octet-stream", ct);

        return success ? Ok(new UploadChatAvatarResponse(true)) : BadRequest(new UploadChatAvatarResponse(false, reason));
    }

    [HttpDelete("{chatId:guid}/avatar")]
    public async Task<ActionResult<UploadChatAvatarResponse>> DeleteAvatar(Guid chatId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new UploadChatAvatarResponse(false, "not_found"));
        if (membership.Chat.Type != "group")
            return BadRequest(new UploadChatAvatarResponse(false, "not_a_group"));
        if (membership.Role != "admin")
            return BadRequest(new UploadChatAvatarResponse(false, "forbidden"));

        await avatars.DeleteChatAvatarAsync(chatId, ct);
        return Ok(new UploadChatAvatarResponse(true));
    }

    // Any current member can view it - same open-within-the-chat model as
    // messages/media, no extra visibility setting the way a user avatar has.
    [HttpGet("{chatId:guid}/avatar")]
    public async Task<IActionResult> GetAvatar(Guid chatId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null || membership.Chat.Type != "group")
            return NotFound();

        var result = await avatars.OpenChatAvatarStreamAsync(chatId, ct);
        if (result is null)
            return NotFound();

        Response.ContentLength = result.Length;
        Response.Headers.CacheControl = "private, max-age=300";
        return File(result.Content, result.ContentType);
    }

    [HttpGet("{chatId:guid}/members")]
    public async Task<ActionResult<ChatMembersResponse>> GetMembers(Guid chatId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new ChatMembersResponse(false, Reason: "not_found"));

        var (description, members) = await chatService.GetChatMembersAsync(membership, ct);
        return Ok(new ChatMembersResponse(true, description, members));
    }

    [HttpPost("{chatId:guid}/members")]
    public async Task<ActionResult<AddMembersResponse>> AddMembers(
        Guid chatId, [FromBody] AddMembersRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new AddMembersResponse(false, Reason: "not_found"));

        var (members, reason) = await chatService.AddMembersAsync(membership, request.UserIds, request.MemberKeys, ct);
        return reason is null ? Ok(new AddMembersResponse(true, members)) : BadRequest(new AddMembersResponse(false, Reason: reason));
    }

    // Any member (not just an admin) can fill in a gap - this only ever
    // provisions a currently-missing key, never overwrites one (see
    // ChatService.SetMemberChatKeyAsync).
    [HttpPost("{chatId:guid}/members/{memberId:guid}/key")]
    public async Task<ActionResult<SetMemberChatKeyResponse>> SetMemberChatKey(
        Guid chatId, Guid memberId, [FromBody] SetMemberChatKeyRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new SetMemberChatKeyResponse(false, "not_found"));

        var reason = await chatService.SetMemberChatKeyAsync(membership, memberId, request.WrappedChatKey, ct);
        return reason is null ? Ok(new SetMemberChatKeyResponse(true)) : BadRequest(new SetMemberChatKeyResponse(false, reason));
    }

    [HttpDelete("{chatId:guid}/members/{memberId:guid}")]
    public async Task<ActionResult<RemoveMemberResponse>> RemoveMember(Guid chatId, Guid memberId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new RemoveMemberResponse(false, "not_found"));

        var reason = await chatService.RemoveMemberAsync(membership, memberId, ct);
        return reason is null ? Ok(new RemoveMemberResponse(true)) : BadRequest(new RemoveMemberResponse(false, reason));
    }

    [HttpPost("{chatId:guid}/members/{memberId:guid}/promote")]
    public async Task<ActionResult<PromoteMemberResponse>> PromoteMember(Guid chatId, Guid memberId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new PromoteMemberResponse(false, "not_found"));

        var reason = await chatService.PromoteToAdminAsync(membership, memberId, ct);
        return reason is null ? Ok(new PromoteMemberResponse(true)) : BadRequest(new PromoteMemberResponse(false, reason));
    }

    [HttpPost("{chatId:guid}/members/{memberId:guid}/demote")]
    public async Task<ActionResult<DemoteMemberResponse>> DemoteMember(Guid chatId, Guid memberId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new DemoteMemberResponse(false, "not_found"));

        var reason = await chatService.DemoteToMemberAsync(membership, memberId, ct);
        return reason is null ? Ok(new DemoteMemberResponse(true)) : BadRequest(new DemoteMemberResponse(false, reason));
    }

    [HttpDelete("{chatId:guid}")]
    public async Task<ActionResult<DeleteChatResponse>> Delete(
        Guid chatId, [FromQuery] bool forEveryone, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new DeleteChatResponse(false, "not_found"));

        var reason = await chatService.DeleteChatAsync(membership, forEveryone, ct);
        return reason is null ? Ok(new DeleteChatResponse(true)) : BadRequest(new DeleteChatResponse(false, reason));
    }

    [HttpPost("{chatId:guid}/leave")]
    public async Task<ActionResult<LeaveChatResponse>> Leave(Guid chatId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new LeaveChatResponse(false, "not_found"));

        var reason = await chatService.LeaveGroupAsync(membership, ct);
        return reason is null ? Ok(new LeaveChatResponse(true)) : BadRequest(new LeaveChatResponse(false, reason));
    }
}
