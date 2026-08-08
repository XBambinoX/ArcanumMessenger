import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import styles from "./LoginPage.module.css";
import { deriveKeys } from "../crypto/kdf";
import { useAuth } from "../context/AuthContext";

/**
 * Expected in ../api/auth (not implemented here — wire these up to your
 * AuthController endpoints):
 *
 *   startLogin(email) -> { success, sessionId?, kdfSalt?, reason? }
 *     Looks up the user by email and returns the KdfSalt needed to derive
 *     authKey from the password. To avoid leaking which emails are
 *     registered, an unknown email should still return a (fake but
 *     stable) sessionId + kdfSalt rather than an immediate failure —
 *     the real rejection happens at the password step.
 *
 *   submitLoginPassword(sessionId, authKey) -> { success, requiresTotp?, reason? }
 *     Verifies authKey against PasswordHash. If the account has 2FA
 *     enabled (UserSettings), requiresTotp is true and login isn't
 *     complete yet — the TOTP step follows.
 *
 *   submitLoginTotp(sessionId, code) -> { success, reason? }
 *     Verifies the 6-digit TOTP code and completes the login.
 */
import { startLogin, submitLoginPassword, submitLoginTotp, completeLogin } from "../api/login";
import { setIdentityKey } from "../api/users";
import {
    generateIdentityKeyPair,
    exportPrivateKeyPkcs8,
    importPrivateKeyPkcs8,
    unwrapPrivateKey,
    wrapPrivateKey,
} from "../crypto/ecdh";
import { toBase64, fromBase64 } from "../crypto/encoding";
import * as sessionKeys from "../lib/sessionKeys";
import { useLanguage } from "../lib/language";
import { AUTH_COMMON, LOGIN_TRANSLATIONS } from "../lib/authTranslations";

type Step = 0 | 1 | 2;
const CODE_LENGTH = 6;

