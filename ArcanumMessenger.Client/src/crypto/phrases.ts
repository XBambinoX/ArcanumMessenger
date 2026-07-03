import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { toHex } from "./encoding";

/**
 * Recovery phrases are generated here, in the browser, and never sent to the
 * server in plain form. The server only ever receives hashPhrase(phrase).
 */

const ENTROPY_BITS = 128; // 12 words
const SEPARATOR = "-";

export function generateRecoveryPhrase(): string {
    return generateMnemonic(wordlist, ENTROPY_BITS).split(" ").join(SEPARATOR);
}

/** Accepts user input separated by spaces or hyphens, in any case. */
export function normalizePhrase(input: string): string {
    return input.trim().toLowerCase().split(/[\s-]+/).join(SEPARATOR);
}

/** SHA-256 hex of the normalized phrase — this is what goes to the server. */
export async function hashPhrase(phrase: string): Promise<string> {
    const bytes = new TextEncoder().encode(normalizePhrase(phrase));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return toHex(new Uint8Array(digest));
}
