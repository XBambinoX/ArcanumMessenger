import type { Language } from "./language";

export interface AppCommonTranslation {
    cancel: string;
    delete: string;
    close: string;
    save: string;
    saving: string;
    saved: string;
    failedToSave: string;
    add: string;
    remove: string;
    block: string;
    unblock: string;
    search: string;
    loading: string;
    online: string;
    offline: string;
    today: string;
    yesterday: string;
    photo: string;
    video: string;
    file: string;
    gif: string;
    reply: string;
    forward: string;
    edit: string;
    select: string;
    send: string;
    copyText: string;
    somethingWentWrong: string;
}

export interface AppChromeTranslation {
    folderAll: string;
    folderUnread: string;
    folderArchive: string;
    searchPlaceholder: string;
    profileAria: string;
    newChatAria: string;
    emptyStateText: string;
}

export interface ChatListTranslation {
    noChatsYet: string;
    noMessagesYet: string;
    archiveAria: string;
    unarchiveAria: string;
}

export const APP_COMMON: Record<Language, AppCommonTranslation> = {
    en: {
        cancel: "Cancel",
        delete: "Delete",
        close: "Close",
        save: "Save",
        saving: "Saving…",
        saved: "Saved",
        failedToSave: "Failed to save",
        add: "Add",
        remove: "Remove",
        block: "Block",
        unblock: "Unblock",
        search: "Search",
        loading: "Loading…",
        online: "online",
        offline: "offline",
        today: "Today",
        yesterday: "Yesterday",
        photo: "Photo",
        video: "Video",
        file: "File",
        gif: "GIF",
        reply: "Reply",
        forward: "Forward",
        edit: "Edit",
        select: "Select",
        send: "Send",
        copyText: "Copy text",
        somethingWentWrong: "Something went wrong",
    },
    uk: {
        cancel: "Скасувати",
        delete: "Видалити",
        close: "Закрити",
        save: "Зберегти",
        saving: "Збереження…",
        saved: "Збережено",
        failedToSave: "Не вдалося зберегти",
        add: "Додати",
        remove: "Видалити",
        block: "Заблокувати",
        unblock: "Розблокувати",
        search: "Пошук",
        loading: "Завантаження…",
        online: "онлайн",
        offline: "офлайн",
        today: "Сьогодні",
        yesterday: "Вчора",
        photo: "Фото",
        video: "Відео",
        file: "Файл",
        gif: "GIF",
        reply: "Відповісти",
        forward: "Переслати",
        edit: "Редагувати",
        select: "Вибрати",
        send: "Надіслати",
        copyText: "Скопіювати текст",
        somethingWentWrong: "Щось пішло не так",
    },
    de: {
        cancel: "Abbrechen",
        delete: "Löschen",
        close: "Schließen",
        save: "Speichern",
        saving: "Wird gespeichert…",
        saved: "Gespeichert",
        failedToSave: "Speichern fehlgeschlagen",
        add: "Hinzufügen",
        remove: "Entfernen",
        block: "Blockieren",
        unblock: "Entblocken",
        search: "Suche",
        loading: "Wird geladen…",
        online: "online",
        offline: "offline",
        today: "Heute",
        yesterday: "Gestern",
        photo: "Foto",
        video: "Video",
        file: "Datei",
        gif: "GIF",
        reply: "Antworten",
        forward: "Weiterleiten",
        edit: "Bearbeiten",
        select: "Auswählen",
        send: "Senden",
        copyText: "Text kopieren",
        somethingWentWrong: "Etwas ist schiefgelaufen",
    },
};

export const APP_CHROME: Record<Language, AppChromeTranslation> = {
    en: {
        folderAll: "All",
        folderUnread: "Unread",
        folderArchive: "Archive",
        searchPlaceholder: "Search",
        profileAria: "Profile",
        newChatAria: "New chat",
        emptyStateText: "Select a chat to start messaging",
    },
    uk: {
        folderAll: "Усі",
        folderUnread: "Непрочитані",
        folderArchive: "Архів",
        searchPlaceholder: "Пошук",
        profileAria: "Профіль",
        newChatAria: "Новий чат",
        emptyStateText: "Виберіть чат, щоб почати спілкування",
    },
    de: {
        folderAll: "Alle",
        folderUnread: "Ungelesen",
        folderArchive: "Archiv",
        searchPlaceholder: "Suche",
        profileAria: "Profil",
        newChatAria: "Neuer Chat",
        emptyStateText: "Wähle einen Chat, um zu schreiben",
    },
};

export const CHAT_LIST_TRANSLATIONS: Record<Language, ChatListTranslation> = {
    en: {
        noChatsYet: "No chats here yet",
        noMessagesYet: "No messages yet",
        archiveAria: "Archive",
        unarchiveAria: "Unarchive",
    },
    uk: {
        noChatsYet: "Тут ще немає чатів",
        noMessagesYet: "Ще немає повідомлень",
        archiveAria: "Архівувати",
        unarchiveAria: "Розархівувати",
    },
    de: {
        noChatsYet: "Hier gibt es noch keine Chats",
        noMessagesYet: "Noch keine Nachrichten",
        archiveAria: "Archivieren",
        unarchiveAria: "Aus Archiv holen",
    },
};
