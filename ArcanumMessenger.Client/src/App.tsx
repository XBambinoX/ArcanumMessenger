import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import TotpSetupPage from "./pages/TotpSetupPage";
import RecoveryPage from "./pages/RecoveryPage";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/welcome" replace />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route path="/login" element={<LoginPage />} />
            <Route path="/2fa/setup/:userId" element={<TotpSetupPage />} />
            <Route path="/recovery" element={<RecoveryPage />} />
        </Routes>
    );
}

export default App;
