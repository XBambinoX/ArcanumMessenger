import type { ChatMessage, ChatType, MediaAsset } from "../types/messenger";
import type { MediaOutcome } from "./chatExport";
import type { Language } from "./language";
import { APP_COMMON, type AppCommonTranslation } from "./appTranslations";
import { CHAT_WINDOW_TRANSLATIONS, type ChatWindowTranslation } from "./chatWindowTranslations";
import { CHAT_EXPORT_TRANSLATIONS, type ChatExportTranslation } from "./chatManagementTranslations";
import { formatFileSize } from "./fileSize";
import { isEmojiOnlyMessage } from "./emoji";

interface HtmlExportInput {
    title: string;
    chatType: ChatType;
    messages: ChatMessage[];
    mediaOutcomes: Map<string, MediaOutcome>;
    exportedAt: Date;
    language: Language;
    // CSS declarations from readThemeVariables()
    themeVariables: string;
}

interface RenderContext {
    chatType: ChatType;
    common: AppCommonTranslation;
    chatTr: ChatWindowTranslation;
    tr: ChatExportTranslation;
    byId: Map<string, ChatMessage>;
    mediaOutcomes: Map<string, MediaOutcome>;
    timeFormat: Intl.DateTimeFormat;
    stampFormat: Intl.DateTimeFormat;
}

// The variables the page's styles use, see index.css.
const THEME_VARIABLES = [
    "--accent-rgb", "--accent2-rgb", "--accent-light-rgb", "--accent-cyan-rgb", "--accent-cyan3-rgb",
    "--accent-blue-rgb", "--accent-blue2-rgb", "--text-rgb", "--text-muted-rgb", "--bg-rgb", "--bg-page-rgb",
    "--white-rgb", "--black-rgb", "--color-scheme", "--sans",
];

const REPLY_SNIPPET_LENGTH = 200;
const FILE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;

// Snapshots the theme the app shows right now, so the export looks the same.
export function readThemeVariables(): string {
    const style = getComputedStyle(document.documentElement);
    return THEME_VARIABLES.map((name) => `${name}: ${style.getPropertyValue(name).trim()};`)
        .join(" ")
        .replace(/[<>]/g, "");
}

// Mirrors ChatWindow's look as a static page: no scripts, no external requests, all chat content escaped.
export function renderMessagesHtml(input: HtmlExportInput): string {
    const { title, chatType, messages, mediaOutcomes, exportedAt, language, themeVariables } = input;
    const ctx: RenderContext = {
        chatType,
        common: APP_COMMON[language],
        chatTr: CHAT_WINDOW_TRANSLATIONS[language],
        tr: CHAT_EXPORT_TRANSLATIONS[language],
        byId: new Map(messages.map((m) => [m.id, m])),
        mediaOutcomes,
        timeFormat: new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }),
        stampFormat: new Intl.DateTimeFormat(language, { dateStyle: "long", timeStyle: "medium" }),
    };
    const dayFormat = new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" });

    const body: string[] = [];
    let prevDay: string | null = null;
    for (const m of messages) {
        const date = new Date(m.createdAt);
        if (date.toDateString() !== prevDay) {
            body.push(`<div class="daySeparator"><span>${esc(dayFormat.format(date))}</span></div>`);
            prevDay = date.toDateString();
        }
        body.push(m.type === "system"
            ? `<div class="systemMessage" id="msg-${esc(m.id)}"><span>${esc(m.content)}</span></div>`
            : renderMessage(m, ctx));
    }

    const avatarClass = chatType === "group" ? " avatarGroup" : chatType === "saved" ? " avatarSaved" : "";
    const initial = (Array.from(title)[0] ?? "").toUpperCase();
    const subtitle = `${ctx.tr.htmlMessageCount(messages.length)} · ${ctx.tr.htmlExportedAt(ctx.stampFormat.format(exportedAt))}`;

    return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>:root { ${themeVariables} }${STYLES}</style>
