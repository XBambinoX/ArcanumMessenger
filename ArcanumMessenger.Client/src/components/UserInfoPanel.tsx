import { useState } from "react";
import type { ChatSummary, User } from "../types/messenger";
import { createDirectChat } from "../api/chats";
import { addContact, removeContact } from "../api/contacts";
import { formatChatTime } from "../lib/time";
import styles from "./UserInfoPanel.module.css";

interface UserInfoPanelProps {
    userId: string;
    user: User;
    onClose: () => void;
    onStartChat: (chat: ChatSummary) => void;
}

export default function UserInfoPanel({
    userId,
    user,
    onClose,
    onStartChat,
}: UserInfoPanelProps) {
    const [isContact, setIsContact] = useState(user.isContact);

    const handleWrite = async () => {
        const chat = await createDirectChat(userId);
        if (chat) {
            onStartChat(chat);
            onClose();
        }
    };

    const handleToggleContact = async () => {
        const ok = isContact
            ? await removeContact(userId)
            : await addContact(userId);
        if (ok) setIsContact(!isContact);
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
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.profileName}>{user.name}</span>
                    <span className={styles.lastSeen}>
                        {user.lastSeen
                            ? `Last seen ${formatChatTime(user.lastSeen)}`
                            : "Last seen a while ago"}
                    </span>
                </div>

                <div className={styles.actionRow}>
                    <button className={styles.actionBtn} onClick={handleWrite}>
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

                <section className={styles.infoSection}>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Bio</span>
                        <span className={styles.infoValue}>
                            {user.bio ?? "No bio yet"}
                        </span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Email</span>
                        <span className={styles.infoValue}>
                            {user.email ?? "Not shared"}
                        </span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Phone</span>
                        <span className={styles.infoValue}>
                            {user.phone ?? "Not shared"}
                        </span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>ID</span>
                        <span className={styles.infoValue}>
                            {user.publicId}
                        </span>
                    </div>
                </section>
            </aside>
        </div>
    );
}
