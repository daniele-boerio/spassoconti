import { ReactNode, useEffect, useMemo, useState } from "react";
import Sheet from "../../sheet/sheet";
import { Card } from "../../card/card";
import Chip from "../../chip/chip";
import Button from "../../button/button";
import Calendar from "../../calendar/calendar";
import RangeSlider from "../../range_slider/range_slider";
import Toggle from "../../toggle/toggle";
import { useI18n } from "../../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { useDebouncedValue } from "../../../features/ui/use_debounced_value";
import { formatNumber } from "../../../features/ui/format";
import {
  resetFilters,
  selectTransactionFilters,
  selectTransactionPagination,
  selectTransactionPeriod,
  selectTransactionTransactions,
  setPeriod,
  updateFilters,
} from "../../../features/transactions/transaction_slice";
import {
  PERIOD_LABEL_KEYS,
  PERIOD_PRESETS,
} from "../../../features/transactions/period";
import { amountCeiling } from "../../../features/transactions/group";
import { selectContiConti } from "../../../features/conti/conto_slice";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import { selectTagTags } from "../../../features/tags/tag_slice";
import { toIsoDate } from "../../../services/dates";
import "./filters_sheet.scss";

// Il cursore non deve avere un passo più fine di quanto la scala sappia
// mostrare: un centesimo del tetto è già abbastanza preciso.
const STEP_RATIO = 100;
const RANGE_DEBOUNCE = 250;

type FiltersSheetProps = {
  visible: boolean;
  onHide: () => void;
  /**
   * `sheet` è il foglio che sale dal fondo, sul telefono. `panel` è lo stesso
   * contenuto sempre aperto nella colonna di destra del desktop: lì i filtri
   * non coprono la lista, le stanno accanto e la lista si aggiorna sotto.
   */
  variant?: "sheet" | "panel";
};

type ListKey =
  | "conto_id"
  | "categoria_id"
  | "sottocategoria_id"
  | "tag_id";

// I cinque tipi del BE più "tutte". Erano tre in una pillola segmentata:
// rimborsi e accantonamenti restavano fuori, e chi li cercava non poteva
// isolarli. In sei non ci stanno in una pillola sola, quindi diventano chip
// come ogni altro filtro del foglio — a selezione singola, perché `tipo` sul
// BE è un campo solo.
const TYPES: { value: string; labelKey: string }[] = [
  { value: "", labelKey: "mov_type_all" },
  { value: "USCITA", labelKey: "expenses" },
  { value: "ENTRATA", labelKey: "income" },
  { value: "RICARICA", labelKey: "tx_type_transfer" },
  { value: "RIMBORSO", labelKey: "compensations" },
  { value: "ACCANTONAMENTO", labelKey: "mov_type_set_aside" },
];

