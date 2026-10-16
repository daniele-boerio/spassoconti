import { AmountSign, formatAmount } from "../../features/ui/format";
import "./amount.scss";

type AmountProps = {
  value: number;
  /** Colore semantico: solo importi e delta lo usano. */
  tone?: "neutral" | "positive" | "negative";
  sign?: AmountSign;
  decimals?: number;
  currency?: string;
  /** Nasconde il simbolo di valuta (tabelle con la valuta in intestazione). */
  hideCurrency?: boolean;
  className?: string;
};

/**
 * Un importo scritto come vuole il design: cifre tabellari, segno prima del
 * numero, valuta dopo. Il simbolo è un elemento a sé perché l'hero e le card lo
 * rimpiccioliscono rispetto al numero.
 */
export default function Amount({
  value,
  tone = "neutral",
  sign = "auto",
  decimals = 2,
  currency = "€",
  hideCurrency = false,
  className,
}: AmountProps) {
  const formatted = formatAmount(value, { sign, decimals });

  return (
    <span className={`amount amount--${tone} ${className ?? ""}`}>
      <span className="amount__value">{formatted}</span>
      {!hideCurrency && <span className="amount__currency">{currency}</span>}
    </span>
  );
}
