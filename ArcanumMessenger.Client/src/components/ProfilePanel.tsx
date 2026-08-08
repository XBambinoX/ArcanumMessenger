import { useLayoutEffect, useRef, useState, useEffect, type ReactElement } from "react";
import { useNavigate } from "react-router";
import type { User, UserSearchResult } from "../types/messenger";
import styles from "./ProfilePanel.module.css";
import { getUserSettings,
    updateAccountFields,
    getKdfSalt,
    updateNotificationSettings,
    updatePrivacySettings,
    updateChatSettings,
    type UpdatePrivacySettingsRequest,
    type UpdateChatSettingsRequest } from "../api/userSettings";
import { getBlockedUsers, unblockUser } from "../api/contacts";
import { getMyAvatarUrl, getUserAvatarUrl, uploadMyAvatar, deleteMyAvatar } from "../api/users";
import AvatarImage from "./AvatarImage";
import DeleteAccountModal from "./DeleteAccountModal";
import { useLanguage, setLanguage, type Language } from "../lib/language";
import { APP_COMMON } from "../lib/appTranslations";
import { PROFILE_PANEL_TRANSLATIONS } from "../lib/profileTranslations";

interface ProfilePanelProps {
    profile: User;
    onClose: () => void;
    onLogout: () => void;
    onUsernameChange?: (username: string) => void;
    onNotificationSettingsChange?: (sound: string, notificationsEnabled: boolean, groupNotifications: boolean) => void;
    onAvatarChange?: () => void;
}

type Section = "main" | "account" | "notifications" | "privacy" | "chats" | "language" | "blocked";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type PrivacyField = "showLastSeen" | "showOnlineStatus" | "readReceipts" | "showPhoneNumber" | "showBio" | "showAvatar" | "showEmail" | "whoCanAddMe" | "totpEnabled";
type ChatField = "theme" | "language" | "wallpaper" | "linkPreviews" | "autoDownloadMedia";

// Mirrors Entities.UserSettings, plus a few visual-only extras below.
// Not persisted yet — wiring to GET/PUT /api/users/me/settings is next.
interface SettingsState {
    bio: string;
    phone: string;
    email: string;
    username: string;
    notificationsEnabled: boolean;
    messagePreview: boolean;
    groupNotifications: boolean;
    notificationSound: string;
    totpEnabled: boolean;
    showLastSeen: boolean;
    showOnlineStatus: boolean;
    showPhoneNumber: "everyone" | "contacts" | "nobody";
    showBio: "everyone" | "contacts" | "nobody";
    showAvatar: "everyone" | "contacts" | "nobody";
    showEmail: "everyone" | "contacts" | "nobody";
    whoCanAddMe: "everyone" | "contacts";
    readReceipts: boolean;
    theme: "system" | "dark" | "light";
    language: "en" | "uk" | "de";
    wallpaper: string;
    linkPreviews: boolean;
    autoDownloadMedia: boolean;
}

const defaultSettings: SettingsState = {
    bio: "",
    phone: "",
    email: "",
    username: "",
    notificationsEnabled: true,
    messagePreview: true,
    groupNotifications: true,
    notificationSound: "bubble",
    totpEnabled: false,
    showLastSeen: true,
    showOnlineStatus: true,
    showPhoneNumber: "contacts",
    showBio: "everyone",
    showAvatar: "everyone",
    showEmail: "everyone",
    whoCanAddMe: "everyone",
    readReceipts: true,
    theme: "system",
    language: "en",
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
const ThemeSystemIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
    </svg>
);
const ThemeDarkIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
);
const ThemeLightIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
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

const languageOptions: { id: SettingsState["language"]; label: string }[] = [
    { id: "en", label: "English" },
    { id: "uk", label: "Українська" },
    { id: "de", label: "Deutsch" },
];

const MAX_PHONE_DIGITS = 15;
const ANIMATION_MS = 250;

