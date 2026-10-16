import "./toggle.scss";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Obbligatorio quando l'interruttore non è dentro una `<label>` con testo. */
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Interruttore 46×28 del design. È una checkbox vera: dentro una `<label>` si
 * accende toccando la riga intera, che è il bersaglio da 44px che serve sul
 * telefono.
 */
export default function Toggle({
  checked,
  onChange,
  ariaLabel,
  id,
  disabled = false,
  className,
}: ToggleProps) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      className={`toggle ${className ?? ""}`}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
