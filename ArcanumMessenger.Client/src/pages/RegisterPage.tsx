import { useState, useRef, useEffect } from "react";
import styles from "./RegisterPage.module.css";
import {
    startRegistration,
    submitEmail,
    verifyCode,
    resendCode,
    submitPassword,
    confirmRecovery,
    finalizeRegistration,
} from "../api/register";
import { deriveKeys, generateKdfSalt } from "../crypto/kdf";
import { generateRecoveryPhrase, hashPhrase } from "../crypto/phrases";
import {
    generateIdentityKeyPair,
    exportPrivateKeyPkcs8,
    importPrivateKeyPkcs8,
    unwrapPrivateKey,
    wrapPrivateKey,
} from "../crypto/ecdh";
import { toBase64, fromBase64 } from "../crypto/encoding";
import * as sessionKeys from "../lib/sessionKeys";

import { useNavigate } from "react-router";
import zxcvbn from "zxcvbn";
import { downloadRecoveryPdf } from "../utils/recoveryPdf";
import { useAuth } from "../context/AuthContext";
import {
    useLanguage,
    getLanguage,
    setLanguage,
    type Language,
} from "../lib/language";
import {
    AUTH_COMMON,
    REGISTER_TRANSLATIONS,
    type AuthCommonTranslation,
} from "../lib/authTranslations";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_COUNT = 6;

