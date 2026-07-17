using ArcanumMessenger.Contracts.Messenger.Chats;
using ArcanumMessenger.Contracts.Messenger.Messages;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ArcanumMessenger.Hubs;

public interface IChatClient
{
    Task ReceiveMessage(ChatMessageDto message);
    Task ChatCreated(ChatSummaryDto chat);
}

// No client-invokable methods - sending/creating/reading chats all go
// through the REST controllers, so there is exactly one code path that
// validates and persists a mutation. This hub only exists as a typed
// target for the server to push to (see MessageService, ChatService).
[Authorize]
public class ChatHub : Hub<IChatClient>;
