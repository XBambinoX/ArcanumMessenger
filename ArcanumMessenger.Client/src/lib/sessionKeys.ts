import { importPrivateKeyPkcs8 } from "../crypto/ecdh";
import { toBase64, fromBase64 } from "../crypto/encoding";

/**
 * Holds this device's unwrapped E2EE identity keypair for the tab's
 * lifetime. Backed by sessionStorage (not localStorage) so a page refresh
 * doesn't force a fresh login just to keep reading messages, but it's still
 * gone the moment the tab closes - nothing here is ever sent anywhere, and
 * logging out clears it explicitly too.
 */

const STORAGE_KEY = "arcanum:e2ee:identity:v1";

interface StoredIdentity {
    privateKeyPkcs8: string;
    publicKeyRaw: string;
}

let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicKeyRaw: Uint8Array | null = null;

export function setIdentity(privateKeyPkcs8: Uint8Array, publicKeyRaw: Uint8Array, privateKey?: CryptoKey): void {
    const stored: StoredIdentity = {
        privateKeyPkcs8: toBase64(privateKeyPkcs8),
        publicKeyRaw: toBase64(publicKeyRaw),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    cachedPublicKeyRaw = publicKeyRaw;
    cachedPrivateKey = privateKey ?? null;
}

export function clearIdentity(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    cachedPrivateKey = null;
    cachedPublicKeyRaw = null;
}

export async function getPrivateKey(): Promise<CryptoKey | null> {
    if (cachedPrivateKey) return cachedPrivateKey;
    const stored = readStorage();
    if (!stored) return null;
    cachedPrivateKey = await importPrivateKeyPkcs8(fromBase64(stored.privateKeyPkcs8));
    return cachedPrivateKey;
}

export function getPublicKeyRaw(): Uint8Array | null {
    if (cachedPublicKeyRaw) return cachedPublicKeyRaw;
    const stored = readStorage();
    if (!stored) return null;
    cachedPublicKeyRaw = fromBase64(stored.publicKeyRaw);
    return cachedPublicKeyRaw;
}

function readStorage(): StoredIdentity | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredIdentity;
    } catch {
        return null;
    }
}
