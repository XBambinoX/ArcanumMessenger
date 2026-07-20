import { useState, type ReactElement } from "react";
import type { User } from "../types/messenger";
import styles from "./ProfilePanel.module.css";

interface ProfilePanelProps {
    profile: User;
    onClose: () => void;
    onLogout: () => void;
}

type IconProps = { color: string };

const iconProps = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

const AccountIcon = ({ color }: IconProps) => (
    <svg {...iconProps} style={{ color }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
);

const BellIcon = ({ color }: IconProps) => (
    <svg {...iconProps} style={{ color }}>
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
        <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
);

const LockIcon = ({ color }: IconProps) => (
    <svg {...iconProps} style={{ color }}>
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
);

const ChatIcon = ({ color }: IconProps) => (
    <svg {...iconProps} style={{ color }}>
        <path d="M4 12a8 6.5 0 1 1 3 5l-4 1.2 1.2-3.8A6.4 6.4 0 0 1 4 12z" />
    </svg>
);

const SlidersIcon = ({ color }: IconProps) => (
    <svg {...iconProps} style={{ color }}>
        <path d="M4 6h10M4 12h6M4 18h13" />
        <circle cx="17" cy="6" r="2" />
        <circle cx="13" cy="18" r="2" />
        <circle cx="20" cy="12" r="0.01" />
        <path d="M18 12h3" />
    </svg>
);

const LanguageIcon = ({ color }: IconProps) => (
    <svg {...iconProps} style={{ color }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z" />
    </svg>
);

const menuItems: {
    icon: (p: IconProps) => ReactElement;
    color: string;
    label: string;
    value?: string;
}[] = [
    { icon: AccountIcon, color: "#54a9eb", label: "My Account" },
    { icon: BellIcon, color: "#f2703c", label: "Notifications and Sounds" },
    { icon: LockIcon, color: "#4fb85c", label: "Privacy and Security" },
    { icon: ChatIcon, color: "#4ec4dc", label: "Chat Settings" },
    { icon: SlidersIcon, color: "#8f7ee6", label: "Advanced" },
    { icon: LanguageIcon, color: "#3fbfae", label: "Language", value: "Coming soon :)" },
];


export default function ProfilePanel({ profile, onClose, onLogout }: ProfilePanelProps) {
    const [copied, setCopied] = useState(false);

    const handleCopyId = () => {
        navigator.clipboard.writeText(profile.publicId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
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
                        {profile.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.profileName}>{profile.name}</span>
                    <button className={styles.idRow} onClick={handleCopyId} title="Copy ID">
                        <span className={styles.idValue}>{profile.publicId}</span>
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

                <nav className={styles.menuList}>
                    {menuItems.map((item) => (
                        <button key={item.label} className={styles.menuRow}>
                            <span className={styles.menuIcon}>
                                <item.icon color={item.color} />
                            </span>
                            <span className={styles.menuLabel}>{item.label}</span>
                            {item.value && (
                                <span className={styles.menuValue}>{item.value}</span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className={styles.sectionDivider} />

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