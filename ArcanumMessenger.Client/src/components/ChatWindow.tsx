import { useEffect, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import type { ChatMessage, ChatReadState, ChatSummary, MediaAsset, MessageReaction, SavedGifEntry, User } from "../types/messenger";
import { getMessageHistory, sendMessage, deleteMessage, editMessage, forwardMessages, addReaction, removeReaction, type ForwardItem } from "../api/messages";
import { getUser, getUserAvatarUrl } from "../api/users";
import { getChats, getChatAvatarUrl } from "../api/chats";
import { uploadMedia, uploadMediaThumbnail, deleteMedia, getSavedGifs, saveGif, unsaveGif } from "../api/media";
import { EncryptedImage, EncryptedGifVideo, EncryptedVideoPlayer, EncryptedAudioPlayer, EncryptedThumbnail, downloadMediaToDisk } from "./EncryptedMedia";
import { uploadMediaChunked, abortChunkedUpload, clearChunkedUploadResumeState, CHUNK_THRESHOLD } from "../api/chunkedUpload";
import { formatMessageTime, formatChatTime } from "../lib/time";
import { extractVideoFirstFrame } from "../lib/mediaMetadata";
import { reencryptMediaAcrossChats } from "../lib/mediaReencrypt";
import { encryptOutgoing, decryptIncoming, decryptIncomingList, getChatKey } from "../lib/chatCrypto";
import { selfHealChatKeys } from "../lib/chatKeySelfHeal";
import { recordReactionEmojiUse } from "../lib/emojiUsage";
import { isRegionalIndicator, isBlankDraft, ZERO_WIDTH_SPACE } from "../lib/regionalIndicator";
import UserInfoPanel from "./UserInfoPanel";
import ChatInfoPanel from "./ChatInfoPanel";
import EmojiPicker from "./EmojiPicker";
import StickerPicker from "./StickerPicker";
import VoiceRecorderButton from "./VoiceRecorderButton";
import ForwardPanel from "./ForwardPanel";
import AvatarImage from "./AvatarImage";
import MessageContextMenu, { type MessageContextMenuItem } from "./MessageContextMenu";
import SwipeToReply from "./SwipeToReply";
import styles from "./ChatWindow.module.css";
import mediaStyles from "./EncryptedMedia.module.css";
import { useLanguage } from "../lib/language";
import { useIsMobile } from "../lib/useMediaQuery";
import { APP_COMMON, type AppCommonTranslation } from "../lib/appTranslations";
import { CHAT_WINDOW_TRANSLATIONS } from "../lib/chatWindowTranslations";

// "Send as GIF" keeps the file as a real video (still efficient, still has
// real dimensions) - it's just classified as a gif message. Rendering has
// to pick the right tag either way: a real image/gif file plays natively
// in <img>, but video bytes need an actual <video> element.
function isVideoMime(mimeType: string): boolean {
    return mimeType.startsWith("video/");
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The hub can echo a just-sent/forwarded message back before the HTTP
// response for it even resolves (they're two independent channels racing
// each other) - whichever side runs second has to skip it, or it lands in
// the list twice. Every place that appends to `messages` goes through this.
function appendUnique(prev: ChatMessage[], toAdd: ChatMessage[]): ChatMessage[] {
    const existingIds = new Set(prev.map((m) => m.id));
    const unique = toAdd.filter((m) => !existingIds.has(m.id));
    return unique.length > 0 ? [...prev, ...unique] : prev;
}

// A reply/quote preview has no room for the full bubble, and a captionless
// photo/video/gif has no text at all to show there otherwise.
function replySnippet(message: ChatMessage, common: AppCommonTranslation): string {
    if (message.content) return message.content;
    switch (message.type) {
        case "image": return common.photo;
        case "video": return common.video;
        case "gif": return common.gif;
        case "audio": return common.audio;
        case "videoNote": return common.videoNote;
        case "file": return message.media?.fileName ?? common.file;
        default: return "";
    }
}

// Telegram-style: a short message that is nothing but emoji renders bigger.
// \p{Extended_Pictographic} covers the base pictographs; the explicit
// U+1F1E6-1F1FF/U+1F3FB-1F3FF ranges cover flag regional indicators and
// skin-tone modifiers, which are unambiguous. Plain ASCII digits/#/* are
// NOT stripped on their own - \p{Emoji_Component} would match "123" too,
// since digits double as keycap components - they only count as emoji when
// they are actually part of a real keycap sequence (digit + optional
// variation selector + the combining enclosing keycap U+20E3).
function isEmojiOnlyMessage(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const stripped = trimmed.replace(
        /[0-9#*]\ufe0f?\u20e3|[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u200d\ufe0f\s]/gu,
        "",
    );
    if (stripped.length > 0) return false;

    const graphemeCount = [...new Intl.Segmenter().segment(trimmed)].length;
    return graphemeCount > 0 && graphemeCount <= 6;
}

function isMessageRead(message: ChatMessage, readStates: ChatReadState[]): boolean {
    if (readStates.length === 0) return false;
    const createdAt = new Date(message.createdAt).getTime();
    return readStates.every((rs) => new Date(rs.lastReadAt).getTime() >= createdAt);
}

function MessageStatusIcon({ read }: { read: boolean }) {
    return read ? (
        <svg
            className={styles.statusIconRead}
            width="16" height="10" viewBox="0 0 16 10" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        >
            <path d="M1 5L4.5 8.5L9.5 2" />
            <path d="M6 5L9.5 8.5L14.5 2" />
        </svg>
    ) : (
        <svg
            width="12" height="10" viewBox="0 0 12 10" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        >
            <path d="M1 5L4.5 8.5L11 1" />
        </svg>
    );
}

interface ChatWindowProps {
    chat: ChatSummary;
    connection: HubConnection | null;
    onStartChat: (chat: ChatSummary) => void;
    onChatRemoved: (chatId: string) => void;
    presence?: { isOnline: boolean; lastSeen: string | null };
    chatAvatarNonce: number;
    onChatAvatarChanged: () => void;
    // Present only when the caller is showing this chat as a single
    // full-screen pane (mobile) instead of alongside the chat list -
    // renders a back button that returns to the list.
    onBack?: () => void;
}

const ANIMATE_MS = 260;
const MAX_COMPOSE_HEIGHT = 120;
// Same default set WhatsApp shows on a long-press - familiar enough that
// most people already know what this row means without an explanation.
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function dayLabel(iso: string, common: AppCommonTranslation): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);

    if (date.toDateString() === today.toDateString()) return common.today;
    if (date.toDateString() === yesterday.toDateString()) return common.yesterday;
    return date.toLocaleDateString([], {
        day: "numeric",
        month: "long",
    });
}

export default function ChatWindow({
    chat, connection, onStartChat, onChatRemoved, presence, chatAvatarNonce, onChatAvatarChanged, onBack,
}: ChatWindowProps) {
    const language = useLanguage();
    const isMobile = useIsMobile();
    const common = APP_COMMON[language];
    const tr = CHAT_WINDOW_TRANSLATIONS[language];
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [readStates, setReadStates] = useState<ChatReadState[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [draft, setDraft] = useState("");
    const [userInfo, setUserInfo] = useState<{ userId: string; user: User } | null>(null);
    const [chatInfoOpen, setChatInfoOpen] = useState(false);
    const [pendingMedia, setPendingMedia] = useState<MediaAsset | null>(null);
    const [sendAsGif, setSendAsGif] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
    const [voiceRecording, setVoiceRecording] = useState(false);
    // The merged emoji+GIF picker (StickerPicker) shown in the normal
    // compose state; editing a message falls back to a plain emoji-only
    // button below (attaching a new GIF while editing isn't supported).
    const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [savedGifIds, setSavedGifIds] = useState<Set<string>>(new Set());
    // A gif send re-encrypts+re-uploads the file before the real message
    // exists at all, which can take a while on a slow connection - this is
    // what shows a "sending..." placeholder bubble in the meantime instead
    // of the tap appearing to do nothing.
    const [pendingGifSends, setPendingGifSends] = useState<{ tempId: string; media: MediaAsset }[]>([]);
    const [contextMenu, setContextMenu] = useState<{ message: ChatMessage; x: number; y: number } | null>(null);
    const [reactionPicker, setReactionPicker] = useState<{ messageId: string; x: number; y: number; placement: "up" | "down" } | null>(null);
    const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
    const [editTarget, setEditTarget] = useState<ChatMessage | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [forwardIds, setForwardIds] = useState<string[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const scrollAnchor = useRef<HTMLDivElement | null>(null);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const stickerPanelRef = useRef<HTMLDivElement | null>(null);
    const emojiPanelRef = useRef<HTMLDivElement | null>(null);
    const reactionPickerRef = useRef<HTMLDivElement | null>(null);
    const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
    const prependingRef = useRef(false);
    const uploadAbortRef = useRef<AbortController | null>(null);
    const uploadFileRef = useRef<File | null>(null);
    const uploadSessionIdRef = useRef<string | null>(null);
    const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());


    const [, forceTick] = useState(0);

    const markAnimated = (id: string) => {
        setAnimatingIds((prev) => new Set(prev).add(id));
        window.setTimeout(() => {
            setAnimatingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, ANIMATE_MS);
    };

    const handleJumpToMessage = (messageId: string) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (!el) return;

        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedIds((prev) => new Set(prev).add(messageId));
        window.setTimeout(() => {
            setHighlightedIds((prev) => {
                const next = new Set(prev);
                next.delete(messageId);
                return next;
            });
        }, 900);
    };

    // Telegram desktop's own Up/Down-to-reply, triggered from the compose
    // box while it's empty (see the textarea's onKeyDown below). Up with no
    // reply active starts from the most recent message; Down past the most
    // recent one backs out of reply mode entirely. System messages aren't
    // repliable, so they're skipped over rather than ever becoming a target.
    const handleReplyCycle = (direction: "up" | "down") => {
        const repliable = messages.filter((m) => m.type !== "system");
        if (repliable.length === 0) return;

        const currentIndex = replyTarget ? repliable.findIndex((m) => m.id === replyTarget.id) : -1;

        if (direction === "up") {
            const nextIndex = currentIndex === -1 ? repliable.length - 1 : Math.max(0, currentIndex - 1);
            const next = repliable[nextIndex];
            setReplyTarget(next);
            setEditTarget(null);
            handleJumpToMessage(next.id);
            return;
        }

        if (currentIndex === -1) return;
        if (currentIndex >= repliable.length - 1) {
            setReplyTarget(null);
            return;
        }
        const next = repliable[currentIndex + 1];
        setReplyTarget(next);
        handleJumpToMessage(next.id);
    };

    useEffect(() => {
        const interval = window.setInterval(() => {
            forceTick((n) => n + 1);
        }, 100);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        getSavedGifs().then((gifs) => setSavedGifIds(new Set(gifs.map((g) => g.sourceMediaId))));
    }, []);

    // Saved GIFs live in the user's own Saved Messages chat, encrypted with
    // its key like anything else there - fetched once so saving/sending a
    // saved gif has somewhere to re-encrypt to/from (see lib/mediaReencrypt.ts).
    const [savedChat, setSavedChat] = useState<ChatSummary | null>(null);
    useEffect(() => {
        getChats().then((chats) => {
            const saved = chats.find((c) => c.type === "saved") ?? null;
            setSavedChat(saved);
            if (saved) selfHealChatKeys(saved.id, saved.wrappedChatKey);
        });
    }, []);

    const pendingMediaRef = useRef<MediaAsset | null>(null);
    useEffect(() => {
        pendingMediaRef.current = pendingMedia;
    }, [pendingMedia]);

    useEffect(() => {
        return () => {
            uploadAbortRef.current?.abort();
            if (uploadSessionIdRef.current) {
                abortChunkedUpload(uploadSessionIdRef.current);
                if (uploadFileRef.current) clearChunkedUploadResumeState(uploadFileRef.current);
            }
            if (pendingMediaRef.current) deleteMedia(pendingMediaRef.current.id);
        };
    }, []);

    useEffect(() => {
        if (!stickerPickerOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (stickerPanelRef.current && !stickerPanelRef.current.contains(e.target as Node)) {
                setStickerPickerOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [stickerPickerOpen]);

    useEffect(() => {
        if (!emojiPickerOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPanelRef.current && !emojiPanelRef.current.contains(e.target as Node)) {
                setEmojiPickerOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [emojiPickerOpen]);

    useEffect(() => {
        if (!reactionPicker) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
                setReactionPicker(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [reactionPicker]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const history = await getMessageHistory(chat.id);
            if (cancelled) return;
            const decrypted = await decryptIncomingList({ id: chat.id, wrappedChatKey: chat.wrappedChatKey }, history.messages);
            if (cancelled) return;
            setMessages(decrypted);
            setHasMore(history.hasMore);
            setReadStates(history.readStates);
        })();

        return () => {
            cancelled = true;
        };
        // Re-runs if wrappedChatKey shows up later too (e.g. self-heal
        // provisioning it after the chat was first opened with none) so
        // already-loaded ciphertext gets a chance to decrypt properly.
    }, [chat.id, chat.wrappedChatKey]);

    // Best-effort, fire-and-forget: whenever this chat is opened, fix
    // whatever missing chat-key state this client happens to be able to
    // fix (see lib/chatKeySelfHeal.ts). Never blocks rendering.
    useEffect(() => {
        selfHealChatKeys(chat.id, chat.wrappedChatKey);
    }, [chat.id, chat.wrappedChatKey]);

    // Grows the compose box with its content up to MAX_COMPOSE_HEIGHT, then
    // scrolls internally beyond that - resetting height to "auto" first is
    // what lets scrollHeight shrink back down after deleting a line, not
    // just grow. .input is box-sizing:border-box, so its border isn't part
    // of scrollHeight - without adding it back, the content area ends up
    // exactly `border` px too short for its own content, and that's enough
    // overflow to keep a scrollbar showing even on a single short line.
    useEffect(() => {
        const el = draftInputRef.current;
        if (!el) return;
        el.style.height = "auto";
        const border = el.offsetHeight - el.clientHeight;
        el.style.height = `${Math.min(el.scrollHeight + border, MAX_COMPOSE_HEIGHT)}px`;
    }, [draft]);

    useEffect(() => {
        if (!connection) return;

        const keyedChat = { id: chat.id, wrappedChatKey: chat.wrappedChatKey };

        const handleReceiveMessage = async (message: ChatMessage) => {
            if (message.chatId !== chat.id) return;
            // Own sends/forwards now echo back through this same event too (so
            // the sidebar's chat list learns about them) - this window already
            // added its own copy optimistically from the HTTP response, so a
            // duplicate by id here is expected and just needs to be skipped.
            const decrypted = await decryptIncoming(keyedChat, message);
            setMessages((prev) => appendUnique(prev, [decrypted]));
            markAnimated(decrypted.id);
        };

        const handleMessageDeleted = (chatId: string, messageId: string) => {
            if (chatId !== chat.id) return;
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
        };

        const handleMessageEdited = async (message: ChatMessage) => {
            if (message.chatId !== chat.id) return;
            const decrypted = await decryptIncoming(keyedChat, message);
            setMessages((prev) => prev.map((m) => (m.id === decrypted.id ? decrypted : m)));
        };

        const handleChatRead = (readChatId: string, userId: string, readAt: string) => {
            if (readChatId !== chat.id) return;
            setReadStates((prev) => {
                const idx = prev.findIndex((rs) => rs.userId === userId);
                if (idx === -1) return [...prev, { userId, lastReadAt: readAt }];
                const next = [...prev];
                next[idx] = { userId, lastReadAt: readAt };
                return next;
            });
        };

        const handleReactionsChanged = (reactChatId: string, messageId: string, reactions: MessageReaction[]) => {
            if (reactChatId !== chat.id) return;
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
        };

        connection.on("ReceiveMessage", handleReceiveMessage);
        connection.on("MessageDeleted", handleMessageDeleted);
        connection.on("MessageEdited", handleMessageEdited);
        connection.on("ChatRead", handleChatRead);
        connection.on("ReactionsChanged", handleReactionsChanged);
        return () => {
            connection.off("ReceiveMessage", handleReceiveMessage);
            connection.off("MessageDeleted", handleMessageDeleted);
            connection.off("MessageEdited", handleMessageEdited);
            connection.off("ChatRead", handleChatRead);
            connection.off("ReactionsChanged", handleReactionsChanged);
        };
    }, [connection, chat.id, chat.wrappedChatKey]);

    useEffect(() => {
        if (prependingRef.current) {
            prependingRef.current = false;
            return;
        }
        scrollAnchor.current?.scrollIntoView();
    }, [messages.length]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || messages.length === 0) return;

        setLoadingMore(true);
        const container = messagesRef.current;
        const previousHeight = container?.scrollHeight ?? 0;

        const older = await getMessageHistory(chat.id, messages[0].id);
        const decrypted = await decryptIncomingList(chat, older.messages);

        prependingRef.current = true;
        setMessages((prev) => [...decrypted, ...prev]);
        setHasMore(older.hasMore);
        setLoadingMore(false);

        requestAnimationFrame(() => {
            if (container) container.scrollTop = container.scrollHeight - previousHeight;
        });
    };

    const handleScroll = () => {
        if ((messagesRef.current?.scrollTop ?? 0) < 50) loadMore();
    };

    const handleSend = async () => {
        const content = draft.trim();

        if (editTarget) {
            if (isBlankDraft(content)) return;
            // Bails without clearing anything if there's genuinely no chat
            // key to encrypt under yet - there's nothing safe to send.
            const encrypted = await encryptOutgoing(chat, content);
            if (encrypted === null) return;
            setDraft("");
            const target = editTarget;
            setEditTarget(null);
            const updated = await editMessage(chat.id, target.id, encrypted);
            if (updated) setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...updated, content } : m)));
            return;
        }

        if (isBlankDraft(content) && !pendingMedia) return;

        // An empty caption needs no key at all - only real content does.
        const encrypted = content ? await encryptOutgoing(chat, content) : "";
        if (encrypted === null) return;

        setDraft("");
        const media = pendingMedia;
        const asGif = sendAsGif;
        const replyToId = replyTarget?.id ?? null;
        setPendingMedia(null);
        setSendAsGif(false);
        setReplyTarget(null);
        const sent = await sendMessage(chat.id, encrypted, media?.id, asGif, replyToId);
        if (sent) {
            setMessages((prev) => appendUnique(prev, [{ ...sent, content }]));
            markAnimated(sent.id);
        }
    };

    const handleAttachClick = () => fileInputRef.current?.click();

    const handleInsertEmoji = (emoji: string) => {
        const input = draftInputRef.current;
        const start = input?.selectionStart ?? draft.length;
        const end = input?.selectionEnd ?? draft.length;
        const next = draft.slice(0, start) + emoji + draft.slice(end);
        setDraft(next);

        requestAnimationFrame(() => {
            const pos = start + emoji.length;
            input?.focus();
            input?.setSelectionRange(pos, pos);
        });
    };

    // A regional-indicator letter picked from the emoji picker always
    // comes with a trailing zero-width space (see EmojiPicker.tsx) so it
    // doesn't get merged into a flag - without this, backspace would
    // delete that invisible character first and need a second press to
    // remove the letter itself. Array.from walks by code point, not
    // UTF-16 code unit, since the letter itself is a surrogate pair.
    const handleBackspaceOverRegionalIndicator = (): boolean => {
        const input = draftInputRef.current;
        if (!input || input.selectionStart !== input.selectionEnd || input.selectionStart == null) return false;

        const pos = input.selectionStart;
        const before = Array.from(draft.slice(0, pos));
        const last = before[before.length - 1];
        const secondLast = before[before.length - 2];
        if (last !== ZERO_WIDTH_SPACE || !secondLast || !isRegionalIndicator(secondLast)) return false;

        const removedLength = last.length + secondLast.length;
        const next = draft.slice(0, pos - removedLength) + draft.slice(pos);
        setDraft(next);

        requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(pos - removedLength, pos - removedLength);
        });
        return true;
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        const chatKey = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
        if (!chatKey) return; // no usable chat key yet - nothing safe to encrypt with

        const controller = new AbortController();
        uploadAbortRef.current = controller;
        uploadFileRef.current = file;
        uploadSessionIdRef.current = null;

        try {
            let media: MediaAsset | null;
            if (file.size >= CHUNK_THRESHOLD) {
                setUploadProgress({ loaded: 0, total: file.size });
                media = await uploadMediaChunked(
                    file,
                    chatKey,
                    chat.id,
                    (loaded, total) => setUploadProgress({ loaded, total }),
                    controller.signal,
                    (sessionId) => { uploadSessionIdRef.current = sessionId; },
                );
            } else {
                setUploadingFile(true);
                media = await uploadMedia(file, chatKey, chat.id, controller.signal);
            }

            if (media) {
                setPendingMedia(media);

                if (file.type.startsWith("video/")) {
                    const frame = await extractVideoFirstFrame(file);
                    if (frame) {
                        const ok = await uploadMediaThumbnail(media.id, frame, chatKey, chat.id);
                        if (ok) setPendingMedia({ ...media, hasThumbnail: true });
                    }
                }
            }
            setSendAsGif(false);
        } catch (err) {
            // A deliberate cancel (handleCancelUpload) - already cleaned up there.
            if (!(err instanceof DOMException && err.name === "AbortError")) throw err;
        } finally {
            setUploadingFile(false);
            setUploadProgress(null);
            uploadAbortRef.current = null;
            uploadFileRef.current = null;
            uploadSessionIdRef.current = null;
        }
    };

    // Voice messages skip the pendingMedia review step entirely - stopping
    // the recording is the send action, same as Telegram/WhatsApp.
    const handleVoiceRecorded = async (file: File, durationSeconds: number) => {
        const chatKey = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
        if (!chatKey) return;

        const controller = new AbortController();
        uploadAbortRef.current = controller;
        uploadFileRef.current = file;
        uploadSessionIdRef.current = null;

        try {
            let media: MediaAsset | null;
            if (file.size >= CHUNK_THRESHOLD) {
                setUploadProgress({ loaded: 0, total: file.size });
                media = await uploadMediaChunked(
                    file,
                    chatKey,
                    chat.id,
                    (loaded, total) => setUploadProgress({ loaded, total }),
                    controller.signal,
                    (sessionId) => { uploadSessionIdRef.current = sessionId; },
                    durationSeconds,
                );
            } else {
                setUploadingFile(true);
                media = await uploadMedia(file, chatKey, chat.id, controller.signal, durationSeconds);
            }

            if (media) {
                const replyToId = replyTarget?.id ?? null;
                setReplyTarget(null);
                const sent = await sendMessage(chat.id, "", media.id, false, replyToId);
                if (sent) {
                    setMessages((prev) => appendUnique(prev, [{ ...sent, content: "" }]));
                    markAnimated(sent.id);
                }
            }
        } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) throw err;
        } finally {
            setUploadingFile(false);
            setUploadProgress(null);
            uploadAbortRef.current = null;
            uploadFileRef.current = null;
            uploadSessionIdRef.current = null;
        }
    };

    // Same shape as handleVoiceRecorded - the only difference is asVideoNote
    // on the send call, which is what gets media.Kind reclassified from
    // "video" to "videoNote" server-side (see MessageService.SendMessageAsync).
    const handleVideoNoteRecorded = async (file: File, durationSeconds: number) => {
        const chatKey = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
        if (!chatKey) return;

        const controller = new AbortController();
        uploadAbortRef.current = controller;
        uploadFileRef.current = file;
        uploadSessionIdRef.current = null;

        try {
            let media: MediaAsset | null;
            if (file.size >= CHUNK_THRESHOLD) {
                setUploadProgress({ loaded: 0, total: file.size });
                media = await uploadMediaChunked(
                    file,
                    chatKey,
                    chat.id,
                    (loaded, total) => setUploadProgress({ loaded, total }),
                    controller.signal,
                    (sessionId) => { uploadSessionIdRef.current = sessionId; },
                    durationSeconds,
                );
            } else {
                setUploadingFile(true);
                media = await uploadMedia(file, chatKey, chat.id, controller.signal, durationSeconds);
            }

            if (media) {
                const replyToId = replyTarget?.id ?? null;
                setReplyTarget(null);
                const sent = await sendMessage(chat.id, "", media.id, false, replyToId, true);
                if (sent) {
                    setMessages((prev) => appendUnique(prev, [{ ...sent, content: "" }]));
                    markAnimated(sent.id);
                }
            }
        } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) throw err;
        } finally {
            setUploadingFile(false);
            setUploadProgress(null);
            uploadAbortRef.current = null;
            uploadFileRef.current = null;
            uploadSessionIdRef.current = null;
        }
    };

    const handleCancelUpload = () => {
        uploadAbortRef.current?.abort();
        if (uploadSessionIdRef.current) {
            abortChunkedUpload(uploadSessionIdRef.current);
            if (uploadFileRef.current) clearChunkedUploadResumeState(uploadFileRef.current);
        }
    };

    const handleRemovePendingMedia = () => {
        const media = pendingMedia;
        setPendingMedia(null);
        setSendAsGif(false);
        if (media) deleteMedia(media.id);
    };

    const handleSendGif = async (entry: SavedGifEntry) => {
        if (!savedChat) return;
        const replyToId = replyTarget?.id ?? null;
        setReplyTarget(null);

        const tempId = `pending-${crypto.randomUUID()}`;
        setPendingGifSends((prev) => [...prev, { tempId, media: entry.media }]);

        // A saved gif is encrypted under the Saved Messages chat's key -
        // has to be re-encrypted under this chat's key before it can be
        // sent here, same as forwarding.
        const reencrypted = await reencryptMediaAcrossChats(
            savedChat, { id: chat.id, wrappedChatKey: chat.wrappedChatKey }, entry.media,
        );
        if (!reencrypted) {
            setPendingGifSends((prev) => prev.filter((p) => p.tempId !== tempId));
            return;
        }

        // Re-encrypting for this chat is a fresh upload server-side, so its
        // Kind is re-derived from mime type alone - a gif sent as a video
        // file would come back as "video" without this, having lost the
        // "gif" classification the original message's asset had.
        const sent = await sendMessage(chat.id, "", reencrypted.id, true, replyToId);
        setPendingGifSends((prev) => prev.filter((p) => p.tempId !== tempId));
        if (sent) {
            setMessages((prev) => appendUnique(prev, [sent]));
            markAnimated(sent.id);
        }
    };

    const handleToggleSaveGif = async (media: MediaAsset) => {
        const isSaved = savedGifIds.has(media.id);

        if (isSaved) {
            const ok = await unsaveGif(media.id);
            if (!ok) return;
            setSavedGifIds((prev) => {
                const next = new Set(prev);
                next.delete(media.id);
                return next;
            });
            return;
        }

        if (!savedChat) return;
        const reencrypted = await reencryptMediaAcrossChats(
            { id: chat.id, wrappedChatKey: chat.wrappedChatKey }, savedChat, media,
        );
        if (!reencrypted) return;

        const ok = await saveGif(media.id, reencrypted.id);
        if (!ok) return;
        setSavedGifIds((prev) => new Set(prev).add(media.id));
    };

    const handleDeleteMessage = async (messageId: string) => {
        const ok = await deleteMessage(chat.id, messageId);
        if (ok) setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleSaveAs = (media: MediaAsset) => {
        downloadMediaToDisk({ id: chat.id, wrappedChatKey: chat.wrappedChatKey }, media);
    };

    const handleContextMenu = (e: React.MouseEvent, message: ChatMessage) => {
        e.preventDefault();
        if (selectMode) return;
        setContextMenu({ message, x: e.clientX, y: e.clientY });
    };

    // Used by the reaction pill on a message itself - always removes one
    // copy of your own reaction (a person can have stacked several of the
    // same emoji, see handleAddReaction below).
    const handleRemoveReaction = async (messageId: string, emoji: string) => {
        const reactions = await removeReaction(chat.id, messageId, emoji);
        if (reactions) {
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
        }
    };

    // Used by the reaction picker (quick strip + full emoji picker) -
    // always adds one more, so picking the same emoji twice in a row (or
    // leaving the picker open while adding several) stacks rather than
    // undoing the first pick. Only the pill on the message itself removes.
    const handleAddReaction = async (messageId: string, emoji: string) => {
        recordReactionEmojiUse(emoji);
        const reactions = await addReaction(chat.id, messageId, emoji);
        if (reactions) {
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
        }
    };

    const toggleSelected = (messageId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(messageId)) next.delete(messageId);
            else next.add(messageId);
            return next;
        });
    };

    const handleCancelSelect = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    const handleBulkCopy = () => {
        const text = messages
            .filter((m) => selectedIds.has(m.id) && m.content)
            .map((m) => m.content)
            .join("\n\n");
        if (text) navigator.clipboard.writeText(text);
        handleCancelSelect();
    };

    const handleBulkDelete = async () => {
        const ids = messages.filter((m) => selectedIds.has(m.id) && m.isOwn).map((m) => m.id);
        const results = await Promise.all(ids.map((id) => deleteMessage(chat.id, id)));
        const deletedIds = new Set(ids.filter((_, i) => results[i]));
        setMessages((prev) => prev.filter((m) => !deletedIds.has(m.id)));
        handleCancelSelect();
    };

    const handleForwardPick = async (targetChat: ChatSummary) => {
        const ids = forwardIds ?? [];
        setForwardIds(null);

        // Each source message is already decrypted in local state (that's
        // how it's on screen right now) - text gets re-encrypted here under
        // the DESTINATION chat's key, since the server can't do that
        // transcoding itself under E2EE. Media can't be transcoded in place
        // like a short string - it has to be downloaded, decrypted, and
        // re-uploaded fully under the destination's key.
        const items: ForwardItem[] = [];
        for (const id of ids) {
            const source = messages.find((m) => m.id === id);
            if (!source) continue;
            const encryptedContent = source.content ? await encryptOutgoing(targetChat, source.content) : "";
            if (source.content && encryptedContent === null) continue; // no key for the destination yet

            let newMediaId: string | undefined;
            if (source.media) {
                const reencrypted = await reencryptMediaAcrossChats(
                    { id: chat.id, wrappedChatKey: chat.wrappedChatKey },
                    { id: targetChat.id, wrappedChatKey: targetChat.wrappedChatKey },
                    source.media,
                );
                if (!reencrypted) continue; // couldn't re-encrypt the media - skip this item entirely
                newMediaId = reencrypted.id;
            }

            items.push({ sourceMessageId: id, encryptedContent: encryptedContent ?? "", newMediaId });
        }
        if (items.length === 0) {
            if (selectMode) handleCancelSelect();
            return;
        }

        const forwarded = await forwardMessages(targetChat.id, items);
        if (forwarded && targetChat.id === chat.id) {
            const decrypted = await decryptIncomingList(chat, forwarded);
            setMessages((prev) => appendUnique(prev, decrypted));
        }
        if (selectMode) handleCancelSelect();
    };

    const buildMenuItems = (message: ChatMessage): MessageContextMenuItem[] => {
        const items: MessageContextMenuItem[] = [];
        const media = message.media;

        items.push({
            label: common.reply,
            onClick: () => {
                setReplyTarget(message);
                setEditTarget(null);
            },
        });

        if (message.content) {
            items.push({ label: common.copyText, onClick: () => navigator.clipboard.writeText(message.content) });
        }

        items.push({ label: common.forward, onClick: () => setForwardIds([message.id]) });

        items.push({
            label: common.select,
            onClick: () => {
                setSelectMode(true);
                setSelectedIds(new Set([message.id]));
            },
        });

        if (message.type === "gif" && media) {
            const isSaved = savedGifIds.has(media.id);
            items.push({
                label: isSaved ? tr.removeFromGifs : tr.saveToGifs,
                onClick: () => handleToggleSaveGif(media),
            });
        }

        if (media) {
            items.push({ label: tr.saveAs, onClick: () => handleSaveAs(media) });
        }

        if (message.isOwn && message.type === "text") {
            items.push({
                label: common.edit,
                onClick: () => {
                    setEditTarget(message);
                    setDraft(message.content);
                    setReplyTarget(null);
                    handleRemovePendingMedia();
                },
            });
        }

        if (message.isOwn) {
            items.push({ label: tr.deleteMessage, danger: true, onClick: () => handleDeleteMessage(message.id) });
        }

        return items;
    };

    const findMessage = (id: string | null) =>
        id ? messages.find((m) => m.id === id) : undefined;

    const handleAvatarClick = async () => {
        if (chat.type !== "direct" || !chat.otherUserId) return;
        const userId = chat.otherUserId;
        const user = await getUser(userId);
        if (user) setUserInfo({ userId, user });
    };

    const handleForwardedSenderClick = async (userId: string) => {
        const user = await getUser(userId);
        if (user) setUserInfo({ userId, user });
    };

    return (
        <div className={styles.root}>
            <header className={styles.header}>
                {onBack && (
                    <button
                        className={styles.backBtn}
                        onClick={onBack}
                        aria-label={tr.backAria}
                        title={tr.backAria}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                )}
                <div
                    className={`${styles.avatar} ${chat.type === "group" ? styles.avatarGroup : ""} ${chat.type === "saved" ? styles.avatarSaved : ""} ${chat.type === "direct" ? styles.avatarClickable : ""}`}
                    onClick={handleAvatarClick}
                >
                    {chat.type === "saved" ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                        </svg>
                    ) : (
                        <AvatarImage
                            src={
                                chat.type === "direct" && chat.otherUserId
                                    ? getUserAvatarUrl(chat.otherUserId)
                                    : chat.type === "group"
                                        ? `${getChatAvatarUrl(chat.id)}${chatAvatarNonce ? `?t=${chatAvatarNonce}` : ""}`
                                        : null
                            }
                            fallback={chat.title.charAt(0).toUpperCase()}
                        />
                    )}
                </div>
                <div className={styles.headerText}>
                    <span className={styles.title}>{chat.title}</span>
                    <span
                        className={`${styles.subtitle} ${presence?.isOnline ? styles.subtitleOnline : ""}`}
                    >
                        {chat.type === "group"
                            ? tr.groupChatSubtitle
                            : chat.type === "saved"
                            ? tr.onlyVisibleToYou
                            : presence?.isOnline
                            ? common.online
                            : presence?.lastSeen
                                ? `${tr.lastSeenPrefix}${formatChatTime(presence.lastSeen)}`
                                : common.offline}
                    </span>
                </div>
                <button
                    className={styles.infoBtn}
                    onClick={() => setChatInfoOpen(true)}
                    aria-label={tr.chatInfoAria}
                    title={tr.chatInfoAria}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                    </svg>
                </button>
            </header>

            <div
                className={styles.messages}
                ref={messagesRef}
                onScroll={handleScroll}
            >
                {messages.length === 0 && (
                    <p className={styles.noMessages}>{tr.noMessagesYet}</p>
                )}

                {messages.map((message, i) => {
                    const prev = messages[i - 1];
                    const showDay =
                        !prev ||
                        new Date(prev.createdAt).toDateString() !==
                            new Date(message.createdAt).toDateString();
                    const replyTo = findMessage(message.replyToId);
                    const isMediaKind = message.type === "image" || message.type === "gif" || message.type === "video" || message.type === "videoNote";
                    const hasCaption = isMediaKind && !!message.content;
                    const bareMedia = isMediaKind && !hasCaption;
                    const mediaWrapClass = `${styles.mediaWrap} ${hasCaption ? styles.mediaBleedTop : ""} ${
                        message.type === "video" ? styles.mediaWrapVideo : ""
                    } ${message.type === "videoNote" ? styles.mediaWrapVideoNote : ""}`;

                    return (
                        <div key={message.id}>
                            {showDay && (
                                <div className={styles.daySeparator}>
                                    <span>{dayLabel(message.createdAt, common)}</span>
                                </div>
                            )}
                            {message.type === "system" ? (
                                <div className={styles.systemMessage}>
                                    <span>{message.content}</span>
                                </div>
                            ) : (
                            <SwipeToReply
                                disabled={!isMobile || selectMode}
                                reverse={message.isOwn}
                                onReply={() => {
                                    setReplyTarget(message);
                                    setEditTarget(null);
                                }}
                            >
                            <div
                                id={`msg-${message.id}`}
                                className={`${styles.bubbleRow} ${message.isOwn ? styles.own : ""} ${
                                    animatingIds.has(message.id) ? styles.bubbleEnter : ""
                                } ${highlightedIds.has(message.id) ? styles.bubbleHighlight : ""}`}
                            >
                                {selectMode && (
                                    <span
                                        className={`${styles.selectCheckbox} ${selectedIds.has(message.id) ? styles.selectCheckboxChecked : ""}`}
                                        onClick={() => toggleSelected(message.id)}
                                    />
                                )}
                                <div
                                    className={`${styles.bubble} ${bareMedia ? styles.bubbleBare : ""}`}
                                    onContextMenu={(e) => handleContextMenu(e, message)}
                                >
                                    {selectMode && (
                                        <div
                                            className={styles.selectOverlay}
                                            onClick={() => toggleSelected(message.id)}
                                        />
                                    )}
                                    {message.forwardedFromSenderName && (
                                        <span
                                            className={styles.forwardedLabel}
                                            onClick={() => handleForwardedSenderClick(message.forwardedFromSenderId!)}
                                        >
                                            {tr.forwardedFromPrefix}{message.forwardedFromSenderName}
                                        </span>
                                    )}
                                    {chat.type === "group" &&
                                        !message.isOwn && (
                                            <span className={styles.sender}>
                                                {message.senderName}
                                            </span>
                                        )}
                                    {replyTo && (
                                        <div
                                            className={styles.replyQuote}
                                            onClick={() => handleJumpToMessage(replyTo.id)}
                                        >
                                            <span
                                                className={styles.replySender}
                                            >
                                                {replyTo.senderName}
                                            </span>
                                            <span
                                                className={styles.replyText}
                                            >
                                                {replySnippet(replyTo, common)}
                                            </span>
                                        </div>
                                    )}
                                    {message.type === "text" && (
                                        <span
                                            className={`${styles.content} ${isEmojiOnlyMessage(message.content) ? styles.emojiOnly : ""}`}
                                        >
                                            {message.content}
                                        </span>
                                    )}
                                    {message.type === "image" && message.media && (
                                        <div className={mediaWrapClass}>
                                            <EncryptedImage
                                                chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                                media={message.media}
                                                className={styles.mediaImage}
                                                loadingClassName={styles.mediaImageLoading}
                                                alt={message.media.fileName}
                                                openOnClick
                                            />
                                            {bareMedia && (
                                                <span className={styles.mediaTime}>
                                                    {formatMessageTime(message.createdAt)}
                                                    {message.isOwn && chat.type !== "saved" && (
                                                        <MessageStatusIcon read={isMessageRead(message, readStates)} />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {message.type === "gif" && message.media && (
                                        <div className={mediaWrapClass}>
                                            {isVideoMime(message.media.mimeType) ? (
                                                <EncryptedGifVideo
                                                    chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                                    media={message.media}
                                                    className={styles.mediaGifVideo}
                                                    loadingClassName={styles.mediaImageLoading}
                                                    openOnClick
                                                />
                                            ) : (
                                                // A real animated GIF file - always decrypted and loaded in full
                                                // (no thumbnail exists for these), and the browser loops it
                                                // forever on its own once it's a real <img>, no attributes needed.
                                                <EncryptedImage
                                                    chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                                    media={message.media}
                                                    className={styles.mediaImage}
                                                    loadingClassName={styles.mediaImageLoading}
                                                    alt={message.media.fileName}
                                                    openOnClick
                                                />
                                            )}
                                            {bareMedia && (
                                                <span className={styles.mediaTime}>
                                                    {formatMessageTime(message.createdAt)}
                                                    {message.isOwn && chat.type !== "saved" && (
                                                        <MessageStatusIcon read={isMessageRead(message, readStates)} />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {message.type === "video" && message.media && (
                                        <div className={mediaWrapClass}>
                                            <EncryptedVideoPlayer
                                                chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                                media={message.media}
                                                className={styles.mediaVideo}
                                                placeholderClassName={styles.videoPlaceholder}
                                                playIconClassName={styles.videoPlayIcon}
                                                spinnerClassName={styles.videoSpinner}
                                            />
                                            {bareMedia && (
                                                <span className={styles.mediaTime}>
                                                    {formatMessageTime(message.createdAt)}
                                                    {message.isOwn && chat.type !== "saved" && (
                                                        <MessageStatusIcon read={isMessageRead(message, readStates)} />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {message.type === "audio" && message.media && (
                                        <EncryptedAudioPlayer
                                            chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                            media={message.media}
                                            className={styles.mediaAudio}
                                            playButtonClassName={styles.audioPlayBtn}
                                            trackClassName={styles.audioTrack}
                                            timeClassName={styles.audioTime}
                                            spinnerClassName={styles.audioSpinner}
                                            skipButtonClassName={styles.audioSkipBtn}
                                        />
                                    )}
                                    {message.type === "videoNote" && message.media && (
                                        <div className={mediaWrapClass}>
                                            <EncryptedVideoPlayer
                                                chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                                media={message.media}
                                                className={styles.mediaVideoNote}
                                                placeholderClassName={styles.videoNotePlaceholder}
                                                playIconClassName={styles.videoPlayIcon}
                                                spinnerClassName={styles.videoSpinner}
                                                preWarmMetadata
                                            />
                                            {bareMedia && (
                                                <span className={styles.mediaTime}>
                                                    {formatMessageTime(message.createdAt)}
                                                    {message.isOwn && chat.type !== "saved" && (
                                                        <MessageStatusIcon read={isMessageRead(message, readStates)} />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {message.type === "file" && message.media && (
                                        <button
                                            type="button"
                                            className={styles.fileCard}
                                            onClick={() => downloadMediaToDisk(
                                                { id: chat.id, wrappedChatKey: chat.wrappedChatKey },
                                                message.media!,
                                            )}
                                        >
                                            <span className={styles.fileIcon}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <path d="M14 2v6h6" />
                                                </svg>
                                            </span>
                                            <span className={styles.fileInfo}>
                                                <span className={styles.fileName}>{message.media.fileName}</span>
                                                <span className={styles.fileSize}>{formatFileSize(message.media.sizeBytes)}</span>
                                            </span>
                                        </button>
                                    )}
                                    {message.type !== "text" && message.content && (
                                        <span className={`${styles.content} ${styles.mediaCaption}`}>
                                            {message.content}
                                        </span>
                                    )}
                                    {message.reactions.length > 0 && (
                                        <div className={styles.reactions}>
                                            {message.reactions.map((r) => (
                                                <button
                                                    key={r.emoji}
                                                    className={`${styles.reactionPill} ${r.reactedByMe ? styles.reactionPillActive : ""}`}
                                                    onClick={() => handleRemoveReaction(message.id, r.emoji)}
                                                >
                                                    <span>{r.emoji}</span>
                                                    <span className={styles.reactionCount}>{r.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {!bareMedia && (
                                        <span className={styles.meta}>
                                            {message.isEdited && (
                                                <span className={styles.edited}>
                                                    {tr.editedLabel}
                                                </span>
                                            )}
                                            {formatMessageTime(message.createdAt)}
                                            {message.isOwn && chat.type !== "saved" && (
                                                <MessageStatusIcon read={isMessageRead(message, readStates)} />
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                            </SwipeToReply>
                            )}
                        </div>
                    );
                })}
                {pendingGifSends.map(({ tempId, media }) => {
                    const ratioVar = media.width && media.height
                        ? ({ "--media-aspect": `${media.width} / ${media.height}` } as React.CSSProperties)
                        : undefined;
                    return (
                        <div key={tempId} className={`${styles.bubbleRow} ${styles.own}`}>
                            <div className={`${styles.bubble} ${styles.bubbleBare}`}>
                                <div className={styles.mediaWrap}>
                                    {/* .mediaImageLoading, not just .mediaImage - see its own comment
                                        in ChatWindow.module.css: a plain div has no intrinsic size the
                                        way a loaded <img> does, so it needs an explicit width or this
                                        collapses to nothing instead of showing a real placeholder box. */}
                                    <div className={`${styles.mediaImageLoading} ${mediaStyles.loading}`} style={ratioVar}>
                                        <span className={mediaStyles.spinner} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollAnchor} />
            </div>

            <footer className={styles.inputBar}>
                {selectMode ? (
                    <div className={styles.selectionBar}>
                        <button
                            className={styles.removeAttachmentBtn}
                            onClick={handleCancelSelect}
                            aria-label={tr.cancelSelectionAria}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                        <span className={styles.selectionCount}>{tr.selectedCount(selectedIds.size)}</span>
                        <div className={styles.selectionActions}>
                            <button
                                className={styles.selectionActionBtn}
                                onClick={handleBulkCopy}
                                disabled={selectedIds.size === 0}
                            >
                                {tr.copyButton}
                            </button>
                            <button
                                className={styles.selectionActionBtn}
                                onClick={() => setForwardIds(Array.from(selectedIds))}
                                disabled={selectedIds.size === 0}
                            >
                                {common.forward}
                            </button>
                            <button
                                className={`${styles.selectionActionBtn} ${styles.selectionActionDanger}`}
                                onClick={handleBulkDelete}
                                disabled={selectedIds.size === 0}
                            >
                                {common.delete}
                            </button>
                        </div>
                    </div>
                ) : chat.isBlocked ? (
                    <p className={styles.blockedNote}>{tr.youCantSendMessages}</p>
                ) : (
                    <>
                        {editTarget && (
                            <div className={styles.replyBar}>
                                <div className={styles.replyBarText}>
                                    <span className={styles.replyBarSender}>{tr.editingMessage}</span>
                                    <span className={styles.replyBarSnippet}>{editTarget.content}</span>
                                </div>
                                <button
                                    className={styles.removeAttachmentBtn}
                                    onClick={() => {
                                        setEditTarget(null);
                                        setDraft("");
                                    }}
                                    aria-label={tr.cancelEditAria}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                        {replyTarget && (
                            <div className={styles.replyBar}>
                                <div className={styles.replyBarText}>
                                    <span className={styles.replyBarSender}>{replyTarget.senderName}</span>
                                    <span className={styles.replyBarSnippet}>
                                        {replySnippet(replyTarget, common)}
                                    </span>
                                </div>
                                <button
                                    className={styles.removeAttachmentBtn}
                                    onClick={() => setReplyTarget(null)}
                                    aria-label={tr.cancelReplyAria}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                        {(pendingMedia || uploadingFile || uploadProgress) && (
                            <div className={styles.pendingAttachment}>
                                {uploadingFile ? (
                                    <>
                                        <span className={styles.pendingUploading}>{tr.uploading}</span>
                                        <button
                                            className={styles.removeAttachmentBtn}
                                            onClick={handleCancelUpload}
                                            aria-label={tr.cancelUploadAria}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </>
                                ) : uploadProgress ? (
                                    <div className={styles.progressRow}>
                                        <div className={styles.progressBarTrack}>
                                            <div
                                                className={styles.progressBarFill}
                                                style={{ width: `${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%` }}
                                            />
                                        </div>
                                        <span className={styles.progressLabel}>
                                            {Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%
                                        </span>
                                        <button
                                            className={styles.removeAttachmentBtn}
                                            onClick={handleCancelUpload}
                                            aria-label={tr.cancelUploadAria}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : pendingMedia && (
                                    <>
                                        {pendingMedia.hasThumbnail ? (
                                            <EncryptedThumbnail
                                                chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                                mediaId={pendingMedia.id}
                                                className={styles.pendingThumb}
                                                alt=""
                                            />
                                        ) : (
                                            <span className={styles.pendingIcon}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <path d="M14 2v6h6" />
                                                </svg>
                                            </span>
                                        )}
                                        <span className={styles.pendingName}>{pendingMedia.fileName}</span>
                                        {pendingMedia.kind === "video" && (
                                            <label className={styles.sendAsGifLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={sendAsGif}
                                                    onChange={(e) => setSendAsGif(e.target.checked)}
                                                />
                                                {tr.sendAsGif}
                                            </label>
                                        )}
                                        <button
                                            className={styles.removeAttachmentBtn}
                                            onClick={handleRemovePendingMedia}
                                            aria-label={tr.removeAttachmentAria}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        <div className={styles.inputRow}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className={styles.hiddenFileInput}
                                onChange={handleFileSelected}
                            />
                            {!editTarget && !voiceRecording && (
                                <div className={styles.stickerButtonWrap} ref={stickerPanelRef}>
                                    <button
                                        className={styles.attachBtn}
                                        onClick={() => setStickerPickerOpen((prev) => !prev)}
                                        aria-label={tr.emojiAria}
                                        title={tr.emojiAria}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                            <path d="M9 9h.01M15 9h.01" />
                                        </svg>
                                    </button>
                                    {stickerPickerOpen && savedChat && (
                                        <StickerPicker
                                            savedChat={savedChat}
                                            onClose={() => setStickerPickerOpen(false)}
                                            onSelectEmoji={handleInsertEmoji}
                                            onSelectGif={handleSendGif}
                                            onAttachFile={() => {
                                                handleAttachClick();
                                                setStickerPickerOpen(false);
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                            {editTarget && (
                                <div className={styles.emojiButtonWrap} ref={emojiPanelRef}>
                                    <button
                                        className={styles.attachBtn}
                                        onClick={() => setEmojiPickerOpen((prev) => !prev)}
                                        aria-label={tr.emojiAria}
                                        title={tr.emojiAria}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                            <path d="M9 9h.01M15 9h.01" />
                                        </svg>
                                    </button>
                                    {emojiPickerOpen && (
                                        <EmojiPicker
                                            onClose={() => setEmojiPickerOpen(false)}
                                            onSelect={handleInsertEmoji}
                                        />
                                    )}
                                </div>
                            )}
                            {!voiceRecording && (
                                <textarea
                                    ref={draftInputRef}
                                    className={styles.input}
                                    rows={1}
                                    placeholder={tr.messagePlaceholder}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Backspace" && handleBackspaceOverRegionalIndicator()) {
                                            e.preventDefault();
                                            return;
                                        }
                                        // Telegram desktop's own shortcut - only while there's
                                        // nothing typed yet, so it never fights with actually
                                        // moving the cursor through real draft text.
                                        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !editTarget && isBlankDraft(draft)) {
                                            e.preventDefault();
                                            handleReplyCycle(e.key === "ArrowUp" ? "up" : "down");
                                            return;
                                        }
                                        // Mobile: Enter always inserts a newline (there's no
                                        // convenient Shift key) - sending is send-button-only.
                                        // Desktop: Enter sends, Shift+Enter inserts a newline.
                                        if (e.key !== "Enter" || e.shiftKey || isMobile) return;
                                        e.preventDefault();
                                        handleSend();
                                    }}
                                />
                            )}
                            {!editTarget && (
                                <VoiceRecorderButton
                                    chatId={chat.id}
                                    disabled={uploadingFile || !!uploadProgress || !!pendingMedia}
                                    onRecorded={handleVoiceRecorded}
                                    onVideoRecorded={handleVideoNoteRecorded}
                                    onRecordingChange={setVoiceRecording}
                                />
                            )}
                            {!voiceRecording && (
                                <button
                                    className={styles.sendBtn}
                                    // Tapping a button moves focus to it by default,
                                    // and away from the draft textarea - since a
                                    // button isn't a text field, that's what tells
                                    // the on-screen keyboard to close. Blocking just
                                    // that default (not the click itself) keeps the
                                    // textarea focused, so the keyboard stays open
                                    // through a send and only closes when the user
                                    // actually taps outside the input themselves.
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={handleSend}
                                    disabled={isBlankDraft(draft) && !pendingMedia}
                                    aria-label={common.send}
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect x="2" y="4" width="20" height="16" rx="3" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </>
                )}
            </footer>

            {userInfo && (
                <UserInfoPanel
                    userId={userInfo.userId}
                    user={userInfo.user}
                    onClose={() => setUserInfo(null)}
                    onStartChat={onStartChat}
                    presence={presence}
                />
            )}

            {chatInfoOpen && (
                <ChatInfoPanel
                    chat={chat}
                    connection={connection}
                    onClose={() => setChatInfoOpen(false)}
                    onChatRemoved={onChatRemoved}
                    chatAvatarNonce={chatAvatarNonce}
                    onChatAvatarChanged={onChatAvatarChanged}
                    onJumpToMessage={(messageId) => {
                        setChatInfoOpen(false);
                        handleJumpToMessage(messageId);
                    }}
                    onDeleteMessage={handleDeleteMessage}
                />
            )}

            {contextMenu && (
                <MessageContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={buildMenuItems(contextMenu.message)}
                    quickReactions={QUICK_REACTIONS}
                    onReact={(emoji) => handleAddReaction(contextMenu.message.id, emoji)}
                    onMoreReactions={() => {
                        // Not enough headroom above a message near the top
                        // of the chat to open the full picker upward -
                        // flips down instead, same threshold as its own
                        // max-height (min(360px, 55vh) + the 10px gap).
                        const placement = contextMenu.y < 380 ? "down" : "up";
                        setReactionPicker({ messageId: contextMenu.message.id, x: contextMenu.x, y: contextMenu.y, placement });
                        setContextMenu(null);
                    }}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {reactionPicker && (
                <div
                    ref={reactionPickerRef}
                    className={styles.reactionPickerAnchor}
                    style={{ left: Math.min(reactionPicker.x, window.innerWidth - 328), top: reactionPicker.y }}
                >
                    <EmojiPicker
                        placement={reactionPicker.placement}
                        showFrequent
                        onClose={() => setReactionPicker(null)}
                        onSelect={(emoji) => handleAddReaction(reactionPicker.messageId, emoji)}
                    />
                </div>
            )}

            {forwardIds && (
                <ForwardPanel
                    onClose={() => setForwardIds(null)}
                    onPick={handleForwardPick}
                />
            )}
        </div>
    );
}
