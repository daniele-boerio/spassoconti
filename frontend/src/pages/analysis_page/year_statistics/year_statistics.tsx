import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { Card, CardTitle } from "../../../components/card/card";
import {
  PageColumn,
  PageColumns,
} from "../../../components/page/page";
import Amount from "../../../components/amount/amount";
import EmptyState from "../../../components/empty_state/empty_state";
import SkeletonList from "../../../components/skeleton/skeleton";
import { useI18n } from "../../../i18n/use-i18n";
import { getLocale } from "../../../i18n";
import "./year_statistics.scss";
import { getYearDetailsStatistics } from "../../../features/statistics/api_calls";
import {
  selectStatisticsLoading,
  selectYearlyStatisticsData,
  selectYearlyTotals,
} from "../../../features/statistics/statistics_slice";
import { linearRegression } from "../../../features/statistics/trend";
import TrendChart from "../../../components/charts/trend_chart/trend_chart";
import { YearDetailsStatRow } from "../../../features/statistics/interfaces";
import {
  ExpenseRow,
  yearExpenseRows,
} from "../../../features/statistics/expenses";
import CategoryBars from "../../../components/category_bars/category_bars";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import { encodeFilters } from "../../../features/transactions/filters_url";
import { endOfYear, startOfYear, toIsoDate } from "../../../services/dates";

// Da nove mesi in su le colonne si stringono: a spaziature piene dodici
// coppie di barre non entrano nella card su 430px.
const DENSE_MONTHS = 9;

type YearStatisticsProps = {
  year: number;
  categoriaId: string | null;
  sottocategoriaIds: string[];
  tagId: string | null;
};

interface MonthTotals {
  month: number;
  entrate: number;
  uscite: number;
}

/**
 * Entrate e uscite di un mese. `yearDetails` manda una riga per mese con una
 * chiave per categoria e il segno dentro al valore: positivo entrata,
 * negativo uscita.
 */
const totalsOf = (row: YearDetailsStatRow): MonthTotals => {
  let entrate = 0;
  let uscite = 0;

  for (const [key, value] of Object.entries(row)) {
    if (key === "month") continue;

    if (value > 0) entrate += value;
    else uscite -= value;
  }

  return { month: Number(row.month), entrate, uscite };
};

