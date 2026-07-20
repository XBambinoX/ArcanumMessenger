import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import type { User } from "../types/messenger";
import styles from "./ProfilePanel.module.css";

interface ProfilePanelProps {
    profile: User;
    onClose: () => void;
    onLogout: () => void;
}

type Section = "main" | "account" | "notifications" | "privacy" | "chats";

// Mirrors Entities.UserSettings. Not persisted yet — wiring to
// GET/PUT /api/users/me/settings is the next step.
interface SettingsState {
    bio: string;
    phone: string;
    notificationsEnabled: boolean;
    showLastSeen: boolean;
    showOnlineStatus: boolean;
    theme: "system" | "dark" | "light";
}

const defaultSettings: SettingsState = {
    bio: "",
    phone: "",
    notificationsEnabled: true,
    showLastSeen: true,
    showOnlineStatus: true,
    theme: "system",
};

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
const ChevronIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
    </svg>
);
const CheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
    </svg>
);

const menuItems: {
    icon: (p: IconProps) => ReactElement;
    color: string;
    label: string;
    value?: string;
    section?: Section;
}[] = [
    { icon: AccountIcon, color: "#54a9eb", label: "My Account", section: "account" },
    { icon: BellIcon, color: "#f2703c", label: "Notifications and Sounds", section: "notifications" },
    { icon: LockIcon, color: "#4fb85c", label: "Privacy and Security", section: "privacy" },
    { icon: ChatIcon, color: "#4ec4dc", label: "Chat Settings", section: "chats" },
    { icon: SlidersIcon, color: "#8f7ee6", label: "Advanced" },
    { icon: LanguageIcon, color: "#3fbfae", label: "Language", value: "Coming soon :)" },
];

const themeOptions: { id: SettingsState["theme"]; label: string }[] = [
    { id: "system", label: "System" },
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
];

const sectionTitles: Record<Section, string> = {
    main: "Profile",
    account: "My Account",
    notifications: "Notifications and Sounds",
    privacy: "Privacy and Security",
    chats: "Chat Settings",
};

const ANIMATION_MS = 250;

