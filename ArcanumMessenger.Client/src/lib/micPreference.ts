const STORAGE_KEY = "preferredMicId";

// Mobile Chrome only ever exposes one generic "default" audio input via
// enumerateDevices() - unlike desktop, there's no real per-device list to
// pick from, so a connected Bluetooth headset silently becomes "the"
// input with no way to ask for the phone's own mic by id instead.
//
const AUDIO_PROCESSING_HINT: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: true,
    autoGainControl: true,
};

export function getPreferredMicId(): string | null {
    return localStorage.getItem(STORAGE_KEY);
}

export function setPreferredMicId(deviceId: string | null): void {
    if (deviceId) localStorage.setItem(STORAGE_KEY, deviceId);
    else localStorage.removeItem(STORAGE_KEY);
}

// Requests a mic (+ optional camera) stream honoring the saved
// preference, if any. Falls back to the system default mic instead of
// failing outright when the saved device can't be used right now - a
// stale deviceId (headset left at home today, or a browser/site
// permission reset that invalidated it) shouldn't be worse than having
// no preference at all, and shouldn't be able to derail the *video*
// permission prompt in a combined video+audio request just because the
// audio half of the constraint was the part that didn't resolve. Retries
// on any failure here, not just OverconstrainedError - a stale/invalid
// deviceId doesn't reliably surface as that specific error in every
// browser, and retrying the plain default costs nothing extra when the
// real cause is a flat permission denial anyway (the retry fails the
// same way, just once more).
export async function getUserMediaWithPreferredMic(
    videoConstraints: MediaTrackConstraints | boolean = false,
): Promise<MediaStream> {
    const preferred = getPreferredMicId();
    if (preferred) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: {
                    ...AUDIO_PROCESSING_HINT,
                    deviceId: { exact: preferred },
                },
            });
        } catch {
            // Falls through to the plain-default request below.
        }
    }
    return navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: AUDIO_PROCESSING_HINT,
    });
}
