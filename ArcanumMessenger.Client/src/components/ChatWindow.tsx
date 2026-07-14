import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSummary } from "../types/messenger";
import { formatMessageTime } from "../lib/time";
import styles from "./ChatWindow.module.css";

interface ChatWindowProps {
    chat: ChatSummary;
    initialMessages: ChatMessage[];
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

export default function ChatWindow({ chat, initialMessages }: ChatWindowProps) {
    // Local only for now - sending goes to the server once the
    // messages API exists.
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [draft, setDraft] = useState("");
    const scrollAnchor = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        scrollAnchor.current?.scrollIntoView();
    }, [messages.length]);

    const handleSend = () => {
        const content = draft.trim();
        if (!content) return;

        setMessages((prev) => [
            ...prev,
            {
                id: `local-${Date.now()}`,
                chatId: chat.id,
                senderId: "me",
                senderName: "You",
                replyToId: null,
                content,
                isEdited: false,
                createdAt: new Date().toISOString(),
                isOwn: true,
            },
        ]);
        setDraft("");
    };

    const findMessage = (id: string | null) =>
        id ? messages.find((m) => m.id === id) : undefined;

    return (
        <div className={styles.root}>
            <header className={styles.header}>
                <div
                    className={`${styles.avatar} ${chat.type === "group" ? styles.avatarGroup : ""}`}
                >
                    {chat.title.charAt(0).toUpperCase()}
                </div>
                <div className={styles.headerText}>
                    <span className={styles.title}>{chat.title}</span>
                    <span className={styles.subtitle}>
                        {chat.type === "group" ? "group chat" : "direct chat"}
                    </span>
                </div>
            </header>

            <div className={styles.messages}>
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
        </div>
    );
}
