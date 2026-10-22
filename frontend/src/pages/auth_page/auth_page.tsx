import React, { useEffect, useState } from "react";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import {
  getRegistrationStatus,
  login,
  loginWithPasskey,
  register,
  verifyTwoFactor,
} from "../../features/profile/api_calls";
import Button from "../../components/button/button";
import "./auth_page.scss";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { useI18n } from "../../i18n/use-i18n";
import {
  cancelTwoFactor,
  selectMfaToken,
  selectProfileLoading,
  selectRegistrationOpen,
} from "../../features/profile/profile_slice";
import ForgotPasswordDialog from "../../components/dialog/forgot_password_dialog/forgot_password_dialog";

export default function AuthPage() {
  const { t } = useI18n();

  const [loginMode, setLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const loading = useAppSelector(selectProfileLoading);
  const mfaToken = useAppSelector(selectMfaToken);
  const dispatch = useAppDispatch();
  // Browser senza WebAuthn (molto vecchi): il pulsante non compare.
  const [passkeySupported] = useState(browserSupportsWebAuthn);
  // Iscrizioni chiuse dal server (REGISTRATION_ENABLED=false): resta solo l'accesso.
  const registrationOpen = useAppSelector(selectRegistrationOpen);
  const isLogin = loginMode || !registrationOpen;

  useEffect(() => {
    dispatch(getRegistrationStatus());
  }, [dispatch]);

  // Password giusta, account con la verifica in due passaggi: manca il codice.
  if (mfaToken) return <TwoFactorStep mfaToken={mfaToken} />;

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (isLogin) {
      await dispatch(login({ username, password }));
    } else {
      await dispatch(register({ email, username, password }));
    }
  };

  const canSubmit =
    username.trim() !== "" &&
    password !== "" &&
    (isLogin || email.trim() !== "");

  return (
    <div className="auth">
      <form className="auth__form" onSubmit={submit}>
        <div className="auth__intro">
          <span className="auth__logo" aria-hidden="true">
            S
          </span>

          <h1 className="auth__title">
            {isLogin ? t("auth_welcome_back") : t("auth_welcome")}
          </h1>
          <p className="auth__subtitle">
            {isLogin ? t("auth_subtitle_login") : t("auth_subtitle_register")}
          </p>
        </div>

        <div className="auth__fields">
          {!isLogin && (
            <Field
              id="auth-email"
              label={t("email")}
              icon="ph-bold ph-envelope"
              type="email"
              autoComplete="email"
              value={email}
              placeholder={t("email_placeholder")}
              onChange={setEmail}
            />
          )}

          <Field
            id="auth-username"
            label={t("username")}
            icon="ph-bold ph-user"
            autoComplete="username"
            value={username}
            placeholder={t("username_placeholder")}
            onChange={setUsername}
          />

          <Field
            id="auth-password"
            label={t("password")}
            icon="ph-bold ph-lock"
            type={revealed ? "text" : "password"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            placeholder={t("password_placeholder")}
            onChange={setPassword}
            trailing={
              <button
                type="button"
                className="auth__reveal"
                aria-label={t(revealed ? "auth_hide" : "auth_show")}
                onClick={() => setRevealed((current) => !current)}
              >
                <i
                  className={`ph-bold ${revealed ? "ph-eye-slash" : "ph-eye"}`}
                  aria-hidden="true"
                />
              </button>
            }
          />

          {isLogin && (
            <button
              type="button"
              className="auth__forgot"
              onClick={() => setForgotOpen(true)}
            >
              {t("forgot_password_question")}
            </button>
          )}
        </div>

        <div className="auth__actions">
          <Button type="submit" block disabled={!canSubmit || loading}>
            {isLogin ? t("login") : t("sign_in")}
          </Button>

          {isLogin && passkeySupported && (
            <Button
              variant="neutral"
              block
              icon="ph-bold ph-fingerprint"
              disabled={loading}
              onClick={() => dispatch(loginWithPasskey())}
            >
              {t("passkey_login")}
            </Button>
          )}

          {registrationOpen && (
            <p className="auth__switch">
              {isLogin ? t("no_account") : t("account")}{" "}
              <button type="button" onClick={() => setLoginMode(!isLogin)}>
                {isLogin ? t("sign_in") : t("login")}
              </button>
            </p>
          )}
        </div>
      </form>

      <ForgotPasswordDialog
        visible={forgotOpen}
        onHide={() => setForgotOpen(false)}
      />
    </div>
  );
}

/**
 * Secondo passo dell'accesso: il codice a 6 cifre dell'app di autenticazione,
 * o uno dei codici di recupero se il telefono non c'è.
 */
function TwoFactorStep({ mfaToken }: { mfaToken: string }) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectProfileLoading);

  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    await dispatch(verifyTwoFactor({ mfa_token: mfaToken, code: code.trim() }));
  };

  // Un codice dell'app ha 6 cifre; uno di recupero 10 caratteri (+ trattino).
  const canSubmit = recovery ? code.trim().length >= 10 : /^\d{6}$/.test(code.trim());

  return (
    <div className="auth">
      <form className="auth__form" onSubmit={submit}>
        <div className="auth__intro">
          <span className="auth__logo" aria-hidden="true">
            <i className="ph-bold ph-shield-check" />
          </span>

          <h1 className="auth__title">{t("two_factor_title")}</h1>
          <p className="auth__subtitle">
            {recovery ? t("two_factor_login_recovery_hint") : t("two_factor_login_hint")}
          </p>
        </div>

        <div className="auth__fields">
          <Field
            id="auth-code"
            label={recovery ? t("two_factor_recovery_code") : t("two_factor_code")}
            icon="ph-bold ph-key"
            // "one-time-code": iOS propone il codice dall'app Password.
            autoComplete={recovery ? "off" : "one-time-code"}
            inputMode={recovery ? "text" : "numeric"}
            value={code}
            placeholder={recovery ? "a1b2c-3d4e5" : "123456"}
            onChange={setCode}
            autoFocus
          />

          <button
            type="button"
            className="auth__forgot"
            onClick={() => {
              setRecovery((current) => !current);
              setCode("");
            }}
          >
            {recovery ? t("two_factor_use_app") : t("two_factor_use_recovery")}
          </button>
        </div>

        <div className="auth__actions">
          <Button type="submit" block disabled={!canSubmit || loading}>
            {t("two_factor_verify")}
          </Button>

          <p className="auth__switch">
            <button type="button" onClick={() => dispatch(cancelTwoFactor())}>
              {t("back")}
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  icon: string;
  value: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoFocus?: boolean;
  onChange: (value: string) => void;
  /** Bottone a destra dentro al campo (l'occhio della password). */
  trailing?: React.ReactNode;
};

function Field({
  id,
  label,
  icon,
  value,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  autoFocus,
  onChange,
  trailing,
}: FieldProps) {
  return (
    <div className="auth__field">
      <label className="auth__label" htmlFor={id}>
        {label}
      </label>

      <div className="auth__control">
        <i className={`${icon} auth__icon`} aria-hidden="true" />

        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />

        {trailing}
      </div>
    </div>
  );
}
