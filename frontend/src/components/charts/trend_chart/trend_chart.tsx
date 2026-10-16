import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import Amount from "../../amount/amount";
import { buildTrend } from "../../../features/statistics/trend";
import "./trend_chart.scss";

// Coordinate del disegno, nelle unità del `viewBox`. Il grafico si adatta in
// larghezza da solo: qui contano solo le proporzioni.
const BOX = {
  width: 360,
  padX: 10,
  top: 22,
  bottom: 104,
  baseline: 118,
};

const HEIGHT = 126;

export type TrendPoint = {
  /** Etichetta sotto l'asse: su dodici punti c'è posto per un'iniziale. */
  label: string;
  /** Nome disteso per il riquadro del valore, dove lo spazio c'è. */
  title?: string;
  value: number;
};

type TrendChartProps = {
  points: TrendPoint[];
  /** Descrizione del grafico per chi non lo vede. */
  ariaLabel: string;
  /** La retta dei minimi quadrati sotto la linea vera. */
  showGuide?: boolean;
  className?: string;
};

/**
 * Il grafico a linea dell'Analisi: linea, area sotto, retta di tendenza.
 *
 * I valori sull'asse verticale non sono scritti tutti — su 360 unità di
 * larghezza una scala completa mangerebbe il grafico. Ci sono i due estremi,
 * che dicono dove sta la linea, e il resto si legge toccando un punto: il
 * valore resta lì finché non se ne tocca un altro. È il motivo per cui questo
 * componente esiste invece di essere due volte lo stesso SVG dentro le pagine
 * che lo usano.
 */
export default function TrendChart({
  points,
  ariaLabel,
  showGuide = false,
  className,
}: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Due stati e non uno: il punto fermato con un tocco resta lì, quello sotto
  // il mouse è di passaggio e se ne va quando il puntatore esce.
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const active = hovered ?? pinned;

  const values = points.map((point) => point.value);
  const trend = buildTrend(values, BOX);

  // Con un punto solo non c'è una linea da disegnare né da scorrere.
  if (!trend || points.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const flat = max === min;

  const step = (BOX.width - BOX.padX * 2) / (points.length - 1);

  /** L'indice del punto più vicino a una x dello schermo. */
  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;

    const x = ((clientX - rect.left) / rect.width) * BOX.width;
    const index = Math.round((x - BOX.padX) / step);

    return Math.min(Math.max(index, 0), points.length - 1);
  };

  // Il tocco ferma un punto invece di trascinarlo lungo la linea: sul telefono
  // il trascinamento faceva selezionare il grafico, e al dito alzato il valore
  // spariva prima di poterlo leggere. Ritoccare lo stesso punto lo libera.
  const onClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const index = pick(event.clientX);
    if (index === null) return;

    setPinned((current) => (current === index ? null : index));
  };

  // Col mouse il valore segue il puntatore come prima. Il dito qui non entra,
  // o sarebbe di nuovo il trascinamento, da un'altra porta.
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;

    setHovered(pick(event.clientX));
  };

  const current = active !== null ? points[active] : null;
  const currentPoint = active !== null ? trend.points[active] : null;

  return (
    <div className={`trend-chart ${className ?? ""}`}>
      <div
        className="trend-chart__plot"
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHovered(null)}
      >
        <svg
          ref={svgRef}
          className="trend-chart__svg"
          viewBox={`0 0 ${BOX.width} ${HEIGHT}`}
          role="img"
          aria-label={ariaLabel}
        >
          {/* Le due righe dove stanno il valore più alto e il più basso: senza,
              la linea non dice a che altezza corre. */}
          {!flat && (
            <>
              <line
                className="trend-chart__grid"
                x1={0}
                y1={BOX.top}
                x2={BOX.width}
                y2={BOX.top}
              />
              <line
                className="trend-chart__grid"
                x1={0}
                y1={BOX.bottom}
                x2={BOX.width}
                y2={BOX.bottom}
              />
            </>
          )}

          <polygon className="trend-chart__area" points={trend.area} />
          <polyline className="trend-chart__line" points={trend.line} />

          {showGuide && trend.guide && (
            <line
              className="trend-chart__guide"
              x1={trend.guide.x1}
              y1={trend.guide.y1}
              x2={trend.guide.x2}
              y2={trend.guide.y2}
            />
          )}

          {currentPoint ? (
            <>
              <line
                className="trend-chart__cursor"
                x1={currentPoint.x}
                y1={BOX.top - 6}
                x2={currentPoint.x}
                y2={BOX.baseline}
              />
              <circle
                className="trend-chart__dot trend-chart__dot--active"
                cx={currentPoint.x}
                cy={currentPoint.y}
                r={6}
              />
            </>
          ) : (
            <circle
              className="trend-chart__dot"
              cx={trend.points[trend.points.length - 1].x}
              cy={trend.points[trend.points.length - 1].y}
              r={5.5}
            />
          )}
        </svg>

        {!flat && (
          <>
            <span className="trend-chart__bound trend-chart__bound--max">
              <Amount value={max} decimals={0} />
            </span>
            <span className="trend-chart__bound trend-chart__bound--min">
              <Amount value={min} decimals={0} />
            </span>
          </>
        )}

        {current && currentPoint && (
          <span
            className={`trend-chart__callout${
              // Vicino al massimo il riquadro uscirebbe dalla card: lì passa
              // sotto al punto invece che sopra.
              currentPoint.y < BOX.top + 28
                ? " trend-chart__callout--below"
                : ""
            }`}
            style={{
              // Il riquadro segue il punto ma non esce dalla card: agli estremi
              // resta indietro, il puntino no.
              left: `${Math.min(
                Math.max((currentPoint.x / BOX.width) * 100, 20),
                80,
              )}%`,
              top: `${(currentPoint.y / HEIGHT) * 100}%`,
            }}
          >
            <span className="trend-chart__callout-label">
              {current.title ?? current.label}
            </span>
            <Amount className="trend-chart__callout-value" value={current.value} />
          </span>
        )}
      </div>

      <div className="trend-chart__axis">
        {points.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            className={
              index === active
                ? "trend-chart__tick trend-chart__tick--on"
                : "trend-chart__tick"
            }
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
