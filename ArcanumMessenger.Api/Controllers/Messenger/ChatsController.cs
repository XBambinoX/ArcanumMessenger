using ArcanumMessenger.Contracts.Messenger.Chats;
using ArcanumMessenger.Services.MessengerServices;
using Microsoft.AspNetCore.Mvc;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/chats")]
public class ChatsController(ChatService chatService, ChatAccessService chatAccess) : MessengerControllerBase
{
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
            "direct" when request.OtherUserId is { } otherId => await chatService.CreateDirectChatAsync(userId, otherId, ct),
            "direct" => (null, "missing_other_user"),
            "group" => await chatService.CreateGroupChatAsync(userId, request.Title, request.Description, request.MemberIds, ct),
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
