import { categoryIcon } from "../categorie/icons";
import { tipoTransaction } from "./interfaces";

// Alcuni tipi hanno un'icona propria che vale più di quella della categoria:
// un giroconto è un giroconto, qualunque categoria porti.
const TYPE_ICONS: Partial<Record<tipoTransaction, string>> = {
  ENTRATA: "ph-bold ph-arrow-up-right",
  RIMBORSO: "ph-bold ph-arrow-up-right",
  RICARICA: "ph-bold ph-arrows-left-right",
  ACCANTONAMENTO: "ph-bold ph-wallet",
};

/** Icona di una riga movimento: prima il tipo, poi la categoria. */
export function transactionIcon(
  tipo: tipoTransaction,
  categoria?: string | null,
): string {
  return TYPE_ICONS[tipo] ?? categoryIcon(categoria);
}
