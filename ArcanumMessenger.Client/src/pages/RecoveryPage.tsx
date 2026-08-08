import { useState } from "react";
import { useNavigate } from "react-router";
import { startRecovery, verifyRecovery, resetPassword } from "../api/recovery";
import { hashPhrase } from "../crypto/phrases";
import { deriveKeys, generateKdfSalt } from "../crypto/kdf";
import { generateIdentityKeyPair, exportPrivateKeyPkcs8, wrapPrivateKey } from "../crypto/ecdh";
import { toBase64 } from "../crypto/encoding";
import styles from "./RecoveryPage.module.css";
import zxcvbn from "zxcvbn";
import { useLanguage } from "../lib/language";
import {
    AUTH_COMMON,
    RECOVERY_TRANSLATIONS,
    type AuthCommonTranslation,
} from "../lib/authTranslations";

type Step = 0 | 1 | 2;
const STEP_COUNT = 3;

export default function RecoveryPage() {
    const navigate = useNavigate();
    const language = useLanguage();
    const common = AUTH_COMMON[language];
    const tr = RECOVERY_TRANSLATIONS[language];

    const [sessionId, setSessionId] = useState<string | null>(null);
    
    const [step, setStep] = useState<Step>(0);

    const [email, setEmail] = useState("");
    const [phrase, setPhrase] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isPhraseValid = phrase.trim().length >= 6;
    const passwordStrength = password ? zxcvbn(password).score : 0;
    const isPasswordValid = password.length >= 8 && passwordStrength >= 2;
    const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;
    const passwordFeedback = password ? zxcvbn(password).feedback : null;

    const goNext = () => {
        setError("");
        setStep((s) => Math.min(s + 1, STEP_COUNT - 1) as Step);
    };
    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 0) as Step);
    };

    const handleEmailSubmit = async () => {
        if (!isEmailValid) {
            setError(common.invalidEmail);
            return;
        }
        setLoading(true);
        try {
            const { success, sessionId } = await startRecovery(email);
            if (!success) {
                setError(common.somethingWrongTryAgain);
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

    const handlePhraseSubmit = async () => {
        if (!isPhraseValid) {
            setError(tr.enterRecoveryPhrase);
            return;
        }
        setLoading(true);
        try {
            const { success, reason } = await verifyRecovery(sessionId!, email, await hashPhrase(phrase));
            if (!success) {
                setError(
                    reason === "too_many_attempts" ? tr.tooManyAttemptsStartOver :
                    reason === "session_expired" ? common.sessionExpired :
                    tr.emailOrPhraseIncorrect
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
            const kdfSalt = generateKdfSalt();
            const { authKey, encKey } = await deriveKeys(password, kdfSalt);

            // Recovering via phrase can't know the old password, so the old
            // identity keypair (and anything wrapped only for it) is
            // abandoned here in favor of a brand-new one.
            const identity = await generateIdentityKeyPair();
            const privateKeyPkcs8 = await exportPrivateKeyPkcs8(identity.privateKey);
            const wrappedEcdhPrivateKey = await wrapPrivateKey(encKey, privateKeyPkcs8);

            const { success, reason } = await resetPassword(
                sessionId!,
                authKey,
                kdfSalt,
                toBase64(identity.publicKeyRaw),
                wrappedEcdhPrivateKey,
            );
            if (!success) {
                setError(
                    reason === "session_expired" ? common.sessionExpired :
                    reason === "invalid_step" ? common.somethingWrongStartOver :
                    tr.failedToResetPassword
                );
                return;
            }
            navigate("/login");
        } catch {
            setError(common.somethingWrongTryAgain);
        } finally {
            setLoading(false);
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
                    {tr.phraseForPrefix}
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
                {/* Header */}
                <div className={styles.header}>
                    <button
                        className={styles.backHome}
                        onClick={() => navigate("/login")}
                        aria-label={tr.backToLoginAria}
                        style={{ visibility: step === 0 ? "visible" : "hidden" }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <div className={styles.logoBox}>
                        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                            <path
                                d="M16 12H32a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H20l-6 5v-5a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
                                stroke="url(#rcg)" strokeWidth="2.2" fill="none" strokeLinejoin="round"
                            />
                            <defs>
                                <linearGradient id="rcg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#a78bfa" /><stop offset="1" stopColor="#22d3ee" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <p className={styles.brand}>Arcanum</p>
                </div>

                {/* Dots */}
                <div className={styles.dots}>
                    {Array.from({ length: STEP_COUNT }).map((_, i) => (
                        <span
                            key={i}
                            className={`${styles.dot} ${i === step ? styles.active : ""} ${i < step ? styles.done : ""}`}
                        />
                    ))}
                </div>

                {/* Carousel */}
                <div
                    className={styles.viewport}
                >
                    <div
                        className={styles.track}
                    >
                        {/* ── STEP 0: Email ── */}
                        <div className={`${styles.slide} ${step === 0 ? styles.activeSlide : ""}`}>
                            <h2 className={styles.stepTitle}>{stepTitles[0].title}</h2>
                            <p className={styles.stepSubtitle}>{stepTitles[0].subtitle}</p>

                            <div className={styles.field}>
                                <label className={styles.label}>{common.emailLabel}</label>
                                <input
                                    className={`${styles.input} ${error && step === 0 ? styles.error : ""}`}
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
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
                                >
                                    {common.continueLabel}
                                </button>
                            </div>

                            <p className={styles.footerNote}>
                                {tr.rememberPassword}{" "}
                                <button
                                    className={styles.footerLink}
                                    onClick={() => navigate("/login")}
                                >
                                    {common.signIn}
                                </button>
                            </p>
                        </div>

                        {/* ── STEP 1: Recovery phrase ── */}
                        <div className={`${styles.slide} ${step === 1 ? styles.activeSlide : ""}`}>
                            <h2 className={styles.stepTitle}>{stepTitles[1].title}</h2>
                            <p className={styles.stepSubtitle}>{stepTitles[1].subtitle}</p>

                            <div className={styles.infoBox}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4M12 8h.01" />
                                </svg>
                                <span>{tr.infoBoxText}</span>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>{tr.recoveryPhraseLabel}</label>
                                <textarea
                                    className={`${styles.phraseTextarea} ${error && step === 1 ? styles.error : ""}`}
                                    placeholder={tr.phrasePlaceholder}
                                    value={phrase}
                                    onChange={(e) => setPhrase(e.target.value)}
                                    rows={4}
                                    autoFocus={step === 1}
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                />
                                {error && step === 1 && (
                                    <p className={styles.errorText}>{error}</p>
                                )}
                            </div>

                            <div className={styles.actions}>
                                <button className={styles.btnBack} onClick={goBack} aria-label={common.backAria}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2.2"
                                        strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={handlePhraseSubmit}
                                    disabled={loading}
                                >
                                    {loading ? common.verifying : tr.verifyPhraseButton}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 2: New password ── */}
                        <div className={`${styles.slide} ${step === 2 ? styles.activeSlide : ""}`}>
                            <h2 className={styles.stepTitle}>{stepTitles[2].title}</h2>
                            <p className={styles.stepSubtitle}>{stepTitles[2].subtitle}</p>

                            <div className={styles.field}>
                                <label className={styles.label}>{tr.newPasswordLabel}</label>
                                <input
                                    className={styles.input}
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus={step === 2}
                                />
                                {password.length > 0 && (
                                    <div className={styles.strengthBlock}>
                                        <div className={styles.strengthRow}>
                                            {[0, 1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className={styles.strengthBar}
                                                    style={{
                                                        background: i < passwordStrength
                                                            ? strengthColor(passwordStrength)
                                                            : undefined,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <p className={styles.strengthLabel}>{strengthLabel(passwordStrength, common)}</p>
                                        {passwordFeedback?.warning && (
                                            <p className={styles.strengthWarning}>{passwordFeedback.warning}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>{common.confirmPasswordLabel}</label>
                                <input
                                    className={`${styles.input} ${confirmPassword && !doPasswordsMatch ? styles.error : ""}`}
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                                />
                                {confirmPassword && !doPasswordsMatch && (
                                    <p className={styles.errorText}>{common.passwordsDoNotMatch}</p>
                                )}
                            </div>

                            {error && step === 2 && (
                                <p className={styles.errorText} style={{ textAlign: "center" }}>{error}</p>
                            )}

                            <div className={styles.actions}>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={handlePasswordSubmit}
                                    disabled={loading}
                                >
                                    {loading ? tr.savingButton : tr.setNewPasswordButton}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
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
