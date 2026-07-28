import { useEffect, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import type { ChatMessage, ChatSummary, MediaAsset, User } from "../types/messenger";
import { getMessageHistory, sendMessage } from "../api/messages";
import { getUser } from "../api/users";
import { uploadMedia, getMediaUrl, getMediaThumbnailUrl, getSavedGifs, saveGif, unsaveGif } from "../api/media";
import { formatMessageTime, formatChatTime } from "../lib/time";
import UserInfoPanel from "./UserInfoPanel";
import ChatInfoPanel from "./ChatInfoPanel";
import GifPicker from "./GifPicker";
import styles from "./ChatWindow.module.css";

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatWindowProps {
    chat: ChatSummary;
    connection: HubConnection | null;
    onStartChat: (chat: ChatSummary) => void;
    presence?: { isOnline: boolean; lastSeen: string | null };
}

const ANIMATE_MS = 260;

function dayLabel(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], {
        day: "numeric",
        month: "long",
    });
}

export default function ChatWindow({ chat, connection, onStartChat, presence }: ChatWindowProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [draft, setDraft] = useState("");
    const [userInfo, setUserInfo] = useState<{ userId: string; user: User } | null>(null);
    const [chatInfoOpen, setChatInfoOpen] = useState(false);
    const [pendingMedia, setPendingMedia] = useState<MediaAsset | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [gifPickerOpen, setGifPickerOpen] = useState(false);
    const [savedGifIds, setSavedGifIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const scrollAnchor = useRef<HTMLDivElement | null>(null);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const prependingRef = useRef(false);
    const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());


    const [, forceTick] = useState(0);

    const markAnimated = (id: string) => {
        setAnimatingIds((prev) => new Set(prev).add(id));
        window.setTimeout(() => {
            setAnimatingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, ANIMATE_MS);
    };

    useEffect(() => {
        const interval = window.setInterval(() => {
            forceTick((n) => n + 1);
        }, 100);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        getSavedGifs().then((gifs) => setSavedGifIds(new Set(gifs.map((g) => g.id))));
    }, []);

    useEffect(() => {
        let cancelled = false;

        getMessageHistory(chat.id).then((history) => {
            if (cancelled) return;
            setMessages(history.messages);
            setHasMore(history.hasMore);
        });

        return () => {
            cancelled = true;
        };
    }, [chat.id]);

    useEffect(() => {
        if (!connection) return;

        const handleReceiveMessage = (message: ChatMessage) => {
            if (message.chatId !== chat.id) return;
            setMessages((prev) => [...prev, message]);
            markAnimated(message.id);
        };

        connection.on("ReceiveMessage", handleReceiveMessage);
        return () => {
            connection.off("ReceiveMessage", handleReceiveMessage);
        };
    }, [connection, chat.id]);

    useEffect(() => {
        if (prependingRef.current) {
            prependingRef.current = false;
            return;
        }
        scrollAnchor.current?.scrollIntoView();
    }, [messages.length]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || messages.length === 0) return;

        setLoadingMore(true);
        const container = messagesRef.current;
        const previousHeight = container?.scrollHeight ?? 0;

        const older = await getMessageHistory(chat.id, messages[0].id);

        prependingRef.current = true;
        setMessages((prev) => [...older.messages, ...prev]);
        setHasMore(older.hasMore);
        setLoadingMore(false);

        requestAnimationFrame(() => {
            if (container) container.scrollTop = container.scrollHeight - previousHeight;
        });
    };

    const handleScroll = () => {
        if ((messagesRef.current?.scrollTop ?? 0) < 50) loadMore();
    };

    const handleSend = async () => {
        const content = draft.trim();
        if (!content && !pendingMedia) return;

        setDraft("");
        const media = pendingMedia;
        setPendingMedia(null);
        const sent = await sendMessage(chat.id, content, media?.id);
        if (sent) {
            setMessages((prev) => [...prev, sent]);
            markAnimated(sent.id);
        }
    };

    const handleAttachClick = () => fileInputRef.current?.click();

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setUploadingFile(true);
        const media = await uploadMedia(file);
        setUploadingFile(false);
        if (media) setPendingMedia(media);
    };

    const handleSendGif = async (gif: MediaAsset) => {
        setGifPickerOpen(false);
        const sent = await sendMessage(chat.id, "", gif.id);
        if (sent) {
            setMessages((prev) => [...prev, sent]);
            markAnimated(sent.id);
        }
    };

    const handleToggleSaveGif = async (mediaId: string) => {
        const isSaved = savedGifIds.has(mediaId);
        const ok = isSaved ? await unsaveGif(mediaId) : await saveGif(mediaId);
        if (!ok) return;

        setSavedGifIds((prev) => {
            const next = new Set(prev);
            if (isSaved) next.delete(mediaId);
            else next.add(mediaId);
            return next;
        });
    };

    const findMessage = (id: string | null) =>
        id ? messages.find((m) => m.id === id) : undefined;

    const handleAvatarClick = async () => {
        if (chat.type !== "direct" || !chat.otherUserId) return;
        const userId = chat.otherUserId;
        const user = await getUser(userId);
        if (user) setUserInfo({ userId, user });
    };

    return (
        <div className={styles.root}>
            <header className={styles.header}>
                <div
                    className={`${styles.avatar} ${chat.type === "group" ? styles.avatarGroup : ""} ${chat.type === "direct" ? styles.avatarClickable : ""}`}
                    onClick={handleAvatarClick}
                >
                    {chat.title.charAt(0).toUpperCase()}
                </div>
                <div className={styles.headerText}>
                    <span className={styles.title}>{chat.title}</span>
                    <span
                        className={`${styles.subtitle} ${presence?.isOnline ? styles.subtitleOnline : ""}`}
                    >
                        {chat.type === "group"
                            ? "group chat"
                            : presence?.isOnline
                            ? "online"
                            : presence?.lastSeen
                                ? `last seen ${formatChatTime(presence.lastSeen)}`
                                : "offline"}
                    </span>
                </div>
                <button
                    className={styles.infoBtn}
                    onClick={() => setChatInfoOpen(true)}
                    aria-label="Chat info"
                    title="Chat info"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </svg>
                </button>
            </header>

            <div
                className={styles.messages}
                ref={messagesRef}
                onScroll={handleScroll}
            >
                {messages.length === 0 && (
                    <p className={styles.noMessages}>No messages yet</p>
                )}

                {messages.map((message, i) => {
                    const prev = messages[i - 1];
                    const showDay =
                        !prev ||
                        new Date(prev.createdAt).toDateString() !==
                            new Date(message.createdAt).toDateString();
                    const replyTo = findMessage(message.replyToId);

                    return (
                        <div key={message.id}>
                            {showDay && (
                                <div className={styles.daySeparator}>
                                    <span>{dayLabel(message.createdAt)}</span>
                                </div>
                            )}
                            <div
                                className={`${styles.bubbleRow} ${message.isOwn ? styles.own : ""} ${
                                    animatingIds.has(message.id) ? styles.bubbleEnter : ""
                                }`}
                            >
                                <div className={styles.bubble}>
                                    {chat.type === "group" &&
                                        !message.isOwn && (
                                            <span className={styles.sender}>
                                                {message.senderName}
                                            </span>
                                        )}
                                    {replyTo && (
                                        <div className={styles.replyQuote}>
                                            <span
                                                className={styles.replySender}
                                            >
                                                {replyTo.senderName}
                                            </span>
                                            <span
                                                className={styles.replyText}
                                            >
                                                {replyTo.content}
                                            </span>
                                        </div>
                                    )}
                                    {message.type === "text" && (
                                        <span className={styles.content}>
                                            {message.content}
                                        </span>
                                    )}
                                    {message.type === "image" && message.media && (
                                        <img
                                            className={styles.mediaImage}
                                            src={message.media.hasThumbnail
                                                ? getMediaThumbnailUrl(message.media.id)
                                                : getMediaUrl(message.media.id)}
                                            alt={message.media.fileName}
                                            onClick={() => window.open(getMediaUrl(message.media!.id), "_blank")}
                                        />
                                    )}
                                    {message.type === "gif" && message.media && (
                                        <div className={styles.gifWrapper}>
                                            <img
                                                className={styles.mediaImage}
                                                src={message.media.hasThumbnail
                                                    ? getMediaThumbnailUrl(message.media.id)
                                                    : getMediaUrl(message.media.id)}
                                                alt={message.media.fileName}
                                                onClick={() => window.open(getMediaUrl(message.media!.id), "_blank")}
                                            />
                                            <button
                                                className={`${styles.saveGifBtn} ${
                                                    savedGifIds.has(message.media.id) ? styles.saveGifBtnActive : ""
                                                }`}
                                                onClick={() => handleToggleSaveGif(message.media!.id)}
                                                aria-label={savedGifIds.has(message.media.id) ? "Remove from saved GIFs" : "Save GIF"}
                                                title={savedGifIds.has(message.media.id) ? "Remove from saved GIFs" : "Save GIF"}
                                            >
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill={savedGifIds.has(message.media.id) ? "currentColor" : "none"}
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    {message.type === "video" && message.media && (
                                        <video
                                            className={styles.mediaVideo}
                                            src={getMediaUrl(message.media.id)}
                                            controls
                                        />
                                    )}
                                    {message.type === "file" && message.media && (
                                        <a
                                            className={styles.fileCard}
                                            href={getMediaUrl(message.media.id)}
                                            download={message.media.fileName}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <span className={styles.fileIcon}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <path d="M14 2v6h6" />
                                                </svg>
                                            </span>
                                            <span className={styles.fileInfo}>
                                                <span className={styles.fileName}>{message.media.fileName}</span>
                                                <span className={styles.fileSize}>{formatFileSize(message.media.sizeBytes)}</span>
                                            </span>
                                        </a>
                                    )}
                                    {message.type !== "text" && message.content && (
                                        <span className={`${styles.content} ${styles.mediaCaption}`}>
                                            {message.content}
                                        </span>
                                    )}
                                    <span className={styles.meta}>
                                        {message.isEdited && (
                                            <span className={styles.edited}>
                                                edited
                                            </span>
                                        )}
                                        {formatMessageTime(message.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollAnchor} />
            </div>

            <footer className={styles.inputBar}>
                {chat.isBlocked ? (
                    <p className={styles.blockedNote}>You can't send messages in this chat</p>
                ) : (
                    <>
                        {(pendingMedia || uploadingFile) && (
                            <div className={styles.pendingAttachment}>
                                {uploadingFile ? (
                                    <span className={styles.pendingUploading}>Uploading…</span>
                                ) : pendingMedia && (
                                    <>
                                        {pendingMedia.hasThumbnail ? (
                                            <img
                                                className={styles.pendingThumb}
                                                src={getMediaThumbnailUrl(pendingMedia.id)}
                                                alt=""
                                            />
                                        ) : (
                                            <span className={styles.pendingIcon}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <path d="M14 2v6h6" />
                                                </svg>
                                            </span>
                                        )}
                                        <span className={styles.pendingName}>{pendingMedia.fileName}</span>
                                        <button
                                            className={styles.removeAttachmentBtn}
                                            onClick={() => setPendingMedia(null)}
                                            aria-label="Remove attachment"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        <div className={styles.inputRow}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className={styles.hiddenFileInput}
                                onChange={handleFileSelected}
                            />
                            <button
                                className={styles.attachBtn}
                                onClick={handleAttachClick}
                                aria-label="Attach file"
                                title="Attach file"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.33 3.33 0 0 1 4.71 4.71l-9.2 9.19a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48" />
                                </svg>
                            </button>
                            <button
                                className={styles.attachBtn}
                                onClick={() => setGifPickerOpen(true)}
                                aria-label="Saved GIFs"
                                title="Saved GIFs"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="5" width="18" height="14" rx="2" />
                                    <path d="M7 9v6M11 9v6M11 12h2M16 9v6M16 9h3M16 12h2" />
                                </svg>
                            </button>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="Message"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={handleSend}
                                disabled={!draft.trim() && !pendingMedia}
                                aria-label="Send"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <rect x="2" y="4" width="20" height="16" rx="3" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}
            </footer>

            {userInfo && (
                <UserInfoPanel
                    userId={userInfo.userId}
                    user={userInfo.user}
                    onClose={() => setUserInfo(null)}
                    onStartChat={onStartChat}
                    presence={presence}
                />
            )}

            {chatInfoOpen && (
                <ChatInfoPanel
                    chat={chat}
                    onClose={() => setChatInfoOpen(false)}
                />
            )}

            {gifPickerOpen && (
                <GifPicker
                    onClose={() => setGifPickerOpen(false)}
                    onSelect={handleSendGif}
                />
            )}
        </div>
    );
}
