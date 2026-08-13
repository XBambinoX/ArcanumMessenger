import type { Language } from "./language";

export interface ChatWindowTranslation {
    groupChatSubtitle: string;
    onlyVisibleToYou: string;
    lastSeenPrefix: string;
    chatInfoAria: string;
    backAria: string;
    noMessagesYet: string;
    forwardedFromPrefix: string;
    cancelSelectionAria: string;
    selectedCount: (count: number) => string;
    copyButton: string;
    youCantSendMessages: string;
    editingMessage: string;
    cancelEditAria: string;
    cancelReplyAria: string;
    uploading: string;
    cancelUploadAria: string;
    recordVoiceAria: string;
    recordVideoNoteAria: string;
    cancelRecordingAria: string;
    sendRecordingAria: string;
    micPermissionDenied: string;
    cameraPermissionDenied: string;
    micNotFound: string;
    cameraNotFound: string;
    micInUse: string;
    cameraInUse: string;
    flipCameraAria: string;
    sendAsGif: string;
    removeAttachmentAria: string;
    attachFileAria: string;
    savedGifsAria: string;
    emojiAria: string;
    messagePlaceholder: string;
    editedLabel: string;
    removeFromGifs: string;
    saveToGifs: string;
    saveAs: string;
    deleteMessage: string;
}

export interface GifPickerTranslation {
    title: string;
    closeAria: string;
    noGifsYet: string;
    removeFromGifs: string;
}

export interface ForwardPanelTranslation {
    title: string;
    closeAria: string;
    noChatsYet: string;
}

export interface EmojiCategoryLabels {
    frequent: string;
    smileys: string;
    people: string;
    animals: string;
    food: string;
    travel: string;
    activities: string;
    objects: string;
    symbols: string;
    flags: string;
}

export interface EmojiPickerTranslation {
    closeAria: string;
    categories: EmojiCategoryLabels;
}

export const GIF_PICKER_TRANSLATIONS: Record<Language, GifPickerTranslation> = {
    en: {
        title: "Saved GIFs",
        closeAria: "Close",
        noGifsYet:
            "No saved GIFs yet - send or receive one, then save it from the chat to see it here.",
        removeFromGifs: "Remove from GIFs",
    },
    uk: {
        title: "Збережені GIF",
        closeAria: "Закрити",
        noGifsYet:
            "Ще немає збережених GIF – надішліть або отримайте один, а потім збережіть його з чату, щоб побачити тут.",
        removeFromGifs: "Видалити з GIF",
    },
    de: {
        title: "Gespeicherte GIFs",
        closeAria: "Schließen",
        noGifsYet:
            "Noch keine gespeicherten GIFs – sende oder empfange eines und speichere es aus dem Chat, um es hier zu sehen.",
        removeFromGifs: "Aus GIFs entfernen",
    },
};

export const FORWARD_PANEL_TRANSLATIONS: Record<Language, ForwardPanelTranslation> = {
    en: {
        title: "Forward to…",
        closeAria: "Close",
        noChatsYet: "No chats to forward to yet",
    },
    uk: {
        title: "Переслати до…",
        closeAria: "Закрити",
        noChatsYet: "Ще немає чатів для пересилання",
    },
    de: {
        title: "Weiterleiten an…",
        closeAria: "Schließen",
        noChatsYet: "Noch keine Chats zum Weiterleiten",
    },
};

export const EMOJI_PICKER_TRANSLATIONS: Record<Language, EmojiPickerTranslation> = {
    en: {
        closeAria: "Close",
        categories: {
            frequent: "Frequently Used",
            smileys: "Smileys",
            people: "People & Body",
            animals: "Animals & Nature",
            food: "Food & Drink",
            travel: "Travel & Places",
            activities: "Activities",
            objects: "Objects",
            symbols: "Symbols",
            flags: "Flags",
        },
    },
    uk: {
        closeAria: "Закрити",
        categories: {
            frequent: "Часто використовувані",
            smileys: "Смайли",
            people: "Люди",
            animals: "Тварини й природа",
            food: "Їжа й напої",
            travel: "Подорожі й місця",
            activities: "Активності",
            objects: "Предмети",
            symbols: "Символи",
            flags: "Прапори",
        },
    },
    de: {
        closeAria: "Schließen",
        categories: {
            frequent: "Häufig verwendet",
            smileys: "Smileys",
            people: "Menschen",
            animals: "Tiere & Natur",
            food: "Essen & Trinken",
            travel: "Reisen & Orte",
            activities: "Aktivitäten",
            objects: "Objekte",
            symbols: "Symbole",
            flags: "Flaggen",
        },
    },
};

