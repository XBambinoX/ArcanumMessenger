/**
 * Chunked AEAD for chat media (photos/videos/gifs/files) - the same
 * per-chat symmetric key that already encrypts message text (`chatKey.ts`),
 * just applied per fixed-size chunk instead of once over a whole buffer.
 *
 * Text and the other AEAD helpers in this codebase (`chatKey.ts`,
 * `ecdh.ts`) encrypt one buffer in memory with a single nonce/tag - fine
 * for a few KB, wrong for a file up to a few GB. Here each chunk gets its
 * own random nonce and is authenticated independently, with the chat id
 * *and* the chunk's index as associated data - binding a chunk to both the
 * chat it belongs to and its position, so chunks can't be replayed into a
 * different chat or silently reordered.
 *
 * Wire format per chunk: nonce(12) || ciphertext+tag. Same shape
 * `chatKey.ts`/`ecdh.ts` already use, just once per chunk instead of once
 * per message.
 */

const NONCE_SIZE = 12;
const TAG_BITS = 128;

// Matches the chunk boundaries the resumable upload already uses
// (chunkedUpload.ts) - reusing the same size means one chunk of plaintext
// maps to exactly one chunk of ciphertext, upload and download alike.
export const CHUNK_SIZE = 10 * 1024 * 1024;

function chunkAad(chatId: string, chunkIndex: number): Uint8Array {
    return new TextEncoder().encode(`${chatId}:${chunkIndex}`);
}

export async function encryptChunk(
    chatKey: Uint8Array,
    chatId: string,
    chunkIndex: number,
    plaintext: Uint8Array,
): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", chatKey as BufferSource, "AES-GCM", false, ["encrypt"]);
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
    const aad = chunkAad(chatId, chunkIndex);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: TAG_BITS },
            key,
            plaintext as BufferSource,
        ),
    );

    const result = new Uint8Array(nonce.length + ciphertext.length);
    result.set(nonce, 0);
    result.set(ciphertext, nonce.length);
    return result;
}

export async function decryptChunk(
    chatKey: Uint8Array,
    chatId: string,
    chunkIndex: number,
    encrypted: Uint8Array,
): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", chatKey as BufferSource, "AES-GCM", false, ["decrypt"]);
    const nonce = encrypted.slice(0, NONCE_SIZE);
    const ciphertext = encrypted.slice(NONCE_SIZE);
    const aad = chunkAad(chatId, chunkIndex);

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: TAG_BITS },
        key,
        ciphertext as BufferSource,
    );
    return new Uint8Array(plaintext);
}

// Encrypts an arbitrarily large plaintext (an already-in-memory Blob for
// the simple upload path, or a File for the chunked path) chunk by chunk,
// yielding each ciphertext chunk as it's ready rather than building the
// whole encrypted file in memory at once.
export async function* encryptChunked(
    chatKey: Uint8Array,
    chatId: string,
    plaintext: Blob,
): AsyncGenerator<Uint8Array> {
    const totalChunks = Math.max(1, Math.ceil(plaintext.size / CHUNK_SIZE));
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const slice = plaintext.slice(start, Math.min(start + CHUNK_SIZE, plaintext.size));
        const bytes = new Uint8Array(await slice.arrayBuffer());
        yield await encryptChunk(chatKey, chatId, i, bytes);
    }
}

// How many plaintext chunks a file of `plaintextSize` bytes was split into,
// and the byte offset/length of each chunk in the resulting *ciphertext*
// (each full chunk is exactly NONCE_SIZE + 16-byte tag = 28 bytes larger
// encrypted; only the last, possibly-partial chunk differs) - lets a
// downloader compute exact Range requests without any extra server-side
// metadata.
export function chunkCiphertextLayout(plaintextSize: number): { index: number; start: number; length: number }[] {
    const overhead = NONCE_SIZE + 16;
    const totalChunks = Math.max(1, Math.ceil(plaintextSize / CHUNK_SIZE));
    const layout: { index: number; start: number; length: number }[] = [];
    let offset = 0;
    for (let i = 0; i < totalChunks; i++) {
        const plainChunkSize = Math.min(CHUNK_SIZE, plaintextSize - i * CHUNK_SIZE);
        const length = plainChunkSize + overhead;
        layout.push({ index: i, start: offset, length });
        offset += length;
    }
    return layout;
}
