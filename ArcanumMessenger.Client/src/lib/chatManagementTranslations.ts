import type { Language } from "./language";
import type { MediaSkipReason } from "./chatExport";

export interface UserInfoPanelTranslation {
    closeAria: string;
    onlyAcceptsMessagesSuffix: string;
    couldntStartChat: string;
    lastSeenPrefix: string;
    lastSeenAWhileAgo: string;
    messageButton: string;
    removeFromContacts: string;
    addToContacts: string;
    youBlockedUser: string;
    userBlockedYou: string;
    bioLabel: string;
    emailLabel: string;
    phoneLabel: string;
    idLabel: string;
}

export interface MembersManagePanelTranslation {
    backAria: string;
    closeAria: string;
    addMembersTitle: string;
    manageMembersTitle: string;
    ownerBadge: string;
    adminBadge: string;
    removeButton: string;
    findUserPlaceholder: string;
    removeChipAria: (name: string) => string;
    searchResultsHeading: string;
    contactsHeading: string;
    typeAtLeast: (minLength: number) => string;
    noMatches: string;
    noContactsToAdd: string;
    restrictedMembersError: string;
    couldntAddMembers: string;
    adding: string;
    addMembersCount: (count: number) => string;
}

export interface NewChatPanelTranslation {
    backAria: string;
    closeAria: string;
    titleNewChat: string;
    titleAddMembers: string;
    titleNewGroup: string;
    groupNamePlaceholder: string;
    descriptionPlaceholder: string;
    membersSelected: (count: number) => string;
    creatingGroup: string;
    createGroupButton: string;
    findUserPlaceholder: string;
    createAGroupButton: string;
    removeChipAria: (name: string) => string;
    searchResultsHeading: string;
    contactsHeading: string;
    typeAtLeast: (minLength: number) => string;
    noMatches: string;
    noContactsYet: string;
    nextButton: string;
    restrictedGroupMembersError: string;
    couldntCreateGroup: string;
}

export interface ChatInfoPanelTranslation {
    closeAria: string;
    deleteGroupTitle: string;
    deleteGroupText: (title: string) => string;
    deleteGroupButton: string;
    leaveGroupTitle: string;
    leaveGroupText: (title: string) => string;
    leaveGroupButton: string;
    deleteChatTitle: string;
    deleteChatText: string;
    deleteForMe: string;
    deleteForEveryone: string;
    membersCount: (count: number) => string;
    savedMessages: string;
    directChat: string;
    removePhoto: string;
    adminsLabel: string;
    manageMembersLabel: string;
    membersHeading: string;
    ownerBadge: string;
    adminBadge: string;
    lastSeenPrefix: string;
    offlineStatus: string;
    mediaLabel: string;
    noMediaYet: string;
    messagesLabel: string;
    deleteChatButton: string;
    generalTab: string;
    mediaTab: string;
    gifTab: string;
    loadMore: string;
    goToMessage: string;
    deleteMediaMessage: string;
}

export interface AdminListPanelTranslation {
    title: string;
    closeAria: string;
    ownerOnlyNote: string;
    ownerBadge: string;
    adminBadge: string;
    removeButton: string;
    addAdminsHeading: string;
    everyoneIsAdminNote: string;
    addButton: string;
}

export const ADMIN_LIST_TRANSLATIONS: Record<Language, AdminListPanelTranslation> = {
    en: {
        title: "Admins",
        closeAria: "Close",
        ownerOnlyNote: "Only the group owner can add or remove admins.",
        ownerBadge: "owner",
        adminBadge: "admin",
        removeButton: "Remove",
        addAdminsHeading: "Add admins",
        everyoneIsAdminNote: "Everyone in this group is already an admin.",
        addButton: "Add",
    },
    uk: {
        title: "Адміністратори",
        closeAria: "Закрити",
        ownerOnlyNote: "Лише власник групи може додавати чи видаляти адміністраторів.",
        ownerBadge: "власник",
        adminBadge: "адмін",
        removeButton: "Видалити",
        addAdminsHeading: "Додати адміністраторів",
        everyoneIsAdminNote: "Усі учасники цієї групи вже є адміністраторами.",
        addButton: "Додати",
    },
    de: {
        title: "Admins",
        closeAria: "Schließen",
        ownerOnlyNote: "Nur der Gruppeninhaber kann Admins hinzufügen oder entfernen.",
        ownerBadge: "Inhaber",
        adminBadge: "Admin",
        removeButton: "Entfernen",
        addAdminsHeading: "Admins hinzufügen",
        everyoneIsAdminNote: "Alle Mitglieder dieser Gruppe sind bereits Admins.",
        addButton: "Hinzufügen",
    },
};

