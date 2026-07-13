import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { checkSession, refreshSession } from "../api/session";

interface AuthContextValue {
    isAuthenticated: boolean;
    sessionChecked: boolean;
    setAuthenticated: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [sessionChecked, setSessionChecked] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const didInit = useRef(false);

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

    return (
        <AuthContext.Provider
            value={{ isAuthenticated, sessionChecked, setAuthenticated: setIsAuthenticated }}
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