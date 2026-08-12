import * as signalR from "@microsoft/signalr";

export function createChatHubConnection(): signalR.HubConnection {
    return new signalR.HubConnectionBuilder()
        .withUrl("/hubs/chat")
        .withAutomaticReconnect()
        .build();
}
