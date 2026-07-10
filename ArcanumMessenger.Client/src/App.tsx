import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import TotpSetupPage from "./pages/TotpSetupPage";
import RecoveryPage from "./pages/RecoveryPage";
import AppPage from "./pages/AppPage"; // Main messenger application page
import { checkSession, refreshSession } from "./api/session";

function App() {
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

    if (!sessionChecked) {
        return null;
    }

    return (
        <Routes>
            <Route
                path="/"
                element={<Navigate to={isAuthenticated ? "/app" : "/welcome"} replace />}
            />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
                path="/login"
                element={isAuthenticated ? <Navigate to="/app" replace /> : <LoginPage />}
            />
            <Route path="/2fa/setup/:userId" element={<TotpSetupPage />} />
            <Route path="/recovery" element={<RecoveryPage />} />
            <Route
                path="/app"
                element={isAuthenticated ? <AppPage /> : <Navigate to="/login" replace />}
            />
        </Routes>
    );
}

export default App;