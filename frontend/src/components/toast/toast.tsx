import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppDispatch, useAppSelector } from "../../store/store";
import {
  closeToast,
  selectToasts,
  triggerToastAction,
} from "../../features/ui/ui_slice";
import { ToastItem } from "../../features/ui/toast";
import "./toast.scss";

const ICONS: Record<ToastItem["variant"], string> = {
  success: "ph-bold ph-check-circle",
  error: "ph-bold ph-warning",
  offline: "ph-bold ph-wifi-slash",
};

function Toast({ toast }: { toast: ToastItem }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!toast.duration) return;

    const timer = window.setTimeout(
      () => dispatch(closeToast(toast.id)),
      toast.duration,
    );

    return () => window.clearTimeout(timer);
  }, [dispatch, toast.id, toast.duration]);

  return (
    <div className={`toast toast--${toast.variant}`} role="status">
      <i className={`toast__icon ${ICONS[toast.variant]}`} aria-hidden="true" />

      <div className="toast__text">
        <span className="toast__title">{toast.title}</span>
        {toast.meta && <span className="toast__meta">{toast.meta}</span>}
      </div>

      {toast.actionLabel && (
        <button
          type="button"
          className="toast__action"
          onClick={() => dispatch(triggerToastAction(toast.id))}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Impila i toast sopra la tab bar, dentro la colonna dell'app.
 *
 * Va in un portale su <body>, come gli sheet, e non è un dettaglio: dentro
 * `.App` lo prendeva in pieno la regola di compatibilità di App.scss
 * (`.App:has(.tab-bar) > *:not(.page):not(.tab-bar)`), pensata per dare spazio
 * alle schermate non ancora convertite. Quel `padding-bottom` su un elemento
 * ancorato in basso non sposta il bordo inferiore: spinge in su il contenuto,
 * e il toast se ne andava a mezza altezza. Fuori da `.App` nessuna regola
 * degli antenati — padding, transform o altro — può più spostarlo.
 */
export default function ToastHost() {
  const toasts = useAppSelector(selectToasts);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-host">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body,
  );
}
