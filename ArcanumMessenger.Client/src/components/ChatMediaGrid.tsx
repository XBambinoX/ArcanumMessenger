import { useEffect, useRef, useState } from "react";
import { getChatMedia, type ChatMediaItem } from "../api/messages";
import {
    EncryptedImage,
    EncryptedGifVideo,
    EncryptedVideoPlayer,
    downloadMediaToDisk,
    type KeyedChat,
} from "./EncryptedMedia";
import MessageContextMenu from "./MessageContextMenu";
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
    mediaTab: string;
    gifTab: string;
    goToMessage: string;
    deleteMediaMessage: string;
}

interface ChatMediaGridProps {
    chat: KeyedChat;
    tr: ChatMediaGridTranslation;
    onJumpToMessage: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
}

type MediaTab = "media" | "gif";

const LONG_PRESS_MS = 450;

export default function ChatMediaGrid({ chat, tr, onJumpToMessage, onDeleteMessage }: ChatMediaGridProps) {
    // Gifs (stickers, reactions) can pile up fast and crowd out actual
    // photos/videos in one shared grid - split into their own tab, fetched
    // (and paginated) separately by kind rather than filtered client-side,
    // so "GIF" doesn't just show whatever gifs happened to land on the
    // first page of a combined feed.
    const [tab, setTab] = useState<MediaTab>("media");
    const [items, setItems] = useState<ChatMediaItem[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
    const longPressTimer = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getChatMedia(chat.id, undefined, tab).then((result) => {
            if (cancelled) return;
            setItems(result.items);
            setHasMore(result.hasMore);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [chat.id, tab]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || items.length === 0) return;
        setLoadingMore(true);
        const oldest = items[items.length - 1];
        const result = await getChatMedia(chat.id, oldest.messageId, tab);
        setItems((prev) => [...prev, ...result.items]);
        setHasMore(result.hasMore);
        setLoadingMore(false);
    };

    const clearLongPressTimer = () => {
        if (longPressTimer.current !== null) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTouchStart = (e: React.TouchEvent, messageId: string) => {
        const { clientX: x, clientY: y } = e.touches[0];
        clearLongPressTimer();
        longPressTimer.current = window.setTimeout(() => {
            setContextMenu({ messageId, x, y });
        }, LONG_PRESS_MS);
    };

    const tileContextHandlers = (messageId: string) => ({
        onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            setContextMenu({ messageId, x: e.clientX, y: e.clientY });
        },
        onTouchStart: (e: React.TouchEvent) => handleTouchStart(e, messageId),
        onTouchEnd: clearLongPressTimer,
        onTouchMove: clearLongPressTimer,
    });

    return (
        <div>
            <div className={styles.tabBar}>
                <button
                    className={`${styles.tabBtn} ${tab === "media" ? styles.tabBtnActive : ""}`}
                    onClick={() => setTab("media")}
                >
                    {tr.mediaTab}
                </button>
                <button
                    className={`${styles.tabBtn} ${tab === "gif" ? styles.tabBtnActive : ""}`}
                    onClick={() => setTab("gif")}
                >
                    {tr.gifTab}
                </button>
            </div>

            {!loading && items.length === 0 && <p className={styles.empty}>{tr.noMediaYet}</p>}

            <div className={styles.grid}>
                {items.map(({ messageId, media }) => {
                    if (media.kind === "image") {
                        return (
                            <div key={messageId} className={styles.tileWrap} {...tileContextHandlers(messageId)}>
                                <EncryptedImage
                                    chat={chat}
                                    media={media}
                                    className={styles.tile}
                                    loadingClassName={styles.tileLoading}
                                    alt={media.fileName}
                                    openOnClick
                                />
                            </div>
                        );
                    }

                    if (media.kind === "gif") {
                        return (
                            <div key={messageId} className={styles.tileWrap} {...tileContextHandlers(messageId)}>
                                {isVideoMime(media.mimeType) ? (
                                    <EncryptedGifVideo
                                        chat={chat}
                                        media={media}
                                        className={styles.tile}
                                        loadingClassName={styles.tileLoading}
                                        openOnClick
                                    />
                                ) : (
                                    <EncryptedImage
                                        chat={chat}
                                        media={media}
                                        className={styles.tile}
                                        loadingClassName={styles.tileLoading}
                                        alt={media.fileName}
                                        openOnClick
                                    />
                                )}
                            </div>
                        );
                    }

                    if (media.kind === "video") {
                        return (
                            <div key={messageId} className={styles.tileWrap} {...tileContextHandlers(messageId)}>
                                <EncryptedVideoPlayer
                                    chat={chat}
                                    media={media}
                                    className={styles.tile}
                                    placeholderClassName={`${styles.tile} ${styles.videoPlaceholderTile}`}
                                    playIconClassName={styles.playIcon}
                                    spinnerClassName={styles.tileSpinner}
                                />
                            </div>
                        );
                    }

                    return (
                        <button
                            key={messageId}
                            type="button"
                            className={styles.fileTile}
                            onClick={() => downloadMediaToDisk(chat, media)}
                            {...tileContextHandlers(messageId)}
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

            {contextMenu && (
                <MessageContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        { label: tr.goToMessage, onClick: () => onJumpToMessage(contextMenu.messageId) },
                        {
                            label: tr.deleteMediaMessage,
                            danger: true,
                            onClick: () => {
                                onDeleteMessage(contextMenu.messageId);
                                setItems((prev) => prev.filter((item) => item.messageId !== contextMenu.messageId));
                            },
                        },
                    ]}
                />
            )}
        </div>
    );
}
