import React, { useState } from "react";
import { login, register } from "../../features/profile/api_calls";
import Button from "../../components/button/button";
import "./auth_page.scss";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { useI18n } from "../../i18n/use-i18n";
import { selectProfileLoading } from "../../features/profile/profile_slice";
import ForgotPasswordDialog from "../../components/dialog/forgot_password_dialog/forgot_password_dialog";

export default function AuthPage() {
  const { t } = useI18n();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const loading = useAppSelector(selectProfileLoading);
  const dispatch = useAppDispatch();

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

          <p className="auth__switch">
            {isLogin ? t("no_account") : t("account")}{" "}
            <button type="button" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? t("sign_in") : t("login")}
            </button>
          </p>
        </div>
      </form>

      <ForgotPasswordDialog
        visible={forgotOpen}
        onHide={() => setForgotOpen(false)}
      />
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
          onChange={(event) => onChange(event.target.value)}
        />

        {trailing}
      </div>
    </div>
  );
}
