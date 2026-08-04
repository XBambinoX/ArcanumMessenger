import { checkSession } from "../api/session";

/**
 * The caller's own user id is needed client-side to seal a chat key for
 * "myself" alongside every other member - but nothing else in the app
 * tracks it, since the server resolves "isSelf"/"isOwn" flags itself.
 * Fetched once per tab from the cheap, cookie-based /api/auth/me and cached
 * in memory afterward.
 */

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

export async function getMyUserId(): Promise<string | null> {
    if (cached) return cached;
    if (!inflight) {
        inflight = checkSession()
            .then((res) => {
                cached = res.userId ?? null;
                return cached;
            })
            .finally(() => {
                inflight = null;
            });
    }
    return inflight;
}