export const USER_INFO_TRANSLATIONS: Record<Language, UserInfoPanelTranslation> = {
    en: {
        closeAria: "Close",
        onlyAcceptsMessagesSuffix: " only accepts messages from their contacts.",
        couldntStartChat: "Couldn't start this chat.",
        lastSeenPrefix: "Last seen ",
        lastSeenAWhileAgo: "Last seen a while ago",
        messageButton: "Message",
        removeFromContacts: "Remove from contacts",
        addToContacts: "Add to contacts",
        youBlockedUser: "You've blocked this user.",
        userBlockedYou: "This user has blocked you.",
        bioLabel: "Bio",
        emailLabel: "Email",
        phoneLabel: "Phone",
        idLabel: "ID",
    },
    uk: {
        closeAria: "Закрити",
        onlyAcceptsMessagesSuffix: " приймає повідомлення лише від своїх контактів.",
        couldntStartChat: "Не вдалося створити цей чат.",
        lastSeenPrefix: "Був(ла) в мережі ",
        lastSeenAWhileAgo: "Був(ла) в мережі давно",
        messageButton: "Повідомлення",
        removeFromContacts: "Видалити з контактів",
        addToContacts: "Додати до контактів",
        youBlockedUser: "Ви заблокували цього користувача.",
        userBlockedYou: "Цей користувач заблокував вас.",
        bioLabel: "Про себе",
        emailLabel: "Email",
        phoneLabel: "Телефон",
        idLabel: "ID",
    },
    de: {
        closeAria: "Schließen",
        onlyAcceptsMessagesSuffix: " akzeptiert nur Nachrichten von Kontakten.",
        couldntStartChat: "Dieser Chat konnte nicht gestartet werden.",
        lastSeenPrefix: "Zuletzt online ",
        lastSeenAWhileAgo: "Zuletzt vor einer Weile online",
        messageButton: "Nachricht",
        removeFromContacts: "Aus Kontakten entfernen",
        addToContacts: "Zu Kontakten hinzufügen",
        youBlockedUser: "Du hast diesen Nutzer blockiert.",
        userBlockedYou: "Dieser Nutzer hat dich blockiert.",
        bioLabel: "Bio",
        emailLabel: "E-Mail",
        phoneLabel: "Telefon",
        idLabel: "ID",
    },
};

