import type { Language } from "./language";

export interface ProfilePanelTranslation {
    sectionTitles: {
        main: string;
        account: string;
        notifications: string;
        privacy: string;
        chats: string;
        language: string;
        blocked: string;
    };
    logOut: string;
    copyIdTitle: string;
    closeProfileAria: string;
    setNewPhoto: string;
    removePhotoButton: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    bioLabel: string;
    bioPlaceholder: string;
    charactersLeft: (n: number) => string;
    phoneLabel: string;
    phonePlaceholder: string;
    emailLabel: string;
    dangerZone: string;
    deleteMyAccount: string;
    messageNotificationsHeading: string;
    enableNotifications: string;
    groupChatNotifications: string;
    soundHeading: string;
    soundBubble: string;
    soundChime: string;
    soundBell: string;
    enableTotp: string;
    presenceHeading: string;
    showLastSeen: string;
    showOnlineStatus: string;
    sendReadReceipts: string;
    whoCanSeePhoneHeading: string;
    whoCanSeeBioHeading: string;
    whoCanSeePhotoHeading: string;
    whoCanSeeEmailHeading: string;
    whoCanAddMeHeading: string;
    blockedUsersRowLabel: string;
    noBlockedUsers: string;
    themeHeading: string;
    themeSystem: string;
    themeDark: string;
    themeLight: string;
    appearanceHeading: string;
    chatWallpaper: string;
    showLinkPreviews: string;
    dataUsageHeading: string;
    autoDownloadMediaLabel: string;
    micHeading: string;
    micDefaultOption: string;
    micPermissionHint: string;
    micMobileLimitationNote: string;
    everyoneOption: string;
    myContactsOption: string;
    nobodyOption: string;
}

export interface DeleteAccountModalTranslation {
    tooManyAttempts: string;
    incorrectPassword: string;
    somethingWrong: string;
    warningTitle: string;
    warningText: string;
    cancel: string;
    continueLabel: string;
    continueWithCountdown: (seconds: number) => string;
    confirmPasswordTitle: string;
    confirmPasswordText: string;
    passwordPlaceholder: string;
    deleting: string;
    deleteAccountButton: string;
}

export const DELETE_ACCOUNT_TRANSLATIONS: Record<Language, DeleteAccountModalTranslation> = {
    en: {
        tooManyAttempts: "Too many attempts. Try again later.",
        incorrectPassword: "Incorrect password",
        somethingWrong: "Something went wrong",
        warningTitle: "Delete Account",
        warningText:
            "This will permanently delete your account, messages, and all associated data. This action cannot be undone.",
        cancel: "Cancel",
        continueLabel: "Continue",
        continueWithCountdown: (s) => `Continue (${s})`,
        confirmPasswordTitle: "Confirm Your Password",
        confirmPasswordText: "Enter your password to permanently delete your account.",
        passwordPlaceholder: "Password",
        deleting: "Deleting...",
        deleteAccountButton: "Delete Account",
    },
    uk: {
        tooManyAttempts: "Занадто багато спроб. Спробуйте пізніше.",
        incorrectPassword: "Неправильний пароль",
        somethingWrong: "Щось пішло не так",
        warningTitle: "Видалення акаунту",
        warningText:
            "Це остаточно видалить ваш акаунт, повідомлення та всі пов'язані дані. Цю дію неможливо скасувати.",
        cancel: "Скасувати",
        continueLabel: "Продовжити",
        continueWithCountdown: (s) => `Продовжити (${s})`,
        confirmPasswordTitle: "Підтвердьте свій пароль",
        confirmPasswordText: "Введіть пароль, щоб остаточно видалити акаунт.",
        passwordPlaceholder: "Пароль",
        deleting: "Видалення...",
        deleteAccountButton: "Видалити акаунт",
    },
    de: {
        tooManyAttempts: "Zu viele Versuche. Versuche es später erneut.",
        incorrectPassword: "Falsches Passwort",
        somethingWrong: "Etwas ist schiefgelaufen",
        warningTitle: "Konto löschen",
        warningText:
            "Dadurch werden dein Konto, deine Nachrichten und alle zugehörigen Daten dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
        cancel: "Abbrechen",
        continueLabel: "Weiter",
        continueWithCountdown: (s) => `Weiter (${s})`,
        confirmPasswordTitle: "Passwort bestätigen",
        confirmPasswordText: "Gib dein Passwort ein, um dein Konto dauerhaft zu löschen.",
        passwordPlaceholder: "Passwort",
        deleting: "Wird gelöscht...",
        deleteAccountButton: "Konto löschen",
    },
};

