import { apiFetch } from "../lib/apiFetch";
import { deriveKeys } from "../crypto/kdf";

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

export async function deleteAccount(password: string, kdfSalt: string): Promise<{ ok: boolean; reason?: string }> {
    const { authKey } = await deriveKeys(password, kdfSalt);

    const res = await apiFetch("/api/settings/delete-account", {
        method: "POST",
        body: JSON.stringify({ authKey }),
    });

    if (res.status === 422) {
        const body = await res.json().catch(() => null);
        return { ok: false, reason: body?.reason ?? "invalid_password" };
    }

    if (!res.ok) {
        return { ok: false, reason: "unknown_error" };
    }

    return { ok: true };
}

export async function getKdfSalt(): Promise<string> {
    const res = await apiFetch("/api/settings/kdf-salt");
    return (await res.json()).kdfSalt;
}