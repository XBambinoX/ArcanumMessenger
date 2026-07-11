import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import TotpSetupPage from "./pages/TotpSetupPage";
import RecoveryPage from "./pages/RecoveryPage";
import AppPage from "./pages/AppPage";
import ErrorPage from "./pages/ErrorPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import NavigationSetter from "./lib/navigation";

function AppRoutes() {
    const { isAuthenticated, sessionChecked } = useAuth();

    if (!sessionChecked) {
        return null;
    }

    return (
        <>
            <NavigationSetter />
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
                <Route path="/error" element={<ErrorPage />} />
            </Routes>
        </>
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