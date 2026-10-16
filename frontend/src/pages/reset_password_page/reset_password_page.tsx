import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import InputText from "../../components/input_text/input_text";
import Password from "../../components/password/password"; // Usa il tuo componente password
import Button from "../../components/legacy_button/legacy_button";
import api from "../../services/api";
import { useI18n } from "../../i18n/use-i18n";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token"); // Cattura il token dall'URL
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleReset = async () => {
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: t("passwords_dont_match") });
      return;
    }
    if (password.length < 8) {
      setMessage({
        type: "error",
        text: t("password_min_length"),
      });
      return;
    }

    setLoading(true);
    try {
      // Invio token e nuova password al backend
      await api.post("/auth/reset-password", { token, new_password: password });
      setMessage({
        type: "success",
        text: t("password_updated_success"),
      });

      // Manda al login dopo 3 secondi
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.detail || t("link_invalid_or_expired"),
      });
    } finally {
      setLoading(false);
    }
  };

  // Se l'utente arriva qui senza token nell'URL, mostriamo errore
  if (!token) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <h2>{t("reset_link_missing")}</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          padding: "2rem",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{ margin: 0, textAlign: "center", color: "var(--ink)" }}
        >
          {t("new_password")}
        </h2>

        {message.text && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "8px",
              backgroundColor:
                message.type === "error"
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(34, 197, 94, 0.1)",
              color:
                message.type === "error"
                  ? "var(--negative)"
                  : "var(--positive)",
              textAlign: "center",
            }}
          >
            {message.text}
          </div>
        )}

        {message.type !== "success" && (
          <>
            <Password
              label={t("new_password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("min_8_chars")}
            />
            <Password
              label={t("confirm_password")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("rewrite_password")}
            />
            <Button
              label={t("save_new_password")}
              onClick={handleReset}
              disabled={!password || !confirmPassword || loading}
              className="action-button"
            />
          </>
        )}
      </div>
    </div>
  );
}
