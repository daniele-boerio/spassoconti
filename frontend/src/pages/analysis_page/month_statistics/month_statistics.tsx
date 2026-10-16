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
import "./month_statistics.scss";
import {
  getMonthRefunds,
  getMonthlyDetailsStatistics,
  getPreviousMonthSavings,
} from "../../../features/statistics/api_calls";
import {
  selectMonthRefunds,
  selectMonthlyStatisticsData,
  selectMonthlyTotals,
  selectPreviousMonthSavings,
  selectStatisticsLoading,
} from "../../../features/statistics/statistics_slice";
import { buildInsights, Insight } from "../../../features/statistics/insights";
import {
  expenseRows,
  ExpenseRow,
} from "../../../features/statistics/expenses";
import CategoryBars from "../../../components/category_bars/category_bars";
import { budgetRows } from "../../../features/statistics/budget";
import ProgressBar from "../../../components/progress_bar/progress_bar";
import {
  getExpenseCompositionChart,
  getSavingsChart,
} from "../../../features/charts/api_calls";
import {
  selectChartsExpenseComposition,
  selectChartsSavings,
} from "../../../features/charts/charts_slice";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import { addMonths, endOfMonth, startOfMonth, toIsoDate } from "../../../services/dates";

// Mesi su cui si misura il "sopra media": dal design.
const AVERAGE_MONTHS = 3;

const ICONS: Record<Insight["kind"], string> = {
  above_average: "ph-bold ph-arrow-up-right",
  concentration: "ph-bold ph-chart-pie",
  overspent: "ph-bold ph-warning-circle",
  saved_share: "ph-bold ph-check",
  streak: "ph-bold ph-star",
};

type MonthStatisticsProps = {
  year: number;
  month: number;
  categoriaId: string | null;
  sottocategoriaIds: string[];
  tagId: string | null;
};

