import type { Language } from "./language";

export interface AuthCommonTranslation {
    backAria: string;
    backToWelcomeAria: string;
    continueLabel: string;
    checking: string;
    signIn: string;
    verify: string;
    verifying: string;
    emailLabel: string;
    passwordLabel: string;
    confirmPasswordLabel: string;
    invalidEmail: string;
    enterFullCode: string;
    invalidCode: string;
    somethingWrongTryAgain: string;
    somethingWrongStartOver: string;
    sessionExpired: string;
    tooManyAttemptsLater: string;
    passwordsDoNotMatch: string;
    weakPasswordError: string;
    strength: {
        weak: string;
        fair: string;
        good: string;
        strong: string;
    };
}

export interface LoginTranslation {
    step0Title: string;
    step0Subtitle: string;
    step1Title: string;
    signingInAsPrefix: string;
    step2Title: string;
    step2Subtitle: string;
    enterPassword: string;
    incorrectEmailOrPassword: string;
    completeLoginFailed: string;
    signingIn: string;
    dontHaveAccount: string;
    createOne: string;
    forgotPassword: string;
    changeIt: string;
}

export interface RegisterTranslation {
    step0Title: string;
    step0Subtitle: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    usernameInvalid: string;
    alreadyHaveAccount: string;

    step1Title: string;
    sendCodePrefix: string;
    sendCodeFallback: string;
    consentLabel: string;
    sendCodeButton: string;
    sendingCode: string;
    emailSendFailed: string;

    step2Title: string;
    checkPrefix: string;
    checkSuffix: string;
    codeExpired: string;
    tooManyAttemptsRequestNewCode: string;
    resendLimitReached: string;
    resendInPrefix: string;
    resendInSuffix: string;
    didntGetIt: string;
    resendCodeLink: string;
    resendLimitReachedStartOver: string;
    waitBeforeRequestingNewCode: string;
    failedToSendCode: string;
    failedToResendCode: string;

    step3Title: string;
    step3Subtitle: string;

    step4Title: string;
    step4Subtitle: string;
    generatingPhrases: string;
    recoveryPhrase1Label: string;
    recoveryPhrase2Label: string;
    recoveryWarning: string;
    downloadRecoveryKit: string;
    savedBothPhrases: string;
    pleaseConfirmSavedPhrases: string;
    creatingAccount: string;
    createAccountButton: string;
    emailTaken: string;

    modalTitle: string;
    modalText1: string;
    modalWarning: string;
    modalAck: string;
    modalAckWithCountdown: (seconds: number) => string;
}

export interface RecoveryTranslation {
    backToLoginAria: string;

    step0Title: string;
    step0Subtitle: string;
    rememberPassword: string;

    step1Title: string;
    phraseForPrefix: string;
    infoBoxText: string;
    recoveryPhraseLabel: string;
    phrasePlaceholder: string;
    enterRecoveryPhrase: string;
    tooManyAttemptsStartOver: string;
    emailOrPhraseIncorrect: string;
    verifyPhraseButton: string;

    step2Title: string;
    step2Subtitle: string;
    newPasswordLabel: string;
    savingButton: string;
    setNewPasswordButton: string;
    failedToResetPassword: string;
}

