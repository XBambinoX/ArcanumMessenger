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
} from "../api/auth";
import { deriveKeys, generateKdfSalt } from "../crypto/kdf";
import { generateRecoveryPhrase, hashPhrase } from "../crypto/phrases";

import { useNavigate } from "react-router-dom";
import zxcvbn from "zxcvbn";
import { downloadRecoveryPdf } from "../utils/recoveryPdf";

type Step = 0 | 1 | 2 | 3 | 4;

const STEP_COUNT = 5;
const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function RegisterPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>(0);

    // ── Form state ──
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

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
            setError(
                "Username must be at least 3 characters – Latin letters, digits, and underscores only",
            );
            return;
        }
        setLoading(true);
        try {
            const { success, sessionId } = await startRegistration(username);
            if (!success) {
                setError("Invalid username format");
                return;
            }
            setSessionId(sessionId!);
            goNext();
        } catch {
            setError("Something went wrong, try again");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSubmit = async () => {
        if (!isEmailValid) {
            setError("Enter a valid email address");
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
                setError(
                    reason === "session_expired"
                        ? "Session expired, please start over"
                        : reason === "email_taken"
                          ? "This email is already registered"
                          : "Invalid email address",
                );
                return;
            }
            setResendCooldown(RESEND_COOLDOWN);
            goNext();
        } catch {
            setError("Something went wrong, try again");
        } finally {
            setLoading(false);
        }
    };

    const handleCodeSubmit = async () => {
        if (!isCodeComplete) {
            setError("Enter the full 6-digit code");
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
                        ? "Code expired, request a new one"
                        : reason === "too_many_attempts"
                          ? "Too many attempts, request a new code"
                          : reason === "session_expired"
                            ? "Session expired, please start over"
                            : "Invalid code",
                );
                setCode(Array(CODE_LENGTH).fill(""));
                codeInputs.current[0]?.focus();
                return;
            }
            goNext();
        } catch {
            setError("Something went wrong, try again");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async () => {
        if (!isPasswordValid) {
            setError(
                "Password must be at least 8 characters and reasonably strong",
            );
            return;
        }
        if (!doPasswordsMatch) {
            setError("Passwords do not match");
            return;
        }
        setLoading(true);
        try {
            // The password itself never leaves the browser: we derive authKey
            // from it (Argon2id, ~0.5s) and send only the key + its salt.
            // encKey from the same derivation stays local for future E2EE.
            const kdfSalt = generateKdfSalt();
            const { authKey } = await deriveKeys(password, kdfSalt);

            const { success, reason } = await submitPassword(
                sessionId!,
                authKey,
                kdfSalt,
            );
            if (!success) {
                setError(
                    reason === "session_expired"
                        ? "Session expired, please start over"
                        : "Something went wrong, please start over",
                );
                return;
            }
            goNext();
        } catch {
            setError("Something went wrong, try again");
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
                        ? "Resend limit reached, please start over"
                        : reason === "cooldown_active"
                          ? "Please wait before requesting a new code"
                          : reason === "email_send_failed"
                            ? "Failed to send code, try again"
                            : "Failed to resend code",
                );
            }
        } catch {
            setError("Something went wrong, try again");
        } finally {
            setLoading(false);
        }
    };

    const handleRecoverySubmit = async () => {
        if (!recoveryConfirmChecked) {
            setError("Please confirm you've saved your recovery phrases");
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
                        ? "Session expired, please start over"
                        : "Something went wrong, please start over",
                );
                return;
            }

            const { success, reason } = await finalizeRegistration(sessionId!);
            if (!success) {
                setError(
                    reason === "email_taken"
                        ? "Email was taken, please start over"
                        : reason === "session_expired"
                          ? "Session expired, please start over"
                          : "Something went wrong, please start over",
                );
                return;
            }

            navigate("/welcome");
        } catch {
            setError("Something went wrong, try again");
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
            title: "Create your account",
            subtitle: "Choose a username for Arcanum",
        },
        {
            title: "Confirm your email",
            subtitle: (
                <>
                    We'll send a verification code to{" "}
                    <b>{email || "your email"}</b>
                </>
            ),
        },
        {
            title: "Enter verification code",
            subtitle: (
                <>
                    Check <b>{email}</b> for a 6-digit code
                </>
            ),
        },
        {
            title: "Set a password",
            subtitle: "Make it strong – this protects your encrypted messages",
        },
        {
            title: "Save your recovery phrases",
            subtitle:
                "Write these down – they're the only way to recover your account",
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
                        aria-label="Back to welcome"
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
                        <div className={styles.logoBox}>
                            <svg
                                width="60"
                                height="60"
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
                <div className={styles.viewport}>
                    <div
                        className={styles.track}
                        style={{ transform: `translateX(-${step * 100}%)` }}
                    >
                        {/* ── STEP 0: Username ── */}
                        <div className={styles.slide}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[0].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[0].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>Username</label>
                                <input
                                    className={`${styles.input} ${error && step === 0 ? styles.error : ""}`}
                                    type="text"
                                    placeholder="your_username"
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
                                    {loading ? "Checking…" : "Continue"}
                                </button>
                            </div>

                            <p className={styles.footerNote}>
                                Already have an account?{" "}
                                <button className={styles.footerLink}>
                                    Sign in
                                </button>
                            </p>
                        </div>

                        {/* ── STEP 1: Email ── */}
                        <div className={styles.slide}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[1].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[1].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>Email</label>
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
                                    <span>
                                        Allow Arcanum to know my email so I can
                                        show it on my profile later{" "}
                                    </span>
                                </label>
                            </div>

                            <div className={styles.actions}>
                                <button
                                    className={styles.btnBack}
                                    onClick={goBack}
                                    aria-label="Back"
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
                                    {loading ? "Sending code…" : "Send code"}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 2: Email code ── */}
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

                            <div className={styles.resendRow}>
                                {resendCount >= RESEND_LIMIT ? (
                                    <span>Resend limit reached</span>
                                ) : resendCooldown > 0 ? (
                                    <span>
                                        Resend code in {resendCooldown}s
                                    </span>
                                ) : (
                                    <>
                                        Didn't get it?{" "}
                                        <button
                                            className={styles.resendLink}
                                            onClick={handleResend}
                                        >
                                            Resend code
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className={styles.actions}>
                                <button
                                    className={styles.btnBack}
                                    onClick={goBack}
                                    aria-label="Back"
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
                                    {loading ? "Verifying…" : "Verify"}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 3: Password ── */}
                        <div className={styles.slide}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[3].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[3].subtitle}
                            </p>

                            <div className={styles.field}>
                                <label className={styles.label}>Password</label>
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
                                            {strengthLabel(passwordStrength)}
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
                                    Confirm password
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
                                        Passwords do not match
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
                                    {loading ? "Checking…" : "Continue"}
                                </button>
                            </div>
                        </div>

                        {/* ── STEP 4: Recovery phrases ── */}
                        <div className={styles.slide}>
                            <h2 className={styles.stepTitle}>
                                {stepTitles[4].title}
                            </h2>
                            <p className={styles.stepSubtitle}>
                                {stepTitles[4].subtitle}
                            </p>

                            {!recoveryLoaded ? (
                                <p className={styles.stepSubtitle}>
                                    Generating your recovery phrases…
                                </p>
                            ) : (
                                <>
                                    <div className={styles.recoveryBlock}>
                                        <span className={styles.label}>
                                            Recovery phrase 1
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
                                            Recovery phrase 2
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
                                        Anyone with access to either phrase can
                                        recover your account. Store them
                                        somewhere safe and offline – we cannot
                                        show them to you again.
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
                                        Download recovery kit (PDF)
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
                                        <span>
                                            I've saved both recovery phrases
                                            somewhere safe
                                        </span>
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
                                    onClick={handleRecoverySubmit}
                                    disabled={loading || !recoveryLoaded}
                                >
                                    {loading
                                        ? "Creating account…"
                                        : "Create account"}
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
                        <h3 className={styles.modalTitle}>About your email</h3>
                        <p className={styles.modalText}>
                            Your email is private and not even developers can
                            read or recover it. If you'd like to show your email
                            on your public profile later, we need your
                            permission to know it in plain form.
                        </p>
                        <p className={styles.modalText}>
                            <br />
                            <span className={styles.modalWarning}>
                                Without this, your email stays hashed forever –
                                and you won't be able to add it to your profile,
                                even afterward.
                            </span>
                        </p>
                        <button
                            className={styles.btnPrimary}
                            onClick={handleEmailInfoAck}
                            disabled={emailInfoCountdown > 0}
                        >
                            {emailInfoCountdown > 0
                                ? `I've read and understand (${emailInfoCountdown})`
                                : "I've read and understand"}
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

function strengthLabel(score: number): string {
    if (score <= 1) return "Weak password";
    if (score === 2) return "Fair password";
    if (score === 3) return "Good password";
    return "Strong password";
}