export const MEMBERS_MANAGE_TRANSLATIONS: Record<Language, MembersManagePanelTranslation> = {
    en: {
        backAria: "Back",
        closeAria: "Close",
        addMembersTitle: "Add members",
        manageMembersTitle: "Manage members",
        ownerBadge: "owner",
        adminBadge: "admin",
        removeButton: "Remove",
        findUserPlaceholder: "Find a user by ID",
        removeChipAria: (name) => `Remove ${name}`,
        searchResultsHeading: "Search results",
        contactsHeading: "Contacts",
        typeAtLeast: (n) => `Type at least ${n} characters of the ID.`,
        noMatches: "No matches.",
        noContactsToAdd: "No contacts to add.",
        restrictedMembersError: "Someone you picked only accepts adds from their contacts.",
        couldntAddMembers: "Couldn't add these members.",
        adding: "Adding…",
        addMembersCount: (count) =>
            count > 0 ? `Add ${count} member${count === 1 ? "" : "s"}` : "Add members",
    },
    uk: {
        backAria: "Назад",
        closeAria: "Закрити",
        addMembersTitle: "Додати учасників",
        manageMembersTitle: "Керування учасниками",
        ownerBadge: "власник",
        adminBadge: "адмін",
        removeButton: "Видалити",
        findUserPlaceholder: "Знайти користувача за ID",
        removeChipAria: (name) => `Видалити ${name}`,
        searchResultsHeading: "Результати пошуку",
        contactsHeading: "Контакти",
        typeAtLeast: (n) => `Введіть щонайменше ${n} символи ID.`,
        noMatches: "Немає збігів.",
        noContactsToAdd: "Немає контактів для додавання.",
        restrictedMembersError: "Хтось із вибраних приймає додавання лише від своїх контактів.",
        couldntAddMembers: "Не вдалося додати цих учасників.",
        adding: "Додавання…",
        addMembersCount: (count) =>
            count > 0
                ? `Додати ${count} ${count % 10 === 1 && count % 100 !== 11 ? "учасника" : "учасників"}`
                : "Додати учасників",
    },
    de: {
        backAria: "Zurück",
        closeAria: "Schließen",
        addMembersTitle: "Mitglieder hinzufügen",
        manageMembersTitle: "Mitglieder verwalten",
        ownerBadge: "Inhaber",
        adminBadge: "Admin",
        removeButton: "Entfernen",
        findUserPlaceholder: "Nutzer per ID finden",
        removeChipAria: (name) => `${name} entfernen`,
        searchResultsHeading: "Suchergebnisse",
        contactsHeading: "Kontakte",
        typeAtLeast: (n) => `Gib mindestens ${n} Zeichen der ID ein.`,
        noMatches: "Keine Treffer.",
        noContactsToAdd: "Keine Kontakte zum Hinzufügen.",
        restrictedMembersError: "Jemand, den du ausgewählt hast, akzeptiert nur Einladungen von Kontakten.",
        couldntAddMembers: "Diese Mitglieder konnten nicht hinzugefügt werden.",
        adding: "Wird hinzugefügt…",
        addMembersCount: (count) =>
            count > 0
                ? `${count} ${count === 1 ? "Mitglied" : "Mitglieder"} hinzufügen`
                : "Mitglieder hinzufügen",
    },
};

function ukMemberWordAccusative(count: number): string {
    return count % 10 === 1 && count % 100 !== 11 ? "учасника" : "учасників";
}

function ukMemberWordNominative(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "учасник";
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "учасники";
    return "учасників";
}

export const NEW_CHAT_TRANSLATIONS: Record<Language, NewChatPanelTranslation> = {
    en: {
        backAria: "Back",
        closeAria: "Close",
        titleNewChat: "New chat",
        titleAddMembers: "Add members",
        titleNewGroup: "New group",
        groupNamePlaceholder: "Group name",
        descriptionPlaceholder: "Description (optional)",
        membersSelected: (count) => `${count} member${count === 1 ? "" : "s"} selected`,
        creatingGroup: "Creating…",
        createGroupButton: "Create group",
        findUserPlaceholder: "Find a user by ID",
        createAGroupButton: "Create a group",
        removeChipAria: (name) => `Remove ${name}`,
        searchResultsHeading: "Search results",
        contactsHeading: "Contacts",
        typeAtLeast: (n) => `Type at least ${n} characters of the ID.`,
        noMatches: "No matches.",
        noContactsYet: "No contacts yet – find someone by ID above.",
        nextButton: "Next",
        restrictedGroupMembersError: "Someone in this group only accepts chats from their contacts.",
        couldntCreateGroup: "Couldn't create this group.",
    },
    uk: {
        backAria: "Назад",
        closeAria: "Закрити",
        titleNewChat: "Новий чат",
        titleAddMembers: "Додати учасників",
        titleNewGroup: "Нова група",
        groupNamePlaceholder: "Назва групи",
        descriptionPlaceholder: "Опис (необов'язково)",
        membersSelected: (count) => `Вибрано ${count} ${ukMemberWordAccusative(count)}`,
        creatingGroup: "Створення…",
        createGroupButton: "Створити групу",
        findUserPlaceholder: "Знайти користувача за ID",
        createAGroupButton: "Створити групу",
        removeChipAria: (name) => `Видалити ${name}`,
        searchResultsHeading: "Результати пошуку",
        contactsHeading: "Контакти",
        typeAtLeast: (n) => `Введіть щонайменше ${n} символи ID.`,
        noMatches: "Немає збігів.",
        noContactsYet: "Ще немає контактів – знайдіть когось за ID вище.",
        nextButton: "Далі",
        restrictedGroupMembersError: "Хтось у цій групі приймає чати лише від своїх контактів.",
        couldntCreateGroup: "Не вдалося створити цю групу.",
    },
    de: {
        backAria: "Zurück",
        closeAria: "Schließen",
        titleNewChat: "Neuer Chat",
        titleAddMembers: "Mitglieder hinzufügen",
        titleNewGroup: "Neue Gruppe",
        groupNamePlaceholder: "Gruppenname",
        descriptionPlaceholder: "Beschreibung (optional)",
        membersSelected: (count) => `${count} ${count === 1 ? "Mitglied" : "Mitglieder"} ausgewählt`,
        creatingGroup: "Wird erstellt…",
        createGroupButton: "Gruppe erstellen",
        findUserPlaceholder: "Nutzer per ID finden",
        createAGroupButton: "Gruppe erstellen",
        removeChipAria: (name) => `${name} entfernen`,
        searchResultsHeading: "Suchergebnisse",
        contactsHeading: "Kontakte",
        typeAtLeast: (n) => `Gib mindestens ${n} Zeichen der ID ein.`,
        noMatches: "Keine Treffer.",
        noContactsYet: "Noch keine Kontakte – finde oben jemanden per ID.",
        nextButton: "Weiter",
        restrictedGroupMembersError: "Jemand in dieser Gruppe akzeptiert nur Chats von Kontakten.",
        couldntCreateGroup: "Diese Gruppe konnte nicht erstellt werden.",
    },
};

