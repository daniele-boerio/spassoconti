import { ReactNode } from "react";
import "./card.scss";

type CardProps = {
  children: ReactNode;
  /** `invert` è la card "In arrivo" / toast di successo: superficie scura. */
  variant?: "default" | "invert" | "alert";
  className?: string;
};

export function Card({ children, variant = "default", className }: CardProps) {
  return (
    <section className={`card card--${variant} ${className ?? ""}`}>
      {children}
    </section>
  );
}

type CardTitleProps = {
  children: ReactNode;
  /** Link o valore allineato a destra sulla stessa riga del titolo. */
  aside?: ReactNode;
};

/** Titolo di card: stesso font del resto, in peso da display. */
export function CardTitle({ children, aside }: CardTitleProps) {
  return (
    <div className="card__title-row">
      <h2 className="card__title">{children}</h2>
      {aside && <div className="card__aside">{aside}</div>}
    </div>
  );
}
