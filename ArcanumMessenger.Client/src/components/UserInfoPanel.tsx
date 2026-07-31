import { useState } from "react";
import type { ChatSummary, User } from "../types/messenger";
import { createDirectChat } from "../api/chats";
import { addContact, removeContact, blockUser, unblockUser } from "../api/contacts";
import { getUserAvatarUrl } from "../api/users";
import { formatChatTime } from "../lib/time";
import AvatarImage from "./AvatarImage";
import styles from "./UserInfoPanel.module.css";

interface UserInfoPanelProps {
    userId: string;
    user: User;
    onClose: () => void;
    onStartChat: (chat: ChatSummary) => void;
    presence?: { isOnline: boolean; lastSeen: string | null };
}

export default function UserInfoPanel({
    userId,
    user,
    onClose,
    onStartChat,
    presence
}: UserInfoPanelProps) {
    const [isContact, setIsContact] = useState(user.isContact);
    const [isBlocked, setIsBlocked] = useState(user.isBlocked);
    const [writeError, setWriteError] = useState<string | null>(null);
    const canInteract = !isBlocked && !user.isBlockedByOther;

    const handleWrite = async () => {
        if (!canInteract) return;
        const { chat, reason } = await createDirectChat(userId);
        if (chat) {
            onStartChat(chat);
            onClose();
        } else {
            setWriteError(
                reason === "add_restricted"
                    ? `${user.name} only accepts messages from their contacts.`
                    : "Couldn't start this chat.",
            );
        }
    };

    const handleToggleContact = async () => {
        if (!canInteract) return;
        const ok = isContact
            ? await removeContact(userId)
            : await addContact(userId);
        if (ok) setIsContact(!isContact);
    };

    const handleToggleBlock = async () => {
        const ok = isBlocked
            ? await unblockUser(userId)
            : await blockUser(userId);
        if (ok) setIsBlocked(!isBlocked);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label="Close"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                    >
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                <div className={styles.profileHeader}>
                    <div className={styles.profileAvatar}>
                        <AvatarImage src={getUserAvatarUrl(userId)} fallback={user.name.charAt(0).toUpperCase()} />
                    </div>
                    <span className={styles.profileName}>{user.name}</span>
                    <span
                        className={`${styles.lastSeen} ${presence?.isOnline ? styles.lastSeenOnline : ""}`}
                    >
                        {presence?.isOnline
                            ? "online"
                            : presence?.lastSeen
                                ? `Last seen ${formatChatTime(presence.lastSeen)}`
                                : user.lastSeen
                                    ? `Last seen ${formatChatTime(user.lastSeen)}`
                                    : "Last seen a while ago"}
                    </span>
                </div>

                {writeError && <p className={styles.blockNote}>{writeError}</p>}

                <div className={styles.actionRow}>
                    <button className={styles.actionBtn} onClick={handleWrite} disabled={!canInteract}>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
                        </svg>
                        Message
                    </button>
                    <button
                        className={styles.actionBtn}
                        onClick={handleToggleContact}
                        disabled={!canInteract}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            {isContact ? (
                                <path d="M17 11h6" />
                            ) : (
                                <path d="M20 8v6M23 11h-6" />
                            )}
                        </svg>
                        {isContact ? "Remove from contacts" : "Add to contacts"}
                    </button>
                </div>

                <button
                    className={`${styles.actionBtn} ${styles.blockBtn} ${isBlocked ? styles.blockBtnActive : ""}`}
                    onClick={handleToggleBlock}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M6.5 6.5l11 11" />
                    </svg>
                    {isBlocked ? "Unblock" : "Block"}
                </button>

                {(isBlocked || user.isBlockedByOther) && (
                    <p className={styles.blockNote}>
                        {isBlocked
                            ? "You've blocked this user."
                            : "This user has blocked you."}
                    </p>
                )}

                <section className={styles.infoSection}>
                    {user.bio && (
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Bio</span>
                            <span className={styles.infoValue}>{user.bio}</span>
                        </div>
                    )}
                    {user.email && (
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Email</span>
                            <span className={styles.infoValue}>{user.email}</span>
                        </div>
                    )}
                    {user.phone && (
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Phone</span>
                            <span className={styles.infoValue}>{user.phone}</span>
                        </div>
                    )}
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>ID</span>
                        <span className={styles.infoValue}>{user.publicId}</span>
                    </div>
                </section>
            </aside>
        </div>
    );
}
