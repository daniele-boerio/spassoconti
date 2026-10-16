import { ReactNode } from "react";
import "./section_header.scss";

type SectionHeaderProps = {
  children: ReactNode;
  /** Subtotale o azione allineati a destra (header di gruppo lista). */
  aside?: ReactNode;
  className?: string;
};

/**
 * Etichetta di sezione in maiuscoletto spaziato: separa i gruppi di una lista
 * (la data del giorno con il suo subtotale) e i blocchi di Impostazioni.
 */
export default function SectionHeader({
  children,
  aside,
  className,
}: SectionHeaderProps) {
  return (
    <div className={`section-header ${className ?? ""}`}>
      <span className="section-header__label">{children}</span>
      {aside && <span className="section-header__aside">{aside}</span>}
    </div>
  );
}
