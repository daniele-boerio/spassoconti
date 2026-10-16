import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { Card, CardTitle } from "../../components/card/card";
import { PageColumn, PageColumns } from "../../components/page/page";
import Amount from "../../components/amount/amount";
import EmptyState from "../../components/empty_state/empty_state";
import SkeletonList from "../../components/skeleton/skeleton";
import MonthColumns from "../../components/charts/month_columns/month_columns";
import TrendChart from "../../components/charts/trend_chart/trend_chart";
import {
  getCategoryTrendChart,
  getExpenseCompositionChart,
  getIncomeExpenseChart,
  getSavingsChart,
} from "../../features/charts/api_calls";
import {
  selectChartsCategoryTrend,
  selectChartsExpenseComposition,
  selectChartsIncomeExpense,
  selectChartsLoading,
  selectChartsSavings,
} from "../../features/charts/charts_slice";
import { selectCategoriaCategorie } from "../../features/categorie/categoria_slice";
import { UNCATEGORIZED } from "../../features/statistics/expenses";
import { linearRegression } from "../../features/statistics/trend";
import { monthOfLabel } from "../../features/charts/labels";
import { endOfMonth, toIsoDate } from "../../services/dates";
import "./charts_page.scss";

// Ciambella: diametro e spessore dell'anello, in unità del `viewBox`.
const DONUT_SIZE = 132;
const DONUT_STROKE = 18;

// Le tinte della serie sono cinque: dalla sesta categoria in giù si sommano
// tutte in "Altro", che ha la sua tinta neutra.
const TOP_SLICES = 5;

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

/** Iniziale del mese: dodici colonne non hanno spazio per "gen", "feb", … */
const monthInitial = (year: number, month: number) =>
  new Intl.DateTimeFormat(localeTag(), { month: "narrow" }).format(
    new Date(year, month - 1, 1),
  );

/** Nome breve: nel riquadro che compare al tocco lo spazio c'è. */
const monthShort = (year: number, month: number) =>
  new Intl.DateTimeFormat(localeTag(), { month: "short" }).format(
    new Date(year, month - 1, 1),
  );

/**
 * Le serie a mesi, ripulite: `charts_slice` è un secchio unico riempito anche
 * dalla vista Mese, con finestre che scavalcano l'anno. Quello che non
 * appartiene all'anno a schermo esce di qui (vedi features/charts/labels).
 */
const byMonth = <T, R>(
  rows: (T & { label: string })[],
  year: number,
  map: (row: T, month: number) => R,
): R[] =>
  rows.flatMap((row) => {
    const month = monthOfLabel(row.label, year);
    return month === null ? [] : [map(row, month)];
  });

type ChartsProps = {
  year: number;
  /**
   * Dai filtri della schermata: restringe tutti e quattro i grafici, e decide
   * di quale categoria è l'andamento dell'ultima card.
   */
  categoriaId: string | null;
  sottocategoriaIds: string[];
  tagId: string | null;
};

/**
 * La terza vista dell'Analisi: l'anno intero, in quattro grafici.
 *
 * Il periodo non si sceglie qui — è l'anno della testata, come per le altre due
 * viste. Prima ogni card aveva la sua coppia di date e la categoria un menu a
 * tendina suo: quattro periodi diversi nella stessa schermata, e nessuno dei
 * quattro era quello scritto in cima.
 *
 * I grafici sono disegnati a mano come il resto dell'Analisi, non con una
 * libreria: è l'unico modo perché prendano i colori dai token del tema (dentro
 * un canvas le custom property non esistono) e perché al buio si leggano senza
 * doverli ridipingere da JavaScript. I numeri si leggono tenendo il dito sul
 * grafico — è lì che `MonthColumns` e `TrendChart` si guadagnano il posto di
 * componenti invece di essere due SVG scritti qui dentro.
 */
