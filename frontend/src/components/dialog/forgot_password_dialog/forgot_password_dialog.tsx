import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import { useI18n } from "../../../i18n/use-i18n";
import api from "../../../services/api"; // Usa la tua istanza axios configurata

interface ForgotPasswordDialogProps {
  visible: boolean;
  onHide: () => void;
}

export default function ForgotPasswordDialog({
  visible,
  onHide,
}: ForgotPasswordDialogProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      // Chiama l'endpoint per inviare la mail
      await api.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || t("error_sending_email"));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onHide();
    setTimeout(() => {
      setSuccess(false);
      setEmail("");
      setError("");
    }, 300); // Resetta lo stato dopo l'animazione di chiusura
  };

  return (
    <Dialog
      header={t("recover_password")}
      visible={visible}
      style={{ width: "90vw", maxWidth: "25rem" }}
      onHide={handleClose}
      className="dialog-custom"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          paddingTop: "0.5rem",
        }}
      >
        {success ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--positive)",
              lineHeight: "1.5",
            }}
          >
            <i
              className="ph-bold ph-check-circle"
              style={{ fontSize: "2rem", marginBottom: "1rem" }}
            ></i>
            <p>{t("password_reset_success")}</p>
          </div>
        ) : (
          <>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.9rem",
                lineHeight: "1.4",
                margin: 0,
              }}
            >
              {t("password_reset_instructions")}
            </p>

            <InputText
              label={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email_example")}
            />

            {error && (
              <small style={{ color: "var(--negative)" }}>{error}</small>
            )}

            <Button
              label={t("send_link")}
              onClick={handleSubmit}
              disabled={!email || loading}
              className="action-button"
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