export default function MonthStatistics({
  year,
  month,
  categoriaId,
  sottocategoriaIds,
  tagId,
}: MonthStatisticsProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const data = useAppSelector(selectMonthlyStatisticsData);
  const totals = useAppSelector(selectMonthlyTotals);
  const previous = useAppSelector(selectPreviousMonthSavings);
  const refunds = useAppSelector(selectMonthRefunds);
  const composition = useAppSelector(selectChartsExpenseComposition);
  const savingsHistory = useAppSelector(selectChartsSavings);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const loading = useAppSelector(selectStatisticsLoading);

  useEffect(() => {
    const filtri = {
      year,
      month,
      categoria_id: categoriaId,
      sottocategoria_id: sottocategoriaIds,
      tag_id: tagId,
    };

    dispatch(getMonthlyDetailsStatistics(filtri));
    dispatch(getPreviousMonthSavings(filtri));
    dispatch(getMonthRefunds(filtri));

    // Media per categoria dei mesi *precedenti*: il mese corrente è quello da
    // confrontare, includerlo appiattirebbe lo scostamento.
    const selected = new Date(year, month - 1, 1);

    // Un anno di risparmi mensili: serve a dire da quanto va bene, non solo
    // se va bene adesso.
    dispatch(
      getSavingsChart({
        data_inizio: toIsoDate(startOfMonth(addMonths(selected, -12))),
        data_fine: toIsoDate(endOfMonth(addMonths(selected, -1))),
      }),
    );

    dispatch(
      getExpenseCompositionChart({
        data_inizio: toIsoDate(startOfMonth(addMonths(selected, -AVERAGE_MONTHS))),
        data_fine: toIsoDate(endOfMonth(addMonths(selected, -1))),
      }),
    );
  }, [dispatch, year, month, categoriaId, sottocategoriaIds, tagId]);

  const averages = useMemo(
    () =>
      Object.fromEntries(
        composition.map((entry) => [
          entry.categoria,
          Number(entry.totale) / AVERAGE_MONTHS,
        ]),
      ),
    [composition],
  );

  const categoriaSelezionata = useMemo(
    () =>
      categorie.find((item) => String(item.id) === String(categoriaId)) ?? null,
    [categorie, categoriaId],
  );

  const expenses = useMemo(
    () => expenseRows(data, categoriaSelezionata),
    [data, categoriaSelezionata],
  );

  // Le categorie con un tetto di spesa, e quanto ci si è speso nel mese.
  //
  // Il tetto è mensile e va confrontato con la spesa del mese *intera* su
  // quella categoria. Con un filtro per sottocategoria o per tag il speso che
  // arriva è solo un pezzo di quella spesa: confrontarlo col tetto direbbe che
  // si è spesa metà di quanto si è speso davvero, quindi la card tace.
  //
  // Con una categoria scelta invece il confronto regge — il speso è tutto il
  // suo — ma si guarda solo lei: le altre non sono nel payload filtrato, e
  // mostrarle vorrebbe dire dichiararle a zero quando non lo sono.
  const budgets = useMemo(() => {
    if (sottocategoriaIds.length > 0 || tagId) return [];

    return budgetRows(data, categoriaSelezionata ? [categoriaSelezionata] : categorie);
  }, [data, categorie, categoriaSelezionata, sottocategoriaIds, tagId]);

  const insights = useMemo(
    () =>
      buildInsights({
        categories: data,
        averages,
        savings: totals.total,
        income: totals.incomes,
        history: savingsHistory.map((entry) => Number(entry.risparmio)),
      }),
    [data, averages, totals.total, totals.incomes, savingsHistory],
  );

  const income = totals.incomes;
  const spent = Math.abs(totals.expenses);
  const savedAside = totals.accantonamento;
  const savings = totals.total;

  // I tre segmenti sono quote delle entrate: senza entrate non c'è barra da
  // disegnare, e dividere per zero darebbe una barra piena a caso.
  const share = (value: number) => (income > 0 ? (value / income) * 100 : 0);

  const delta =
    previous !== null && previous !== 0
      ? Math.round(((savings - previous) / Math.abs(previous)) * 100)
      : null;

  const openRow = (row: ExpenseRow) => {
    // La pagina di dettaglio è sempre quella di una categoria: quando la riga
    // è una sottocategoria, si apre la categoria scelta ristretta a quella.
    const categoria =
      categoriaSelezionata ?? categorie.find((item) => item.nome === row.nome);
    if (!categoria) return;

    // Il periodo viaggia con il link: la pagina di dettaglio apre sullo stesso
    // mese che si stava guardando, non su quello corrente.
    const query = new URLSearchParams({
      anno: String(year),
      mese: String(month),
    });
    // Una sottocategoria senza id (le uscite che non ne hanno) non si può
    // filtrare: il link apre la categoria intera.
    if (row.sottocategoriaId) query.set("sotto", row.sottocategoriaId);
    if (tagId) query.set("tag", tagId);

    navigate(`/categories/${categoria.id}?${query.toString()}`);
  };

  const sentence = (insight: Insight) => {
    switch (insight.kind) {
      case "above_average":
        return {
          strong: `${insight.category} +${insight.percent}%`,
          rest: ` ${t("analysis_insight_above_average")}`,
        };
      case "concentration":
        return {
          strong: `${insight.category} ${insight.percent}%`,
          rest: ` ${t("analysis_insight_concentration")}`,
        };
      case "overspent":
        return { strong: t("analysis_insight_overspent"), rest: "" };
      case "saved_share":
        return {
          strong: `${insight.percent}%`,
          rest: ` ${t("analysis_insight_saved_share")}`,
        };
      case "streak":
        return {
          strong: `${insight.count} ${t("home_months")}`,
          rest: ` ${t("analysis_insight_streak")}`,
        };
    }
  };

  if (loading && data.length === 0) {
    return (
      <Card>
        <SkeletonList />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon="ph-bold ph-chart-bar"
        title={t("analysis_empty_title")}
        description={t("analysis_empty_text")}
      />
    );
  }

  return (
    <PageColumns split="hero">
      <PageColumn>
      <Card className="savings-card">
        <div className="savings-card__top">
          <div className="savings-card__headline">
            <span className="savings-card__eyebrow">
              {t("analysis_month_savings")}
            </span>
            <Amount
              className="savings-card__value"
              value={savings}
              tone={savings >= 0 ? "positive" : "negative"}
            />
          </div>

          {delta !== null && (
            <span
              className={`savings-card__delta savings-card__delta--${
                delta >= 0 ? "up" : "down"
              }`}
            >
              <i
                className={`ph-bold ${delta >= 0 ? "ph-arrow-up-right" : "ph-arrow-down-right"}`}
                aria-hidden="true"
              />
              {`${Math.abs(delta)}%`}
            </span>
          )}
        </div>

        <div className="savings-card__bar">
          <span
            className="savings-card__segment savings-card__segment--spent"
            style={{ width: `${share(spent)}%` }}
          />
          <span
            className="savings-card__segment savings-card__segment--aside"
            style={{ width: `${share(savedAside)}%` }}
          />
          <span
            className="savings-card__segment savings-card__segment--left"
            style={{ width: `${share(Math.max(savings, 0))}%` }}
          />
        </div>

        <div className="savings-card__legend">
          <LegendRow
            variant="spent"
            label={t("expenses")}
            value={spent}
          />
          <LegendRow
            variant="aside"
            label={t("set_aside")}
            value={savedAside}
          />
          <LegendRow
            variant="left"
            label={t("analysis_left")}
            value={Math.max(savings, 0)}
          />
        </div>

        <div className="savings-card__footer">
          <span>
            {`${t("income")} `}
            <strong>
              <Amount value={income} />
            </strong>
          </span>
          <span>
            {`${t("compensations")} `}
            <strong>
              <Amount value={refunds} />
            </strong>
          </span>
        </div>
      </Card>

      <Card>
        <CardTitle aside={t("analysis_tap_for_transactions")}>
          {categoriaSelezionata
            ? `${t("analysis_expenses_by_category")} - ${categoriaSelezionata.nome}`
            : t("analysis_expenses_by_category")}
        </CardTitle>

        <CategoryBars
          rows={expenses}
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
      {budgets.length > 0 && (
        <Card>
          <CardTitle aside={t("analysis_budget_aside")}>
            {t("analysis_budget")}
          </CardTitle>

          <div className="budget-bars">
            {budgets.map((row) => (
              <div className="budget-bars__row" key={row.id}>
                <div className="budget-bars__line">
                  <span className="budget-bars__name">{row.nome}</span>
                  <span className="budget-bars__figure">
                    <strong>
                      <Amount value={row.speso} decimals={0} hideCurrency />
                    </strong>
                    {` ${t("analysis_budget_of")} `}
                    <Amount value={row.budget} decimals={0} />
                  </span>
                </div>

                {/* Il tetto è il track, la spesa è il segmento: il colore dice
                    se ci si sta dentro, e oltre il tetto la barra è piena —
                    quanto si è sforato lo scrive la riga sotto. */}
                <ProgressBar
                  height={8}
                  label={`${row.nome} · ${Math.round(row.percent)}%`}
                  segments={[
                    {
                      value: Math.min(row.percent, 100) / 100,
                      tone: row.over ? "negative" : "accent",
                    },
                  ]}
                />

                <span
                  className={`budget-bars__caption ${
                    row.over ? "budget-bars__caption--over" : ""
                  }`}
                >
                  {`${Math.round(row.percent)}% · `}
                  {row.over
                    ? `${t("analysis_budget_over")} `
                    : `${t("analysis_budget_left")} `}
                  <Amount value={Math.abs(row.resta)} decimals={0} />
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {insights.length > 0 && (
        <Card>
          <CardTitle>{t("analysis_notable")}</CardTitle>

          {insights.map((insight) => {
            const { strong, rest } = sentence(insight);

            return (
              <div className="insight" key={insight.kind}>
                <span
                  className={`insight__icon insight__icon--${insight.tone}`}
                  aria-hidden="true"
                >
                  <i className={ICONS[insight.kind]} />
                </span>

                <span className="insight__text">
                  <strong>{strong}</strong>
                  {rest}
                </span>
              </div>
            );
          })}
        </Card>
      )}
      </PageColumn>
    </PageColumns>
  );
}

function LegendRow({
  variant,
  label,
  value,
}: {
  variant: "spent" | "aside" | "left";
  label: string;
  value: number;
}) {
  return (
    <div className="savings-card__legend-row">
      <span className="savings-card__legend-label">
        <span
          className={`savings-card__dot savings-card__dot--${variant}`}
          aria-hidden="true"
        />
        {label}
      </span>
      <Amount value={value} />
    </div>
  );
}
