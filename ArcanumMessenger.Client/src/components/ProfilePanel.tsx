import { useLayoutEffect, useRef, useState, useEffect, type ReactElement } from "react";
import type { User } from "../types/messenger";
import styles from "./ProfilePanel.module.css";
import { getUserSettings, 
    updateAccountFields, 
    getKdfSalt, 
    updateNotificationSettings, 
    updatePrivacySettings,
    updateChatSettings,
    type UpdatePrivacySettingsRequest,
    type UpdateChatSettingsRequest } from "../api/userSettings";
    
import DeleteAccountModal from "./DeleteAccountModal";

interface ProfilePanelProps {
    profile: User;
    onClose: () => void;
    onLogout: () => void;
    onUsernameChange?: (username: string) => void;
}

type Section = "main" | "account" | "notifications" | "privacy" | "chats";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type PrivacyField = "showLastSeen" | "showOnlineStatus" | "readReceipts" | "showPhoneNumber" | "whoCanAddMe" | "totpEnabled";
type ChatField = "theme" | "wallpaper" | "linkPreviews" | "autoDownloadMedia";

// Mirrors Entities.UserSettings, plus a few visual-only extras below.
// Not persisted yet — wiring to GET/PUT /api/users/me/settings is next.
interface SettingsState {
    bio: string;
    phone: string;
    username: string;
    notificationsEnabled: boolean;
    messagePreview: boolean;
    groupNotifications: boolean;
    notificationSound: string;
    totpEnabled: boolean;
    showLastSeen: boolean;
    showOnlineStatus: boolean;
    showPhoneNumber: "everyone" | "contacts" | "nobody";
    whoCanAddMe: "everyone" | "contacts";
    readReceipts: boolean;
    theme: "system" | "dark" | "light";
    wallpaper: string;
    linkPreviews: boolean;
    autoDownloadMedia: boolean;
}

const defaultSettings: SettingsState = {
    bio: "",
    phone: "",
    username: "",
    notificationsEnabled: true,
    messagePreview: true,
    groupNotifications: true,
    notificationSound: "bubble",
    totpEnabled: false,
    showLastSeen: true,
    showOnlineStatus: true,
    showPhoneNumber: "contacts",
    whoCanAddMe: "everyone",
    readReceipts: true,
    theme: "system",
    wallpaper: "Default",
    linkPreviews: true,
    autoDownloadMedia: true,
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

const EveryoneIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z" />
    </svg>
);

const ContactsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <circle cx="17" cy="9" r="2.3" />
        <path d="M15.5 14.2c2.4.4 4.2 2.4 4.5 4.8" />
    </svg>
);

const NobodyIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M6.5 6.5l11 11" />
    </svg>
);
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
const SoundWaveIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" />
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
const CameraIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
        <circle cx="12" cy="13" r="3.5" />
    </svg>
);
const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
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
    { icon: LanguageIcon, color: "#3fbfae", label: "Language", value: "Coming soon :)" },
];

const themeOptions: { id: SettingsState["theme"]; label: string }[] = [
    { id: "system", label: "System" },
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
];

const phoneVisibilityOptions: { id: SettingsState["showPhoneNumber"]; label: string; icon: () => ReactElement }[] = [
    { id: "everyone", label: "Everyone", icon: EveryoneIcon },
    { id: "contacts", label: "My Contacts", icon: ContactsIcon },
    { id: "nobody", label: "Nobody", icon: NobodyIcon },
];

const notificationSoundOptions: { id: string; label: string; file: string; icon: () => ReactElement }[] = [
    { id: "bubble", label: "Bubble", file: "/sounds/notification_bubble.mp3", icon: SoundWaveIcon },
    { id: "chime", label: "Chime", file: "/sounds/notification_chime.mp3", icon: SoundWaveIcon },
    { id: "bell", label: "Bell", file: "/sounds/notification_bell.mp3", icon: SoundWaveIcon },
];

const addMeOptions: { id: SettingsState["whoCanAddMe"]; label: string; icon: () => ReactElement }[] = [
    { id: "everyone", label: "Everyone", icon: EveryoneIcon },
    { id: "contacts", label: "My Contacts", icon: ContactsIcon },
];

