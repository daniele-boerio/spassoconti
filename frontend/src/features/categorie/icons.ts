// Le categorie sul BE non hanno un'icona: il design però ne mostra una diversa
// per riga. Finché il campo non esiste la deduciamo dal nome, con un ripiego
// neutro per tutto il resto — meglio un'icona generica che una sbagliata.
//
// Solo icone presenti nell'elenco del design (PrimeIcons).
const KEYWORD_ICONS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["spesa", "supermercato", "aliment", "grocer"], "ph-bold ph-shopping-cart"],
  [["casa", "affitto", "mutuo", "rent", "home"], "ph-bold ph-house"],
  [["trasport", "auto", "carburante", "benzina", "car", "fuel"], "ph-bold ph-car"],
  [["svago", "tempo libero", "divertimento", "cinema", "leisure"], "ph-bold ph-ticket"],
  [["utenz", "bollett", "luce", "gas", "energia", "util"], "ph-bold ph-lightning"],
  [["shopping", "abbigliamento", "vestiti", "clothes"], "ph-bold ph-shopping-bag"],
  [["stipendio", "salario", "lavoro", "salary", "income"], "ph-bold ph-money"],
  [["banca", "conto", "bank"], "ph-bold ph-bank"],
  [["carta", "credito", "card"], "ph-bold ph-credit-card"],
  [["tass", "imposte", "bollo", "tax"], "ph-bold ph-receipt"],
];

const FALLBACK_ICON = "ph-bold ph-tag";

export function categoryIcon(name: string | null | undefined): string {
  if (!name) return FALLBACK_ICON;

  const normalized = name
    .toLowerCase()
    // Toglie gli accenti: "Utenzè" e "Utenze" devono pescare la stessa icona.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [keywords, icon] of KEYWORD_ICONS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return icon;
  }

  return FALLBACK_ICON;
}
