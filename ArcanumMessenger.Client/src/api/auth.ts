const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5173";

export async function checkUsername(username: string): Promise<{ available: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/check-username?username=${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error("Network error");
    return res.json();
}