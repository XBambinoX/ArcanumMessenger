import { getChatMembers, setMemberChatKey } from "../api/chats";
import { generateChatKey } from "../crypto/chatKey";
import { seal } from "../crypto/ecdh";
import { fromBase64 } from "../crypto/encoding";
import { unwrapOwnChatKey } from "./chatKeys";
import { primeChatKey } from "./chatCrypto";
import * as sessionKeys from "./sessionKeys";

/**
 * Opportunistically fixes a chat's missing-key situations, whenever a
 * client able to help happens to open that chat:
 *  - Bootstraps a brand-new key for a chat nobody has ever keyed (the
 *    auto-created "Saved Messages" chat has no client involved at creation
 *    time to seal one).
 *  - Reseals the chat's existing key for any other member missing a
 *    wrapped copy (added before the seal landed, or their identity keypair
 *    rotated via password recovery).
 * Best-effort and silent: does nothing if this client can't currently help
 * (doesn't hold the chat's key itself, and nobody else needs fixing, or
 * there's nothing safe to do yet).
 */
export async function selfHealChatKeys(chatId: string, myWrappedChatKey: string | null): Promise<void> {
    const result = await getChatMembers(chatId);
    if (!result) return;
    const { members } = result;

    const anyoneKeyed = members.some((m) => m.hasChatKey);

    if (!anyoneKeyed) {
        // Nobody has ever sealed a key for this chat - only possible for a
        // solo chat (Saved Messages); every other chat type always gets a
        // key sealed to every initial member at creation time.
        const me = members.find((m) => m.isSelf);
        if (!me || members.length !== 1) return;

        const myPublicKeyRaw = sessionKeys.getPublicKeyRaw();
        if (!myPublicKeyRaw) return;

        const chatKey = generateChatKey();
        const wrapped = await seal(myPublicKeyRaw, chatKey);
        if (await setMemberChatKey(chatId, me.userId, wrapped)) {
            primeChatKey(chatId, chatKey);
        }
        return;
    }

    const me = members.find((m) => m.isSelf);
    if (!me?.hasChatKey || !myWrappedChatKey) return; // I don't hold the real key myself - nothing I can do

    const chatKey = await unwrapOwnChatKey(myWrappedChatKey);
    if (!chatKey) return;

    const gaps = members.filter((m) => !m.isSelf && !m.hasChatKey && m.ecdhPublicKey);
    for (const member of gaps) {
        const wrapped = await seal(fromBase64(member.ecdhPublicKey!), chatKey);
        await setMemberChatKey(chatId, member.userId, wrapped);
    }
}
