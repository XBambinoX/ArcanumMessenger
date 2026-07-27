const SOUND_FILES: Record<string, string> = {
    bubble: "/sounds/notification_bubble.mp3",
    chime: "/sounds/notification_chime.mp3",
    bell: "/sounds/notification_bell.mp3",
};

const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(sound: string): HTMLAudioElement {
    const src = SOUND_FILES[sound] ?? SOUND_FILES.bubble;
    let audio = audioCache.get(src);
    if (!audio) {
        audio = new Audio(src);
        audio.preload = "auto";
        audioCache.set(src, audio);
    }
    return audio;
}

export function playNotificationSound(sound: string) {
    const audio = getAudio(sound);
    audio.currentTime = 0;
    void audio.play().catch(() => {
    });
}