</head>
<body>
<header class="header">
<div class="avatar${avatarClass}">${esc(initial)}</div>
<div class="headerText"><div class="title">${esc(title)}</div><div class="subtitle">${esc(subtitle)}</div></div>
</header>
<main class="messages">
${body.join("\n")}
</main>
</body>
</html>
`;
}

function renderMessage(m: ChatMessage, ctx: RenderContext): string {
    const outcome = m.media ? ctx.mediaOutcomes.get(m.media.id) : undefined;
    const isMediaKind = m.type === "image" || m.type === "gif" || m.type === "video" || m.type === "videoNote";
    const hasCaption = isMediaKind && !!m.content;
    // Media that didn't make it into the archive gets a placeholder card inside a normal bubble instead.
    const bareMedia = isMediaKind && !hasCaption && !!outcome?.file;
    const replyTo = m.replyToId ? ctx.byId.get(m.replyToId) : undefined;
    const time = renderTime(m, ctx);

    const parts: string[] = [];
    if (m.forwardedFromSenderName) {
        parts.push(`<span class="forwardedLabel">${esc(ctx.chatTr.forwardedFromPrefix + m.forwardedFromSenderName)}</span>`);
    }
    if (ctx.chatType === "group" && !m.isOwn) {
        parts.push(`<span class="sender">${esc(m.senderName)}</span>`);
    }
    if (replyTo) {
        parts.push(`<a class="replyQuote" href="#msg-${esc(replyTo.id)}"><span class="replySender">${esc(replyTo.senderName)}</span><span class="replyText">${esc(replySnippet(replyTo, ctx.common))}</span></a>`);
    }
    if (m.type === "text") {
        parts.push(`<span class="content${isEmojiOnlyMessage(m.content) ? " emojiOnly" : ""}">${esc(m.content)}</span>`);
    }
    if (m.media) {
        parts.push(renderMedia(m.media, outcome, hasCaption, bareMedia ? time : "", ctx));
    }
    if (m.type !== "text" && m.content) {
        parts.push(`<span class="content mediaCaption">${esc(m.content)}</span>`);
    }
    if (m.reactions.length > 0) {
        const pills = m.reactions.map((r) =>
            `<span class="reactionPill${r.reactedByMe ? " reactionPillActive" : ""}"><span>${esc(r.emoji)}</span><span class="reactionCount">${r.count}</span></span>`);
        parts.push(`<div class="reactions">${pills.join("")}</div>`);
    }
    if (!bareMedia) {
        const edited = m.isEdited ? `<span class="edited">${esc(ctx.chatTr.editedLabel)}</span>` : "";
        parts.push(`<span class="meta">${edited}${time}</span>`);
    }

    return `<div class="bubbleRow${m.isOwn ? " own" : ""}" id="msg-${esc(m.id)}"><div class="bubble${bareMedia ? " bubbleBare" : ""}">${parts.join("")}</div></div>`;
}

function renderTime(m: ChatMessage, ctx: RenderContext): string {
    const date = new Date(m.createdAt);
    return `<time datetime="${esc(m.createdAt)}" title="${esc(ctx.stampFormat.format(date))}">${esc(ctx.timeFormat.format(date))}</time>`;
}

function renderMedia(
    media: MediaAsset,
    outcome: MediaOutcome | undefined,
    hasCaption: boolean,
    overlayTime: string,
    ctx: RenderContext,
): string {
    if (!outcome?.file) {
        const name = media.kind === "file" ? media.fileName : `${mediaLabel(media.kind, ctx.common)} · ${media.fileName}`;
        const reason = outcome?.skipped ? ` · ${ctx.tr.htmlSkipped[outcome.skipped]}` : "";
        return fileCard("span", "fileCard fileMissing", name, formatFileSize(media.sizeBytes) + reason);
    }

    const src = esc(fileUrl(outcome.file));
    if (media.kind === "file") return fileCard("a", "fileCard", media.fileName, formatFileSize(media.sizeBytes), src);
    if (media.kind === "audio") return `<div class="mediaAudio"><audio src="${src}" controls preload="metadata"></audio></div>`;

    const alt = esc(media.fileName);
    let element: string;
    switch (media.kind) {
        case "image":
            element = `<a href="${src}" target="_blank" rel="noopener"><img class="mediaImage" src="${src}" alt="${alt}"${fitSize(media, 340, 340)} loading="lazy"></a>`;
            break;
        case "gif":
            element = media.mimeType.startsWith("video/")
                ? `<video class="mediaGifVideo" src="${src}"${fitSize(media, 340, 340)} autoplay loop muted playsinline></video>`
                : `<img class="mediaImage" src="${src}" alt="${alt}"${fitSize(media, 340, 340)} loading="lazy">`;
            break;
        case "video":
            element = `<video class="mediaVideo" src="${src}"${fitSize(media, 380, 420) || ` width="380"`} controls preload="metadata"></video>`;
            break;
        case "videoNote":
            element = `<video class="mediaVideoNote" src="${src}" controls preload="metadata"></video>`;
            break;
    }

    const wrapClass = [
        "mediaWrap",
        hasCaption ? "mediaBleedTop" : "",
        media.kind === "video" ? "mediaWrapVideo" : "",
        media.kind === "videoNote" ? "mediaWrapVideoNote" : "",
    ].filter(Boolean).join(" ");
    const overlay = overlayTime ? `<span class="mediaTime">${overlayTime}</span>` : "";
    return `<div class="${wrapClass}">${element}${overlay}</div>`;
}

function fileCard(tag: "a" | "span", className: string, name: string, details: string, href?: string): string {
    const link = href ? ` href="${href}" download` : "";
    return `<${tag} class="${className}"${link}><span class="fileIcon">${FILE_ICON}</span><span class="fileInfo"><span class="fileName">${esc(name)}</span><span class="fileSize">${esc(details)}</span></span></${tag}>`;
}

// Width/height attributes sized to fit the box, so the page doesn't jump around while media loads.
function fitSize(media: MediaAsset, maxWidth: number, maxHeight: number): string {
    if (!media.width || !media.height) return "";
    const scale = Math.min(1, maxWidth / media.width, maxHeight / media.height);
    return ` width="${Math.round(media.width * scale)}" height="${Math.round(media.height * scale)}"`;
}

function replySnippet(message: ChatMessage, common: AppCommonTranslation): string {
    const text = message.content
        || (message.media ? (message.type === "file" ? message.media.fileName : mediaLabel(message.media.kind, common)) : "");
    // Array.from keeps emoji whole when cutting.
    return Array.from(text).slice(0, REPLY_SNIPPET_LENGTH).join("");
}

function mediaLabel(kind: MediaAsset["kind"], common: AppCommonTranslation): string {
    switch (kind) {
        case "image": return common.photo;
        case "video": return common.video;
        case "gif": return common.gif;
        case "audio": return common.audio;
        case "videoNote": return common.videoNote;
        case "file": return common.file;
    }
}

// File names can hold spaces, # or %, which would break a raw relative URL.
function fileUrl(path: string): string {
    return path.split("/").map(encodeURIComponent).join("/");
}

function esc(text: string): string {
    return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Adapted from ChatWindow.module.css - keep the two looking alike.
const STYLES = `
* { box-sizing: border-box; }
html { color-scheme: var(--color-scheme); }
body {
    margin: 0; min-height: 100vh;
    font: 18px/145% var(--sans); letter-spacing: 0.18px;
    color: rgb(var(--text-rgb)); background: rgb(var(--bg-rgb));
    -webkit-font-smoothing: antialiased;
}
a { color: inherit; }

