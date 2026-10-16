import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "../button/button";
import "./alert.scss";

type AlertProps = {
  open: boolean;
  icon?: string;
  title: ReactNode;
  /** Deve dire la conseguenza esplicita: "il saldo torna a…". */
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `danger` per le eliminazioni; è il caso normale. */
  tone?: "danger" | "accent";
};

/**
 * Conferma centrata da 326px: la usano solo le azioni distruttive. Tutto il
 * resto (form, scelte) sta in un bottom sheet.
 */
export default function Alert({
  open,
  icon = "ph-bold ph-trash",
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "danger",
}: AlertProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="alert">
      <div className="alert__overlay" onClick={onCancel} />

      <div className="alert__panel" role="alertdialog" aria-modal="true">
        <span className={`alert__icon alert__icon--${tone}`} aria-hidden="true">
          <i className={icon} />
        </span>

        <div className="alert__text">
          <span className="alert__title">{title}</span>
          {description && <p className="alert__description">{description}</p>}
        </div>

        <div className="alert__actions">
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="md"
            block
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="neutral" size="md" block onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
