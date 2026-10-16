import { ReactNode } from "react";
import "./empty_state.scss";

type EmptyStateProps = {
  icon: string;
  title: ReactNode;
  description?: ReactNode;
  /** Bottoni o link: una lista vuota non resta mai senza un'azione. */
  actions?: ReactNode;
  /** `search` è la variante compatta per "nessun risultato". */
  variant?: "default" | "search";
  className?: string;
};

export default function EmptyState({
  icon,
  title,
  description,
  actions,
  variant = "default",
  className,
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${variant} ${className ?? ""}`}>
      <span className="empty-state__icon" aria-hidden="true">
        <i className={icon} />
      </span>

      <div className="empty-state__text">
        <span className="empty-state__title">{title}</span>
        {description && (
          <p className="empty-state__description">{description}</p>
        )}
      </div>

      {actions && <div className="empty-state__actions">{actions}</div>}
    </div>
  );
}
