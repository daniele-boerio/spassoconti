import "./skeleton.scss";

// Larghezze diverse per riga: tre barre identiche si leggono come un errore di
// rendering, non come un caricamento.
const ROWS = [
  { title: "58%", meta: "36%", amount: "62px" },
  { title: "44%", meta: "52%", amount: "54px" },
  { title: "66%", meta: "30%", amount: "58px" },
];

/** Scheletro di una lista in caricamento: si mostra solo al primo caricamento. */
export default function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => {
        const shape = ROWS[index % ROWS.length];

        return (
          <div key={index} className="skeleton__row">
            <span className="skeleton__avatar" />
            <span className="skeleton__text">
              <span
                className="skeleton__bar"
                style={{ width: shape.title, height: 11 }}
              />
              <span
                className="skeleton__bar skeleton__bar--soft"
                style={{ width: shape.meta, height: 9 }}
              />
            </span>
            <span
              className="skeleton__bar"
              style={{ width: shape.amount, height: 12 }}
            />
          </div>
        );
      })}
    </div>
  );
}
