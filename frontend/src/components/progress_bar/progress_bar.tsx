import "./progress_bar.scss";

export type SegmentTone = "accent" | "positive" | "negative";

export type ProgressSegment = {
  /** Quota sul totale, da 0 a 1. */
  value: number;
  tone: SegmentTone;
};

type ProgressBarProps = {
  segments: ProgressSegment[];
  /** Il design usa 6px nelle liste, 8px nei debiti, 10-12px negli hero. */
  height?: 6 | 8 | 10 | 12;
  label?: string;
  className?: string;
};

/**
 * Barra a segmenti su track `--track`. Più segmenti solo dove la schermata
 * dice a parole che cosa è ciascun colore: senza legenda si usa un tono solo.
 */
export default function ProgressBar({
  segments,
  height = 6,
  label,
  className,
}: ProgressBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div
      className={`progress progress--h${height} ${className ?? ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(total * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {segments.map((segment, index) => (
        <span
          key={index}
          className={`progress__segment progress__segment--${segment.tone}`}
          style={{ width: `${Math.max(0, Math.min(1, segment.value)) * 100}%` }}
        />
      ))}
    </div>
  );
}
