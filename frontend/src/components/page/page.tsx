import { ReactNode } from "react";
import { useScrollRestoration } from "../../features/ui/use_scroll_restoration";

type SlotProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Colonna della schermata: header fermo, contenuto che scorre, tab bar sotto.
 *
 * È lei a tenere la posizione di scroll per indirizzo: entrare in una sezione
 * e tornare indietro, o passare da un tab all'altro, riporta all'altezza a cui
 * la si era lasciata.
 */
export function Page({ children, className }: SlotProps) {
  useScrollRestoration();

  // `main` e non `div`: è il contenuto della schermata, ed è dove porta lo
  // skip link ("Vai al contenuto") di App.
  return (
    <main id="contenuto" tabIndex={-1} className={`page ${className ?? ""}`}>
      {children}
    </main>
  );
}

export function PageHeader({ children, className }: SlotProps) {
  return (
    <header className={`page__header ${className ?? ""}`}>{children}</header>
  );
}

/** Il contenuto sotto l'header, che scorre col documento. */
export function PageContent({ children, className }: SlotProps) {
  return (
    <div className={`page__content ${className ?? ""}`}>
      {children}
    </div>
  );
}

/**
 * Le due colonne del desktop.
 *
 * `split` sceglie le proporzioni che il design dà alla schermata: `hero` per
 * la Home (1.6fr / 1fr), `balanced` per i Conti (1.5fr / 1fr), `filters` per i
 * Movimenti (la lista, e 296px fissi di pannello filtri).
 *
 * Sotto i 1180px il contenitore e le colonne sono `display: contents`: i loro
 * figli si appiattiscono nella colonna singola di `PageContent` esattamente
 * come se questi wrapper non ci fossero. È per questo che il mobile non si
 * accorge di niente — non è un secondo layout, è lo stesso DOM che sopra la
 * soglia si dispone in griglia.
 */
export function PageColumns({
  children,
  split = "hero",
  className,
}: SlotProps & { split?: "hero" | "balanced" | "filters" }) {
  return (
    <div className={`page__columns page__columns--${split} ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function PageColumn({ children, className }: SlotProps) {
  return <div className={`page__col ${className ?? ""}`}>{children}</div>;
}