export default function ProfilePanel({ profile, onClose, onLogout, onUsernameChange, onNotificationSettingsChange, onAvatarChange }: ProfilePanelProps) {
    const navigate = useNavigate();
    const language = useLanguage();
    const common = APP_COMMON[language];
    const tr = PROFILE_PANEL_TRANSLATIONS[language];

    const menuItems: {
        icon: (p: IconProps) => ReactElement;
        color: string;
        label: string;
        value?: string;
        section?: Section;
    }[] = [
        { icon: AccountIcon, color: "#54a9eb", label: tr.sectionTitles.account, section: "account" },
        { icon: BellIcon, color: "#f2703c", label: tr.sectionTitles.notifications, section: "notifications" },
        { icon: LockIcon, color: "#4fb85c", label: tr.sectionTitles.privacy, section: "privacy" },
        { icon: ChatIcon, color: "#4ec4dc", label: tr.sectionTitles.chats, section: "chats" },
        { icon: LanguageIcon, color: "#3fbfae", label: tr.sectionTitles.language, section: "language" },
    ];

    const themeOptions: { id: SettingsState["theme"]; label: string; icon: () => ReactElement }[] = [
        { id: "system", label: tr.themeSystem, icon: ThemeSystemIcon },
        { id: "dark", label: tr.themeDark, icon: ThemeDarkIcon },
        { id: "light", label: tr.themeLight, icon: ThemeLightIcon },
    ];

    // Shared by phone/bio/avatar visibility - all three are the same three-way choice.
    const visibilityOptions: { id: SettingsState["showPhoneNumber"]; label: string; icon: () => ReactElement }[] = [
        { id: "everyone", label: tr.everyoneOption, icon: EveryoneIcon },
        { id: "contacts", label: tr.myContactsOption, icon: ContactsIcon },
        { id: "nobody", label: tr.nobodyOption, icon: NobodyIcon },
    ];

    const notificationSoundOptions: { id: string; label: string; file: string; icon: () => ReactElement }[] = [
        { id: "bubble", label: tr.soundBubble, file: "/sounds/notification_bubble.mp3", icon: SoundWaveIcon },
        { id: "chime", label: tr.soundChime, file: "/sounds/notification_chime.mp3", icon: SoundWaveIcon },
        { id: "bell", label: tr.soundBell, file: "/sounds/notification_bell.mp3", icon: SoundWaveIcon },
    ];

    const addMeOptions: { id: SettingsState["whoCanAddMe"]; label: string; icon: () => ReactElement }[] = [
        { id: "everyone", label: tr.everyoneOption, icon: EveryoneIcon },
        { id: "contacts", label: tr.myContactsOption, icon: ContactsIcon },
    ];

    const sectionTitles: Record<Section, string> = tr.sectionTitles;

    const [copied, setCopied] = useState(false);
    const [settings, setSettings] = useState<SettingsState>(defaultSettings);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const [avatarNonce, setAvatarNonce] = useState(0);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const myAvatarSrc = getMyAvatarUrl() + (avatarNonce ? `?t=${avatarNonce}` : "");

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

    const [blockedUsers, setBlockedUsers] = useState<UserSearchResult[]>([]);

    const saveTimer = useRef<number | null>(null);
    const pendingFields = useRef<Partial<{ username: string; bio: string; phone: string; email: string }>>({});

    const [notifSaveStatus, setNotifSaveStatus] = useState<SaveStatus>("idle");
    const [privacySaveStatus, setPrivacySaveStatus] = useState<SaveStatus>("idle");
    const [chatsSaveStatus, setChatsSaveStatus] = useState<SaveStatus>("idle");

    const soundCacheRef = useRef<Record<string, HTMLAudioElement>>({});
     
    const privacyApiFieldMap: Record<PrivacyField, keyof UpdatePrivacySettingsRequest> = {
        showLastSeen: "showLastSeen",
        showOnlineStatus: "showOnlineStatus",
        readReceipts: "readReceiptsEnabled",
        showPhoneNumber: "showPhoneNumber",
        showBio: "showBio",
        showAvatar: "showAvatar",
        showEmail: "showEmail",
        whoCanAddMe: "whoCanAddMe",
        totpEnabled: "totpEnabled",
    };

    const chatsApiFieldMap: Record<ChatField, keyof UpdateChatSettingsRequest> = {
        theme: "theme",
        language: "language",
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

    const handleAvatarClick = () => avatarInputRef.current?.click();

    const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setSaveStatus("saving");
        const ok = await uploadMyAvatar(file);
        if (ok) {
            setSaveStatus("saved");
            window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
            setAvatarNonce(Date.now());
            onAvatarChange?.();
        } else {
            setSaveStatus("error");
        }
    };

    const handleRemoveAvatar = async () => {
        setSaveStatus("saving");
        const ok = await deleteMyAvatar();
        if (ok) {
            setSaveStatus("saved");
            window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
            setAvatarNonce(Date.now());
            onAvatarChange?.();
        } else {
            setSaveStatus("error");
        }
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
            const result = await updateAccountFields(fields);
            if (result.ok) {
                setSaveStatus("saved");
                window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
            } else {
                setSaveStatus("error");
            }
        } catch {
            setSaveStatus("error");
        }
    };

    const scheduleSave = (field: "username" | "bio" | "phone" | "email", value: string) => {
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

    const handleEmailChange = (raw: string) => {
        const value = raw.replace(/^\s+/, "");
        patch({ email: value });
        scheduleSave("email", value);
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

            const next = { ...settings, [field]: value };
            onNotificationSettingsChange?.(next.notificationSound, next.notificationsEnabled, next.groupNotifications);
        } catch {
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

    // Turning TOTP on needs a QR code scanned and a code confirmed first, or
    // the account gets locked out of its own login - that setup lives on its
    // own page. Turning it off doesn't need any of that.
    const handleToggleTotp = (checked: boolean) => {
        if (checked) {
            onClose();
            navigate("/2fa/setup");
            return;
        }
        handlePrivacyChange("totpEnabled", false);
    };

    const handleChatSettingChange = async <K extends ChatField>(field: K, value: SettingsState[K]) => {
        const prevValue = settings[field];
        patch({ [field]: value } as Partial<SettingsState>);
        setChatsSaveStatus("saving");

        try {
            await updateChatSettings({ [chatsApiFieldMap[field]]: value });
            if (field === "language") {
                setLanguage(value as Language);
            }
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

            onNotificationSettingsChange?.(soundId, settings.notificationsEnabled, settings.groupNotifications);
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
                    email: data.email,
                    username: data.username,
                    notificationsEnabled: data.notificationsEnabled,
                    groupNotifications: data.groupNotifications,
                    notificationSound: data.notificationSound,
                    totpEnabled: data.totpEnabled,
                    showLastSeen: data.showLastSeen,
                    showOnlineStatus: data.showOnlineStatus,
                    readReceipts: data.readReceiptsEnabled,
                    showPhoneNumber: data.showPhoneNumber,
                    showBio: data.showBio,
                    showAvatar: data.showAvatar,
                    showEmail: data.showEmail,
                    whoCanAddMe: data.whoCanAddMe,
                    theme: data.theme,
                    language: data.language,
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
        getBlockedUsers().then(setBlockedUsers);
    }, []);

    const handleUnblock = async (id: string) => {
        const ok = await unblockUser(id);
        if (ok) setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
    };

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
                                <AvatarImage
                                    src={myAvatarSrc}
                                    fallback={(settingsLoaded ? (settings.username || profile.name) : profile.name).charAt(0).toUpperCase()}
                                />
                            </div>

                           <span className={styles.profileName}>
                                {settingsLoaded ? (settings.username || profile.name) : profile.name}
                            </span>

                            {settingsLoaded && settings.bio && (
                                <span className={styles.profileBio}>{settings.bio}</span>
                            )}
                            <button className={styles.idRow} onClick={handleCopyId} title={tr.copyIdTitle}>
                                <span className={styles.idValue}>{profile.publicId}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                            </button>
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
                                {tr.logOut}
                            </button>
                        </div>
                    </>
                );

            case "account":
                return (
                    <div className={styles.subPage}>
                        <div className={styles.avatarEditRow}>
                            <input
                                type="file"
                                accept="image/*"
                                ref={avatarInputRef}
                                className={styles.hiddenFileInput}
                                onChange={handleAvatarFileSelected}
                            />
                            <div className={styles.avatarEditPic} onClick={handleAvatarClick}>
                                <AvatarImage src={myAvatarSrc} fallback={profile.name.charAt(0).toUpperCase()} />
                                <span className={styles.avatarEditOverlay}>
                                    <CameraIcon />
                                </span>
                            </div>
                            <div className={styles.avatarEditHint}>
                                <span className={styles.avatarEditTitle}>{tr.setNewPhoto}</span>
                                <button className={styles.avatarEditSub} onClick={handleRemoveAvatar}>
                                    {tr.removePhotoButton}
                                </button>
                            </div>

                            <div className={styles.saveStatus}>
                                {saveStatus === "saving" && <span className={styles.saveStatusSaving}>{common.saving}</span>}
                                {saveStatus === "saved" && <span className={styles.saveStatusSaved}>{common.saved}</span>}
                                {saveStatus === "error" && <span className={styles.saveStatusError}>{common.failedToSave}</span>}
                            </div>
                        </div>

                        <label className={styles.fieldLabel}>{tr.usernameLabel}</label>
                        <input
                            className={styles.textInput}
                            type="text"
                            placeholder={settingsLoaded ? tr.usernamePlaceholder : common.loading}
                            value={settings.username}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            maxLength={32}
                            disabled={!settingsLoaded}
                        />

                        <label className={styles.fieldLabel}>{tr.bioLabel}</label>
                        <textarea
                            className={styles.textArea}
                            placeholder={settingsLoaded ? tr.bioPlaceholder : common.loading}
                            value={settings.bio}
                            onChange={(e) => handleBioChange(e.target.value)}
                            rows={3}
                            maxLength={70}
                            disabled={!settingsLoaded}
                        />
                        <p className={styles.fieldHint}>{tr.charactersLeft(70 - settings.bio.length)}</p>

                        <label className={styles.fieldLabel}>{tr.phoneLabel}</label>
                        <input
                            className={styles.textInput}
                            type="tel"
                            inputMode="numeric"
                            placeholder={settingsLoaded ? tr.phonePlaceholder : common.loading}
                            value={settings.phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            disabled={!settingsLoaded}
                        />

                        <label className={styles.fieldLabel}>{tr.emailLabel}</label>
                        <input
                            className={styles.textInput}
                            type="email"
                            placeholder={settingsLoaded ? "you@example.com" : common.loading}
                            value={settings.email}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            disabled={!settingsLoaded}
                        />

                        <span className={styles.dangerTitle}>{tr.dangerZone}</span>
                        <button className={styles.dangerRow} onClick={handleOpenDeleteModal}>
                            <TrashIcon />
                            <span>{tr.deleteMyAccount}</span>
                        </button>
                    </div>
                );

            case "notifications":
                return (
                    <div className={styles.subPage}>
                        <div className={styles.saveStatusRow}>
                            {notifSaveStatus === "saving" && <span className={styles.saveStatusSaving}>{common.saving}</span>}
                            {notifSaveStatus === "saved" && <span className={styles.saveStatusSaved}>{common.saved}</span>}
                            {notifSaveStatus === "error" && <span className={styles.saveStatusError}>{common.failedToSave}</span>}
                        </div>

                        <span className={styles.subGroupTitle}>{tr.messageNotificationsHeading}</span>
                        <label className={styles.row}>
                            <span>{tr.enableNotifications}</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.notificationsEnabled}
                                disabled={!settingsLoaded}
                                onChange={(e) => handleNotificationToggle("notificationsEnabled", e.target.checked)}
                            />
                        </label>
                        <label className={styles.row}>
                            <span>{tr.groupChatNotifications}</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.groupNotifications}
                                disabled={!settingsLoaded || !settings.notificationsEnabled}
                                onChange={(e) => handleNotificationToggle("groupNotifications", e.target.checked)}
                            />
                        </label>

                        <span className={styles.subGroupTitle}>{tr.soundHeading}</span>
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
                            {privacySaveStatus === "saving" && <span className={styles.saveStatusSaving}>{common.saving}</span>}
                            {privacySaveStatus === "saved" && <span className={styles.saveStatusSaved}>{common.saved}</span>}
                            {privacySaveStatus === "error" && <span className={styles.saveStatusError}>{common.failedToSave}</span>}
                        </div>

                        <label className={styles.row}>
                            <span>{tr.enableTotp}</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.totpEnabled}
                                disabled={!settingsLoaded}
                                onChange={(e) => handleToggleTotp(e.target.checked)}
                            />
                        </label>

                        <span className={styles.subGroupTitle}>{tr.presenceHeading}</span>
                        <label className={styles.row}>
                            <span>{tr.showLastSeen}</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.showLastSeen}
                                disabled={!settingsLoaded}
                                onChange={(e) => handlePrivacyChange("showLastSeen", e.target.checked)}
                            />
                        </label>
                        <label className={styles.row}>
                            <span>{tr.showOnlineStatus}</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.showOnlineStatus}
                                disabled={!settingsLoaded}
                                onChange={(e) => handlePrivacyChange("showOnlineStatus", e.target.checked)}
                            />
                        </label>
                        <label className={styles.row}>
                            <span>{tr.sendReadReceipts}</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.readReceipts}
                                disabled={!settingsLoaded}
                                onChange={(e) => handlePrivacyChange("readReceipts", e.target.checked)}
                            />
                        </label>

                        <span className={styles.subGroupTitle}>{tr.whoCanSeePhoneHeading}</span>
                        <div className={styles.chipGroup}>
                            {visibilityOptions.map((opt) => (
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

                        <span className={styles.subGroupTitle}>{tr.whoCanSeeBioHeading}</span>
                        <div className={styles.chipGroup}>
                            {visibilityOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.showBio === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handlePrivacyChange("showBio", opt.id)}
                                >
                                    <span className={styles.chipIcon}>
                                        <opt.icon />
                                    </span>
                                    <span className={styles.chipLabel}>{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        <span className={styles.subGroupTitle}>{tr.whoCanSeePhotoHeading}</span>
                        <div className={styles.chipGroup}>
                            {visibilityOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.showAvatar === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handlePrivacyChange("showAvatar", opt.id)}
                                >
                                    <span className={styles.chipIcon}>
                                        <opt.icon />
                                    </span>
                                    <span className={styles.chipLabel}>{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        <span className={styles.subGroupTitle}>{tr.whoCanSeeEmailHeading}</span>
                        <div className={styles.chipGroup}>
                            {visibilityOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.showEmail === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handlePrivacyChange("showEmail", opt.id)}
                                >
                                    <span className={styles.chipIcon}>
                                        <opt.icon />
                                    </span>
                                    <span className={styles.chipLabel}>{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        <span className={styles.subGroupTitle}>{tr.whoCanAddMeHeading}</span>
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

                        <span className={styles.subGroupTitle}>{tr.sectionTitles.blocked}</span>
                        <button className={styles.blockedEntryRow} onClick={() => navigateTo("blocked")}>
                            <span>{tr.blockedUsersRowLabel}</span>
                            <span className={styles.menuValue}>{blockedUsers.length}</span>
                        </button>
                    </div>
                );

            case "blocked":
                return (
                    <div className={styles.subPage}>
                        {blockedUsers.length === 0 ? (
                            <p className={styles.fieldHint}>{tr.noBlockedUsers}</p>
                        ) : (
                            <ul className={styles.blockedList}>
                                {blockedUsers.map((u) => (
                                    <li key={u.id} className={styles.blockedRow}>
                                        <div className={styles.blockedAvatar}>
                                            <AvatarImage src={getUserAvatarUrl(u.id)} fallback={u.name.charAt(0).toUpperCase()} />
                                        </div>
                                        <span className={styles.blockedName}>{u.name}</span>
                                        <button
                                            className={styles.unblockBtn}
                                            onClick={() => handleUnblock(u.id)}
                                        >
                                            {common.unblock}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );

            case "chats":
                return (
                    <div className={styles.subPage}>
                        <div className={styles.saveStatusRow}>
                            {chatsSaveStatus === "saving" && <span className={styles.saveStatusSaving}>{common.saving}</span>}
                            {chatsSaveStatus === "saved" && <span className={styles.saveStatusSaved}>{common.saved}</span>}
                            {chatsSaveStatus === "error" && <span className={styles.saveStatusError}>{common.failedToSave}</span>}
                        </div>

                        <span className={styles.subGroupTitle}>{tr.themeHeading}</span>
                        <div className={styles.chipGroup}>
                            {themeOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.theme === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handleChatSettingChange("theme", opt.id)}
                                >
                                    <span className={styles.chipIcon}>
                                        <opt.icon />
                                    </span>
                                    <span className={styles.chipLabel}>{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        <span className={styles.subGroupTitle}>{tr.appearanceHeading}</span>
                        <div className={styles.row}>
                            <span>{tr.chatWallpaper}</span>
                            <span className={styles.menuValue}>{settings.wallpaper}</span>
                        </div>
                        <label className={styles.row}>
                            <span>{tr.showLinkPreviews}</span>
                            <input
                                className={styles.switch}
                                type="checkbox"
                                checked={settings.linkPreviews}
                                disabled={!settingsLoaded}
                                onChange={(e) => handleChatSettingChange("linkPreviews", e.target.checked)}
                            />
                        </label>

                        <span className={styles.subGroupTitle}>{tr.dataUsageHeading}</span>
                        <label className={styles.row}>
                            <span>{tr.autoDownloadMediaLabel}</span>
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

            case "language":
                return (
                    <div className={styles.subPage}>
                        <div className={styles.saveStatusRow}>
                            {chatsSaveStatus === "saving" && <span className={styles.saveStatusSaving}>{common.saving}</span>}
                            {chatsSaveStatus === "saved" && <span className={styles.saveStatusSaved}>{common.saved}</span>}
                            {chatsSaveStatus === "error" && <span className={styles.saveStatusError}>{common.failedToSave}</span>}
                        </div>

                        <div className={styles.chipGroup}>
                            {languageOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    className={`${styles.chipButton} ${settings.language === opt.id ? styles.chipButtonActive : ""}`}
                                    disabled={!settingsLoaded}
                                    onClick={() => handleChatSettingChange("language", opt.id)}
                                >
                                    <span className={styles.chipLabel}>{opt.label}</span>
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
                    <button className={styles.closeBtn} onClick={onClose} aria-label={tr.closeProfileAria}>
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