/**
 * The 6-digit code fields (email verification, and TOTP at login and at 2FA
 * setup) are one <input maxLength={1}> per digit - a paste only ever lands in
 * the focused box, where maxLength cuts it down to its first character. This
 * spreads a pasted code across the boxes instead.
 */
export function spreadPastedCode(
    code: string[],
    pastedIndex: number,
    pasted: string,
): { code: string[]; focusIndex: number } | null {
    const allDigits = pasted.replace(/\D/g, "");
    if (allDigits.length === 0) return null;

    const start = allDigits.length >= code.length ? 0 : pastedIndex;
    const digits = allDigits.slice(0, code.length - start);

    const next = [...code];
    for (let i = 0; i < digits.length; i++) next[start + i] = digits[i];

    return { code: next, focusIndex: Math.min(start + digits.length, code.length - 1) };
}
