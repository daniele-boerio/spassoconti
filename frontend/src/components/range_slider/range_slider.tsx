import { ReactNode } from "react";
import "./range_slider.scss";

type RangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  /** Estremi selezionati, sempre ordinati. */
  value: [number, number];
  onChange: (value: [number, number]) => void;
  label: string;
  /** Valore leggibile mostrato accanto all'etichetta. */
  caption?: ReactNode;
};

/**
 * Selettore di intervallo a due maniglie: due `<input type="range">`
 * sovrapposti sulla stessa traccia. Sono controlli nativi, quindi arrivano
 * gratis tastiera, lettori di schermo e trascinamento sul telefono — cosa che
 * una coppia di `<div>` trascinabili avrebbe dovuto rifare a mano.
 */
export default function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  caption,
}: RangeSliderProps) {
  const [low, high] = value;
  const span = max - min || 1;

  const percent = (amount: number) => ((amount - min) / span) * 100;

  // Le maniglie non si scavalcano: quella tirata oltre l'altra si ferma lì.
  const setLow = (next: number) => onChange([Math.min(next, high), high]);
  const setHigh = (next: number) => onChange([low, Math.max(next, low)]);

  return (
    <div className="range">
      <div className="range__head">
        <span className="range__label">{label}</span>
        {caption && <span className="range__caption">{caption}</span>}
      </div>

      <div className="range__control">
        <span className="range__track" aria-hidden="true" />
        <span
          className="range__fill"
          aria-hidden="true"
          style={{
            left: `${percent(low)}%`,
            right: `${100 - percent(high)}%`,
          }}
        />

        <input
          type="range"
          className="range__input"
          min={min}
          max={max}
          step={step}
          value={low}
          aria-label={`${label} — min`}
          onChange={(event) => setLow(Number(event.target.value))}
        />
        <input
          type="range"
          className="range__input"
          min={min}
          max={max}
          step={step}
          value={high}
          aria-label={`${label} — max`}
          onChange={(event) => setHigh(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