const sectionTitles: Record<Section, string> = {
    main: "Profile",
    account: "My Account",
    notifications: "Notifications and Sounds" ,
    privacy: "Privacy and Security",
    chats: "Chat Settings",
};

const MAX_PHONE_DIGITS = 15;
const ANIMATION_MS = 250;

export default function ProfilePanel({ profile, onClose, onLogout, onUsernameChange }: ProfilePanelProps) {
    const [copied, setCopied] = useState(false);
    const [settings, setSettings] = useState<SettingsState>(defaultSettings);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

    const [section, setSection] = useState<Section>("main");
    const [prevSection, setPrevSection] = useState<Section | null>(null);
    const [direction, setDirection] = useState<"forward" | "back">("forward");
    const [animating, setAnimating] = useState(false);
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);

    const viewportRef = useRef<HTMLDivElement>(null);
    const incomingRef = useRef<HTMLDivElement>(null);
    const animationTimer = useRef<number | null>(null);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [kdfSalt, setKdfSalt] = useState<string | null>(null);

    const saveTimer = useRef<number | null>(null);
    const pendingFields = useRef<Partial<{ username: string; bio: string; phone: string }>>({});

    const [notifSaveStatus, setNotifSaveStatus] = useState<SaveStatus>("idle");
    const [privacySaveStatus, setPrivacySaveStatus] = useState<SaveStatus>("idle");
    const [chatsSaveStatus, setChatsSaveStatus] = useState<SaveStatus>("idle");

    const soundCacheRef = useRef<Record<string, HTMLAudioElement>>({});
     
    const privacyApiFieldMap: Record<PrivacyField, keyof UpdatePrivacySettingsRequest> = {
        showLastSeen: "showLastSeen",
        showOnlineStatus: "showOnlineStatus",
        readReceipts: "readReceiptsEnabled",
        showPhoneNumber: "showPhoneNumber",
        whoCanAddMe: "whoCanAddMe",
        totpEnabled: "totpEnabled",
    };

    const chatsApiFieldMap: Record<ChatField, keyof UpdateChatSettingsRequest> = {
        theme: "theme",
        wallpaper: "wallpaper",
        linkPreviews: "linkPreviewsEnabled",
        autoDownloadMedia: "autoDownloadMedia",
    };


    const patch = (partial: Partial<SettingsState>) =>
        setSettings((prev) => ({ ...prev, ...partial }));

    const handleCopyId = () => {
        navigator.clipboard.writeText(profile.publicId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleOpenDeleteModal = async () => {
        try {
            const salt = await getKdfSalt();
            setKdfSalt(salt);
            setDeleteModalOpen(true);
        } catch { }
    };

    const flushSave = async () => {
        const fields = pendingFields.current;
        if (Object.keys(fields).length === 0) return;

        pendingFields.current = {};
        setSaveStatus("saving");

        try {
            await updateAccountFields(fields);
            setSaveStatus("saved");
            window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
        } catch {
            setSaveStatus("error");
        }
    };

    const scheduleSave = (field: "username" | "bio" | "phone", value: string) => {
        pendingFields.current = { ...pendingFields.current, [field]: value };

        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            flushSave();
        }, 2000);
    };

    const handleBioChange = (raw: string) => {
        const value = raw.replace(/^\s+/, "");
        patch({ bio: value });
        scheduleSave("bio", value);
    };

    const handlePhoneChange = (raw: string) => {
        const hasPlus = raw.trim().startsWith("+");
        const digits = raw.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
        const value = (hasPlus ? "+" : "") + digits;
        patch({ phone: value });
        scheduleSave("phone", value);
    };

    const handleUsernameChange = (raw: string) => {
        const value = raw.replace(/^\s+/, "");
        patch({ username: value });
        scheduleSave("username", value);
    };

    const handleNotificationToggle = async (
        field: "notificationsEnabled" | "groupNotifications",
        value: boolean,
    ) => {
        patch({ [field]: value } as Partial<SettingsState>);
        setNotifSaveStatus("saving");

        try {
            await updateNotificationSettings({ [field]: value });
            setNotifSaveStatus("saved");
            window.setTimeout(() => setNotifSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
        } catch {
            // Roll back optimistic update on failure
            patch({ [field]: !value } as Partial<SettingsState>);
            setNotifSaveStatus("error");
        }
    };

    const handlePrivacyChange = async <K extends PrivacyField>(field: K, value: SettingsState[K]) => {
        const prevValue = settings[field];
        patch({ [field]: value } as Partial<SettingsState>);
        setPrivacySaveStatus("saving");

        try {
            await updatePrivacySettings({ [privacyApiFieldMap[field]]: value });
            setPrivacySaveStatus("saved");
            window.setTimeout(() => setPrivacySaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
        } catch {
            patch({ [field]: prevValue } as Partial<SettingsState>);
            setPrivacySaveStatus("error");
        }
    };

    const handleChatSettingChange = async <K extends ChatField>(field: K, value: SettingsState[K]) => {
        const prevValue = settings[field];
        patch({ [field]: value } as Partial<SettingsState>);
        setChatsSaveStatus("saving");

        try {
            await updateChatSettings({ [chatsApiFieldMap[field]]: value });
            setChatsSaveStatus("saved");
            window.setTimeout(() => setChatsSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
        } catch {
            patch({ [field]: prevValue } as Partial<SettingsState>);
            setChatsSaveStatus("error");
        }
    };

    const playSoundPreview = (soundId: string) => {
        const cached = soundCacheRef.current[soundId];
        if (!cached) return;

        cached.currentTime = 0;
        cached.play().catch(() => { });
    };

    const handleNotificationSoundChange = async (soundId: string) => {
        const prevValue = settings.notificationSound;
        patch({ notificationSound: soundId });

        playSoundPreview(soundId);

        setNotifSaveStatus("saving");
        try {
            await updateNotificationSettings({ notificationSound: soundId });
            setNotifSaveStatus("saved");
            window.setTimeout(() => setNotifSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
        } catch {
            patch({ notificationSound: prevValue });
            setNotifSaveStatus("error");
        }
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

    useLayoutEffect(() => {
        if (animating && incomingRef.current) {
            const target = incomingRef.current.scrollHeight;
            requestAnimationFrame(() => setViewportHeight(target));
        }
    }, [animating, section]);

    useEffect(() => {
        let cancelled = false;

        getUserSettings()
            .then((data) => {
                if (cancelled) return;
                setSettings(prev => ({
                    ...prev,
                    bio: data.bio,
                    phone: data.phone,
                    username: data.username,
                    notificationsEnabled: data.notificationsEnabled,
                    groupNotifications: data.groupNotifications,
                    notificationSound: data.notificationSound,
                    totpEnabled: data.totpEnabled,
                    showLastSeen: data.showLastSeen,
                    showOnlineStatus: data.showOnlineStatus,
                    readReceipts: data.readReceiptsEnabled,
                    showPhoneNumber: data.showPhoneNumber,
                    whoCanAddMe: data.whoCanAddMe,
                    theme: data.theme,
                    wallpaper: data.wallpaper,
                    linkPreviews: data.linkPreviewsEnabled,
                    autoDownloadMedia: data.autoDownloadMedia,
                }));
                setSettingsLoaded(true);
            })
            .catch(() => {
                if (!cancelled) setSettingsLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (settingsLoaded) {
            onUsernameChange?.(settings.username);
        }
    }, [settings.username, settingsLoaded]);

    useEffect(() => {
        return () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            flushSave();
        };
    }, []);

    useEffect(() => {
        notificationSoundOptions.forEach((opt) => {
            const audio = new Audio(opt.file);
            audio.preload = "auto";
            audio.load();
            soundCacheRef.current[opt.id] = audio;
        });

        return () => {
            Object.values(soundCacheRef.current).forEach((audio) => {
                audio.pause();
                audio.src = "";
            });
            soundCacheRef.current = {};
        };
    }, []);

    const renderSection = (sec: Section) => {
        switch (sec) {
            case "main":
                return (
                    <>
                        <div className={styles.profileHeader}>
                            <div className={styles.profileAvatar}>
                                {(settingsLoaded ? (settings.username || profile.name) : profile.name).charAt(0).toUpperCase()}
                            </div>

                            <span className={styles.profileName}>
                                {settingsLoaded ? (settings.username || profile.name) : profile.name}
                            </span>

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
                        <div className={styles.avatarEditRow}>
                            <div className={styles.avatarEditPic}>
                                {profile.name.charAt(0).toUpperCase()}
                                <span className={styles.avatarEditOverlay}>
                                    <CameraIcon />
                                </span>
                            </div>
                            <div className={styles.avatarEditHint}>
                                <span className={styles.avatarEditTitle}>Set New Photo</span>
                                <span className={styles.avatarEditSub}>
                                    Upload isn't wired up yet
                                </span>
                            </div>

                            <div className={styles.saveStatus}>
                                {saveStatus === "saving" && <span className={styles.saveStatusSaving}>Saving...</span>}
                                {saveStatus === "saved" && <span className={styles.saveStatusSaved}>Saved</span>}
                                {saveStatus === "error" && <span className={styles.saveStatusError}>Failed to save</span>}
                            </div>
                        </div>

                        <label className={styles.fieldLabel}>Username</label>
                        <input                    
                            className={styles.textInput}
                            type="text"
                            placeholder={settingsLoaded ? "Your username" : "Loading..."}
                            value={settings.username}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            maxLength={32}
                            disabled={!settingsLoaded}
                        />

                        <label className={styles.fieldLabel}>Bio</label>
                        <textarea
                            className={styles.textArea}
                            placeholder={settingsLoaded ? "Tell something about yourself" : "Loading..."}
                            value={settings.bio}
                            onChange={(e) => handleBioChange(e.target.value)}
                            rows={3}
                            maxLength={70}
                            disabled={!settingsLoaded}
                        />
                        <p className={styles.fieldHint}>{70 - settings.bio.length} characters left</p>

                        <label className={styles.fieldLabel}>Phone number</label>
                        <input
                            className={styles.textInput}
                            type="tel"
                            inputMode="numeric"
                            placeholder={settingsLoaded ? "+1..." : "Loading..."}
                            value={settings.phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            disabled={!settingsLoaded}
                        />
                        <span className={styles.dangerTitle}>Danger Zone</span>
                        <button className={styles.dangerRow} onClick={handleOpenDeleteModal}>
                            <TrashIcon />
                            <span>Delete My Account</span>
                        </button>
                    </div>
                );

            case "notifications":
                return (
                    <div className={styles.subPage}>
                        <div className={styles.saveStatusRow}>
                            {notifSaveStatus === "saving" && <span className={styles.saveStatusSaving}>Saving...</span>}
                            {notifSaveStatus === "saved" && <span className={styles.saveStatusSaved}>Saved</span>}
                            {notifSaveStatus === "error" && <span className={styles.saveStatusError}>Failed to save</span>}
                        </div>

                        <span className={styles.subGroupTitle}>Message Notifications</span>
                        <label className={styles.row}>
                            <span>Enable notifications</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.notificationsEnabled}
                                disabled={!settingsLoaded}
                                onChange={(e) => handleNotificationToggle("notificationsEnabled", e.target.checked)}
                            />
                        </label>
                        <label className={styles.row}>
                            <span>Group chat notifications</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.groupNotifications}
                                disabled={!settingsLoaded || !settings.notificationsEnabled}
                                onChange={(e) => handleNotificationToggle("groupNotifications", e.target.checked)}
                            />
                        </label>

                        <span className={styles.subGroupTitle}>Sound</span>
                        <div className={styles.chipGroup}>
                            {notificationSoundOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.notificationSound === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handleNotificationSoundChange(opt.id)}
                                >
                                    <span className={styles.chipIcon}>
                                        <opt.icon />
                                    </span>
                                    <span className={styles.chipLabel}>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case "privacy":
                return (
                    <div className={styles.subPage}>
                        <div className={styles.saveStatusRow}>
                            {privacySaveStatus === "saving" && <span className={styles.saveStatusSaving}>Saving...</span>}
                            {privacySaveStatus === "saved" && <span className={styles.saveStatusSaved}>Saved</span>}
                            {privacySaveStatus === "error" && <span className={styles.saveStatusError}>Failed to save</span>}
                        </div>

                        <label className={styles.row}>
                            <span>Enable TOTP</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.totpEnabled}
                                disabled={!settingsLoaded}
                                onChange={(e) => handlePrivacyChange("totpEnabled", e.target.checked)}
                            />
                        </label>
                        
                        <span className={styles.subGroupTitle}>Presence</span>
                        <label className={styles.row}>
                            <span>Show last seen</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.showLastSeen}
                                disabled={!settingsLoaded}
                                onChange={(e) => handlePrivacyChange("showLastSeen", e.target.checked)}
                            />
                        </label>
                        <label className={styles.row}>
                            <span>Show online status</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.showOnlineStatus}
                                disabled={!settingsLoaded}
                                onChange={(e) => handlePrivacyChange("showOnlineStatus", e.target.checked)}
                            />
                        </label>
                        <label className={styles.row}>
                            <span>Send read receipts</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.readReceipts}
                                disabled={!settingsLoaded}
                                onChange={(e) => handlePrivacyChange("readReceipts", e.target.checked)}
                            />
                        </label>

                        <span className={styles.subGroupTitle}>Who can see my phone number</span>
                        <div className={styles.chipGroup}>
                            {phoneVisibilityOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.showPhoneNumber === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handlePrivacyChange("showPhoneNumber", opt.id)}
                                >
                                    <span className={styles.chipIcon}>
                                        <opt.icon />
                                    </span>
                                    <span className={styles.chipLabel}>{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        <span className={styles.subGroupTitle}>Who can add me to chats</span>
                        <div className={styles.chipGroup}>
                            {addMeOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.whoCanAddMe === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handlePrivacyChange("whoCanAddMe", opt.id)}
                                >
                                    <span className={styles.chipIcon}>
                                        <opt.icon />
                                    </span>
                                    <span className={styles.chipLabel}>{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        <span className={styles.subGroupTitle}>Blocked Users</span>
                        <div className={styles.row}>
                            <span>Blocked users</span>
                            <span className={styles.menuValue}>0</span>
                        </div>
                    </div>
                );

            case "chats":
                return (
                    <div className={styles.subPage}>
                        <div className={styles.saveStatusRow}>
                            {chatsSaveStatus === "saving" && <span className={styles.saveStatusSaving}>Saving...</span>}
                            {chatsSaveStatus === "saved" && <span className={styles.saveStatusSaved}>Saved</span>}
                            {chatsSaveStatus === "error" && <span className={styles.saveStatusError}>Failed to save</span>}
                        </div>

                        <span className={styles.subGroupTitle}>Theme</span>
                        <div className={styles.optionList}>
                            {themeOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={styles.optionRow}
                                    disabled={!settingsLoaded}
                                    onClick={() => handleChatSettingChange("theme", opt.id)}
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

                        <span className={styles.subGroupTitle}>Appearance</span>
                        <div className={styles.row}>
                            <span>Chat wallpaper</span>
                            <span className={styles.menuValue}>{settings.wallpaper}</span>
                        </div>
                        <label className={styles.row}>
                            <span>Show link previews</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.linkPreviews}
                                disabled={!settingsLoaded}
                                onChange={(e) => handleChatSettingChange("linkPreviews", e.target.checked)}
                            />
                        </label>

                        <span className={styles.subGroupTitle}>Data Usage</span>
                        <label className={styles.row}>
                            <span>Auto-download media</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.autoDownloadMedia}
                                disabled={!settingsLoaded}
                                onChange={(e) => handleChatSettingChange("autoDownloadMedia", e.target.checked)}
                            />
                        </label>
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
            {deleteModalOpen && (
                <DeleteAccountModal
                    kdfSalt={kdfSalt || ""}
                    onClose={() => setDeleteModalOpen(false)}
                    onConfirmed={() => {
                        setDeleteModalOpen(false);
                        onLogout(); // reuse the existing logout flow
                    }}
                />
            )}
        </div>
    );
}