import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./sheet.scss";

// Oltre questa trascinata verso il basso lo sheet si chiude invece di tornare su.
const DISMISS_THRESHOLD = 120;

// Sotto questa fetta di schermo mancante non c'è una tastiera, ci sono le
// barre di sistema che si assestano: alzare lo sheet per quelle sarebbe solo
// tremolio.
const KEYBOARD_MIN_HEIGHT = 120;

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Azione a destra del titolo ("Azzera" nei filtri), prima della chiusura. */
  action?: ReactNode;
  children: ReactNode;
  /** Footer fisso in fondo (i bottoni di conferma). */
  footer?: ReactNode;
  /** Altezza in percentuale dello schermo; senza, lo sheet si adatta al contenuto. */
  heightPercent?: number;
  className?: string;
};

/**
 * Bottom sheet ancorato in basso: è la forma di ogni form e di ogni scelta.
 * Si chiude con la X, con un tap sull'overlay, con Esc o trascinandolo giù.
 */
export default function Sheet({
  open,
  onClose,
  title,
  action,
  children,
  footer,
  heightPercent,
  className,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  // Serve in render per togliere la transizione mentre il dito trascina: deve
  // essere stato, non un ref.
  const [dragging, setDragging] = useState(false);
  // Quanto schermo si mangia la tastiera. Zero quando è chiusa.
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Esc chiude, e il corpo dietro non deve scorrere.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  // Con la tastiera aperta iOS non rimpicciolisce il viewport di layout: un
  // pannello `fixed` ancorato in fondo resta ancorato al fondo dello *schermo*,
  // cioè finisce sotto ai tasti — è il motivo per cui il campo descrizione non
  // si vedeva più. Quanto spazio resta davvero lo sa solo `visualViewport`: da
  // lì ricaviamo l'ingombro della tastiera e lo ridiamo al CSS.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;

    const sync = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;

      setKeyboardInset(covered > KEYBOARD_MIN_HEIGHT ? covered : 0);
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);

    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      setKeyboardInset(0);
    };
  }, [open]);

  // Ristretto lo sheet, il campo che ha il fuoco può essere rimasto fuori dalla
  // parte visibile del corpo: il browser lo aveva già portato in vista, ma
  // ragionando sull'ingombro di prima. Lo rimettiamo al centro noi, dopo che la
  // nuova altezza è stata applicata.
  useEffect(() => {
    if (!keyboardInset) return;

    const focused = document.activeElement;
    if (focused instanceof HTMLElement && panelRef.current?.contains(focused)) {
      focused.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [keyboardInset]);

  if (!open) return null;

  const onPointerDown = (event: React.PointerEvent) => {
    dragStartY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    // Solo verso il basso: tirare su non allunga lo sheet.
    setDragOffset(Math.max(0, event.clientY - dragStartY.current));
  };

  const onPointerUp = () => {
    if (dragStartY.current === null) return;

    if (dragOffset > DISMISS_THRESHOLD) onClose();

    setDragOffset(0);

    dragStartY.current = null;
    setDragging(false);
  };

  return createPortal(
    // Il fondo dello sheet è il bordo alto della tastiera, non quello dello
    // schermo: il pannello dentro resta `bottom: 0` e si accorcia da sé.
    <div
      className="sheet"
      style={keyboardInset ? { bottom: keyboardInset } : undefined}
    >
      <div className="sheet__overlay" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`sheet__panel ${keyboardInset ? "sheet__panel--keyboard" : ""} ${className ?? ""}`}
        style={{
          height: heightPercent ? `${heightPercent}%` : undefined,
          transform: dragOffset
            ? `translateX(-50%) translateY(${dragOffset}px)`
            : undefined,
          transition: dragging ? "none" : undefined,
        }}
      >
        <span
          className="sheet__handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {title && (
          <div className="sheet__header">
            <h2 className="sheet__title">{title}</h2>

            <div className="sheet__actions">
              {action}
              <button
                type="button"
                className="sheet__close"
                onClick={onClose}
                aria-label="close"
              >
                <i className="ph-bold ph-x" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="sheet__body">{children}</div>

        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