export default function LoginPage() {
    const navigate = useNavigate();
    const language = useLanguage();
    const common = AUTH_COMMON[language];
    const tr = LOGIN_TRANSLATIONS[language];
    const [step, setStep] = useState<Step>(0);
    const [stepCount, setStepCount] = useState<2 | 3>(2);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [kdfSalt, setKdfSalt] = useState<string | null>(null);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
    // Derived alongside authKey at the password step and needed again once
    // login completes (possibly after an intervening TOTP step) to unwrap
    // this device's identity private key - kept in a ref rather than state
    // since it's sensitive and never needs to trigger a re-render.
    const encKeyRef = useRef<Uint8Array | null>(null);

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isCodeComplete = code.every((d) => d !== "");

    const { setAuthenticated } = useAuth();

    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 0) as Step);
    };

    // Unwraps this device's identity private key with the encKey derived at
    // the password step, or - for accounts that predate E2EE and have none
    // yet - generates and uploads a fresh keypair. Either way, caches the
    // result via sessionKeys for the rest of this tab's session.
    const establishIdentity = async (
        ecdhPublicKey: string | null | undefined,
        wrappedEcdhPrivateKey: string | null | undefined,
    ) => {
        const encKey = encKeyRef.current;
        if (!encKey) return;

        if (ecdhPublicKey && wrappedEcdhPrivateKey) {
            const privateKeyPkcs8 = await unwrapPrivateKey(encKey, wrappedEcdhPrivateKey);
            const privateKey = await importPrivateKeyPkcs8(privateKeyPkcs8);
            sessionKeys.setIdentity(privateKeyPkcs8, fromBase64(ecdhPublicKey), privateKey);
            return;
        }

        const identity = await generateIdentityKeyPair();
        const privateKeyPkcs8 = await exportPrivateKeyPkcs8(identity.privateKey);
        const wrapped = await wrapPrivateKey(encKey, privateKeyPkcs8);
        await setIdentityKey(toBase64(identity.publicKeyRaw), wrapped);
        sessionKeys.setIdentity(privateKeyPkcs8, identity.publicKeyRaw, identity.privateKey);
    };

    const handleEmailSubmit = async () => {
        if (!isEmailValid) {
            setError(common.invalidEmail);
            return;
        }
        setLoading(true);
        try {
            const { success, sessionId, kdfSalt, reason } =
                await startLogin(email);
            if (!success || !sessionId || !kdfSalt) {
                setError(
                    reason === "invalid_format"
                        ? common.invalidEmail
                        : reason === "too_many_attempts"
                          ? common.tooManyAttemptsLater
                          : common.somethingWrongTryAgain,
                );
                return;
            }
            setSessionId(sessionId);
            setKdfSalt(kdfSalt);
            setError("");
            setStep(1);
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async () => {
        if (!password) {
            setError(tr.enterPassword);
            return;
        }
        setLoading(true);
        try {
            const { authKey, encKey } = await deriveKeys(password, kdfSalt!);
            encKeyRef.current = encKey;
            const { success, requiresTotp, reason } = await submitLoginPassword(
                sessionId!,
                authKey,
            );
            if (!success) {
                setError(
                    reason === "session_expired"
                        ? common.sessionExpired
                        : reason === "too_many_attempts"
                          ? common.tooManyAttemptsLater
                          : tr.incorrectEmailOrPassword,
                );
                return;
            }
            if (requiresTotp) {
                setStepCount(3);
                setError("");
                setStep(2);
                return;
            }

            const completeRes = await completeLogin(sessionId!);
            if (!completeRes.success) {
                setError(tr.completeLoginFailed);
                return;
            }

            await establishIdentity(completeRes.ecdhPublicKey, completeRes.wrappedEcdhPrivateKey);
            setAuthenticated(true);
            navigate("/app");
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handleTotpSubmit = async () => {
        if (!isCodeComplete) {
            setError(common.enterFullCode);
            return;
        }
        setLoading(true);
        try {
            const { success, reason } = await submitLoginTotp(
                sessionId!,
                code.join(""),
            );
            if (!success) {
                setError(
                    reason === "session_expired"
                        ? common.sessionExpired
                        : reason === "too_many_attempts"
                          ? common.tooManyAttemptsLater
                          : common.invalidCode,
                );
                setCode(Array(CODE_LENGTH).fill(""));
                codeInputs.current[0]?.focus();
                return;
            }

            const completeRes = await completeLogin(sessionId!);
            if (!completeRes.success) {
                setError(common.somethingWrongTryAgain);
                return;
            }
            await establishIdentity(completeRes.ecdhPublicKey, completeRes.wrappedEcdhPrivateKey);
            setAuthenticated(true);
            navigate("/app");
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeChange = (index: number, value: string) => {
        if (!/^[0-9]?$/.test(value)) return;
        const next = [...code];
        next[index] = value;
        setCode(next);
        if (value && index < CODE_LENGTH - 1) {
            codeInputs.current[index + 1]?.focus();
        }
    };

    const handleCodeKeyDown = (
        index: number,
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            codeInputs.current[index - 1]?.focus();
        }
    };

    const stepTitles = [
        { title: tr.step0Title, subtitle: tr.step0Subtitle },
        {
            title: tr.step1Title,
            subtitle: (
                <>
                    {tr.signingInAsPrefix}
                    <b>{email}</b>
                </>
            ),
        },
        {
            title: tr.step2Title,
            subtitle: tr.step2Subtitle,
        },
    ];

    return (
        <div className={styles.root}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.grid} />

            <div className={styles.card}>
                <div className={styles.header}>
                    <button
                        className={styles.backHome}
                        onClick={() => navigate("/welcome")}
                        aria-label={common.backToWelcomeAria}
                        style={{
                            visibility: step === 0 ? "visible" : "hidden",
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div className={styles.logoBox}>
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 48 48"
                            fill="none"
                        >
                            <path
                                d="M16 12H32a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H20l-6 5v-5a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
                                stroke="url(#rg)"
                                strokeWidth="2.2"
                                fill="none"
                                strokeLinejoin="round"
                            />
                            <defs>
                                <linearGradient
                                    id="rg"
                                    x1="6"
                                    y1="4"
                                    x2="42"
                                    y2="44"
                                    gradientUnits="userSpaceOnUse"
                                >
                                    <stop stopColor="#a78bfa" />
                                    <stop offset="1" stopColor="#22d3ee" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <p className={styles.brand}>Arcanum</p>
                </div>

                <div className={styles.dots}>
                    {Array.from({ length: stepCount }).map((_, i) => (
                        <span
                            key={i}
                            className={`${styles.dot} ${i === step ? styles.active : ""} ${i < step ? styles.done : ""}`}
                        />
                    ))}
                </div>

                <div className={styles.viewport}>
                    <div
                        className={styles.track}
                        style={{ transform: `translateX(-${step * 100}%)` }}
                    >
                        {/* ── STEP 0: Email ── */}
                        <div className={styles.slide}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[0].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[0].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>{common.emailLabel}</label>
                                <input
                                    className={`${styles.input} ${error && step === 0 ? styles.error : ""}`}
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && handleEmailSubmit()
                                    }
                                    autoFocus
                                />
                                {error && step === 0 && (
                                    <p className={styles.errorText}>{error}</p>
                                )}
                            </div>

                            <div className={styles.actions}>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={handleEmailSubmit}
                                    disabled={loading}
                                >
                                    {loading ? common.checking : common.continueLabel}
                                </button>
                            </div>

                            <p className={styles.footerNote}>
                                {tr.dontHaveAccount}{" "}
                                <button
                                    className={styles.footerLink}
                                    onClick={() => navigate("/register")}
                                >
                                    {tr.createOne}
                                </button>
                            </p>
                        </div>

                        {/* ── STEP 1: Password ── */}
                        <div className={styles.slide}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[1].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[1].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>{common.passwordLabel}</label>
                                <input
                                    className={`${styles.input} ${error && step === 1 ? styles.error : ""}`}
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" &&
                                        handlePasswordSubmit()
                                    }
                                    autoFocus={step === 1}
                                />
                                {error && step === 1 && (
                                    <p className={styles.errorText}>{error}</p>
                                )}
                            </div>

                            <div className={styles.actions}>
                                <button
                                    className={styles.btnBack}
                                    onClick={goBack}
                                    aria-label={common.backAria}
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={handlePasswordSubmit}
                                    disabled={loading}
                                >
                                    {loading ? tr.signingIn : common.signIn}
                                </button>
                            </div>

                            <p className={styles.footerNote}>
                                {tr.forgotPassword}{" "}
                                <button
                                    className={styles.footerLink}
                                    onClick={() => navigate("/recovery")}
                                >
                                    {tr.changeIt}
                                </button>
                            </p>
                        </div>

                        {/* ── STEP 2: TOTP (only if enabled in settings) ── */}
                        <div className={styles.slide}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[2].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[2].subtitle}
                            </p>

                            <div className={styles.codeRow}>
                                {code.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            codeInputs.current[i] = el;
                                        }}
                                        className={styles.codeDigit}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) =>
                                            handleCodeChange(i, e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            handleCodeKeyDown(i, e)
                                        }
                                        autoFocus={step === 2 && i === 0}
                                    />
                                ))}
                            </div>
                            {error && step === 2 && (
                                <p
                                    className={styles.errorText}
                                    style={{ textAlign: "center" }}
                                >
                                    {error}
                                </p>
                            )}

                            <div className={styles.actions}>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={handleTotpSubmit}
                                    disabled={loading}
                                >
                                    {loading ? common.verifying : common.verify}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