export default function YearStatistics({
  year,
  categoriaId,
  sottocategoriaIds,
  tagId,
}: YearStatisticsProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const rows = useAppSelector(selectYearlyStatisticsData);
  const totals = useAppSelector(selectYearlyTotals);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const loading = useAppSelector(selectStatisticsLoading);

  useEffect(() => {
    dispatch(
      getYearDetailsStatistics({
        year,
        categoria_id: categoriaId,
        sottocategoria_id: sottocategoriaIds,
        tag_id: tagId,
      }),
    );
  }, [dispatch, year, categoriaId, sottocategoriaIds, tagId]);

  const today = new Date();
  // Nell'anno in corso si arriva al mese corrente; negli anni passati
  // all'ultimo mese, che c'è tutto.
  const lastMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;

  // Tutto l'anno fin qui, da gennaio: è l'anno che si sta guardando, e una
  // finestra più corta ne nascondeva l'inizio senza dirlo.
  const months = useMemo(() => {
    const all = rows.map(totalsOf).sort((a, b) => a.month - b.month);
    const end = all.findIndex((entry) => entry.month === lastMonth);

    return end >= 0 ? all.slice(0, end + 1) : all;
  }, [rows, lastMonth]);

  const savings = months.map((month) => month.entrate - month.uscite);

  const peak = Math.max(
    ...months.flatMap((month) => [month.entrate, month.uscite]),
    0,
  );

  const average =
    savings.length > 0
      ? savings.reduce((sum, value) => sum + value, 0) / savings.length
      : 0;

  // La pendenza serve solo al badge: il disegno lo fa `TrendChart`, che si
  // ricalcola la sua geometria dai punti che gli passiamo.
  const slope = linearRegression(savings).slope;

  const categoriaSelezionata = useMemo(
    () =>
      categorie.find((item) => String(item.id) === String(categoriaId)) ?? null,
    [categorie, categoriaId],
  );

  const expenseBars = useMemo(
    () => yearExpenseRows(rows, categoriaSelezionata),
    [rows, categoriaSelezionata],
  );

  /**
   * I movimenti di una riga, su tutto l'anno che si sta guardando.
   *
   * Non la pagina di dettaglio della categoria come nella vista Mese: quella
   * ragiona su un mese solo. Qui la lista giusta è quella dei Movimenti, che
   * i filtri se li legge dall'indirizzo — periodo compreso.
   */
  const openRow = (row: ExpenseRow) => {
    const categoria =
      categoriaSelezionata ?? categorie.find((item) => item.nome === row.nome);

    const primo = new Date(year, 0, 1);
    const query = encodeFilters(
      {
        data_inizio: toIsoDate(startOfYear(primo)),
        data_fine: toIsoDate(endOfYear(primo)),
        // Senza categoria non c'è un id da passare: si chiedono proprio le
        // transazioni a cui la categoria manca, che è quello che dice la riga.
        ...(categoria
          ? { categoria_id: [categoria.id] }
          : { senza_categoria: true }),
        ...(row.sottocategoriaId
          ? { sottocategoria_id: [row.sottocategoriaId] }
          : {}),
        ...(tagId ? { tag_id: [tagId] } : {}),
      },
      "custom",
    );

    navigate(`/transactions?${query.toString()}`);
  };

  const monthLabel = (month: number) =>
    new Intl.DateTimeFormat(getLocale() === "it" ? "it-IT" : "en-GB", {
      month: "short",
    }).format(new Date(year, month - 1, 1));

  const incomes = totals.incomes;
  // Le uscite arrivano negative dal BE: qui si scrivono in positivo.
  const expenses = Math.abs(totals.expenses);

  if (loading && rows.length === 0) {
    return (
      <Card>
        <SkeletonList />
      </Card>
    );
  }

  if (months.length === 0) {
    return (
      <EmptyState
        icon="ph-bold ph-chart-bar"
        title={t("analysis_empty_title")}
        description={t("analysis_empty_text")}
      />
    );
  }

  return (
    <PageColumns split="balanced">
      <PageColumn>
      <Card className="year-card">
        <div className="year-card__heading">
          <span className="year-card__title">{t("analysis_in_and_out")}</span>
          <span className="year-card__subtitle">
            {`${t("analysis_average_savings")} `}
            <strong>
              <Amount value={average} decimals={0} />
            </strong>
            {` ${t("analysis_per_month")}`}
          </span>
        </div>

        <div
          className={`year-bars${
            months.length >= DENSE_MONTHS ? " year-bars--dense" : ""
          }`}
        >
          {months.map((month) => (
            <div className="year-bars__group" key={month.month}>
              <div className="year-bars__pair">
                <span
                  className="year-bars__bar year-bars__bar--in"
                  style={{ height: `${peak > 0 ? (month.entrate / peak) * 100 : 0}%` }}
                />
                <span
                  className={`year-bars__bar year-bars__bar--out${
                    month.month === lastMonth ? " year-bars__bar--current" : ""
                  }`}
                  style={{ height: `${peak > 0 ? (month.uscite / peak) * 100 : 0}%` }}
                />
              </div>

              <span
                className={`year-bars__label${
                  month.month === lastMonth ? " year-bars__label--current" : ""
                }`}
              >
                {monthLabel(month.month)}
              </span>
            </div>
          ))}
        </div>

        <div className="year-legend">
          <LegendItem variant="in" label={t("income")} />
          <LegendItem variant="out" label={t("expenses")} />
          <LegendItem variant="current" label={t("analysis_current_month")} />
        </div>
      </Card>

      {months.length > 1 && (
        <Card>
          <CardTitle
            aside={
              <span
                className={`year-trend__badge year-trend__badge--${
                  slope >= 0 ? "up" : "down"
                }`}
              >
                {slope >= 0
                  ? t("analysis_trend_up")
                  : t("analysis_trend_down")}
              </span>
            }
          >
            {t("analysis_savings_trend")}
          </CardTitle>

          <TrendChart
            points={months.map((month, index) => ({
              label: monthLabel(month.month),
              value: savings[index],
            }))}
            ariaLabel={t("analysis_savings_trend")}
            showGuide
          />
        </Card>
      )}

      <Card>
        <CardTitle aside={t("analysis_tap_for_transactions")}>
          {categoriaSelezionata
            ? `${t("analysis_expenses_by_category")} - ${categoriaSelezionata.nome}`
            : t("analysis_expenses_by_category")}
        </CardTitle>

        <CategoryBars
          rows={expenseBars}
          missingLabel={t(
            categoriaSelezionata
              ? "taxonomy_no_subcategory"
              : "taxonomy_uncategorized",
          )}
          emptyText={t("no_data")}
          onSelect={openRow}
        />
      </Card>

      </PageColumn>

      <PageColumn>
      <Card className="year-totals">
        <TotalRow label={`${t("income")} ${year}`} value={incomes} />
        <TotalRow label={`${t("expenses")} ${year}`} value={expenses} />
        <TotalRow label={t("set_aside")} value={totals.accantonamento} />

        <div className="year-totals__row year-totals__row--net">
          <span className="year-totals__label">{t("analysis_net_savings")}</span>
          <Amount
            className="year-totals__net"
            value={incomes - expenses}
            sign="always"
            tone={incomes - expenses >= 0 ? "positive" : "negative"}
          />
        </div>
      </Card>
      </PageColumn>
    </PageColumns>
  );
}

function LegendItem({
  variant,
  label,
}: {
  variant: "in" | "out" | "current";
  label: string;
}) {
  return (
    <span className="year-legend__item">
      <span
        className={`year-legend__dot year-legend__dot--${variant}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="year-totals__row">
      <span className="year-totals__label">{label}</span>
      <Amount className="year-totals__value" value={value} />
    </div>
  );
}
