import { apiFetch } from "../lib/apiFetch";

export interface UserSettingsResponse {
    username: string;
    bio: string;
    phone: string;
}
 
export async function getUserSettings(): Promise<UserSettingsResponse> {
    const res = await apiFetch("api/settings", {
        credentials: "include",
    });
    return res.json();
}