import type { ChatSummary } from "../types/messenger";
import { formatChatTime } from "../lib/time";
import { getUserAvatarUrl } from "../api/users";
import { getChatAvatarUrl } from "../api/chats";
import AvatarImage from "./AvatarImage";
import styles from "./ChatList.module.css";
import { useLanguage } from "../lib/language";
import { CHAT_LIST_TRANSLATIONS, APP_COMMON, type AppCommonTranslation } from "../lib/appTranslations";

// A captionless photo/video/gif/file has a null lastMessageText (there's no
// text to show) but is very much a real last message - falling back
// straight to "no messages yet" for that case would be wrong whenever the
// chat's last message happens to be bare media. Only genuinely-empty chats
// (lastMessageAt itself null) get that fallback.
function lastMessagePreview(chat: ChatSummary, common: AppCommonTranslation, noMessagesYet: string): string {
    if (chat.lastMessageText) return chat.lastMessageText;
    if (!chat.lastMessageAt) return noMessagesYet;
    switch (chat.lastMessageType) {
        case "image": return common.photo;
        case "video": return common.video;
        case "gif": return common.gif;
        case "file": return common.file;
        default: return noMessagesYet;
    }
}

interface PresenceInfo {
    isOnline: boolean;
    lastSeen: string | null;
}

interface ChatListProps {
    chats: ChatSummary[];
    selectedChatId: string | null;
    onSelect: (chatId: string) => void;
    onToggleArchive: (chatId: string) => void;
    presence: Record<string, PresenceInfo>;
    chatAvatarNonce: number;
}

export default function ChatList({
    chats,
    selectedChatId,
    onSelect,
    onToggleArchive,
    presence,
    chatAvatarNonce,
}: ChatListProps) {
    const language = useLanguage();
    const tr = CHAT_LIST_TRANSLATIONS[language];
    const common = APP_COMMON[language];

    if (chats.length === 0) {
        return <p className={styles.empty}>{tr.noChatsYet}</p>;
    }

    return (
        <ul className={styles.list}>
            {chats.map((chat) => {
                const isOnline =
                    chat.type === "direct" &&
                    chat.otherUserId != null &&
                    presence[chat.otherUserId]?.isOnline;

                return (
                    <li key={chat.id}>
                        <button
                            className={`${styles.item} ${chat.id === selectedChatId ? styles.selected : ""}`}
                            onClick={() => onSelect(chat.id)}
                        >
                            <div
                                className={`${styles.avatar} ${chat.type === "group" ? styles.avatarGroup : ""} ${chat.type === "saved" ? styles.avatarSaved : ""}`}
                            >
                                {chat.type === "saved" ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                                    </svg>
                                ) : (
                                    <AvatarImage
                                        src={
                                            chat.type === "direct" && chat.otherUserId
                                                ? getUserAvatarUrl(chat.otherUserId)
                                                : chat.type === "group"
                                                    ? `${getChatAvatarUrl(chat.id)}${chatAvatarNonce ? `?t=${chatAvatarNonce}` : ""}`
                                                    : null
                                        }
                                        fallback={chat.title.charAt(0).toUpperCase()}
                                    />
                                )}
                                {isOnline && <span className={styles.onlineDot} />}
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
                                    <span
                                        className={styles.archiveBtn}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={
                                            chat.isArchived
                                                ? tr.unarchiveAria
                                                : tr.archiveAria
                                        }
                                        title={
                                            chat.isArchived
                                                ? tr.unarchiveAria
                                                : tr.archiveAria
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleArchive(chat.id);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.stopPropagation();
                                                onToggleArchive(chat.id);
                                            }
                                        }}
                                    >
                                        {chat.isArchived ? (
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M21 8v13H3V8M1 3h22v5H1zM12 17V9M8 13l4-4 4 4" />
                                            </svg>
                                        ) : (
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                                            </svg>
                                        )}
                                    </span>
                                </div>
                                <div className={styles.bottomRow}>
                                    <span className={styles.preview}>
                                        {lastMessagePreview(chat, common, tr.noMessagesYet)}
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
                );
            })}
        </ul>
    );
}