export const CHAT_INFO_TRANSLATIONS: Record<Language, ChatInfoPanelTranslation> = {
    en: {
        closeAria: "Close",
        deleteGroupTitle: "Delete group?",
        deleteGroupText: (title) => `This deletes "${title}" for everyone in it.`,
        deleteGroupButton: "Delete group",
        leaveGroupTitle: "Leave group?",
        leaveGroupText: (title) => `You won't receive messages from "${title}" anymore.`,
        leaveGroupButton: "Leave group",
        deleteChatTitle: "Delete chat?",
        deleteChatText: "Choose who this disappears for.",
        deleteForMe: "Delete for me",
        deleteForEveryone: "Delete for everyone",
        membersCount: (count) => `${count} member${count === 1 ? "" : "s"}`,
        savedMessages: "Saved Messages",
        directChat: "Direct chat",
        removePhoto: "Remove photo",
        adminsLabel: "Admins",
        manageMembersLabel: "Manage members",
        membersHeading: "Members",
        ownerBadge: "owner",
        adminBadge: "admin",
        lastSeenPrefix: "last seen ",
        offlineStatus: "offline",
        mediaLabel: "Media",
        noMediaYet: "No media yet",
        messagesLabel: "Messages",
        deleteChatButton: "Delete chat",
        generalTab: "General",
        mediaTab: "Media",
        gifTab: "GIF",
        loadMore: "Load more",
        goToMessage: "Go to message",
        deleteMediaMessage: "Delete",
    },
    uk: {
        closeAria: "Закрити",
        deleteGroupTitle: "Видалити групу?",
        deleteGroupText: (title) => `Це видалить «${title}» для всіх учасників.`,
        deleteGroupButton: "Видалити групу",
        leaveGroupTitle: "Вийти з групи?",
        leaveGroupText: (title) => `Ви більше не отримуватимете повідомлення з «${title}».`,
        leaveGroupButton: "Вийти з групи",
        deleteChatTitle: "Видалити чат?",
        deleteChatText: "Виберіть, для кого це зникне.",
        deleteForMe: "Видалити для мене",
        deleteForEveryone: "Видалити для всіх",
        membersCount: (count) => `${count} ${ukMemberWordNominative(count)}`,
        savedMessages: "Збережені повідомлення",
        directChat: "Особистий чат",
        removePhoto: "Видалити фото",
        adminsLabel: "Адміністратори",
        manageMembersLabel: "Керування учасниками",
        membersHeading: "Учасники",
        ownerBadge: "власник",
        adminBadge: "адмін",
        lastSeenPrefix: "був(ла) в мережі ",
        offlineStatus: "офлайн",
        mediaLabel: "Медіа",
        noMediaYet: "Ще немає медіа",
        messagesLabel: "Повідомлення",
        deleteChatButton: "Видалити чат",
        generalTab: "Загальне",
        mediaTab: "Медіа",
        gifTab: "GIF",
        loadMore: "Завантажити ще",
        goToMessage: "До повідомлення",
        deleteMediaMessage: "Видалити",
    },
    de: {
        closeAria: "Schließen",
        deleteGroupTitle: "Gruppe löschen?",
        deleteGroupText: (title) => `Dadurch wird „${title}" für alle Mitglieder gelöscht.`,
        deleteGroupButton: "Gruppe löschen",
        leaveGroupTitle: "Gruppe verlassen?",
        leaveGroupText: (title) => `Du erhältst keine Nachrichten mehr von „${title}".`,
        leaveGroupButton: "Gruppe verlassen",
        deleteChatTitle: "Chat löschen?",
        deleteChatText: "Wähle, für wen dieser Chat verschwinden soll.",
        deleteForMe: "Für mich löschen",
        deleteForEveryone: "Für alle löschen",
        membersCount: (count) => `${count} ${count === 1 ? "Mitglied" : "Mitglieder"}`,
        savedMessages: "Gespeicherte Nachrichten",
        directChat: "Direktnachricht",
        removePhoto: "Foto entfernen",
        adminsLabel: "Admins",
        manageMembersLabel: "Mitglieder verwalten",
        membersHeading: "Mitglieder",
        ownerBadge: "Inhaber",
        adminBadge: "Admin",
        lastSeenPrefix: "zuletzt online ",
        offlineStatus: "offline",
        mediaLabel: "Medien",
        noMediaYet: "Noch keine Medien",
        messagesLabel: "Nachrichten",
        deleteChatButton: "Chat löschen",
        generalTab: "Allgemein",
        mediaTab: "Medien",
        gifTab: "GIF",
        loadMore: "Mehr laden",
        goToMessage: "Zur Nachricht",
        deleteMediaMessage: "Löschen",
    },
};

