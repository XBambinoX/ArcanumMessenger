using ArcanumMessenger.Contracts.Messenger.Messages;
using ArcanumMessenger.Services.MessengerServices;
using Microsoft.AspNetCore.Mvc;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/chats/{chatId:guid}/messages")]
public class MessagesController(MessageService messageService, ChatAccessService chatAccess) : MessengerControllerBase
{
    [HttpGet]
    public async Task<ActionResult<MessageHistoryResponse>> History(
        Guid chatId, [FromQuery] Guid? before, [FromQuery] int take, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new MessageHistoryResponse(false, null, false, "not_found"));

        var (messages, hasMore, reason) = await messageService.GetHistoryAsync(chatId, userId, before, take, ct);
        if (reason is not null)
            return BadRequest(new MessageHistoryResponse(false, null, false, reason));

        return Ok(new MessageHistoryResponse(true, messages, hasMore));
    }

    [HttpPost]
    public async Task<ActionResult<SendMessageResponse>> Send(
        Guid chatId, [FromBody] SendMessageRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new SendMessageResponse(false, null, "not_found"));

        var (message, reason) = await messageService.SendMessageAsync(membership, request.Content, request.ReplyToId, request.MediaId, request.AsGif, ct);
        if (message is null)
            return BadRequest(new SendMessageResponse(false, null, reason));

        return Ok(new SendMessageResponse(true, message));
    }

    [HttpDelete("{messageId:guid}")]
    public async Task<ActionResult<DeleteMessageResponse>> Delete(Guid chatId, Guid messageId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new DeleteMessageResponse(false, "not_found"));

        var (success, reason) = await messageService.DeleteMessageAsync(chatId, messageId, userId, ct);
        return success ? Ok(new DeleteMessageResponse(true)) : BadRequest(new DeleteMessageResponse(false, reason));
    }

    [HttpPut("{messageId:guid}")]
    public async Task<ActionResult<EditMessageResponse>> Edit(
        Guid chatId, Guid messageId, [FromBody] EditMessageRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new EditMessageResponse(false, null, "not_found"));

        var (message, reason) = await messageService.EditMessageAsync(chatId, messageId, userId, request.Content, ct);
        return message is null
            ? BadRequest(new EditMessageResponse(false, null, reason))
            : Ok(new EditMessageResponse(true, message));
    }
}