export const AUTH_COMMON: Record<Language, AuthCommonTranslation> = {
    en: {
        backAria: "Back",
        backToWelcomeAria: "Back to welcome",
        continueLabel: "Continue",
        checking: "Checking…",
        signIn: "Sign in",
        verify: "Verify",
        verifying: "Verifying…",
        emailLabel: "Email",
        passwordLabel: "Password",
        confirmPasswordLabel: "Confirm password",
        invalidEmail: "Enter a valid email address",
        enterFullCode: "Enter the full 6-digit code",
        invalidCode: "Invalid code",
        somethingWrongTryAgain: "Something went wrong, try again",
        somethingWrongStartOver: "Something went wrong, please start over",
        sessionExpired: "Session expired, please start over",
        tooManyAttemptsLater: "Too many attempts, try again later",
        passwordsDoNotMatch: "Passwords do not match",
        weakPasswordError:
            "Password must be at least 8 characters and reasonably strong",
        strength: {
            weak: "Weak password",
            fair: "Fair password",
            good: "Good password",
            strong: "Strong password",
        },
    },
    uk: {
        backAria: "Назад",
        backToWelcomeAria: "Назад на головну",
        continueLabel: "Продовжити",
        checking: "Перевірка…",
        signIn: "Увійти",
        verify: "Підтвердити",
        verifying: "Перевірка…",
        emailLabel: "Електронна пошта",
        passwordLabel: "Пароль",
        confirmPasswordLabel: "Підтвердіть пароль",
        invalidEmail: "Введіть дійсну електронну адресу",
        enterFullCode: "Введіть усі 6 цифр коду",
        invalidCode: "Невірний код",
        somethingWrongTryAgain: "Щось пішло не так, спробуйте ще раз",
        somethingWrongStartOver: "Щось пішло не так, почніть спочатку",
        sessionExpired: "Сесія закінчилася, почніть спочатку",
        tooManyAttemptsLater: "Занадто багато спроб, спробуйте пізніше",
        passwordsDoNotMatch: "Паролі не збігаються",
        weakPasswordError:
            "Пароль має містити щонайменше 8 символів і бути достатньо надійним",
        strength: {
            weak: "Слабкий пароль",
            fair: "Прийнятний пароль",
            good: "Хороший пароль",
            strong: "Надійний пароль",
        },
    },
    de: {
        backAria: "Zurück",
        backToWelcomeAria: "Zurück zur Startseite",
        continueLabel: "Weiter",
        checking: "Wird geprüft…",
        signIn: "Anmelden",
        verify: "Bestätigen",
        verifying: "Wird überprüft…",
        emailLabel: "E-Mail",
        passwordLabel: "Passwort",
        confirmPasswordLabel: "Passwort bestätigen",
        invalidEmail: "Gib eine gültige E-Mail-Adresse ein",
        enterFullCode: "Gib den vollständigen 6-stelligen Code ein",
        invalidCode: "Ungültiger Code",
        somethingWrongTryAgain:
            "Etwas ist schiefgelaufen, versuche es erneut",
        somethingWrongStartOver:
            "Etwas ist schiefgelaufen, bitte fang neu an",
        sessionExpired: "Sitzung abgelaufen, bitte fang neu an",
        tooManyAttemptsLater:
            "Zu viele Versuche, versuche es später erneut",
        passwordsDoNotMatch: "Passwörter stimmen nicht überein",
        weakPasswordError:
            "Das Passwort muss mindestens 8 Zeichen lang und ausreichend stark sein",
        strength: {
            weak: "Schwaches Passwort",
            fair: "Mäßiges Passwort",
            good: "Gutes Passwort",
            strong: "Starkes Passwort",
        },
    },
};