const parseDate = (value?: string): Date | null => {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

/**
 * Foglio dei filtri dei Movimenti.
 *
 * Ogni tocco applica subito: la lista dietro si aggiorna mentre il foglio è
 * aperto, e il bottone in fondo non conferma niente — dice quanti movimenti
 * restano e chiude. È l'unico modo perché quel numero sia vero.
 */
export default function FiltersSheet({
  visible,
  onHide,
  variant = "sheet",
}: FiltersSheetProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const filters = useAppSelector(selectTransactionFilters);
  const period = useAppSelector(selectTransactionPeriod);
  const pagination = useAppSelector(selectTransactionPagination);
  const transactions = useAppSelector(selectTransactionTransactions);
  const conti = useAppSelector(selectContiConti);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const tags = useAppSelector(selectTagTags);

  // Il tetto del cursore si deduce dai movimenti a schermo; un massimo già
  // scelto lo alza, altrimenti riaprendo il foglio la maniglia sarebbe fuori
  // scala.
  const ceiling = useMemo(
    () => Math.max(amountCeiling(transactions), filters.importo_max ?? 0),
    [transactions, filters.importo_max],
  );

  // `null` finché il cursore non l'ha toccato nessuno: in quel caso le due
  // maniglie non sono uno stato ma il riflesso dei filtri e del tetto.
  //
  // Il tetto si conosce solo quando i movimenti sono arrivati, e come pannello
  // fisso della colonna destra questo componente è montato da prima. Con le
  // maniglie congelate al primo tetto provvisorio, il cursore scriveva da solo
  // un massimo che nessuno aveva chiesto, il massimo riabbassava il tetto, il
  // tetto cancellava il massimo: due richieste che si rincorrevano all'infinito.
  const [range, setRange] = useState<[number, number] | null>(null);

  const shown = useMemo<[number, number]>(
    () =>
      range ?? [filters.importo_min ?? 0, filters.importo_max ?? ceiling],
    [range, filters.importo_min, filters.importo_max, ceiling],
  );

  const settledRange = useDebouncedValue(shown, RANGE_DEBOUNCE);

  useEffect(() => {
    // Nessuno ha trascinato niente: non c'è nessun filtro da scrivere, e
    // scriverlo vorrebbe dire filtrare di sua iniziativa.
    if (range === null) return;

    const [low, high] = settledRange;

    // Agli estremi il filtro sparisce: "da zero a tutto" non è un filtro.
    dispatch(
      updateFilters({
        importo_min: low > 0 ? low : undefined,
        importo_max: high < ceiling ? high : undefined,
      }),
    );
  }, [dispatch, range, settledRange, ceiling]);

  const selected = (key: ListKey) => filters[key] ?? [];

  // Gli id girano ora come numeri (arrivano così dal BE) ora come stringhe
  // (l'URL non sa fare altro): il confronto passa sempre da `String`, e nella
  // lista dei filtri ci finisce la stringa. Senza, dopo un refresh la spunta
  // sui chip spariva e ritoccarli aggiungeva un doppione.
  const isOn = (key: ListKey, id: string) =>
    selected(key).some((item) => String(item) === String(id));

  const toggleIn = (key: ListKey, id: string) => {
    const next = isOn(key, id)
      ? selected(key).filter((item) => String(item) !== String(id))
      : [...selected(key), String(id)];

    dispatch(updateFilters({ [key]: next.length > 0 ? next : undefined }));
  };

  // Le sottocategorie scegliibili sono quelle delle categorie accese. Fuori da
  // una categoria sarebbero un elenco lungo e senza contesto — è la stessa
  // regola del foglio dei filtri dell'Analisi.
  const sottocategorieScegliibili = useMemo(
    () =>
      categorie
        .filter((categoria) =>
          (filters.categoria_id ?? []).some(
            (item) => String(item) === String(categoria.id),
          ),
        )
        .flatMap((categoria) => categoria.sottocategorie ?? []),
    [categorie, filters.categoria_id],
  );

  // Spegnere una categoria porta via anche le sue sottocategorie: lasciarle
  // accese vorrebbe dire continuare a filtrare su un ramo che il foglio non
  // mostra più, cioè una lista corta senza un motivo visibile.
  const toggleCategoria = (id: string) => {
    const next = isOn("categoria_id", id)
      ? selected("categoria_id").filter((item) => String(item) !== String(id))
      : [...selected("categoria_id"), String(id)];

    const superstiti = new Set(
      categorie
        .filter((categoria) =>
          next.some((item) => String(item) === String(categoria.id)),
        )
        .flatMap((categoria) => categoria.sottocategorie ?? [])
        .map((sotto) => String(sotto.id)),
    );

    const sottocategorie = selected("sottocategoria_id").filter((item) =>
      superstiti.has(String(item)),
    );

    dispatch(
      updateFilters({
        categoria_id: next.length > 0 ? next : undefined,
        sottocategoria_id:
          sottocategorie.length > 0 ? sottocategorie : undefined,
      }),
    );
  };

  // Il conto virtuale non si filtra: chi non ha conti non ha niente da
  // distinguere, e chi ne ha vede solo i suoi.
  const contiScegliibili = conti.filter((conto) => !conto.virtuale);

  const total = pagination.total ?? 0;

  const reset = (
    <button
      type="button"
      className="filters-sheet__reset"
      onClick={() => {
        dispatch(resetFilters());
        setRange(null);
      }}
    >
      {t("mov_clear")}
    </button>
  );

  const body = (
    <>
      <Section label={t("mov_period")}>
        <div className="filters-sheet__chips">
          {PERIOD_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={t(PERIOD_LABEL_KEYS[preset])}
              variant={period === preset ? "accent" : "solid"}
              onClick={() => dispatch(setPeriod(preset))}
            />
          ))}

          <Chip
            label={t(PERIOD_LABEL_KEYS.custom)}
            variant={period === "custom" ? "accent" : "dashed"}
            onClick={() => dispatch(setPeriod("custom"))}
          />
        </div>

        {period === "custom" && (
          <div className="filters-sheet__dates">
            <Calendar
              label={t("from_date")}
              value={parseDate(filters.data_inizio)}
              onChange={(event) =>
                dispatch(
                  updateFilters({
                    data_inizio: event.value
                      ? toIsoDate(event.value as Date)
                      : undefined,
                  }),
                )
              }
              showIcon
              showButtonBar
            />
            <Calendar
              label={t("to_date")}
              value={parseDate(filters.data_fine)}
              onChange={(event) =>
                dispatch(
                  updateFilters({
                    data_fine: event.value
                      ? toIsoDate(event.value as Date)
                      : undefined,
                  }),
                )
              }
              showIcon
              showButtonBar
            />
          </div>
        )}
      </Section>

      <Section label={t("mov_type")}>
        <div className="filters-sheet__chips">
          {TYPES.map((type) => (
            <Chip
              key={type.value || "all"}
              label={t(type.labelKey)}
              variant={
                (filters.tipo ?? "") === type.value ? "accent" : "solid"
              }
              onClick={() =>
                dispatch(updateFilters({ tipo: type.value || undefined }))
              }
            />
          ))}
        </div>
      </Section>

      {contiScegliibili.length > 0 && (
        <Section label={t("nav_accounts")}>
          <div className="filters-sheet__chips">
            {contiScegliibili.map((conto) => (
              <Chip
                key={conto.id}
                label={conto.nome}
                icon={isOn("conto_id", conto.id) ? "ph-bold ph-check" : undefined}
                variant={isOn("conto_id", conto.id) ? "accent" : "solid"}
                onClick={() => toggleIn("conto_id", conto.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {categorie.length > 0 && (
        <Section label={t("nav_categories")}>
          <div className="filters-sheet__chips">
            {categorie.map((categoria) => (
              <Chip
                key={categoria.id}
                label={categoria.nome}
                icon={
                  isOn("categoria_id", categoria.id) ? "ph-bold ph-check" : undefined
                }
                variant={isOn("categoria_id", categoria.id) ? "accent" : "solid"}
                onClick={() => toggleCategoria(categoria.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {sottocategorieScegliibili.length > 0 && (
        <Section label={t("sub_categories")}>
          <div className="filters-sheet__chips">
            {sottocategorieScegliibili.map((sotto) => (
              <Chip
                key={sotto.id}
                label={sotto.nome}
                icon={
                  isOn("sottocategoria_id", sotto.id) ? "ph-bold ph-check" : undefined
                }
                variant={
                  isOn("sottocategoria_id", sotto.id) ? "accent" : "solid"
                }
                onClick={() => toggleIn("sottocategoria_id", sotto.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {tags.length > 0 && (
        <Section label={t("nav_tags")}>
          <div className="filters-sheet__chips">
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.nome}
                icon={isOn("tag_id", tag.id) ? "ph-bold ph-check" : undefined}
                variant={isOn("tag_id", tag.id) ? "accent" : "solid"}
                onClick={() => toggleIn("tag_id", tag.id)}
              />
            ))}
          </div>
        </Section>
      )}

      <label className="filters-sheet__switch">
        <span>{t("mov_only_uncategorized")}</span>
        <Toggle
          checked={filters.senza_categoria ?? false}
          onChange={(checked) =>
            dispatch(updateFilters({ senza_categoria: checked || undefined }))
          }
        />
      </label>

      <RangeSlider
        label={t("amount")}
        min={0}
        max={ceiling}
        step={Math.max(1, Math.round(ceiling / STEP_RATIO))}
        value={shown}
        onChange={setRange}
        caption={`${formatNumber(shown[0], 0)} – ${formatNumber(shown[1], 0)}${
          shown[1] >= ceiling ? "+" : ""
        } €`}
      />
    </>
  );

  if (variant === "panel") {
    return (
      <Card className="filters-panel">
        <div className="filters-panel__head">
          <span className="filters-panel__title">{t("filters")}</span>
          {reset}
        </div>
        {body}
      </Card>
    );
  }

  return (
    <Sheet
      open={visible}
      onClose={onHide}
      title={t("filters")}
      className="filters-sheet"
      action={reset}
      footer={
        <Button block onClick={onHide}>
          {`${t("mov_show")} ${total} ${t("nav_movements").toLowerCase()}`}
        </Button>
      }
    >
      {body}
    </Sheet>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="filters-sheet__section">
      <span className="filters-sheet__label">{label}</span>
      {children}
    </section>
  );
}
