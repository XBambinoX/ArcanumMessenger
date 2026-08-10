import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { checkSession, refreshSession } from "../api/session";
import * as sessionKeys from "../lib/sessionKeys";

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

    // Re-checked every time isAuthenticated turns true, not just once on
    // load - a real login (LoginPage) always calls sessionKeys.setIdentity()
    // before setAuthenticated(true), so this correctly resolves to false
    // right after one; it only stays true for the cookie-only auto-login
    // path, which never touches sessionKeys at all.
    useEffect(() => {
        setNeedsUnlock(isAuthenticated && !sessionKeys.hasIdentity());
    }, [isAuthenticated]);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        (async () => {
            try {
                const { success } = await checkSession();
                if (success) {
                    setIsAuthenticated(true);
                    setSessionChecked(true);
                    return;
                }
                const refreshRes = await refreshSession();
                setIsAuthenticated(refreshRes.success);
            } catch {
                setIsAuthenticated(false);
            } finally {
                setSessionChecked(true);
            }
        })();
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
                setAuthenticated: setIsAuthenticated,
                needsUnlock,
                confirmUnlocked: () => setNeedsUnlock(false),
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