export const PROFILE_PANEL_TRANSLATIONS: Record<Language, ProfilePanelTranslation> = {
    en: {
        sectionTitles: {
            main: "Profile",
            account: "My Account",
            notifications: "Notifications and Sounds",
            privacy: "Privacy and Security",
            chats: "Chat Settings",
            language: "Language",
            blocked: "Blocked Users",
        },
        logOut: "Log out",
        copyIdTitle: "Copy ID",
        closeProfileAria: "Close profile",
        setNewPhoto: "Set New Photo",
        removePhotoButton: "Remove photo",
        usernameLabel: "Username",
        usernamePlaceholder: "Your username",
        bioLabel: "Bio",
        bioPlaceholder: "Tell something about yourself",
        charactersLeft: (n) => `${n} characters left`,
        phoneLabel: "Phone number",
        phonePlaceholder: "+1...",
        emailLabel: "Email",
        dangerZone: "Danger Zone",
        deleteMyAccount: "Delete My Account",
        messageNotificationsHeading: "Message Notifications",
        enableNotifications: "Enable notifications",
        groupChatNotifications: "Group chat notifications",
        soundHeading: "Sound",
        soundBubble: "Bubble",
        soundChime: "Chime",
        soundBell: "Bell",
        enableTotp: "Enable TOTP",
        presenceHeading: "Presence",
        showLastSeen: "Show last seen",
        showOnlineStatus: "Show online status",
        sendReadReceipts: "Send read receipts",
        whoCanSeePhoneHeading: "Who can see my phone number",
        whoCanSeeBioHeading: "Who can see my bio",
        whoCanSeePhotoHeading: "Who can see my profile photo",
        whoCanSeeEmailHeading: "Who can see my email",
        whoCanAddMeHeading: "Who can add me to chats",
        blockedUsersRowLabel: "Blocked users",
        noBlockedUsers: "No blocked users.",
        themeHeading: "Theme",
        themeSystem: "System",
        themeDark: "Dark",
        themeLight: "Light",
        appearanceHeading: "Appearance",
        chatWallpaper: "Chat wallpaper",
        showLinkPreviews: "Show link previews",
        dataUsageHeading: "Data Usage",
        autoDownloadMediaLabel: "Auto-download media",
        micHeading: "Microphone",
        micDefaultOption: "System default",
        micPermissionHint: "Send a voice message once to see your microphones here",
        micMobileLimitationNote: "On most phone browsers only one generic microphone entry is available here, not each physical device - this only really lets you pick between devices on desktop.",
        everyoneOption: "Everyone",
        myContactsOption: "My Contacts",
        nobodyOption: "Nobody",
    },
    uk: {
        sectionTitles: {
            main: "Профіль",
            account: "Мій акаунт",
            notifications: "Сповіщення та звуки",
            privacy: "Приватність і безпека",
            chats: "Налаштування чату",
            language: "Мова",
            blocked: "Заблоковані користувачі",
        },
        logOut: "Вийти",
        copyIdTitle: "Скопіювати ID",
        closeProfileAria: "Закрити профіль",
        setNewPhoto: "Встановити нове фото",
        removePhotoButton: "Видалити фото",
        usernameLabel: "Ім'я користувача",
        usernamePlaceholder: "Ваше ім'я користувача",
        bioLabel: "Про себе",
        bioPlaceholder: "Розкажіть трохи про себе",
        charactersLeft: (n) => `Залишилось символів: ${n}`,
        phoneLabel: "Номер телефону",
        phonePlaceholder: "+1...",
        emailLabel: "Електронна пошта",
        dangerZone: "Небезпечна зона",
        deleteMyAccount: "Видалити мій акаунт",
        messageNotificationsHeading: "Сповіщення про повідомлення",
        enableNotifications: "Увімкнути сповіщення",
        groupChatNotifications: "Сповіщення групових чатів",
        soundHeading: "Звук",
        soundBubble: "Бульбашка",
        soundChime: "Дзвіночок",
        soundBell: "Дзвінок",
        enableTotp: "Увімкнути TOTP",
        presenceHeading: "Присутність",
        showLastSeen: "Показувати час останнього візиту",
        showOnlineStatus: "Показувати статус онлайн",
        sendReadReceipts: "Надсилати підтвердження прочитання",
        whoCanSeePhoneHeading: "Хто бачить мій номер телефону",
        whoCanSeeBioHeading: "Хто бачить мій опис",
        whoCanSeePhotoHeading: "Хто бачить моє фото профілю",
        whoCanSeeEmailHeading: "Хто бачить мою електронну пошту",
        whoCanAddMeHeading: "Хто може додавати мене до чатів",
        blockedUsersRowLabel: "Заблоковані користувачі",
        noBlockedUsers: "Немає заблокованих користувачів.",
        themeHeading: "Тема",
        themeSystem: "Системна",
        themeDark: "Темна",
        themeLight: "Світла",
        appearanceHeading: "Вигляд",
        chatWallpaper: "Фон чату",
        showLinkPreviews: "Показувати попередній перегляд посилань",
        dataUsageHeading: "Використання даних",
        autoDownloadMediaLabel: "Автозавантаження медіа",
        micHeading: "Мікрофон",
        micDefaultOption: "Системний за замовчуванням",
        micPermissionHint: "Надішліть голосове повідомлення хоча б раз, щоб побачити тут ваші мікрофони",
        micMobileLimitationNote: "У більшості мобільних браузерів тут доступний лише один загальний пункт мікрофона, а не кожен фізичний пристрій окремо - реальний вибір між пристроями працює тільки на комп'ютері.",
        everyoneOption: "Усі",
        myContactsOption: "Мої контакти",
        nobodyOption: "Ніхто",
    },
    de: {
        sectionTitles: {
            main: "Profil",
            account: "Mein Konto",
            notifications: "Benachrichtigungen und Sounds",
            privacy: "Datenschutz und Sicherheit",
            chats: "Chat-Einstellungen",
            language: "Sprache",
            blocked: "Blockierte Nutzer",
        },
        logOut: "Abmelden",
        copyIdTitle: "ID kopieren",
        closeProfileAria: "Profil schließen",
        setNewPhoto: "Neues Foto festlegen",
        removePhotoButton: "Foto entfernen",
        usernameLabel: "Benutzername",
        usernamePlaceholder: "Dein Benutzername",
        bioLabel: "Bio",
        bioPlaceholder: "Erzähl etwas über dich",
        charactersLeft: (n) => `Noch ${n} Zeichen`,
        phoneLabel: "Telefonnummer",
        phonePlaceholder: "+1...",
        emailLabel: "E-Mail",
        dangerZone: "Gefahrenzone",
        deleteMyAccount: "Mein Konto löschen",
        messageNotificationsHeading: "Nachrichtenbenachrichtigungen",
        enableNotifications: "Benachrichtigungen aktivieren",
        groupChatNotifications: "Gruppenchat-Benachrichtigungen",
        soundHeading: "Sound",
        soundBubble: "Blase",
        soundChime: "Glockenspiel",
        soundBell: "Glocke",
        enableTotp: "TOTP aktivieren",
        presenceHeading: "Präsenz",
        showLastSeen: "Zuletzt online anzeigen",
        showOnlineStatus: "Online-Status anzeigen",
        sendReadReceipts: "Lesebestätigungen senden",
        whoCanSeePhoneHeading: "Wer meine Telefonnummer sehen kann",
        whoCanSeeBioHeading: "Wer meine Bio sehen kann",
        whoCanSeePhotoHeading: "Wer mein Profilfoto sehen kann",
        whoCanSeeEmailHeading: "Wer meine E-Mail sehen kann",
        whoCanAddMeHeading: "Wer mich zu Chats hinzufügen kann",
        blockedUsersRowLabel: "Blockierte Nutzer",
        noBlockedUsers: "Keine blockierten Nutzer.",
        themeHeading: "Design",
        themeSystem: "System",
        themeDark: "Dunkel",
        themeLight: "Hell",
        appearanceHeading: "Erscheinungsbild",
        chatWallpaper: "Chat-Hintergrund",
        showLinkPreviews: "Linkvorschauen anzeigen",
        dataUsageHeading: "Datennutzung",
        autoDownloadMediaLabel: "Medien automatisch herunterladen",
        micHeading: "Mikrofon",
        micDefaultOption: "Systemstandard",
        micPermissionHint: "Sende einmal eine Sprachnachricht, um deine Mikrofone hier zu sehen",
        micMobileLimitationNote: "Auf den meisten Handy-Browsern gibt es hier nur einen allgemeinen Mikrofon-Eintrag statt jedes einzelnen Geräts - eine echte Auswahl zwischen Geräten funktioniert nur am Desktop.",
        everyoneOption: "Alle",
        myContactsOption: "Meine Kontakte",
        nobodyOption: "Niemand",
    },
};
