import type { ChatSummary } from "../types/messenger";
import { formatChatTime } from "../lib/time";
import styles from "./ChatList.module.css";

interface ChatListProps {
    chats: ChatSummary[];
    selectedChatId: string | null;
    onSelect: (chatId: string) => void;
}

export default function ChatList({
    chats,
    selectedChatId,
    onSelect,
}: ChatListProps) {
    if (chats.length === 0) {
        return <p className={styles.empty}>No chats here yet</p>;
    }

    return (
        <ul className={styles.list}>
            {chats.map((chat) => (
                <li key={chat.id}>
                    <button
                        className={`${styles.item} ${chat.id === selectedChatId ? styles.selected : ""}`}
                        onClick={() => onSelect(chat.id)}
                    >
                        <div
                            className={`${styles.avatar} ${chat.type === "group" ? styles.avatarGroup : ""}`}
                        >
                            {chat.title.charAt(0).toUpperCase()}
                        </div>

                        <div className={styles.body}>
                            <div className={styles.topRow}>
                                <span className={styles.title}>
                                    {chat.title}
                                </span>
                                {chat.isMuted && (
                                    <svg
                                        className={styles.muteIcon}
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.9 17.9 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                )}
                                {chat.lastMessageAt && (
                                    <span className={styles.time}>
                                        {formatChatTime(chat.lastMessageAt)}
                                    </span>
                                )}
                            </div>
                            <div className={styles.bottomRow}>
                                <span className={styles.preview}>
                                    {chat.lastMessageText ?? "No messages yet"}
                                </span>
                                {chat.unreadCount > 0 && (
                                    <span
                                        className={`${styles.badge} ${chat.isMuted ? styles.badgeMuted : ""}`}
                                    >
                                        {chat.unreadCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    );
}
