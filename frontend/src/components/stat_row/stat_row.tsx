import { ReactNode } from "react";
import "./stat_row.scss";

export type Stat = {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  /**
   * Rende la colonna toccabile: una metrica è la somma di qualcosa, e da qui
   * si va a vedere di cosa. Senza, la colonna resta un numero e basta.
   */
  onClick?: () => void;
};

/**
 * Poche metriche affiancate in una card, separate da linee verticali: il
 * riepilogo secondario che sta sotto l'hero della Home. Le colonne le detta la
 * lista, non il CSS.
 */
export default function StatRow({
  stats,
  className,
}: {
  stats: Stat[];
  className?: string;
}) {
  return (
    <div className={`stat-row ${className ?? ""}`}>
      {stats.map((stat) => {
        const content = (
          <>
            <span className="stat-row__label">
              {stat.label}
              {stat.onClick && (
                <i className="ph-bold ph-caret-right" aria-hidden="true" />
              )}
            </span>
            <span
              className={`stat-row__value stat-row__value--${
                stat.tone ?? "neutral"
              }`}
            >
              {stat.value}
            </span>
          </>
        );

        if (!stat.onClick) {
          return (
            <div key={stat.label} className="stat-row__cell">
              {content}
            </div>
          );
        }

        return (
          <button
            key={stat.label}
            type="button"
            className="stat-row__cell stat-row__cell--tappable"
            onClick={stat.onClick}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
