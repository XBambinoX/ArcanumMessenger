import type { MediaAsset } from "../types/messenger";
import { getChatKey } from "./chatCrypto";
import { downloadAndDecryptMedia, downloadAndDecryptThumbnail } from "./mediaDownload";
import { uploadMedia, uploadMediaThumbnail } from "../api/media";
import { uploadMediaChunked, CHUNK_THRESHOLD } from "../api/chunkedUpload";

interface KeyedChat {
    id: string;
    wrappedChatKey: string | null;
}

// Chat media is encrypted with that chat's own key, so it can't just be
// pointed at from a different chat the way a database reference normally
// would - moving it anywhere else (forwarding, saving a gif, sending a
// saved gif into a chat) means downloading and decrypting it under the
// source chat's key, then re-uploading it fully encrypted under the
// destination's. Used by all three of those flows.
export async function reencryptMediaAcrossChats(
    sourceChat: KeyedChat,
    destChat: KeyedChat,
    media: MediaAsset,
): Promise<MediaAsset | null> {
    const sourceChatKey = await getChatKey({ id: sourceChat.id, wrappedChatKey: sourceChat.wrappedChatKey });
    const destChatKey = await getChatKey({ id: destChat.id, wrappedChatKey: destChat.wrappedChatKey });
    if (!sourceChatKey || !destChatKey) return null;

    const plainBlob = await downloadAndDecryptMedia(sourceChatKey, sourceChat.id, media);
    const plainFile = new File([plainBlob], media.fileName, { type: media.mimeType });

    const reuploaded = plainFile.size >= CHUNK_THRESHOLD
        ? await uploadMediaChunked(plainFile, destChatKey, destChat.id, () => {})
        : await uploadMedia(plainFile, destChatKey, destChat.id);
    if (!reuploaded) return null;

    if (media.hasThumbnail) {
        const thumbBlob = await downloadAndDecryptThumbnail(sourceChatKey, sourceChat.id, media.id);
        if (thumbBlob) await uploadMediaThumbnail(reuploaded.id, thumbBlob, destChatKey, destChat.id);
    }

    return reuploaded;
}
