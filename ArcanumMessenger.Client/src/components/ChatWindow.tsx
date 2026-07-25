import { useEffect, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import type { ChatMessage, ChatSummary, User } from "../types/messenger";
import { getMessageHistory, sendMessage } from "../api/messages";
import { getUser } from "../api/users";
import { formatMessageTime, formatChatTime } from "../lib/time";
import UserInfoPanel from "./UserInfoPanel";
import ChatInfoPanel from "./ChatInfoPanel";
import styles from "./ChatWindow.module.css";

interface ChatWindowProps {
    chat: ChatSummary;
    connection: HubConnection | null;
    onStartChat: (chat: ChatSummary) => void;
    presence?: { isOnline: boolean; lastSeen: string | null };
}

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
    const scrollAnchor = useRef<HTMLDivElement | null>(null);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const prependingRef = useRef(false);

    const [, forceTick] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            forceTick((n) => n + 1);
        }, 100);

        return () => window.clearInterval(interval);
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
        if (!content) return;

        setDraft("");
        const sent = await sendMessage(chat.id, content);
        if (sent) setMessages((prev) => [...prev, sent]);
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
                    <span className={styles.subtitle}>
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
                                className={`${styles.bubbleRow} ${message.isOwn ? styles.own : ""}`}
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
                                    <span className={styles.content}>
                                        {message.content}
                                    </span>
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
                    disabled={!draft.trim()}
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
            </footer>

            {userInfo && (
                <UserInfoPanel
                    userId={userInfo.userId}
                    user={userInfo.user}
                    onClose={() => setUserInfo(null)}
                    onStartChat={onStartChat}
                />
            )}

            {chatInfoOpen && (
                <ChatInfoPanel
                    chat={chat}
                    onClose={() => setChatInfoOpen(false)}
                />
            )}
        </div>
    );
}