export const LOGIN_TRANSLATIONS: Record<Language, LoginTranslation> = {
    en: {
        step0Title: "Welcome back",
        step0Subtitle: "Sign in with your email",
        step1Title: "Enter your password",
        signingInAsPrefix: "Signing in as ",
        step2Title: "Two-factor authentication",
        step2Subtitle: "Enter the 6-digit code from your authenticator app",
        enterPassword: "Enter your password",
        incorrectEmailOrPassword: "Incorrect email or password",
        completeLoginFailed:
            "Something went wrong with login completion, try again",
        signingIn: "Signing in…",
        dontHaveAccount: "Don't have an account?",
        createOne: "Create one",
        forgotPassword: "Forgot your password?",
        changeIt: "Change it",
    },
    uk: {
        step0Title: "З поверненням",
        step0Subtitle: "Увійдіть за допомогою електронної пошти",
        step1Title: "Введіть пароль",
        signingInAsPrefix: "Вхід як ",
        step2Title: "Двофакторна автентифікація",
        step2Subtitle: "Введіть 6-значний код із застосунку автентифікатора",
        enterPassword: "Введіть свій пароль",
        incorrectEmailOrPassword: "Неправильна електронна пошта або пароль",
        completeLoginFailed:
            "Щось пішло не так під час завершення входу, спробуйте ще раз",
        signingIn: "Вхід…",
        dontHaveAccount: "Немає облікового запису?",
        createOne: "Створити",
        forgotPassword: "Забули пароль?",
        changeIt: "Змінити",
    },
    de: {
        step0Title: "Willkommen zurück",
        step0Subtitle: "Melde dich mit deiner E-Mail an",
        step1Title: "Gib dein Passwort ein",
        signingInAsPrefix: "Anmeldung als ",
        step2Title: "Zwei-Faktor-Authentifizierung",
        step2Subtitle: "Gib den 6-stelligen Code aus deiner Authenticator-App ein",
        enterPassword: "Gib dein Passwort ein",
        incorrectEmailOrPassword: "Falsche E-Mail oder falsches Passwort",
        completeLoginFailed:
            "Beim Abschluss der Anmeldung ist etwas schiefgelaufen, versuche es erneut",
        signingIn: "Wird angemeldet…",
        dontHaveAccount: "Noch kein Konto?",
        createOne: "Konto erstellen",
        forgotPassword: "Passwort vergessen?",
        changeIt: "Ändern",
    },
};

