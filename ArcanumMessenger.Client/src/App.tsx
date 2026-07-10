import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import TotpSetupPage from "./pages/TotpSetupPage";
import RecoveryPage from "./pages/RecoveryPage";
import AppPage from "./pages/AppPage";
import { AuthProvider, useAuth } from "./context/AuthContext";

function AppRoutes() {
    const { isAuthenticated, sessionChecked } = useAuth();

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

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}

export default App;