export const CHAT_WINDOW_TRANSLATIONS: Record<Language, ChatWindowTranslation> = {
    en: {
        groupChatSubtitle: "group chat",
        onlyVisibleToYou: "only visible to you",
        lastSeenPrefix: "last seen ",
        chatInfoAria: "Chat info",
        backAria: "Back",
        noMessagesYet: "No messages yet",
        forwardedFromPrefix: "Forwarded from ",
        cancelSelectionAria: "Cancel selection",
        selectedCount: (count) => `${count} selected`,
        copyButton: "Copy",
        youCantSendMessages: "You can't send messages in this chat",
        editingMessage: "Editing message",
        cancelEditAria: "Cancel edit",
        cancelReplyAria: "Cancel reply",
        uploading: "Uploading…",
        cancelUploadAria: "Cancel upload",
        recordVoiceAria: "Record voice message",
        recordVideoNoteAria: "Record video message",
        cancelRecordingAria: "Cancel recording",
        sendRecordingAria: "Send voice message",
        micPermissionDenied: "Microphone access is blocked - check your browser's site settings, and on phones also your system Settings app's permissions for this browser",
        cameraPermissionDenied: "Camera access is blocked - check your browser's site settings, and on phones also your system Settings app's permissions for this browser",
        micNotFound: "No microphone found",
        cameraNotFound: "No camera found",
        micInUse: "The microphone is being used by another app",
        cameraInUse: "The camera is being used by another app",
        flipCameraAria: "Flip camera",
        sendAsGif: "Send as GIF",
        removeAttachmentAria: "Remove attachment",
        attachFileAria: "Attach file",
        savedGifsAria: "Saved GIFs",
        emojiAria: "Emoji",
        messagePlaceholder: "Message",
        editedLabel: "edited",
        removeFromGifs: "Remove from GIFs",
        saveToGifs: "Save to GIFs",
        saveAs: "Save as…",
        deleteMessage: "Delete message",
    },
    uk: {
        groupChatSubtitle: "групповий чат",
        onlyVisibleToYou: "видно лише вам",
        lastSeenPrefix: "був(ла) в мережі ",
        chatInfoAria: "Інформація про чат",
        backAria: "Назад",
        noMessagesYet: "Ще немає повідомлень",
        forwardedFromPrefix: "Переслано від ",
        cancelSelectionAria: "Скасувати вибір",
        selectedCount: (count) => `Вибрано ${count}`,
        copyButton: "Копіювати",
        youCantSendMessages: "Ви не можете надсилати повідомлення в цьому чаті",
        editingMessage: "Редагування повідомлення",
        cancelEditAria: "Скасувати редагування",
        cancelReplyAria: "Скасувати відповідь",
        uploading: "Завантаження…",
        cancelUploadAria: "Скасувати завантаження",
        recordVoiceAria: "Записати голосове повідомлення",
        recordVideoNoteAria: "Записати відеоповідомлення",
        cancelRecordingAria: "Скасувати запис",
        sendRecordingAria: "Надіслати голосове повідомлення",
        micPermissionDenied: "Доступ до мікрофона заблоковано - перевірте налаштування сайту в браузері, а на телефоні ще й дозволи браузера в системних налаштуваннях",
        cameraPermissionDenied: "Доступ до камери заблоковано - перевірте налаштування сайту в браузері, а на телефоні ще й дозволи браузера в системних налаштуваннях",
        micNotFound: "Мікрофон не знайдено",
        cameraNotFound: "Камеру не знайдено",
        micInUse: "Мікрофон використовується іншим застосунком",
        cameraInUse: "Камера використовується іншим застосунком",
        flipCameraAria: "Перемкнути камеру",
        sendAsGif: "Надіслати як GIF",
        removeAttachmentAria: "Видалити вкладення",
        attachFileAria: "Прикріпити файл",
        savedGifsAria: "Збережені GIF",
        emojiAria: "Емодзі",
        messagePlaceholder: "Повідомлення",
        editedLabel: "змінено",
        removeFromGifs: "Видалити з GIF",
        saveToGifs: "Зберегти в GIF",
        saveAs: "Зберегти як…",
        deleteMessage: "Видалити повідомлення",
    },
    de: {
        groupChatSubtitle: "Gruppenchat",
        onlyVisibleToYou: "nur für dich sichtbar",
        lastSeenPrefix: "zuletzt online ",
        chatInfoAria: "Chat-Info",
        backAria: "Zurück",
        noMessagesYet: "Noch keine Nachrichten",
        forwardedFromPrefix: "Weitergeleitet von ",
        cancelSelectionAria: "Auswahl abbrechen",
        selectedCount: (count) => `${count} ausgewählt`,
        copyButton: "Kopieren",
        youCantSendMessages: "Du kannst in diesem Chat keine Nachrichten senden",
        editingMessage: "Nachricht wird bearbeitet",
        cancelEditAria: "Bearbeitung abbrechen",
        cancelReplyAria: "Antwort abbrechen",
        uploading: "Wird hochgeladen…",
        cancelUploadAria: "Upload abbrechen",
        recordVoiceAria: "Sprachnachricht aufnehmen",
        recordVideoNoteAria: "Videonachricht aufnehmen",
        cancelRecordingAria: "Aufnahme abbrechen",
        sendRecordingAria: "Sprachnachricht senden",
        micPermissionDenied: "Mikrofonzugriff ist blockiert - prüfe die Website-Einstellungen deines Browsers und auf dem Handy zusätzlich die Berechtigungen des Browsers in den Systemeinstellungen",
        cameraPermissionDenied: "Kamerazugriff ist blockiert - prüfe die Website-Einstellungen deines Browsers und auf dem Handy zusätzlich die Berechtigungen des Browsers in den Systemeinstellungen",
        micNotFound: "Kein Mikrofon gefunden",
        cameraNotFound: "Keine Kamera gefunden",
        micInUse: "Das Mikrofon wird von einer anderen App verwendet",
        cameraInUse: "Die Kamera wird von einer anderen App verwendet",
        flipCameraAria: "Kamera wechseln",
        sendAsGif: "Als GIF senden",
        removeAttachmentAria: "Anhang entfernen",
        attachFileAria: "Datei anhängen",
        savedGifsAria: "Gespeicherte GIFs",
        emojiAria: "Emoji",
        messagePlaceholder: "Nachricht",
        editedLabel: "bearbeitet",
        removeFromGifs: "Aus GIFs entfernen",
        saveToGifs: "In GIFs speichern",
        saveAs: "Speichern als…",
        deleteMessage: "Nachricht löschen",
    },
};
