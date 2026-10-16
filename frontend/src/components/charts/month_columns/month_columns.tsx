import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import Amount from "../../amount/amount";
import "./month_columns.scss";

export type MonthColumn = {
  /** Etichetta sotto la colonna: l'iniziale del mese. */
  label: string;
  /** Nome breve, per la riga di lettura, dove lo spazio c'è. */
  title: string;
  entrate: number;
  uscite: number;
  accantonamento: number;
};

type MonthColumnsProps = {
  months: MonthColumn[];
  ariaLabel: string;
  labels: {
    entrate: string;
    uscite: string;
    accantonamento: string;
  };
};

/**
 * Le colonne dell'anno: entrate a sinistra, uscite a destra con
 * l'accantonamento impilato sopra — sono due modi di far uscire soldi dal
 * portafoglio, e appaiarli a una terza colonna avrebbe dato trentasei barre in
 * trecento pixel.
 *
 * Dodici mesi per tre serie non stanno scritti da nessuna parte, quindi i
 * numeri si leggono toccando un mese, e restano finché non se ne tocca un
 * altro. La riga sopra al grafico è la legenda finché nessuno tocca e diventa
 * la lettura del mese scelto: così i valori non coprono le barre che si sta
 * guardando, e nessuna riga compare dal nulla facendo saltare il resto della
 * card.
 */
export default function MonthColumns({
  months,
  ariaLabel,
  labels,
}: MonthColumnsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Due stati e non uno: il mese fermato con un tocco resta lì, quello sotto
  // il mouse è di passaggio e se ne va quando il puntatore esce.
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const active = hovered ?? pinned;

  // L'altezza è comune a tutte le colonne, o i mesi non si confrontano.
  const peak = Math.max(
    ...months.map((month) =>
      Math.max(month.entrate, month.uscite + month.accantonamento),
    ),
    0,
  );

  /** L'indice del mese sotto una x dello schermo. */
  const pick = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || months.length === 0) return null;

    const share = (clientX - rect.left) / rect.width;
    const index = Math.floor(share * months.length);

    return Math.min(Math.max(index, 0), months.length - 1);
  };

  // Il tocco accende un mese invece di trascinarsi da uno all'altro: sul
  // telefono il trascinamento faceva selezionare il grafico, e al dito alzato
  // i valori sparivano prima di poterli leggere. Ritoccare lo stesso mese lo
  // spegne.
  const onClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const index = pick(event.clientX);
    if (index === null) return;

    setPinned((current) => (current === index ? null : index));
  };

  // Col mouse la lettura segue il puntatore come prima. Il dito qui non entra,
  // o sarebbe di nuovo il trascinamento, da un'altra porta.
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;

    setHovered(pick(event.clientX));
  };

  const height = (value: number) => `${peak > 0 ? (value / peak) * 100 : 0}%`;

  const current = active !== null ? months[active] : null;

  return (
    <div className="month-columns">
      <div className="month-columns__readout">
        {current ? (
          <>
            <span className="month-columns__month">{current.title}</span>

            {/* Senza etichette: i pallini sono gli stessi della legenda, che
                si è appena letta al posto di questa riga. */}
            <Reading variant="in" value={current.entrate} />
            <Reading variant="out" value={current.uscite} />
            {current.accantonamento > 0 && (
              <Reading variant="aside" value={current.accantonamento} />
            )}
          </>
        ) : (
          <>
            <Legend variant="in" label={labels.entrate} />
            <Legend variant="out" label={labels.uscite} />
            <Legend variant="aside" label={labels.accantonamento} />
          </>
        )}
      </div>

      <div
        ref={trackRef}
        className="month-columns__track"
        role="img"
        aria-label={ariaLabel}
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHovered(null)}
      >
        {months.map((month, index) => (
          <div
            className={`month-columns__group${
              active !== null && index !== active
                ? " month-columns__group--dim"
                : ""
            }`}
            key={`${month.label}-${index}`}
          >
            <div className="month-columns__pair">
              <span
                className="month-columns__bar month-columns__bar--in"
                style={{ height: height(month.entrate) }}
              />

              <span className="month-columns__stack">
                <span
                  className="month-columns__bar month-columns__bar--aside"
                  style={{ height: height(month.accantonamento) }}
                />
                <span
                  className="month-columns__bar month-columns__bar--out"
                  style={{ height: height(month.uscite) }}
                />
              </span>
            </div>

            <span
              className={`month-columns__label${
                index === active ? " month-columns__label--on" : ""
              }`}
            >
              {month.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Variant = "in" | "out" | "aside";

function Legend({ variant, label }: { variant: Variant; label: string }) {
  return (
    <span className="month-columns__item">
      <Dot variant={variant} />
      <span className="month-columns__legend-label">{label}</span>
    </span>
  );
}

function Reading({ variant, value }: { variant: Variant; value: number }) {
  return (
    <span className="month-columns__item">
      <Dot variant={variant} />
      <Amount className="month-columns__value" value={value} decimals={0} />
    </span>
  );
}

function Dot({ variant }: { variant: Variant }) {
  return (
    <span
      className={`month-columns__dot month-columns__dot--${variant}`}
      aria-hidden="true"
    />
  );
}
