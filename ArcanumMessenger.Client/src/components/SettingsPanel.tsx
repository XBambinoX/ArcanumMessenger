import { useState } from "react";
import styles from "./SettingsPanel.module.css";

interface SettingsPanelProps {
    onClose: () => void;
    onLogout: () => void;
}

// Visual stub only: the fields mirror the UserSettings entity on the
// server, but nothing is saved yet. Real settings get their own branch.
export default function SettingsPanel({
    onClose,
    onLogout,
}: SettingsPanelProps) {
    const [notifications, setNotifications] = useState(true);
    const [showLastSeen, setShowLastSeen] = useState(true);
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);
    const [theme, setTheme] = useState("system");
    const [language, setLanguage] = useState("uk");

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <h2 className={styles.title}>Settings</h2>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Close settings"
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
