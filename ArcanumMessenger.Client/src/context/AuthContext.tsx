import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

    useEffect(() => {
        (async () => {
            const { success } = await checkSession();
            if (success) {
                setIsAuthenticated(true);
                setSessionChecked(true);
                return;
            }

            const refreshRes = await refreshSession();
            setIsAuthenticated(refreshRes.success);
            setSessionChecked(true);
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