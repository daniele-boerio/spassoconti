import { TransactionsFilters } from "./interfaces";
import { PeriodPreset, periodRange } from "./period";

/**
 * Filtri dei Movimenti ⇄ query string. Stanno nell'URL perché un refresh, un
 * link condiviso o il tasto indietro non devono riportare la lista al suo
 * stato iniziale: la vista è quella che l'indirizzo descrive.
 *
 * Le chiavi sono quelle del dominio (in italiano, come le rotte del BE), non i
 * nomi dei campi interni: l'URL lo legge anche l'utente.
 */
const KEYS = {
  period: "periodo",
  from: "da",
  to: "a",
  type: "tipo",
  accounts: "conti",
  categories: "categorie",
  subcategories: "sottocategorie",
  tags: "tag",
  min: "min",
  max: "max",
  query: "q",
  uncategorized: "senza_categoria",
} as const;

/**
 * I Movimenti aprono su tutto: un periodo preselezionato è un filtro che
 * l'utente non ha chiesto e che nasconde metà della lista senza dirlo.
 */
export const DEFAULT_PERIOD: PeriodPreset = "all";

const PERIODS: PeriodPreset[] = [
  "month",
  "last_month",
  "last_90",
  "year",
  "all",
  "custom",
];

export interface UrlFilters {
  period: PeriodPreset;
  filters: TransactionsFilters;
}

const list = (value: string | null): string[] | undefined => {
  const items = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
};

const number = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function encodeFilters(
  filters: TransactionsFilters,
  period: PeriodPreset,
): URLSearchParams {
  const params = new URLSearchParams();

  if (period !== DEFAULT_PERIOD) params.set(KEYS.period, period);

  // Le date stanno nell'URL solo quando le ha scelte l'utente: per i preset le
  // ricalcola `periodRange`, e scriverle renderebbe il link scaduto domani.
  if (period === "custom") {
    if (filters.data_inizio) params.set(KEYS.from, filters.data_inizio);
    if (filters.data_fine) params.set(KEYS.to, filters.data_fine);
  }

  if (filters.tipo) params.set(KEYS.type, filters.tipo);
  if (filters.conto_id?.length)
    params.set(KEYS.accounts, filters.conto_id.join(","));
  if (filters.categoria_id?.length)
    params.set(KEYS.categories, filters.categoria_id.join(","));
  if (filters.sottocategoria_id?.length)
    params.set(KEYS.subcategories, filters.sottocategoria_id.join(","));
  if (filters.tag_id?.length) params.set(KEYS.tags, filters.tag_id.join(","));
  if (filters.importo_min !== undefined)
    params.set(KEYS.min, String(filters.importo_min));
  if (filters.importo_max !== undefined)
    params.set(KEYS.max, String(filters.importo_max));
  if (filters.descrizione) params.set(KEYS.query, filters.descrizione);
  // Solo l'acceso finisce nell'URL: "senza_categoria=0" non è un filtro.
  if (filters.senza_categoria) params.set(KEYS.uncategorized, "1");

  return params;
}

export function decodeFilters(params: URLSearchParams): UrlFilters {
  const raw = params.get(KEYS.period);
  const period = PERIODS.find((item) => item === raw) ?? DEFAULT_PERIOD;

  const range =
    period === "custom"
      ? {
          data_inizio: params.get(KEYS.from) ?? undefined,
          data_fine: params.get(KEYS.to) ?? undefined,
        }
      : periodRange(period);

  return {
    period,
    filters: {
      ...range,
      tipo: params.get(KEYS.type) ?? undefined,
      conto_id: list(params.get(KEYS.accounts)),
      categoria_id: list(params.get(KEYS.categories)),
      sottocategoria_id: list(params.get(KEYS.subcategories)),
      tag_id: list(params.get(KEYS.tags)),
      importo_min: number(params.get(KEYS.min)),
      importo_max: number(params.get(KEYS.max)),
      descrizione: params.get(KEYS.query) ?? undefined,
      senza_categoria: params.get(KEYS.uncategorized) === "1" || undefined,
    },
  };
}
