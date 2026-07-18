import { useState } from "react";
import { mockProfile } from "../mock/profile";
import styles from "./ProfilePanel.module.css";

interface ProfilePanelProps {
    onClose: () => void;
    onLogout: () => void;
}

// Visual stub only: the settings fields mirror the UserSettings entity on
// the server, but nothing is saved yet, and the profile section above
// them uses mock/profile.ts. Real profile + settings get their own branch.
export default function ProfilePanel({ onClose, onLogout }: ProfilePanelProps) {
    const [notifications, setNotifications] = useState(true);
    const [showLastSeen, setShowLastSeen] = useState(true);
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);
    const [theme, setTheme] = useState("system");
    const [language, setLanguage] = useState("uk");
    const [copied, setCopied] = useState(false);

    const handleCopyId = () => {
        navigator.clipboard.writeText(mockProfile.displayId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <h2 className={styles.title}>Profile</h2>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Close profile"
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
                </header>

                <div className={styles.profileHeader}>
                    <div className={styles.profileAvatar}>
                        {mockProfile.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.profileName}>
                        {mockProfile.username}
                    </span>
                    <button
                        className={styles.idRow}
                        onClick={handleCopyId}
                        title="Copy ID"
                    >
                        <span className={styles.idValue}>
                            {mockProfile.displayId}
                        </span>
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
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                    </button>
                    <span className={styles.copiedHint}>
                        {copied ? "Copied" : "This is the ID others use to find you"}
                    </span>
                </div>

                <p className={styles.note}>
                    Settings are not saved yet – this panel is a preview.
                </p>

                <section className={styles.group}>
                    <h3 className={styles.groupTitle}>Notifications</h3>
                    <label className={styles.row}>
                        <span>Enable notifications</span>
                        <input
                            className={styles.switch}
                            type="checkbox"
                            checked={notifications}
                            onChange={(e) =>
                                setNotifications(e.target.checked)
                            }
                        />
                    </label>
                </section>

                <section className={styles.group}>
                    <h3 className={styles.groupTitle}>Privacy</h3>
                    <label className={styles.row}>
                        <span>Show last seen</span>
                        <input
                            className={styles.switch}
                            type="checkbox"
                            checked={showLastSeen}
                            onChange={(e) => setShowLastSeen(e.target.checked)}
                        />
                    </label>
                    <label className={styles.row}>
                        <span>Show online status</span>
                        <input
                            className={styles.switch}
                            type="checkbox"
                            checked={showOnlineStatus}
                            onChange={(e) =>
                                setShowOnlineStatus(e.target.checked)
                            }
                        />
                    </label>
                </section>

                <section className={styles.group}>
                    <h3 className={styles.groupTitle}>Appearance</h3>
                    <label className={styles.row}>
                        <span>Theme</span>
                        <select
                            className={styles.select}
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                        >
                            <option value="system">System</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </label>
                    <label className={styles.row}>
                        <span>Language</span>
                        <select
                            className={styles.select}
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                        >
                            <option value="uk">Українська</option>
                            <option value="en">English</option>
                        </select>
                    </label>
                </section>

                <div className={styles.footer}>
                    <button className={styles.logoutBtn} onClick={onLogout}>
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
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <path d="M16 17l5-5-5-5M21 12H9" />
                        </svg>
                        Log out
                    </button>
                </div>
            </aside>
        </div>
    );
}
