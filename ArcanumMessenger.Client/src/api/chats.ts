import { apiFetch } from "../lib/apiFetch";
import type { ChatSummary } from "../types/messenger";

export async function getChats(): Promise<ChatSummary[]> {
    const res = await apiFetch("/api/chats", { credentials: "include" });
    const data = await res.json();
    return data.chats ?? [];
}

export interface CreateChatResult {
    chat: ChatSummary | null;
    reason: string | null;
}

export async function createDirectChat(otherUserId: string): Promise<CreateChatResult> {
    const res = await apiFetch("/api/chats", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ type: "direct", otherUserId }),
    });
    const data = await res.json();
    return { chat: data.success ? data.chat : null, reason: data.reason ?? null };
}

export async function createGroupChat(
    title: string,
    description: string | undefined,
    memberIds: string[],
): Promise<CreateChatResult> {
    const res = await apiFetch("/api/chats", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ type: "group", title, description, memberIds }),
    });
    const data = await res.json();
    return { chat: data.success ? data.chat : null, reason: data.reason ?? null };
}

export async function markChatRead(chatId: string): Promise<void> {
    await apiFetch(`/api/chats/${chatId}/read`, {
        method: "POST",
        credentials: "include",
    });
}

export async function setChatArchived(chatId: string, isArchived: boolean): Promise<void> {
    await apiFetch(`/api/chats/${chatId}/archive`, {
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ isArchived }),
    });
}

export async function deleteChat(chatId: string, forEveryone: boolean): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}?forEveryone=${forEveryone}`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}

export interface ChatMemberInfo {
    userId: string;
    name: string;
    role: string;
    isSelf: boolean;
    isOwner: boolean;
}

export async function getChatMembers(
    chatId: string,
): Promise<{ description: string | null; members: ChatMemberInfo[] } | null> {
    const res = await apiFetch(`/api/chats/${chatId}/members`, { credentials: "include" });
    const data = await res.json();
    if (!data.success) return null;
    return { description: data.description ?? null, members: data.members ?? [] };
}

export async function promoteToAdmin(chatId: string, userId: string): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}/members/${userId}/promote`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}

export async function demoteToMember(chatId: string, userId: string): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}/members/${userId}/demote`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}

export interface AddMembersResult {
    members: ChatMemberInfo[] | null;
    reason: string | null;
}

export async function addChatMembers(chatId: string, userIds: string[]): Promise<AddMembersResult> {
    const res = await apiFetch(`/api/chats/${chatId}/members`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ userIds }),
    });
    const data = await res.json();
    return { members: data.success ? (data.members ?? []) : null, reason: data.reason ?? null };
}

export async function removeChatMember(chatId: string, userId: string): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}/members/${userId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}

export async function leaveGroup(chatId: string): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}/leave`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}
