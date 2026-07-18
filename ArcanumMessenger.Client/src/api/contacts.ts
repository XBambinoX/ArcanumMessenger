import { apiFetch } from "../lib/apiFetch";
import type { UserSearchResult } from "../types/messenger";

export async function getContacts(): Promise<UserSearchResult[]> {
    const res = await apiFetch("/api/contacts", { credentials: "include" });
    const data = await res.json();
    return data.success ? (data.contacts ?? []) : [];
}

export async function addContact(contactId: string): Promise<boolean> {
    const res = await apiFetch("/api/contacts", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ contactId }),
    });
    const data = await res.json();
    return data.success === true;
}

export async function removeContact(contactId: string): Promise<boolean> {
    const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}
