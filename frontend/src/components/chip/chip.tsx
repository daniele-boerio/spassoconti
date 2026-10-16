import { ReactNode } from "react";
import "./chip.scss";

export type ChipVariant =
  /** Chip filtro a riposo: fondo card e bordo. */
  | "outline"
  /** Chip filtro selezionato: blocco scuro al chiaro, accento al buio. */
  | "active"
  /** Chip di contenuto (sottocategorie, tag): riempimento neutro. */
  | "solid"
  /** Selezione confermata in uno sheet. */
  | "accent"
  /** "+ Aggiungi": bordo tratteggiato e testo accento. */
  | "dashed";

type ChipProps = {
  label: ReactNode;
  variant?: ChipVariant;
  icon?: string;
  /** Valore a destra dell'etichetta (importo di una sottocategoria, conteggio). */
  meta?: ReactNode;
  onClick?: () => void;
  className?: string;
};

export default function Chip({
  label,
  variant = "outline",
  icon,
  meta,
  onClick,
  className,
}: ChipProps) {
  const content = (
    <>
      {icon && <i className={icon} aria-hidden="true" />}
      <span className="chip__label">{label}</span>
      {meta && <span className="chip__meta">{meta}</span>}
    </>
  );

  const classes = `chip chip--${variant} ${className ?? ""}`;

  if (!onClick) return <span className={classes}>{content}</span>;

  return (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  );
}