export const REGISTER_TRANSLATIONS: Record<Language, RegisterTranslation> = {
    en: {
        step0Title: "Create your account",
        step0Subtitle: "Choose a username for Arcanum",
        usernameLabel: "Username",
        usernamePlaceholder: "your_username",
        usernameInvalid:
            "Username must be at least 3 characters – Latin letters, digits, and underscores only",
        alreadyHaveAccount: "Already have an account?",

        step1Title: "Confirm your email",
        sendCodePrefix: "We'll send a verification code to ",
        sendCodeFallback: "your email",
        consentLabel:
            "Allow Arcanum to know my email so I can show it on my profile later ",
        sendCodeButton: "Send code",
        sendingCode: "Sending code…",
        emailSendFailed: "Failed to send verification email, try again",

        step2Title: "Enter verification code",
        checkPrefix: "Check ",
        checkSuffix: " for a 6-digit code",
        codeExpired: "Code expired, request a new one",
        tooManyAttemptsRequestNewCode: "Too many attempts, request a new code",
        resendLimitReached: "Resend limit reached",
        resendInPrefix: "Resend code in ",
        resendInSuffix: "s",
        didntGetIt: "Didn't get it?",
        resendCodeLink: "Resend code",
        resendLimitReachedStartOver: "Resend limit reached, please start over",
        waitBeforeRequestingNewCode: "Please wait before requesting a new code",
        failedToSendCode: "Failed to send code, try again",
        failedToResendCode: "Failed to resend code",

        step3Title: "Set a password",
        step3Subtitle: "Make it strong – this protects your encrypted messages",

        step4Title: "Save your recovery phrases",
        step4Subtitle:
            "Write these down – they're the only way to recover your account",
        generatingPhrases: "Generating your recovery phrases…",
        recoveryPhrase1Label: "Recovery phrase 1",
        recoveryPhrase2Label: "Recovery phrase 2",
        recoveryWarning:
            "Anyone with access to either phrase can recover your account. Store them somewhere safe and offline – we cannot show them to you again.",
        downloadRecoveryKit: "Download recovery kit (PDF)",
        savedBothPhrases: "I've saved both recovery phrases somewhere safe",
        pleaseConfirmSavedPhrases:
            "Please confirm you've saved your recovery phrases",
        creatingAccount: "Creating account…",
        createAccountButton: "Create account",
        emailTaken: "This email is already registered – try signing in instead",

        modalTitle: "About your email",
        modalText1:
            "Your email is private and not even developers can read or recover it. Checking this box lets Arcanum keep this email in encrypted form, so it's already there if you choose to show it on your profile later.",
        modalWarning:
            "Without this, your email stays hashed forever and this copy is never kept. You can still add an email to your profile later - you'll just need to type it in again at that point.",
        modalAck: "I've read and understand",
        modalAckWithCountdown: (s) => `I've read and understand (${s})`,
    },
    uk: {
        step0Title: "Створіть свій акаунт",
        step0Subtitle: "Виберіть ім'я користувача для Arcanum",
        usernameLabel: "Ім'я користувача",
        usernamePlaceholder: "ваш_нікнейм",
        usernameInvalid:
            "Ім'я користувача має містити щонайменше 3 символи – лише латинські букви, цифри та підкреслення",
        alreadyHaveAccount: "Уже маєте акаунт?",

        step1Title: "Підтвердьте email",
        sendCodePrefix: "Ми надішлемо код підтвердження на ",
        sendCodeFallback: "вашу електронну пошту",
        consentLabel:
            "Дозволити Arcanum знати мій email, щоб пізніше показати його в профілі ",
        sendCodeButton: "Надіслати код",
        sendingCode: "Надсилання коду…",
        emailSendFailed: "Не вдалося надіслати лист підтвердження, спробуйте ще раз",

        step2Title: "Введіть код підтвердження",
        checkPrefix: "Перевірте ",
        checkSuffix: " — там 6-значний код",
        codeExpired: "Код застарів, запросіть новий",
        tooManyAttemptsRequestNewCode: "Занадто багато спроб, запросіть новий код",
        resendLimitReached: "Ліміт повторних надсилань досягнуто",
        resendInPrefix: "Повторне надсилання через ",
        resendInSuffix: "с",
        didntGetIt: "Не отримали код?",
        resendCodeLink: "Надіслати ще раз",
        resendLimitReachedStartOver:
            "Ліміт повторних надсилань досягнуто, почніть спочатку",
        waitBeforeRequestingNewCode: "Зачекайте, перш ніж запитувати новий код",
        failedToSendCode: "Не вдалося надіслати код, спробуйте ще раз",
        failedToResendCode: "Не вдалося повторно надіслати код",

        step3Title: "Встановіть пароль",
        step3Subtitle:
            "Зробіть його надійним – це захищає ваші зашифровані повідомлення",

        step4Title: "Збережіть фрази відновлення",
        step4Subtitle:
            "Запишіть їх – це єдиний спосіб відновити ваш акаунт",
        generatingPhrases: "Генеруємо ваші фрази відновлення…",
        recoveryPhrase1Label: "Фраза відновлення 1",
        recoveryPhrase2Label: "Фраза відновлення 2",
        recoveryWarning:
            "Будь-хто з доступом до будь-якої з фраз може відновити ваш акаунт. Зберігайте їх у безпечному місці офлайн – ми не можемо показати їх знову.",
        downloadRecoveryKit: "Завантажити комплект відновлення (PDF)",
        savedBothPhrases: "Я зберіг обидві фрази відновлення в безпечному місці",
        pleaseConfirmSavedPhrases:
            "Будь ласка, підтвердьте, що зберегли фрази відновлення",
        creatingAccount: "Створення акаунту…",
        createAccountButton: "Створити акаунт",
        emailTaken:
            "Цей email вже зареєстровано – спробуйте увійти замість реєстрації",

        modalTitle: "Про вашу електронну пошту",
        modalText1:
            "Ваш email приватний, і навіть розробники не можуть прочитати чи відновити його. Позначивши цей пункт, ви дозволяєте Arcanum зберігати цей email у зашифрованому вигляді, щоб він уже був готовий, якщо ви захочете показати його у профілі пізніше.",
        modalWarning:
            "Без цього ваш email назавжди залишиться лише у вигляді хешу, і ця копія ніколи не зберігається. Ви все ще можете додати email до профілю пізніше – просто доведеться ввести його знову.",
        modalAck: "Я прочитав і зрозумів",
        modalAckWithCountdown: (s) => `Я прочитав і зрозумів (${s})`,
    },
    de: {
        step0Title: "Erstelle dein Konto",
        step0Subtitle: "Wähle einen Benutzernamen für Arcanum",
        usernameLabel: "Benutzername",
        usernamePlaceholder: "dein_benutzername",
        usernameInvalid:
            "Der Benutzername muss mindestens 3 Zeichen lang sein – nur lateinische Buchstaben, Ziffern und Unterstriche",
        alreadyHaveAccount: "Du hast bereits ein Konto?",

        step1Title: "Bestätige deine E-Mail",
        sendCodePrefix: "Wir senden einen Bestätigungscode an ",
        sendCodeFallback: "deine E-Mail",
        consentLabel:
            "Arcanum darf meine E-Mail kennen, damit ich sie später in meinem Profil anzeigen kann ",
        sendCodeButton: "Code senden",
        sendingCode: "Code wird gesendet…",
        emailSendFailed:
            "Bestätigungs-E-Mail konnte nicht gesendet werden, versuche es erneut",

        step2Title: "Bestätigungscode eingeben",
        checkPrefix: "Sieh in ",
        checkSuffix: " nach dem 6-stelligen Code",
        codeExpired: "Code abgelaufen, fordere einen neuen an",
        tooManyAttemptsRequestNewCode:
            "Zu viele Versuche, fordere einen neuen Code an",
        resendLimitReached: "Limit für erneutes Senden erreicht",
        resendInPrefix: "Code erneut senden in ",
        resendInSuffix: "s",
        didntGetIt: "Nichts erhalten?",
        resendCodeLink: "Code erneut senden",
        resendLimitReachedStartOver:
            "Limit für erneutes Senden erreicht, bitte fang neu an",
        waitBeforeRequestingNewCode:
            "Bitte warte, bevor du einen neuen Code anforderst",
        failedToSendCode: "Code konnte nicht gesendet werden, versuche es erneut",
        failedToResendCode: "Code konnte nicht erneut gesendet werden",

        step3Title: "Passwort festlegen",
        step3Subtitle:
            "Mach es stark – das schützt deine verschlüsselten Nachrichten",

        step4Title: "Speichere deine Wiederherstellungsphrasen",
        step4Subtitle:
            "Schreibe sie auf – sie sind der einzige Weg, dein Konto wiederherzustellen",
        generatingPhrases: "Wiederherstellungsphrasen werden generiert…",
        recoveryPhrase1Label: "Wiederherstellungsphrase 1",
        recoveryPhrase2Label: "Wiederherstellungsphrase 2",
        recoveryWarning:
            "Jeder mit Zugriff auf eine der beiden Phrasen kann dein Konto wiederherstellen. Bewahre sie sicher und offline auf – wir können sie dir nicht erneut zeigen.",
        downloadRecoveryKit: "Wiederherstellungs-Kit herunterladen (PDF)",
        savedBothPhrases:
            "Ich habe beide Wiederherstellungsphrasen sicher aufbewahrt",
        pleaseConfirmSavedPhrases:
            "Bitte bestätige, dass du deine Wiederherstellungsphrasen gespeichert hast",
        creatingAccount: "Konto wird erstellt…",
        createAccountButton: "Konto erstellen",
        emailTaken:
            "Diese E-Mail ist bereits registriert – melde dich stattdessen an",

        modalTitle: "Über deine E-Mail",
        modalText1:
            "Deine E-Mail ist privat, und nicht einmal Entwickler können sie lesen oder wiederherstellen. Wenn du dieses Kästchen aktivierst, kann Arcanum diese E-Mail verschlüsselt speichern, sodass sie schon bereitsteht, falls du sie später in deinem Profil anzeigen möchtest.",
        modalWarning:
            "Ohne diese Zustimmung bleibt deine E-Mail für immer nur als Hash gespeichert, und diese Kopie wird nie aufbewahrt. Du kannst später trotzdem eine E-Mail zu deinem Profil hinzufügen – du musst sie dann nur erneut eingeben.",
        modalAck: "Gelesen und verstanden",
        modalAckWithCountdown: (s) => `Gelesen und verstanden (${s})`,
    },
};

