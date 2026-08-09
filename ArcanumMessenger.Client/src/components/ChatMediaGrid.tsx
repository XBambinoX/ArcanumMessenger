import { useEffect, useState } from "react";
import { getChatMedia, type ChatMediaItem } from "../api/messages";
import {
    EncryptedImage,
    EncryptedGifVideo,
    EncryptedVideoPlayer,
    downloadMediaToDisk,
    type KeyedChat,
} from "./EncryptedMedia";
import styles from "./ChatMediaGrid.module.css";

function isVideoMime(mimeType: string): boolean {
    return mimeType.startsWith("video/");
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ChatMediaGridTranslation {
    noMediaYet: string;
    loadMore: string;
}

interface ChatMediaGridProps {
    chat: KeyedChat;
    tr: ChatMediaGridTranslation;
}

export default function ChatMediaGrid({ chat, tr }: ChatMediaGridProps) {
    const [items, setItems] = useState<ChatMediaItem[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getChatMedia(chat.id).then((result) => {
            if (cancelled) return;
            setItems(result.items);
            setHasMore(result.hasMore);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [chat.id]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || items.length === 0) return;
        setLoadingMore(true);
        const oldest = items[items.length - 1];
        const result = await getChatMedia(chat.id, oldest.messageId);
        setItems((prev) => [...prev, ...result.items]);
        setHasMore(result.hasMore);
        setLoadingMore(false);
    };

    if (loading) return null;
    if (items.length === 0) return <p className={styles.empty}>{tr.noMediaYet}</p>;

    return (
        <div>
            <div className={styles.grid}>
                {items.map(({ messageId, media }) => {
                    if (media.kind === "image") {
                        return (
                            <EncryptedImage
                                key={messageId}
                                chat={chat}
                                media={media}
                                className={styles.tile}
                                alt={media.fileName}
                                openOnClick
                            />
                        );
                    }

                    if (media.kind === "gif") {
                        return isVideoMime(media.mimeType) ? (
                            <EncryptedGifVideo
                                key={messageId}
                                chat={chat}
                                media={media}
                                className={styles.tile}
                                openOnClick
                            />
                        ) : (
                            <EncryptedImage
                                key={messageId}
                                chat={chat}
                                media={media}
                                className={styles.tile}
                                alt={media.fileName}
                                openOnClick
                            />
                        );
                    }

                    if (media.kind === "video") {
                        return (
                            <EncryptedVideoPlayer
                                key={messageId}
                                chat={chat}
                                media={media}
                                className={styles.tile}
                                placeholderClassName={`${styles.tile} ${styles.videoPlaceholderTile}`}
                                playIconClassName={styles.playIcon}
                            />
                        );
                    }

                    return (
                        <button
                            key={messageId}
                            type="button"
                            className={styles.fileTile}
                            onClick={() => downloadMediaToDisk(chat, media)}
                        >
                            <span className={styles.fileIcon}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <path d="M14 2v6h6" />
                                </svg>
                            </span>
                            <span className={styles.fileName}>{media.fileName}</span>
                            <span className={styles.fileSize}>{formatFileSize(media.sizeBytes)}</span>
                        </button>
                    );
                })}
            </div>
            {hasMore && (
                <button className={styles.loadMoreBtn} onClick={loadMore} disabled={loadingMore}>
                    {tr.loadMore}
                </button>
            )}
        </div>
    );
}
