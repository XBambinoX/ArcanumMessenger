import { apiFetch } from "../lib/apiFetch";

export interface UserSettingsResponse {
    username: string;
    bio: string;
    phone: string;
}

export interface UpdateAccountFieldsRequest {
    username?: string;
    bio?: string;
    phone?: string;
}
 
export async function getUserSettings(): Promise<UserSettingsResponse> {
    const res = await apiFetch("api/settings/get", {
        credentials: "include",
    });
    return res.json();
}

export async function updateAccountFields( payload: UpdateAccountFieldsRequest, ): Promise<void> {
    await apiFetch("api/settings/update-account", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}