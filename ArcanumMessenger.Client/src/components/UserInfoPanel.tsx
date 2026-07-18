import type { User } from "../types/messenger";
import { formatChatTime } from "../lib/time";
import styles from "./UserInfoPanel.module.css";

interface UserInfoPanelProps {
    user: User;
    onClose: () => void;
}

export default function UserInfoPanel({ user, onClose }: UserInfoPanelProps) {
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
