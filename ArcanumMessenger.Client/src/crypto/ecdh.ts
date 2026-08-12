import { toBase64, fromBase64 } from "./encoding";

/**
 * Identity keypairs (ECDH P-256, native WebCrypto) plus an anonymous sealed
 * box: seal(recipientPublicKey, bytes) hands a secret to whoever holds the
 * matching private key, using only their public key - no interaction
 * required. This is how a chat's symmetric key gets handed to each member
 * (and how a user's own ECDH private key is wrapped with their `encKey`).
 */

const CURVE = "P-256";
const PUBLIC_KEY_RAW_SIZE = 65; // uncompressed P-256 point: 0x04 || x(32) || y(32)
const AES_KEY_SIZE = 32;
const NONCE_SIZE = 12;
const TAG_BITS = 128;
const HKDF_INFO_SEAL = "arcanum/chat-key-seal/v1";

export interface IdentityKeyPair {
    publicKeyRaw: Uint8Array;
    privateKey: CryptoKey;
}

export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: CURVE }, true, ["deriveBits"]);
    const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    return { publicKeyRaw, privateKey: keyPair.privateKey };
}

export async function exportPrivateKeyPkcs8(privateKey: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
}

export async function importPrivateKeyPkcs8(pkcs8: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey("pkcs8", pkcs8 as BufferSource, { name: "ECDH", namedCurve: CURVE }, true, [
        "deriveBits",
    ]);
}

export async function importPublicKeyRaw(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", raw as BufferSource, { name: "ECDH", namedCurve: CURVE }, true, []);
}

/** Wraps a user's own ECDH private key (pkcs8 bytes) with their `encKey` - AES-256-GCM, base64(nonce||ciphertext+tag). */
export async function wrapPrivateKey(encKey: Uint8Array, privateKeyPkcs8: Uint8Array): Promise<string> {
    return aesGcmEncrypt(encKey, privateKeyPkcs8);
}

export async function unwrapPrivateKey(encKey: Uint8Array, wrapped: string): Promise<Uint8Array> {
    return aesGcmDecrypt(encKey, wrapped);
}

/** Anonymous sealed box: hands `plaintext` to whoever holds the private key matching `recipientPublicKeyRaw`. */
export async function seal(recipientPublicKeyRaw: Uint8Array, plaintext: Uint8Array): Promise<string> {
    const ephemeral = await generateIdentityKeyPair();
    const recipientPublicKey = await importPublicKeyRaw(recipientPublicKeyRaw);
    const wrapKey = await deriveWrapKey(ephemeral.privateKey, recipientPublicKey, ephemeral.publicKeyRaw);

    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce as BufferSource, tagLength: TAG_BITS },
            wrapKey,
            plaintext as BufferSource,
        ),
    );

    const result = new Uint8Array(ephemeral.publicKeyRaw.length + nonce.length + ciphertext.length);
    result.set(ephemeral.publicKeyRaw, 0);
    result.set(nonce, ephemeral.publicKeyRaw.length);
    result.set(ciphertext, ephemeral.publicKeyRaw.length + nonce.length);
    return toBase64(result);
}

export async function unseal(ownPrivateKey: CryptoKey, blob: string): Promise<Uint8Array> {
    const bytes = fromBase64(blob);
    const ephemeralPublicKeyRaw = bytes.slice(0, PUBLIC_KEY_RAW_SIZE);
    const nonce = bytes.slice(PUBLIC_KEY_RAW_SIZE, PUBLIC_KEY_RAW_SIZE + NONCE_SIZE);
    const ciphertext = bytes.slice(PUBLIC_KEY_RAW_SIZE + NONCE_SIZE);

    const ephemeralPublicKey = await importPublicKeyRaw(ephemeralPublicKeyRaw);
    const wrapKey = await deriveWrapKey(ownPrivateKey, ephemeralPublicKey, ephemeralPublicKeyRaw);

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce as BufferSource, tagLength: TAG_BITS },
        wrapKey,
        ciphertext as BufferSource,
    );
    return new Uint8Array(plaintext);
}

/** ECDH(privateKey, publicKey) -> HKDF -> a one-time AES-GCM key. `salt` is the ephemeral public key, known to both sides. */
async function deriveWrapKey(privateKey: CryptoKey, publicKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
    const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, AES_KEY_SIZE * 8);
    const sharedSecret = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"]);
    const wrapKeyBits = await crypto.subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: salt as BufferSource,
            info: new TextEncoder().encode(HKDF_INFO_SEAL),
        },
        sharedSecret,
        AES_KEY_SIZE * 8,
    );
    return crypto.subtle.importKey("raw", wrapKeyBits, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): Promise<string> {
    const aesKey = await crypto.subtle.importKey("raw", key as BufferSource, "AES-GCM", false, ["encrypt"]);
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce as BufferSource, tagLength: TAG_BITS },
            aesKey,
            plaintext as BufferSource,
        ),
    );
    const result = new Uint8Array(nonce.length + ciphertext.length);
    result.set(nonce, 0);
    result.set(ciphertext, nonce.length);
    return toBase64(result);
}

async function aesGcmDecrypt(key: Uint8Array, blob: string): Promise<Uint8Array> {
    const bytes = fromBase64(blob);
    const nonce = bytes.slice(0, NONCE_SIZE);
    const ciphertext = bytes.slice(NONCE_SIZE);
    const aesKey = await crypto.subtle.importKey("raw", key as BufferSource, "AES-GCM", false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce as BufferSource, tagLength: TAG_BITS },
        aesKey,
        ciphertext as BufferSource,
    );
    return new Uint8Array(plaintext);
}
