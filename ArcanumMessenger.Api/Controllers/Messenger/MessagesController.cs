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

        var (messages, hasMore, readStates, reason) = await messageService.GetHistoryAsync(chatId, userId, before, take, ct);
        if (reason is not null)
            return BadRequest(new MessageHistoryResponse(false, null, false, reason));

        return Ok(new MessageHistoryResponse(true, messages, hasMore, ReadStates: readStates));
    }

    [HttpGet("media")]
    public async Task<ActionResult<ChatMediaResponse>> Media(
        Guid chatId, [FromQuery] Guid? before, [FromQuery] int take, [FromQuery] string? kind, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new ChatMediaResponse(false, Reason: "not_found"));

        var (items, hasMore, reason) = await messageService.GetMediaAsync(chatId, before, take, kind, ct);
        if (reason is not null)
            return BadRequest(new ChatMediaResponse(false, Reason: reason));

        return Ok(new ChatMediaResponse(true, items, hasMore));
    }

    [HttpGet("stats")]
    public async Task<ActionResult<ChatStatsResponse>> Stats(Guid chatId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new ChatStatsResponse(false, Reason: "not_found"));

        var (messageCount, mediaCount) = await messageService.GetStatsAsync(chatId, ct);
        return Ok(new ChatStatsResponse(true, messageCount, mediaCount));
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

        var (message, reason) = await messageService.SendMessageAsync(membership, request.Content, request.ReplyToId, request.MediaId, request.AsGif, request.AsVideoNote, ct);
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

    [HttpPost("forward")]
    public async Task<ActionResult<ForwardMessagesResponse>> Forward(
        Guid chatId, [FromBody] ForwardMessagesRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var membership = await chatAccess.GetMembershipAsync(chatId, userId, ct);
        if (membership is null)
            return NotFound(new ForwardMessagesResponse(false, null, "not_found"));

        var (messages, reason) = await messageService.ForwardMessagesAsync(membership, request.Items, ct);
        return messages is null
            ? BadRequest(new ForwardMessagesResponse(false, null, reason))
            : Ok(new ForwardMessagesResponse(true, messages));
    }
}