export default function ProfilePanel({ profile, onClose, onLogout }: ProfilePanelProps) {
    const [copied, setCopied] = useState(false);
    const [settings, setSettings] = useState<SettingsState>(defaultSettings);

    const [section, setSection] = useState<Section>("main");
    const [prevSection, setPrevSection] = useState<Section | null>(null);
    const [direction, setDirection] = useState<"forward" | "back">("forward");
    const [animating, setAnimating] = useState(false);
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);

    const viewportRef = useRef<HTMLDivElement>(null);
    const incomingRef = useRef<HTMLDivElement>(null);
    const animationTimer = useRef<number | null>(null);

    const patch = (partial: Partial<SettingsState>) =>
        setSettings((prev) => ({ ...prev, ...partial }));

    const handleCopyId = () => {
        navigator.clipboard.writeText(profile.publicId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const navigateTo = (target: Section) => {
        if (animating || target === section) return;

        if (viewportRef.current) {
            setViewportHeight(viewportRef.current.offsetHeight);
        }

        setDirection(target === "main" ? "back" : "forward");
        setPrevSection(section);
        setSection(target);
        setAnimating(true);

        if (animationTimer.current) window.clearTimeout(animationTimer.current);
        animationTimer.current = window.setTimeout(() => {
            setAnimating(false);
            setPrevSection(null);
            setViewportHeight(null);
        }, ANIMATION_MS);
    };

    // Once the incoming panel is in the DOM, measure it so the viewport
    // can smoothly transition to the new content's height.
    useLayoutEffect(() => {
        if (animating && incomingRef.current) {
            const target = incomingRef.current.scrollHeight;
            requestAnimationFrame(() => setViewportHeight(target));
        }
    }, [animating, section]);

    const renderSection = (sec: Section) => {
        switch (sec) {
            case "main":
                return (
                    <>
                        <div className={styles.profileHeader}>
                            <div className={styles.profileAvatar}>
                                {profile.name.charAt(0).toUpperCase()}
                            </div>
                            <span className={styles.profileName}>{profile.name}</span>
                            <button className={styles.idRow} onClick={handleCopyId} title="Copy ID">
                                <span className={styles.idValue}>{profile.publicId}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                                <button
                                    key={item.label}
                                    className={styles.menuRow}
                                    onClick={() => item.section && navigateTo(item.section)}
                                    disabled={!item.section}
                                >
                                    <span className={styles.menuIcon}>
                                        <item.icon color={item.color} />
                                    </span>
                                    <span className={styles.menuLabel}>{item.label}</span>
                                    {item.value && (
                                        <span className={styles.menuValue}>{item.value}</span>
                                    )}
                                    {item.section && (
                                        <span className={styles.menuChevron}>
                                            <ChevronIcon />
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>

                        <div className={styles.footer}>
                            <button className={styles.logoutBtn} onClick={onLogout}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <path d="M16 17l5-5-5-5M21 12H9" />
                                </svg>
                                Log out
                            </button>
                        </div>
                    </>
                );

            case "account":
                return (
                    <div className={styles.subPage}>
                        <label className={styles.fieldLabel}>Bio</label>
                        <textarea
                            className={styles.textArea}
                            placeholder="Tell something about yourself"
                            value={settings.bio}
                            onChange={(e) => patch({ bio: e.target.value })}
                            rows={3}
                        />
                        <label className={styles.fieldLabel}>Phone number</label>
                        <input
                            className={styles.textInput}
                            type="tel"
                            placeholder="+1..."
                            value={settings.phone}
                            onChange={(e) => patch({ phone: e.target.value })}
                        />
                        <p className={styles.fieldHint}>
                            These fields are encrypted on the server (BioEnc / PhoneEnc) — saving comes next.
                        </p>
                    </div>
                );

            case "notifications":
                return (
                    <div className={styles.subPage}>
                        <label className={styles.row}>
                            <span>Enable notifications</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.notificationsEnabled}
                                onChange={(e) => patch({ notificationsEnabled: e.target.checked })}
                            />
                        </label>
                    </div>
                );

            case "privacy":
                return (
                    <div className={styles.subPage}>
                        <label className={styles.row}>
                            <span>Show last seen</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.showLastSeen}
                                onChange={(e) => patch({ showLastSeen: e.target.checked })}
                            />
                        </label>
                        <label className={styles.row}>
                            <span>Show online status</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.showOnlineStatus}
                                onChange={(e) => patch({ showOnlineStatus: e.target.checked })}
                            />
                        </label>
                    </div>
                );

            case "chats":
                return (
                    <div className={styles.subPage}>
                        <span className={styles.fieldLabel}>Theme</span>
                        <div className={styles.optionList}>
                            {themeOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={styles.optionRow}
                                    onClick={() => patch({ theme: opt.id })}
                                >
                                    <span>{opt.label}</span>
                                    {settings.theme === opt.id && (
                                        <span className={styles.optionCheck}>
                                            <CheckIcon />
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
                <header className={styles.header}>
                    {section === "main" ? (
                        <h2 className={styles.title}>{sectionTitles.main}</h2>
                    ) : (
                        <button className={styles.backBtn} onClick={() => navigateTo("main")}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 6l-6 6 6 6" />
                            </svg>
                            <span>{sectionTitles[section]}</span>
                        </button>
                    )}
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close profile">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div
                    ref={viewportRef}
                    className={styles.slideViewport}
                    style={animating && viewportHeight != null ? { height: viewportHeight } : undefined}
                >
                    {animating && prevSection && (
                        <div
                            className={`${styles.slidePanel} ${
                                direction === "forward" ? styles.slideOutLeft : styles.slideOutRight
                            }`}
                        >
                            {renderSection(prevSection)}
                        </div>
                    )}
                    <div
                        ref={animating ? incomingRef : undefined}
                        className={
                            animating
                                ? `${styles.slidePanel} ${
                                      direction === "forward" ? styles.slideInRight : styles.slideInLeft
                                  }`
                                : styles.staticPanel
                        }
                    >
                        {renderSection(section)}
                    </div>
                </div>
            </aside>
        </div>
    );
}