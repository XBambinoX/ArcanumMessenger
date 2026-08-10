import { useState } from "react";
import { useNavigate } from "react-router";
import styles from "./UnlockPage.module.css";
import { deriveKeys } from "../crypto/kdf";
import { getKdfSalt, getIdentityKeys } from "../api/userSettings";
import { importPrivateKeyPkcs8, unwrapPrivateKey } from "../crypto/ecdh";
import { fromBase64 } from "../crypto/encoding";
import * as sessionKeys from "../lib/sessionKeys";
import { logout } from "../api/session";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../lib/language";
import { UNLOCK_TRANSLATIONS } from "../lib/authTranslations";

// Shown instead of AppPage whenever this tab is authenticated (valid
// session cookie) but never went through LoginPage's password entry - e.g.
// a fresh tab opened against an already-valid refresh token. There's no
// E2EE identity in memory yet, so every encrypt/decrypt call would
// otherwise silently do nothing. Re-derives it from the password without a
// full logout/login round-trip - see AuthContext's needsUnlock.
export default function UnlockPage() {
    const navigate = useNavigate();
    const language = useLanguage();
    const tr = UNLOCK_TRANSLATIONS[language];
    const { setAuthenticated, confirmUnlocked } = useAuth();

    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleUnlock = async () => {
        if (!password || loading) return;
        setLoading(true);
        setError(null);

        try {
            const [kdfSalt, identity] = await Promise.all([getKdfSalt(), getIdentityKeys()]);
            if (!identity.ecdhPublicKey || !identity.wrappedEcdhPrivateKey) {
                setError(tr.somethingWrong);
                return;
            }

            const { encKey } = await deriveKeys(password, kdfSalt);

            // unwrapPrivateKey is AES-GCM (authenticated) - a wrong password
            // makes this throw rather than silently returning garbage, so
            // that's the only password check needed here, no server round-trip.
            const privateKeyPkcs8 = await unwrapPrivateKey(encKey, identity.wrappedEcdhPrivateKey);
            const privateKey = await importPrivateKeyPkcs8(privateKeyPkcs8);
            sessionKeys.setIdentity(privateKeyPkcs8, fromBase64(identity.ecdhPublicKey), privateKey);
            confirmUnlocked();
        } catch {
            setError(tr.incorrectPassword);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        setAuthenticated(false);
        navigate("/welcome");
    };

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                <h1 className={styles.title}>{tr.title}</h1>
                <p className={styles.subtitle}>{tr.subtitle}</p>

                <input
                    className={styles.passwordInput}
                    type="password"
                    placeholder={tr.passwordPlaceholder}
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                    autoFocus
                />

                {error && <p className={styles.error}>{error}</p>}

                <button
                    className={styles.unlockBtn}
                    onClick={handleUnlock}
                    disabled={loading || password.length === 0}
                >
                    {loading ? tr.unlocking : tr.unlockButton}
                </button>

                <button className={styles.logoutLink} onClick={handleLogout}>
                    {tr.logoutInstead}
                </button>
            </div>
        </div>
    );
}