.header {
    position: sticky; top: 0; z-index: 1;
    display: flex; align-items: center; gap: 12px; padding: 10px 18px;
    border-bottom: 1px solid rgba(var(--accent-rgb), 0.12);
    background: rgba(var(--bg-page-rgb), 0.85); backdrop-filter: blur(12px);
}
.avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: rgb(var(--white-rgb));
    background: linear-gradient(135deg, rgb(var(--accent-rgb)), rgb(var(--accent2-rgb)));
}
.avatarGroup { background: linear-gradient(135deg, rgb(var(--accent-cyan3-rgb)), rgb(var(--accent2-rgb))); }
.avatarSaved { background: linear-gradient(135deg, rgb(var(--accent-blue-rgb)), rgb(var(--accent-blue2-rgb))); }
.headerText { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.title { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.subtitle { font-size: 12px; color: rgba(var(--text-muted-rgb), 0.6); }

.messages {
    max-width: 960px; margin: 0 auto; padding: 16px 18px 32px;
    display: flex; flex-direction: column; gap: 6px; overflow-x: hidden;
}
.daySeparator, .systemMessage { display: flex; justify-content: center; margin: 10px 0; }
.daySeparator span {
    font-size: 12px; color: rgba(var(--text-muted-rgb), 0.6);
    background: rgba(var(--accent-rgb), 0.08); border-radius: 10px; padding: 3px 12px;
}
.systemMessage span {
    font-size: 12.5px; text-align: center; white-space: pre-wrap; overflow-wrap: anywhere;
    color: rgba(var(--accent-light-rgb), 0.75); background: rgba(var(--accent-rgb), 0.1);
    border-radius: 10px; padding: 5px 14px;
}

.bubbleRow { display: flex; justify-content: flex-start; min-width: 0; scroll-margin-top: 80px; }
.bubbleRow.own { justify-content: flex-end; }
.bubble {
    position: relative; display: flex; flex-direction: column; gap: 3px;
    max-width: min(70%, 520px); min-width: 0; padding: 8px 12px;
    border-radius: 16px; border-bottom-left-radius: 6px;
    background: rgba(var(--accent-rgb), 0.1); border: 1px solid rgba(var(--accent-rgb), 0.14);
    font-size: 14px; line-height: 1.45;
}
.own .bubble {
    border-radius: 16px; border-bottom-right-radius: 6px;
    background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.4), rgba(var(--accent2-rgb), 0.35));
    border-color: rgba(var(--accent-light-rgb), 0.3);
}
.bubble.bubbleBare, .own .bubble.bubbleBare { padding: 0; background: transparent; border: none; }
.bubbleRow:target .bubble { box-shadow: 0 0 0 3px rgba(var(--accent-light-rgb), 0.6); }