export default function ChartsPage({
  year,
  categoriaId,
  sottocategoriaIds,
  tagId,
}: ChartsProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const incomeExpense = useAppSelector(selectChartsIncomeExpense);
  const savings = useAppSelector(selectChartsSavings);
  const composition = useAppSelector(selectChartsExpenseComposition);
  const categoryTrend = useAppSelector(selectChartsCategoryTrend);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const loading = useAppSelector(selectChartsLoading);

  // Nell'anno in corso la finestra si ferma al mese corrente: i mesi che non
  // sono ancora successi tornano a zero dal BE, e uno zero in fondo alla linea
  // del risparmio si legge come un crollo.
  const filtri = useMemo(() => {
    const today = new Date();
    const last = year === today.getFullYear() ? today : new Date(year, 11, 1);

    return {
      data_inizio: toIsoDate(new Date(year, 0, 1)),
      data_fine: toIsoDate(endOfMonth(last)),
      categoria_id: categoriaId,
      sottocategoria_id: sottocategoriaIds,
      tag_id: tagId,
    };
  }, [year, categoriaId, sottocategoriaIds, tagId]);

  useEffect(() => {
    dispatch(getIncomeExpenseChart(filtri));
    dispatch(getSavingsChart(filtri));
    dispatch(getExpenseCompositionChart(filtri));
  }, [dispatch, filtri]);

  useEffect(() => {
    if (!categoriaId) return;

    // Qui la categoria non è un filtro ma il soggetto: la card dice il suo
    // andamento nei mesi, e `filtri` la porta già dentro.
    dispatch(getCategoryTrendChart({ ...filtri, categoria_id: categoriaId }));
  }, [dispatch, categoriaId, filtri]);

  // Il BE riempie di zeri i mesi senza movimenti: l'asse c'è tutto anche
  // quando i dati no, e le colonne restano nella stessa posizione da un anno
  // all'altro.
  const months = useMemo(
    () =>
      byMonth(incomeExpense, year, (row, month) => ({
        label: monthInitial(year, month),
        title: monthShort(year, month),
        entrate: Math.abs(row.entrate),
        uscite: Math.abs(row.uscite),
        accantonamento: Math.abs(row.accantonamento ?? 0),
      })),
    [incomeExpense, year],
  );

  const savingsPoints = useMemo(
    () =>
      byMonth(savings, year, (row, month) => ({
        label: monthInitial(year, month),
        title: monthShort(year, month),
        value: Number(row.risparmio),
      })),
    [savings, year],
  );

  const savingsSlope = linearRegression(
    savingsPoints.map((point) => point.value),
  ).slope;

  const slices = useMemo(() => {
    const sorted = composition
      .map((row) => ({
        nome:
          row.categoria === UNCATEGORIZED
            ? t(
                categoriaId
                  ? "taxonomy_no_subcategory"
                  : "taxonomy_uncategorized",
              )
            : row.categoria,
        totale: Math.abs(row.totale),
      }))
      .filter((row) => row.totale > 0)
      .sort((a, b) => b.totale - a.totale);

    const top = sorted.slice(0, TOP_SLICES);
    const rest = sorted.slice(TOP_SLICES);

    if (rest.length > 0) {
      top.push({
        nome: t("other"),
        totale: rest.reduce((sum, row) => sum + row.totale, 0),
      });
    }

    return top;
  }, [composition, categoriaId, t]);

  const compositionTotal = slices.reduce((sum, slice) => sum + slice.totale, 0);

  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  // Gli archi della ciambella: ognuno è un cerchio tratteggiato lungo quanto la
  // sua fetta e spostato di quanto misurano tutte quelle prima. Lo scorrimento
  // si ricalcola invece di accumularsi in una variabile: le fette sono al
  // massimo sei, e una somma parziale è più facile da leggere di un contatore
  // che cambia sotto al `map`.
  const arcs = useMemo(() => {
    const shares = slices.map((slice) =>
      compositionTotal > 0 ? slice.totale / compositionTotal : 0,
    );

    return slices.map((slice, index) => {
      const before = shares
        .slice(0, index)
        .reduce((sum, share) => sum + share, 0);

      return {
        ...slice,
        index,
        share: shares[index],
        length: shares[index] * circumference,
        offset: before * circumference,
      };
    });
  }, [slices, compositionTotal, circumference]);

  const trendPoints = useMemo(
    () =>
      byMonth(categoryTrend, year, (row, month) => ({
        label: monthInitial(year, month),
        title: monthShort(year, month),
        value: Math.abs(Number(row.spesa)),
      })),
    [categoryTrend, year],
  );

  const categoriaNome = categorie.find(
    (item) => String(item.id) === String(categoriaId),
  )?.nome;

  if (loading && months.length === 0) {
    return (
      <Card>
        <SkeletonList />
      </Card>
    );
  }

  const hasData = months.some(
    (entry) =>
      entry.entrate > 0 || entry.uscite > 0 || entry.accantonamento > 0,
  );

  if (!hasData) {
    return (
      <EmptyState
        icon="ph-bold ph-chart-bar"
        title={t("analysis_empty_title")}
        description={t("analysis_empty_text")}
      />
    );
  }

  const sliceClass = (index: number) =>
    index < TOP_SLICES ? String(index + 1) : "rest";

  return (
    <PageColumns split="balanced">
      <PageColumn>
      <Card>
        <CardTitle aside={t("charts_touch_for_values")}>
          {t("analysis_in_and_out")}
        </CardTitle>

        <MonthColumns
          months={months}
          ariaLabel={t("analysis_in_and_out")}
          labels={{
            entrate: t("income"),
            uscite: t("expenses"),
            accantonamento: t("set_aside"),
          }}
        />
      </Card>

      {savingsPoints.length > 1 && (
        <Card>
          <CardTitle
            aside={
              <span
                className={`chart-badge chart-badge--${
                  savingsSlope >= 0 ? "up" : "down"
                }`}
              >
                {savingsSlope >= 0
                  ? t("analysis_trend_up")
                  : t("analysis_trend_down")}
              </span>
            }
          >
            {t("analysis_savings_trend")}
          </CardTitle>

          <TrendChart
            points={savingsPoints}
            ariaLabel={t("analysis_savings_trend")}
            showGuide
          />

          <div className="chart-legend">
            <LegendDot variant="line" label={t("savings")} />
            <LegendDot variant="guide" label={t("trendline")} />
          </div>
        </Card>
      )}

      </PageColumn>

      <PageColumn>
      {slices.length > 0 && (
        <Card>
          <CardTitle>
            {categoriaNome
              ? `${t("expense_composition")} - ${categoriaNome}`
              : t("expense_composition")}
          </CardTitle>

          <div className="donut">
            <svg
              className="donut__chart"
              viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
              role="img"
              aria-label={t("expense_composition")}
            >
              <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
                {arcs.map((arc) => {
                  // Due unità di stacco fra una fetta e l'altra: senza, due
                  // categorie vicine nella scala dei verdi si fondono.
                  const drawn = Math.max(arc.length - 2, 0);

                  return (
                    <circle
                      key={arc.nome}
                      className={`donut__arc donut__arc--${sliceClass(arc.index)}`}
                      cx={DONUT_SIZE / 2}
                      cy={DONUT_SIZE / 2}
                      r={radius}
                      strokeWidth={DONUT_STROKE}
                      strokeDasharray={`${drawn} ${circumference - drawn}`}
                      strokeDashoffset={-arc.offset}
                    />
                  );
                })}
              </g>
            </svg>

            <ul className="donut__legend">
              {arcs.map((arc) => (
                <li className="donut__row" key={arc.nome}>
                  <span
                    className={`donut__dot donut__dot--${sliceClass(arc.index)}`}
                    aria-hidden="true"
                  />
                  <span className="donut__name">{arc.nome}</span>
                  <span className="donut__share">
                    {`${Math.round(arc.share * 100)}%`}
                  </span>
                  <Amount className="donut__value" value={arc.totale} />
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle aside={categoriaNome}>{t("category_trend")}</CardTitle>

        {!categoriaId ? (
          <p className="chart-hint">{t("charts_pick_category")}</p>
        ) : trendPoints.length < 2 ||
          trendPoints.every((point) => point.value === 0) ? (
          <p className="chart-hint">{t("no_data")}</p>
        ) : (
          <TrendChart points={trendPoints} ariaLabel={t("category_trend")} />
        )}
      </Card>
      </PageColumn>
    </PageColumns>
  );
}

function LegendDot({
  variant,
  label,
}: {
  variant: "in" | "out" | "aside" | "line" | "guide";
  label: string;
}) {
  return (
    <span className="chart-legend__item">
      <span
        className={`chart-legend__dot chart-legend__dot--${variant}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
