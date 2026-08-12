import { toBase64, fromBase64 } from "./encoding";

/**
 * A chat's own symmetric key (AES-256-GCM) encrypts message content. The
 * chat's id is used as authenticated-but-not-secret associated data (AAD),
 * binding a ciphertext to the chat it was written for - moving it to a
 * different chat (or decrypting it with a different chat's key) fails the
 * auth tag rather than silently producing garbage.
 */

const KEY_SIZE = 32;
const NONCE_SIZE = 12;
const TAG_BITS = 128;

export function generateChatKey(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(KEY_SIZE));
}

export async function encryptContent(chatKey: Uint8Array, chatId: string, plaintext: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", chatKey as BufferSource, "AES-GCM", false, ["encrypt"]);
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
    const aad = new TextEncoder().encode(chatId);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: TAG_BITS },
            key,
            new TextEncoder().encode(plaintext) as BufferSource,
        ),
    );

    const result = new Uint8Array(nonce.length + ciphertext.length);
    result.set(nonce, 0);
    result.set(ciphertext, nonce.length);
    return toBase64(result);
}

export async function decryptContent(chatKey: Uint8Array, chatId: string, blob: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", chatKey as BufferSource, "AES-GCM", false, ["decrypt"]);
    const bytes = fromBase64(blob);
    const nonce = bytes.slice(0, NONCE_SIZE);
    const ciphertext = bytes.slice(NONCE_SIZE);
    const aad = new TextEncoder().encode(chatId);

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: TAG_BITS },
        key,
        ciphertext as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
}
