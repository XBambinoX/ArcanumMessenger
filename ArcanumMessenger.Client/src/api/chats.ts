import { apiFetch } from "../lib/apiFetch";
import type { ChatSummary } from "../types/messenger";

export async function getChats(): Promise<ChatSummary[]> {
    const res = await apiFetch("/api/chats", { credentials: "include" });
    const data = await res.json();
    return data.chats ?? [];
}

export function getChatAvatarUrl(chatId: string): string {
    return `/api/chats/${chatId}/avatar`;
}

export async function uploadChatAvatar(chatId: string, file: File): Promise<boolean> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch(`/api/chats/${chatId}/avatar`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });
    const data = await res.json();
    return data.success === true;
}

export async function deleteChatAvatar(chatId: string): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}/avatar`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}

export interface CreateChatResult {
    chat: ChatSummary | null;
    reason: string | null;
}

// One sealed copy of a chat's symmetric key per member (see crypto/chatKey.ts
// and crypto/ecdh.ts's seal()) - generated and sealed entirely client-side,
// the server only ever stores these blobs.
export interface MemberKey {
    userId: string;
    wrappedChatKey: string;
}

export async function createDirectChat(otherUserId: string, memberKeys: MemberKey[]): Promise<CreateChatResult> {
    const res = await apiFetch("/api/chats", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ type: "direct", otherUserId, memberKeys }),
    });
    const data = await res.json();
    return { chat: data.success ? data.chat : null, reason: data.reason ?? null };
}

export async function createGroupChat(
    title: string,
    description: string | undefined,
    memberIds: string[],
    memberKeys: MemberKey[],
): Promise<CreateChatResult> {
    const res = await apiFetch("/api/chats", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ type: "group", title, description, memberIds, memberKeys }),
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
    // Whether this member already has a wrapped copy of the chat's key -
    // never the key itself. false means this member's client can't decrypt
    // this chat yet; see lib/chatKeySelfHeal.ts.
    hasChatKey: boolean;
    ecdhPublicKey: string | null;
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

export async function addChatMembers(
    chatId: string,
    userIds: string[],
    memberKeys: MemberKey[],
): Promise<AddMembersResult> {
    const res = await apiFetch(`/api/chats/${chatId}/members`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ userIds, memberKeys }),
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

// Fills in a currently-missing wrapped chat key for a fellow member - the
// caller must already hold the chat's real key themselves. A no-op if the
// member already has one; never overwrites an existing wrap.
export async function setMemberChatKey(chatId: string, userId: string, wrappedChatKey: string): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}/members/${userId}/key`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ wrappedChatKey }),
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
