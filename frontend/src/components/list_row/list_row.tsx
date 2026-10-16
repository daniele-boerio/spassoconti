import { ReactNode } from "react";
import "./list_row.scss";

type ListProps = {
  children: ReactNode;
  className?: string;
};

/** Contenitore di righe: separatori interni `--line-soft`, nessun bordo esterno. */
export function List({ children, className }: ListProps) {
  return <div className={`list ${className ?? ""}`}>{children}</div>;
}

export type IconTone = "neutral" | "accent" | "negative" | "invert";

type ListRowProps = {
  title: ReactNode;
  meta?: ReactNode;
  /** Importo o stato allineato a destra. */
  trailing?: ReactNode;
  icon?: string;
  iconShape?: "circle" | "square";
  iconTone?: IconTone;
  /** Sostituisce il quadrato icona (es. la colonna data delle ricorrenze). */
  leading?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
};

/**
 * La riga di lista del design: icona, titolo, meta, valore a destra. La usano
 * movimenti, ricorrenze, conti e le liste dentro le card.
 */
export default function ListRow({
  title,
  meta,
  trailing,
  icon,
  iconShape = "circle",
  iconTone = "neutral",
  leading,
  onClick,
  chevron = false,
  className,
}: ListRowProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      className={`list-row ${onClick ? "list-row--tappable" : ""} ${
        className ?? ""
      }`}
      onClick={onClick}
      {...(onClick ? { type: "button" as const } : {})}
    >
      {leading ??
        (icon && (
          <span
            className={`list-row__icon list-row__icon--${iconShape} list-row__icon--${iconTone}`}
            aria-hidden="true"
          >
            <i className={icon} />
          </span>
        ))}

      <span className="list-row__text">
        <span className="list-row__title">{title}</span>
        {meta && <span className="list-row__meta">{meta}</span>}
      </span>

      {trailing && <span className="list-row__trailing">{trailing}</span>}

      {chevron && (
        <i className="ph-bold ph-caret-right list-row__chevron" aria-hidden="true" />
      )}
    </Tag>
  );
}
