import { generateChatKey } from "../crypto/chatKey";
import { seal, unseal } from "../crypto/ecdh";
import { toBase64, fromBase64 } from "../crypto/encoding";
import * as sessionKeys from "./sessionKeys";
import { getMyUserId } from "./currentUser";
import type { MemberKey } from "../api/chats";

/**
 * Bridges the pure crypto in crypto/ecdh.ts and crypto/chatKey.ts to this
 * device's own identity keys and the wire format the chats API expects -
 * sealing a chat's symmetric key for a set of members, all client-side.
 */

export interface MemberPublicKey {
    userId: string;
    ecdhPublicKey: string | null;
}

// Members with no ecdhPublicKey yet (haven't logged in since E2EE shipped)
// are skipped - their wrapped key gets provisioned later by the self-heal
// flow once they do.
export async function sealChatKeyFor(chatKey: Uint8Array, members: MemberPublicKey[]): Promise<MemberKey[]> {
    const results: MemberKey[] = [];
    for (const member of members) {
        if (!member.ecdhPublicKey) continue;
        const wrappedChatKey = await seal(fromBase64(member.ecdhPublicKey), chatKey);
        results.push({ userId: member.userId, wrappedChatKey });
    }
    return results;
}

// For a brand-new chat: generates the key and seals it for every member,
// including the caller themselves (so their own device can read it back).
// Returns the raw key too - a group's title/description have to be
// encrypted with it before the create-chat request is even sent (see
// NewChatPanel.tsx), which direct chats never need since they have no
// title.
export async function sealNewChatKey(
    otherMembers: MemberPublicKey[],
): Promise<{ memberKeys: MemberKey[]; chatKey: Uint8Array }> {
    const chatKey = generateChatKey();
    const myUserId = await getMyUserId();
    const myPublicKeyRaw = sessionKeys.getPublicKeyRaw();
    const members = myUserId && myPublicKeyRaw
        ? [...otherMembers, { userId: myUserId, ecdhPublicKey: toBase64(myPublicKeyRaw) }]
        : otherMembers;
    const memberKeys = await sealChatKeyFor(chatKey, members);
    return { memberKeys, chatKey };
}

// Unwraps this device's own copy of an existing chat's key, so it can be
// resealed for a newly-added member.
export async function unwrapOwnChatKey(wrappedChatKey: string): Promise<Uint8Array | null> {
    const privateKey = await sessionKeys.getPrivateKey();
    if (!privateKey) return null;
    return unseal(privateKey, wrappedChatKey);
}
