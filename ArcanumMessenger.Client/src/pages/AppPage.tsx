import { useNavigate } from "react-router-dom";
import { logout } from "../api/session";

export default function AppPage() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                background: "#0d0b1e",
                color: "rgba(226, 232, 240, 0.95)",
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
        >
            <h1 style={{ fontSize: "28px", fontWeight: 700 }}>
                Welcome to Arcanum main page
            </h1>
            <button
                onClick={handleLogout}
                style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Log out
            </button>
        </div>
    );
}