const INTERFACE_LANGUAGE_OPTIONS: { id: Language; label: string }[] = [
    { id: "en", label: "English" },
    { id: "uk", label: "Українська" },
    { id: "de", label: "Deutsch" },
];
const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function RegisterPage() {
    const navigate = useNavigate();
    const { setAuthenticated } = useAuth();
    const language = useLanguage();
    const common = AUTH_COMMON[language];
    const tr = REGISTER_TRANSLATIONS[language];
    const [step, setStep] = useState<Step>(0);
    // Derived alongside authKey at the password step and needed again once
    // registration finalizes to unwrap this device's identity private key -
    // kept in a ref rather than state since it's sensitive and never needs
    // to trigger a re-render.
    const encKeyRef = useRef<Uint8Array | null>(null);

    // ── Form state ──
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [interfaceLanguage, setInterfaceLanguage] = useState<Language>(
        getLanguage(),
    );

    // ── Per-step error / loading state ──
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const codeInputs = useRef<(HTMLInputElement | null)[]>([]);

    const [emailInfoShown, setEmailInfoShown] = useState(false);
    const [emailInfoSeen, setEmailInfoSeen] = useState(false);
    const [emailInfoCountdown, setEmailInfoCountdown] = useState(5);
    const [emailVisibilityConsent, setEmailVisibilityConsent] = useState(false);

    const [sessionId, setSessionId] = useState<string | null>(null);

    const [resendCount, setResendCount] = useState(0);
    const RESEND_LIMIT = 2;

    const [recoveryPhrase1, setRecoveryPhrase1] = useState<string | null>(null);
    const [recoveryPhrase2, setRecoveryPhrase2] = useState<string | null>(null);
    const [recoveryConfirmChecked, setRecoveryConfirmChecked] = useState(false);
    const [recoveryLoaded, setRecoveryLoaded] = useState(false);

    useEffect(() => {
        if (step === 1 && !emailInfoSeen) {
            setEmailInfoShown(true);
            setEmailInfoCountdown(5);
        }
    }, [step, emailInfoSeen]);

    useEffect(() => {
        if (!emailInfoShown || emailInfoCountdown <= 0) return;
        const t = setTimeout(() => setEmailInfoCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [emailInfoShown, emailInfoCountdown]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    // Phrases are generated right here in the browser and never sent to the
    // server in plain form — only their hashes go out at the confirm step.
    useEffect(() => {
        if (step === 4 && !recoveryLoaded) {
            setRecoveryPhrase1(generateRecoveryPhrase());
            setRecoveryPhrase2(generateRecoveryPhrase());
            setRecoveryLoaded(true);
        }
    }, [step, recoveryLoaded]);

    const handleEmailInfoAck = () => {
        setEmailInfoShown(false);
        setEmailInfoSeen(true);
    };

    const goNext = () => {
        setError("");
        setStep((s) => Math.min(s + 1, STEP_COUNT - 1) as Step);
    };
    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 0) as Step);
    };

    // The carousel track lays every step out side by side, so its viewport
    // has to be told each step's real height explicitly - a flex row
    // otherwise stretches every slide to match the tallest one, leaving the
    // shorter steps sitting in a needlessly tall card. Re-observing on every
    // step change (rather than once) also keeps this correct if a step's own
    // height changes later, e.g. an inline error appearing.
    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [carouselHeight, setCarouselHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        const el = slideRefs.current[step];
        if (!el) return;
        const ro = new ResizeObserver(() => setCarouselHeight(el.offsetHeight));
        ro.observe(el);
        return () => ro.disconnect();
    }, [step]);

    // ── Validation helpers ──
    const isUsernameValid =
        username.trim().length >= 3 &&
        username.trim().length <= 32 &&
        /^[a-zA-Z0-9_]+$/.test(username);
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isCodeComplete = code.every((d) => d !== "");
    const passwordStrength = getPasswordStrength(password);
    const isPasswordValid = password.length >= 8 && passwordStrength >= 2;
    const doPasswordsMatch =
        password === confirmPassword && confirmPassword.length > 0;
    const passwordFeedback = password ? zxcvbn(password).feedback : null;

    // ── Step handlers (stubs – wire up to your API later) ──
    const handleUsernameSubmit = async () => {
        if (!isUsernameValid) {
            setError(tr.usernameInvalid);
            return;
        }
        setLoading(true);
        try {
            const { success, sessionId, reason } =
                await startRegistration(username);
            if (!success) {
                setError(
                    reason === "invalid_format"
                        ? tr.usernameInvalid
                        : common.somethingWrongTryAgain,
                );
                return;
            }
            setSessionId(sessionId!);
            goNext();
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSubmit = async () => {
        if (!isEmailValid) {
            setError(common.invalidEmail);
            return;
        }
        setLoading(true);
        try {
            const { success, reason } = await submitEmail(
                sessionId!,
                email,
                emailVisibilityConsent,
            );
            if (!success) {
                // No email_taken here on purpose: the server never reveals
                // whether an email is registered at this step (that would
                // allow probing for existing accounts).
                setError(
                    reason === "session_expired"
                        ? common.sessionExpired
                        : reason === "email_send_failed"
                          ? tr.emailSendFailed
                          : reason === "invalid_step"
                            ? common.somethingWrongStartOver
                            : reason === "invalid_email"
                              ? common.invalidEmail
                              : common.somethingWrongStartOver,
                );
                return;
            }
            setResendCooldown(RESEND_COOLDOWN);
            goNext();
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async () => {
        if (!isCodeComplete) {
            setError(common.enterFullCode);
            return;
        }
        setLoading(true);
        try {
            const { success, reason } = await verifyCode(
                sessionId!,
                code.join(""),
            );
            if (!success) {
                setError(
                    reason === "code_expired"
                        ? tr.codeExpired
                        : reason === "too_many_attempts"
                          ? tr.tooManyAttemptsRequestNewCode
                          : reason === "session_expired"
                            ? common.sessionExpired
                            : reason === "invalid_step"
                              ? common.somethingWrongStartOver
                              : reason === "invalid_code"
                                ? common.invalidCode
                                : common.somethingWrongTryAgain,
                );
                setCode(Array(CODE_LENGTH).fill(""));
                codeInputs.current[0]?.focus();
                return;
            }
            goNext();
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async () => {
        if (!isPasswordValid) {
            setError(common.weakPasswordError);
            return;
        }
        if (!doPasswordsMatch) {
            setError(common.passwordsDoNotMatch);
            return;
        }
        setLoading(true);
        try {
            // The password itself never leaves the browser: we derive authKey
            // from it (Argon2id, ~0.5s) and send only the key + its salt.
            const kdfSalt = generateKdfSalt();
            const { authKey, encKey } = await deriveKeys(password, kdfSalt);
            encKeyRef.current = encKey;

            // This account's E2EE identity keypair: the public half is sent
            // as-is, the private half only ever leaves the browser wrapped
            // with encKey - the server can never unwrap it.
            const identity = await generateIdentityKeyPair();
            const privateKeyPkcs8 = await exportPrivateKeyPkcs8(identity.privateKey);
            const wrappedEcdhPrivateKey = await wrapPrivateKey(encKey, privateKeyPkcs8);

            const { success, reason } = await submitPassword(
                sessionId!,
                authKey,
                kdfSalt,
                toBase64(identity.publicKeyRaw),
                wrappedEcdhPrivateKey,
            );
            if (!success) {
                setError(
                    reason === "session_expired"
                        ? common.sessionExpired
                        : common.somethingWrongStartOver,
                );
                return;
            }
            goNext();
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || resendCount >= RESEND_LIMIT) return;
        setLoading(true);
        try {
            const { success, reason } = await resendCode(sessionId!);
            if (success) {
                setResendCooldown(RESEND_COOLDOWN);
                setResendCount((c) => c + 1);
            } else {
                setError(
                    reason === "resend_limit_reached"
                        ? tr.resendLimitReachedStartOver
                        : reason === "cooldown_active"
                          ? tr.waitBeforeRequestingNewCode
                          : reason === "email_send_failed"
                            ? tr.failedToSendCode
                            : reason === "session_expired"
                              ? common.sessionExpired
                              : reason === "invalid_step"
                                ? common.somethingWrongStartOver
                                : tr.failedToResendCode,
                );
            }
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    const handleRecoveryConfirmSubmit = async () => {
        if (!recoveryConfirmChecked) {
            setError(tr.pleaseConfirmSavedPhrases);
            return;
        }
        setLoading(true);
        try {
            // The server receives only SHA-256 hashes of the phrases
            const [phrase1Auth, phrase2Auth] = await Promise.all([
                hashPhrase(recoveryPhrase1!),
                hashPhrase(recoveryPhrase2!),
            ]);

            const confirmRes = await confirmRecovery(
                sessionId!,
                phrase1Auth,
                phrase2Auth,
            );
            if (!confirmRes.success) {
                setError(
                    confirmRes.reason === "session_expired"
                        ? common.sessionExpired
                        : common.somethingWrongStartOver,
                );
                return;
            }

            goNext();
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
        }
    };

    // Unwraps this device's identity private key with the encKey derived at
    // the password step, so this tab can use it right away instead of
    // asking the user to sign in again just to fetch what it already has.
    const establishIdentity = async (
        ecdhPublicKey: string | null | undefined,
        wrappedEcdhPrivateKey: string | null | undefined,
    ) => {
        const encKey = encKeyRef.current;
        if (!encKey || !ecdhPublicKey || !wrappedEcdhPrivateKey) return;

        const privateKeyPkcs8 = await unwrapPrivateKey(encKey, wrappedEcdhPrivateKey);
        const privateKey = await importPrivateKeyPkcs8(privateKeyPkcs8);
        sessionKeys.setIdentity(privateKeyPkcs8, fromBase64(ecdhPublicKey), privateKey);
    };

    const handleFinalizeSubmit = async () => {
        setLoading(true);
        try {
            const { success, reason, ecdhPublicKey, wrappedEcdhPrivateKey } =
                await finalizeRegistration(sessionId!, interfaceLanguage);
            if (!success) {
                setError(
                    reason === "email_taken"
                        ? tr.emailTaken
                        : reason === "session_expired"
                          ? common.sessionExpired
                          : common.somethingWrongStartOver,
                );
                return;
            }

            setLanguage(interfaceLanguage);
            await establishIdentity(ecdhPublicKey, wrappedEcdhPrivateKey);
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
        {
            title: tr.step0Title,
            subtitle: tr.step0Subtitle,
        },
        {
            title: tr.step1Title,
            subtitle: (
                <>
                    {tr.sendCodePrefix}
                    <b>{email || tr.sendCodeFallback}</b>
                </>
            ),
        },
        {
            title: tr.step2Title,
            subtitle: (
                <>
                    {tr.checkPrefix}
                    <b>{email}</b>
                    {tr.checkSuffix}
                </>
            ),
        },
        {
            title: tr.step3Title,
            subtitle: tr.step3Subtitle,
        },
        {
            title: tr.step4Title,
            subtitle: tr.step4Subtitle,
        },
        {
            title: tr.step5Title,
            subtitle: tr.step5Subtitle,
        },
    ];

    return (
        <div className={styles.root}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.grid} />

            <div className={styles.card}>
                {/* Header */}
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

                {/* Progress dots */}
                <div className={styles.dots}>
                    {Array.from({ length: STEP_COUNT }).map((_, i) => (
                        <span
                            key={i}
                            className={`${styles.dot} ${i === step ? styles.active : ""} ${i < step ? styles.done : ""}`}
                        />
                    ))}
                </div>

                {/* Carousel viewport */}
                <div className={styles.viewport} style={{ height: carouselHeight }}>
                    <div
                        className={styles.track}
                        style={{ transform: `translateX(-${step * 100}%)` }}
                    >
                        {/* ── STEP 0: Username ── */}
                        <div className={styles.slide} ref={(el) => { slideRefs.current[0] = el; }}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[0].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[0].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>{tr.usernameLabel}</label>
                                <input
                                    className={`${styles.input} ${error && step === 0 ? styles.error : ""}`}
                                    type="text"
                                    placeholder={tr.usernamePlaceholder}
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" &&
                                        handleUsernameSubmit()
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
                                    onClick={handleUsernameSubmit}
                                    disabled={loading}
                                >
                                    {loading ? common.checking : common.continueLabel}
                                </button>
                            </div>

                            <p className={styles.footerNote}>
                                {tr.alreadyHaveAccount}{" "}
                                <button className={styles.footerLink}
                                    onClick={() => navigate("/login")}>
                                    {common.signIn}
                                </button>
                            </p>
                        </div>

                        {/* ── STEP 1: Email ── */}
                        <div className={styles.slide} ref={(el) => { slideRefs.current[1] = el; }}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[1].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[1].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>{common.emailLabel}</label>
                                <input
                                    className={`${styles.input} ${error && step === 1 ? styles.error : ""}`}
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && handleEmailSubmit()
                                    }
                                    autoFocus={step === 1}
                                />
                                {error && step === 1 && (
                                    <p className={styles.errorText}>{error}</p>
                                )}
                                <label className={styles.consentRow}>
                                    <input
                                        type="checkbox"
                                        className={styles.consentCheckbox}
                                        checked={emailVisibilityConsent}
                                        onChange={(e) =>
                                            setEmailVisibilityConsent(
                                                e.target.checked,
                                            )
                                        }
                                    />
                                    <span>{tr.consentLabel}</span>
                                </label>
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
                                    onClick={handleEmailSubmit}
                                    disabled={loading}
                                >
                                    {loading ? tr.sendingCode : tr.sendCodeButton}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 2: Email code ── */}
                        <div className={styles.slide} ref={(el) => { slideRefs.current[2] = el; }}>
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

                            <div className={styles.resendRow}>
                                {resendCount >= RESEND_LIMIT ? (
                                    <span>{tr.resendLimitReached}</span>
                                ) : resendCooldown > 0 ? (
                                    <span>
                                        {tr.resendInPrefix}
                                        {resendCooldown}
                                        {tr.resendInSuffix}
                                    </span>
                                ) : (
                                    <>
                                        {tr.didntGetIt}{" "}
                                        <button
                                            className={styles.resendLink}
                                            onClick={handleResend}
                                        >
                                            {tr.resendCodeLink}
                                        </button>
                                    </>
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
                                    onClick={handleCodeSubmit}
                                    disabled={loading}
                                >
                                    {loading ? common.verifying : common.verify}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 3: Password ── */}
                        <div className={styles.slide} ref={(el) => { slideRefs.current[3] = el; }}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[3].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[3].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>{common.passwordLabel}</label>
                                <input
                                    className={styles.input}
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    autoFocus={step === 3}
                                />
                                {password.length > 0 && (
                                    <div className={styles.strengthBlock}>
                                        <div className={styles.strengthRow}>
                                            {[0, 1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className={
                                                        styles.strengthBar
                                                    }
                                                    style={{
                                                        background:
                                                            i < passwordStrength
                                                                ? strengthColor(
                                                                      passwordStrength,
                                                                  )
                                                                : undefined,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <p className={styles.strengthLabel}>
                                            {strengthLabel(passwordStrength, common)}
                                        </p>
                                        {passwordFeedback?.warning && (
                                            <p
                                                className={
                                                    styles.strengthWarning
                                                }
                                            >
                                                {passwordFeedback.warning}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>
                                    {common.confirmPasswordLabel}
                                </label>
                                <input
                                    className={`${styles.input} ${confirmPassword && !doPasswordsMatch ? styles.error : ""}`}
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" &&
                                        handlePasswordSubmit()
                                    }
                                />
                                {confirmPassword && !doPasswordsMatch && (
                                    <p className={styles.errorText}>
                                        {common.passwordsDoNotMatch}
                                    </p>
                                )}
                            </div>

                            {error && (
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
                                    onClick={handlePasswordSubmit}
                                    disabled={loading}
                                >
                                    {loading ? common.checking : common.continueLabel}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 4: Recovery phrases ── */}
                        <div className={styles.slide} ref={(el) => { slideRefs.current[4] = el; }}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[4].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[4].subtitle}
                            </p>

                            {!recoveryLoaded ? (
                                <p className={styles.stepSubtitle}>
                                    {tr.generatingPhrases}
                                </p>
                            ) : (
                                <>
                                    <div className={styles.recoveryBlock}>
                                        <span className={styles.label}>
                                            {tr.recoveryPhrase1Label}
                                        </span>
                                        <textarea
                                            className={styles.recoveryTextarea}
                                            readOnly
                                            value={recoveryPhrase1 ?? ""}
                                            rows={3}
                                            onClick={(e) =>
                                                (
                                                    e.target as HTMLTextAreaElement
                                                ).select()
                                            }
                                        />
                                    </div>

                                    <div className={styles.recoveryBlock}>
                                        <span className={styles.label}>
                                            {tr.recoveryPhrase2Label}
                                        </span>
                                        <textarea
                                            className={styles.recoveryTextarea}
                                            readOnly
                                            value={recoveryPhrase2 ?? ""}
                                            rows={3}
                                            onClick={(e) =>
                                                (
                                                    e.target as HTMLTextAreaElement
                                                ).select()
                                            }
                                        />
                                    </div>

                                    <p className={styles.recoveryWarning}>
                                        {tr.recoveryWarning}
                                    </p>

                                    <button
                                        type="button"
                                        className={styles.btnDownloadPdf}
                                        onClick={() =>
                                            downloadRecoveryPdf({
                                                username,
                                                phrase1: recoveryPhrase1!,
                                                phrase2: recoveryPhrase2!,
                                            })
                                        }
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <path d="M7 10l5 5 5-5" />
                                            <path d="M12 15V3" />
                                        </svg>
                                        {tr.downloadRecoveryKit}
                                    </button>

                                    <label className={styles.consentRow}>
                                        <input
                                            type="checkbox"
                                            className={styles.consentCheckbox}
                                            checked={recoveryConfirmChecked}
                                            onChange={(e) =>
                                                setRecoveryConfirmChecked(
                                                    e.target.checked,
                                                )
                                            }
                                        />
                                        <span>{tr.savedBothPhrases}</span>
                                    </label>
                                </>
                            )}

                            {error && step === 4 && (
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
                                    onClick={handleRecoveryConfirmSubmit}
                                    disabled={loading || !recoveryLoaded}
                                >
                                    {loading
                                        ? common.checking
                                        : common.continueLabel}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 5: Interface language ── */}
                        <div className={styles.slide} ref={(el) => { slideRefs.current[5] = el; }}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[5].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[5].subtitle}
                            </p>

                            <div className={styles.langGrid}>
                                {INTERFACE_LANGUAGE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        className={`${styles.langOption} ${interfaceLanguage === opt.id ? styles.langOptionActive : ""}`}
                                        onClick={() =>
                                            setInterfaceLanguage(opt.id)
                                        }
                                    >
                                        {opt.label}
                                        {interfaceLanguage === opt.id && (
                                            <svg
                                                className={styles.langCheck}
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {error && step === 5 && (
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
                                    onClick={handleFinalizeSubmit}
                                    disabled={loading}
                                >
                                    {loading
                                        ? tr.creatingAccount
                                        : tr.createAccountButton}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {emailInfoShown && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalIcon}>🔒</div>
                        <h3 className={styles.modalTitle}>{tr.modalTitle}</h3>
                        <p className={styles.modalText}>{tr.modalText1}</p>
                        <p className={styles.modalText}>
                            <br />
                            <span className={styles.modalWarning}>
                                {tr.modalWarning}
                            </span>
                        </p>
                        <button
                            className={styles.btnPrimary}
                            onClick={handleEmailInfoAck}
                            disabled={emailInfoCountdown > 0}
                        >
                            {emailInfoCountdown > 0
                                ? tr.modalAckWithCountdown(emailInfoCountdown)
                                : tr.modalAck}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Returns a strength score from 0 to 4
function getPasswordStrength(pwd: string): number {
    if (!pwd) return 0;
    const result = zxcvbn(pwd);
    return result.score;
}

function strengthColor(score: number): string {
    if (score <= 1) return "linear-gradient(90deg, #f87171, #f87171)";
    if (score === 2) return "linear-gradient(90deg, #fbbf24, #fbbf24)";
    if (score === 3) return "linear-gradient(90deg, #a78bfa, #818cf8)";
    return "linear-gradient(90deg, #a78bfa, #22d3ee)";
}

function strengthLabel(
    score: number,
    common: AuthCommonTranslation,
): string {
    if (score <= 1) return common.strength.weak;
    if (score === 2) return common.strength.fair;
    if (score === 3) return common.strength.good;
    return common.strength.strong;
}