export const RECOVERY_TRANSLATIONS: Record<Language, RecoveryTranslation> = {
    en: {
        backToLoginAria: "Back to login",

        step0Title: "Recover your account",
        step0Subtitle: "Enter the email address you registered with",
        rememberPassword: "Remember your password?",

        step1Title: "Enter recovery phrase",
        phraseForPrefix:
            "Enter one of the recovery phrases you saved during registration for ",
        infoBoxText:
            "You saved two recovery phrases during registration. Either one works.",
        recoveryPhraseLabel: "Recovery phrase",
        phrasePlaceholder: "word1-word2-word3-word4-word5-word6-…",
        enterRecoveryPhrase: "Enter your recovery phrase",
        tooManyAttemptsStartOver: "Too many attempts, please start over",
        emailOrPhraseIncorrect: "Email or recovery phrase is incorrect",
        verifyPhraseButton: "Verify phrase",

        step2Title: "Set new password",
        step2Subtitle: "Choose a strong password for your account",
        newPasswordLabel: "New password",
        savingButton: "Saving…",
        setNewPasswordButton: "Set new password",
        failedToResetPassword: "Failed to reset password, try again",
    },
    uk: {
        backToLoginAria: "Назад до входу",

        step0Title: "Відновіть свій акаунт",
        step0Subtitle: "Введіть електронну адресу, з якою реєструвались",
        rememberPassword: "Згадали пароль?",

        step1Title: "Введіть фразу відновлення",
        phraseForPrefix:
            "Введіть одну з фраз відновлення, збережених під час реєстрації для ",
        infoBoxText:
            "Під час реєстрації ви зберегли дві фрази відновлення. Підійде будь-яка з них.",
        recoveryPhraseLabel: "Фраза відновлення",
        phrasePlaceholder: "слово1-слово2-слово3-слово4-слово5-слово6-…",
        enterRecoveryPhrase: "Введіть вашу фразу відновлення",
        tooManyAttemptsStartOver: "Занадто багато спроб, почніть спочатку",
        emailOrPhraseIncorrect: "Електронна пошта або фраза відновлення неправильна",
        verifyPhraseButton: "Підтвердити фразу",

        step2Title: "Встановіть новий пароль",
        step2Subtitle: "Виберіть надійний пароль для вашого акаунту",
        newPasswordLabel: "Новий пароль",
        savingButton: "Збереження…",
        setNewPasswordButton: "Встановити новий пароль",
        failedToResetPassword: "Не вдалося змінити пароль, спробуйте ще раз",
    },
    de: {
        backToLoginAria: "Zurück zur Anmeldung",

        step0Title: "Konto wiederherstellen",
        step0Subtitle: "Gib die E-Mail-Adresse ein, mit der du dich registriert hast",
        rememberPassword: "Erinnerst du dich an dein Passwort?",

        step1Title: "Wiederherstellungsphrase eingeben",
        phraseForPrefix:
            "Gib eine der Wiederherstellungsphrasen ein, die du bei der Registrierung für ",
        infoBoxText:
            "Du hast bei der Registrierung zwei Wiederherstellungsphrasen gespeichert. Beide funktionieren.",
        recoveryPhraseLabel: "Wiederherstellungsphrase",
        phrasePlaceholder: "wort1-wort2-wort3-wort4-wort5-wort6-…",
        enterRecoveryPhrase: "Gib deine Wiederherstellungsphrase ein",
        tooManyAttemptsStartOver: "Zu viele Versuche, bitte fang neu an",
        emailOrPhraseIncorrect:
            "E-Mail oder Wiederherstellungsphrase ist falsch",
        verifyPhraseButton: "Phrase bestätigen",

        step2Title: "Neues Passwort festlegen",
        step2Subtitle: "Wähle ein starkes Passwort für dein Konto",
        newPasswordLabel: "Neues Passwort",
        savingButton: "Wird gespeichert…",
        setNewPasswordButton: "Neues Passwort festlegen",
        failedToResetPassword:
            "Passwort konnte nicht zurückgesetzt werden, versuche es erneut",
    },
};
