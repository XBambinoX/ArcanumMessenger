import { argon2id } from "hash-wasm";
import { toBase64, fromBase64 } from "./encoding";

/**
 * Key hierarchy (zero-knowledge auth):
 *
 *   password + kdfSalt --Argon2id--> masterKey (never leaves the client)
 *   masterKey --HKDF("auth")--> authKey  -> sent to the server instead of the password
 *   masterKey --HKDF("enc")-->  encKey   -> stays on the client, will wrap message keys later
 *
 * The server cannot recover the password or encKey from authKey.
 */

const ARGON2_ITERATIONS = 3;
const ARGON2_MEMORY_KB = 65536; // 64 MB
const ARGON2_PARALLELISM = 4;
const KEY_SIZE = 32;
const SALT_SIZE = 16;

const HKDF_INFO_AUTH = "arcanum/auth-key/v1";
const HKDF_INFO_ENC = "arcanum/enc-key/v1";

export interface DerivedKeys {
    /** Base64. This is the "password" from the server's point of view. */
    authKey: string;
    /** Raw bytes. Never send this anywhere. */
    encKey: Uint8Array;
}

export function generateKdfSalt(): string {
    return toBase64(crypto.getRandomValues(new Uint8Array(SALT_SIZE)));
}

export async function deriveKeys(
    password: string,
    kdfSaltBase64: string,
): Promise<DerivedKeys> {
    const masterKey = await argon2id({
        password,
        salt: fromBase64(kdfSaltBase64),
        iterations: ARGON2_ITERATIONS,
        memorySize: ARGON2_MEMORY_KB,
        parallelism: ARGON2_PARALLELISM,
        hashLength: KEY_SIZE,
        outputType: "binary",
    });

    const [authKey, encKey] = await Promise.all([
        hkdf(masterKey, HKDF_INFO_AUTH),
        hkdf(masterKey, HKDF_INFO_ENC),
    ]);

    return { authKey: toBase64(authKey), encKey };
}

async function hkdf(keyMaterial: Uint8Array, info: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        "raw",
        keyMaterial as BufferSource,
        "HKDF",
        false,
        ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(0),
            info: new TextEncoder().encode(info),
        },
        key,
        KEY_SIZE * 8,
    );
    return new Uint8Array(bits);
}
