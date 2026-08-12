import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { checkSession, refreshSession } from "../api/session";
import * as sessionKeys from "../lib/sessionKeys";
import { clearChatKeyCache } from "../lib/chatCrypto";
import { setSessionExpiredHandler } from "../lib/authEvents";

interface AuthContextValue {
    isAuthenticated: boolean;
    sessionChecked: boolean;
    setAuthenticated: (value: boolean) => void;
    // True once isAuthenticated is true (a valid session cookie) but this
    // tab never went through the password-entry login flow, so there's no
    // E2EE identity in memory yet - e.g. a fresh tab opened against an
    // already-valid refresh token. Every encrypt/decrypt call silently
    // does nothing until this is resolved (see UnlockPage).
    needsUnlock: boolean;
    confirmUnlocked: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The access-token cookie is only valid for 5 minutes server-side
// (JwtService.AccessTokenMinutes). apiFetch() silently renews it on a 401,
// but native browser requests - <video src>, <img src>, <a href> - never go
// through apiFetch, so a video that just sits in the chat for a few minutes
// before someone clicks play will 401 with no retry. Refreshing here, well
// under that 5-minute window, keeps the cookie alive so those plain
// requests never see an expired token in the first place.
const ACCESS_TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
    const [sessionChecked, setSessionChecked] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [needsUnlock, setNeedsUnlock] = useState(false);
    const didInit = useRef(false);

    // Sets both together in the same render (React 18+/19 batches this
    // automatically) instead of deriving needsUnlock a render behind in
    // its own effect - that lag used to let AppPage mount and start
    // decrypting for one commit before this ever caught up, permanently
    // caching every chat as keyless (see chatCrypto's keyCache) since
    // there was genuinely no identity yet at that exact moment. A real
    // login (LoginPage) always calls sessionKeys.setIdentity() before
    // this runs, so it still correctly resolves to false right after
    // one; it's only true for the cookie-only auto-login path, which
    // never touches sessionKeys at all.
    const applyAuthenticated = (value: boolean) => {
        setIsAuthenticated(value);
        setNeedsUnlock(value && !sessionKeys.hasIdentity());
    };

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        (async () => {
            try {
                const { success } = await checkSession();
                if (success) {
                    applyAuthenticated(true);
                    setSessionChecked(true);
                    return;
                }
                const refreshRes = await refreshSession();
                applyAuthenticated(refreshRes.success);
            } catch {
                applyAuthenticated(false);
            } finally {
                setSessionChecked(true);
            }
        })();
    }, []);

    // apiFetch's refreshOnce() calls this whenever any refresh attempt -
    // reactive (a 401 retry) or proactive (the interval/visibility timers
    // below) - comes back not-ok. Without this, a session that quietly
    // died stayed isAuthenticated=true until the next full reload, so
    // every action in between just silently failed instead of bouncing
    // to /login right away.
    useEffect(() => {
        setSessionExpiredHandler(() => applyAuthenticated(false));
        return () => setSessionExpiredHandler(null);
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

        const interval = window.setInterval(() => {
            refreshSession();
        }, ACCESS_TOKEN_REFRESH_INTERVAL_MS);

        // Browsers throttle setInterval heavily in a backgrounded tab, so the
        // timer above can't be trusted alone - a tab minimized for a while
        // can still come back to an expired cookie. Catching up the moment
        // the tab is visible again closes that gap.
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") refreshSession();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [isAuthenticated]);

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                sessionChecked,
                setAuthenticated: applyAuthenticated,
                needsUnlock,
                confirmUnlocked: () => {
                    // Recovery net for the keyCache-poisoning race this
                    // same fix closes at the source (see applyAuthenticated
                    // above) - cheap, and makes unlocking self-heal even if
                    // something else manages to poison it in the future.
                    clearChatKeyCache();
                    setNeedsUnlock(false);
                },
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}