export interface ChatExportTranslation {
    exportChatButton: string;
    title: string;
    formatLabel: string;
    formatHtml: string;
    formatJson: string;
    formatBoth: string;
    mediaLabel: string;
    photos: string;
    videos: string;
    voice: string;
    files: string;
    gifs: string;
    sizeLimitLabel: string;
    sizeLimitMb: (mb: number) => string;
    noLimit: string;
    passwordToggle: string;
    passwordPlaceholder: string;
    passwordHint: string;
    cancel: string;
    exportButton: string;
    exportingTitle: string;
    exportingMessages: (done: number, total: number | null) => string;
    exportingMedia: (done: number, total: number | null) => string;
    packing: string;
    cancelExport: string;
    doneTitle: string;
    doneText: string;
    failedTitle: string;
    failedText: string;
    close: string;
    // inside the exported messages.html
    htmlMessageCount: (count: number) => string;
    htmlExportedAt: (date: string) => string;
    htmlSkipped: Record<MediaSkipReason, string>;
}

const countOf = (done: number, total: number | null) => (total === null ? `${done}` : `${done} / ${total}`);

export const CHAT_EXPORT_TRANSLATIONS: Record<Language, ChatExportTranslation> = {
    en: {
        exportChatButton: "Export chat history",
        title: "Export chat history",
        formatLabel: "Format",
        formatHtml: "HTML",
        formatJson: "JSON",
        formatBoth: "Both",
        mediaLabel: "Include media",
        photos: "Photos",
        videos: "Videos",
        voice: "Voice messages",
        files: "Files",
        gifs: "GIFs",
        sizeLimitLabel: "Max file size",
        sizeLimitMb: (mb) => `${mb} MB`,
        noLimit: "No limit",
        passwordToggle: "Protect with a password",
        passwordPlaceholder: "Password",
        passwordHint: "Opens in 7-Zip, WinRAR or Keka - not in the system's built-in unzip.",
        cancel: "Cancel",
        exportButton: "Export",
        exportingTitle: "Exporting...",
        exportingMessages: (done, total) => `Messages: ${countOf(done, total)}`,
        exportingMedia: (done, total) => `Media: ${countOf(done, total)}`,
        packing: "Packing the archive...",
        cancelExport: "Cancel export",
        doneTitle: "Export ready",
        doneText: "The archive has been saved to your downloads.",
        failedTitle: "Export failed",
        failedText: "Something went wrong while exporting. Please try again.",
        close: "Close",
        htmlMessageCount: (count) => `Messages: ${count}`,
        htmlExportedAt: (date) => `Exported ${date}`,
        htmlSkipped: {
            not_selected: "Not included in the export",
            too_large: "Over the file size limit",
            download_failed: "Could not be downloaded",
        },
    },
    uk: {
        exportChatButton: "Експортувати історію чату",
        title: "Експорт історії чату",
        formatLabel: "Формат",
        formatHtml: "HTML",
        formatJson: "JSON",
        formatBoth: "Обидва",
        mediaLabel: "Включити медіа",
        photos: "Фото",
        videos: "Відео",
        voice: "Голосові повідомлення",
        files: "Файли",
        gifs: "GIF",
        sizeLimitLabel: "Макс. розмір файлу",
        sizeLimitMb: (mb) => `${mb} МБ`,
        noLimit: "Без обмежень",
        passwordToggle: "Захистити паролем",
        passwordPlaceholder: "Пароль",
        passwordHint: "Відкривається в 7-Zip, WinRAR або Keka - не вбудованим архіватором системи.",
        cancel: "Скасувати",
        exportButton: "Експортувати",
        exportingTitle: "Експорт...",
        exportingMessages: (done, total) => `Повідомлення: ${countOf(done, total)}`,
        exportingMedia: (done, total) => `Медіа: ${countOf(done, total)}`,
        packing: "Пакування архіву...",
        cancelExport: "Скасувати експорт",
        doneTitle: "Експорт готовий",
        doneText: "Архів збережено в завантаження.",
        failedTitle: "Не вдалося експортувати",
        failedText: "Під час експорту щось пішло не так. Спробуйте ще раз.",
        close: "Закрити",
        htmlMessageCount: (count) => `Повідомлень: ${count}`,
        htmlExportedAt: (date) => `Експортовано ${date}`,
        htmlSkipped: {
            not_selected: "Не включено в експорт",
            too_large: "Більше за ліміт розміру",
            download_failed: "Не вдалося завантажити",
        },
    },
    de: {
        exportChatButton: "Chatverlauf exportieren",
        title: "Chatverlauf exportieren",
        formatLabel: "Format",
        formatHtml: "HTML",
        formatJson: "JSON",
        formatBoth: "Beides",
        mediaLabel: "Medien einschließen",
        photos: "Fotos",
        videos: "Videos",
        voice: "Sprachnachrichten",
        files: "Dateien",
        gifs: "GIFs",
        sizeLimitLabel: "Max. Dateigröße",
        sizeLimitMb: (mb) => `${mb} MB`,
        noLimit: "Keine Begrenzung",
        passwordToggle: "Mit Passwort schützen",
        passwordPlaceholder: "Passwort",
        passwordHint: "Lässt sich mit 7-Zip, WinRAR oder Keka öffnen - nicht mit dem integrierten Entpacker des Systems.",
        cancel: "Abbrechen",
        exportButton: "Exportieren",
        exportingTitle: "Wird exportiert...",
        exportingMessages: (done, total) => `Nachrichten: ${countOf(done, total)}`,
        exportingMedia: (done, total) => `Medien: ${countOf(done, total)}`,
        packing: "Archiv wird gepackt...",
        cancelExport: "Export abbrechen",
        doneTitle: "Export fertig",
        doneText: "Das Archiv wurde in deinen Downloads gespeichert.",
        failedTitle: "Export fehlgeschlagen",
        failedText: "Beim Exportieren ist etwas schiefgelaufen. Bitte versuche es erneut.",
        close: "Schließen",
        htmlMessageCount: (count) => `Nachrichten: ${count}`,
        htmlExportedAt: (date) => `Exportiert am ${date}`,
        htmlSkipped: {
            not_selected: "Nicht im Export enthalten",
            too_large: "Über der Größenbeschränkung",
            download_failed: "Konnte nicht heruntergeladen werden",
        },
    },
};