.sender { font-size: 12.5px; font-weight: 600; color: rgba(var(--accent-cyan-rgb), 0.85); }
.forwardedLabel { font-size: 12px; font-style: italic; color: rgba(var(--text-muted-rgb), 0.7); }
.replyQuote {
    display: flex; flex-direction: column; padding: 4px 10px; margin-bottom: 2px;
    border-left: 2px solid rgba(var(--accent-light-rgb), 0.6); border-radius: 4px;
    background: rgba(var(--accent-rgb), 0.1); text-decoration: none;
}
.replyQuote:hover { background: rgba(var(--accent-rgb), 0.18); }
.replySender { font-size: 12px; font-weight: 600; color: rgba(var(--accent-light-rgb), 0.9); }
.replyText {
    font-size: 12.5px; color: rgba(var(--text-muted-rgb), 0.8);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;
}
.content { word-break: break-word; white-space: pre-wrap; }
.emojiOnly { font-size: 40px; line-height: 1.25; }
.mediaCaption { margin-top: 4px; }

.mediaWrap { position: relative; display: block; line-height: 0; align-self: flex-start; min-width: 0; max-width: 100%; }
.mediaWrap.mediaBleedTop { margin: -8px -12px 0; }
.mediaImage, .mediaGifVideo { display: block; max-width: 340px; max-height: 340px; height: auto; }
.mediaImage { border-radius: 12px; }
.mediaVideo { display: block; max-width: 100%; height: auto; border-radius: 12px; background: rgb(var(--black-rgb)); }
.mediaVideoNote { display: block; width: 260px; height: 260px; max-width: 100%; border-radius: 24px; object-fit: contain; background: rgb(var(--black-rgb)); }
.mediaTime {
    position: absolute; right: 8px; bottom: 6px; padding: 2px 8px; border-radius: 10px;
    background: rgba(var(--black-rgb), 0.5); color: rgba(var(--white-rgb), 0.92);
    font-size: 11px; line-height: 1.4; pointer-events: none;
}
.mediaAudio {
    padding: 6px 8px; border-radius: 10px; width: 300px; max-width: 100%;
    background: rgba(var(--accent-rgb), 0.08); border: 1px solid rgba(var(--accent-rgb), 0.15);
}
.mediaAudio audio { display: block; width: 100%; height: 40px; accent-color: rgb(var(--accent-rgb)); }

.fileCard {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px; min-width: 180px; max-width: 100%;
    border-radius: 10px; background: rgba(var(--accent-rgb), 0.08); border: 1px solid rgba(var(--accent-rgb), 0.15);
    color: rgba(var(--text-rgb), 0.95); text-decoration: none;
}
.fileMissing { border-style: dashed; opacity: 0.75; }
.fileIcon {
    display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex-shrink: 0;
    border-radius: 8px; background: rgba(var(--accent-rgb), 0.15); color: rgba(var(--accent-light-rgb), 0.9);
}
.fileInfo { display: flex; flex-direction: column; min-width: 0; }
.fileName { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fileSize { font-size: 11.5px; color: rgba(var(--text-muted-rgb), 0.6); }

.reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.reactionPill {
    display: flex; align-items: center; gap: 4px; padding: 2px 7px; font-size: 12.5px; line-height: 1.5;
    border: 1px solid rgba(var(--accent-rgb), 0.2); border-radius: 11px; background: rgba(var(--accent-rgb), 0.06);
}
.reactionPillActive { border-color: rgba(var(--accent-light-rgb), 0.55); background: rgba(var(--accent-rgb), 0.22); }
.reactionCount { color: rgba(var(--text-muted-rgb), 0.75); font-size: 11px; }
.meta { align-self: flex-end; display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: rgba(var(--text-muted-rgb), 0.6); }
.edited { font-style: italic; }

@media (max-width: 760px) {
    body { font-size: 16px; }
    .mediaImage, .mediaGifVideo { max-width: min(220px, 58vw); }
    .mediaVideo { max-width: min(240px, 62vw); }
    .mediaVideoNote { width: min(210px, 54vw); height: min(210px, 54vw); }
}
`;
