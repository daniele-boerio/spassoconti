import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import { Card } from "../../components/card/card";
import Amount from "../../components/amount/amount";
import Alert from "../../components/alert/alert";
import EmptyState from "../../components/empty_state/empty_state";
import SkeletonList from "../../components/skeleton/skeleton";
import Button from "../../components/button/button";
import InvestimentoDialog from "../../components/dialog/investimento_dialog/investimento_dialog";
import OperazioniDialog from "../../components/dialog/operazioni_dialog/operazioni_dialog";
import "./investimenti_page.scss";
import {
  deleteInvestimento,
  getInvestimenti,
} from "../../features/investimenti/api_calls";
import {
  selectInvestimenti,
  selectInvestimentiLoading,
} from "../../features/investimenti/investimento_slice";
import { Investimento } from "../../features/investimenti/interfaces";
import { showToast } from "../../features/ui/ui_slice";

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

/** Quantità: fino a sei decimali, senza zeri di riempimento. */
const formatQuantity = (value: number) =>
  new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 6 }).format(value);

export default function InvestimentiPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const investimenti = useAppSelector(selectInvestimenti);
  const loading = useAppSelector(selectInvestimentiLoading);

  const [editing, setEditing] = useState<Investimento | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [opsFor, setOpsFor] = useState<Investimento | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Investimento | null>(null);

  useEffect(() => {
    dispatch(getInvestimenti(undefined));
  }, [dispatch]);

  // Il portafoglio è la somma dei titoli: valore di mercato, capitale
  // investito e differenza fra i due.
  const totals = useMemo(
    () =>
      investimenti.reduce(
        (acc, titolo) => {
          const quantity = Number(titolo.quantita_totale ?? 0);
          const value = Number(titolo.valore_posizione ?? 0);
          const invested = quantity * Number(titolo.prezzo_medio_carico ?? 0);

          return {
            value: acc.value + value,
            invested: acc.invested + invested,
          };
        },
        { value: 0, invested: 0 },
      ),
    [investimenti],
  );

  const pnl = totals.value - totals.invested;
  const pnlPercent =
    totals.invested > 0 ? (pnl / totals.invested) * 100 : null;

  const openDialog = (titolo: Investimento | null) => {
    setEditing(titolo);
    setDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    dispatch(deleteInvestimento({ id: pendingDelete.id }));
    dispatch(showToast({ variant: "success", title: t("investment_deleted") }));
    setPendingDelete(null);
  };

  // Il titolo aperto nel dialog operazioni deve riflettere gli aggiornamenti.
  const liveOps = opsFor
    ? (investimenti.find((item) => String(item.id) === String(opsFor.id)) ??
      opsFor)
    : null;

  return (
    <>
      <Page className="investments">
        <PageHeader className="investments__header">
          <div className="investments__top">
            <h1 className="page-title">{t("nav_investments")}</h1>
          </div>

          <Card className="investments__summary">
            <div className="investments__summary-top">
              <div className="investments__market">
                <span className="investments__eyebrow">
                  {t("investments_market_value")}
                </span>
                <Amount
                  className="investments__market-value"
                  value={totals.value}
                />
              </div>

              {pnlPercent !== null && (
                <span
                  className={`investments__badge investments__badge--${
                    pnl >= 0 ? "up" : "down"
                  }`}
                >
                  <i
                    className={`ph-bold ${pnl >= 0 ? "ph-arrow-up-right" : "ph-arrow-down-right"}`}
                    aria-hidden="true"
                  />
                  {`${Math.abs(pnlPercent).toFixed(1)}%`}
                </span>
              )}
            </div>

            <div className="investments__pair">
              <Figure
                label={t("investments_invested")}
                value={<Amount value={totals.invested} />}
              />
              <Figure
                label={t("investments_pnl")}
                value={
                  <Amount
                    value={pnl}
                    sign="always"
                    tone={pnl >= 0 ? "positive" : "negative"}
                  />
                }
              />
            </div>
          </Card>
        </PageHeader>

        <PageContent className="investments__list">
          {loading && investimenti.length === 0 ? (
            <Card>
              <SkeletonList />
            </Card>
          ) : investimenti.length === 0 ? (
            <EmptyState
              icon="ph-bold ph-chart-line-up"
              title={t("investments_empty_title")}
              description={t("investments_empty_text")}
              actions={
                <Button size="sm" onClick={() => openDialog(null)}>
                  {t("investments_add")}
                </Button>
              }
            />
          ) : (
            <>
              {investimenti.map((titolo) => (
                <TitoloCard
                  key={titolo.id}
                  titolo={titolo}
                  onOperations={() => setOpsFor(titolo)}
                  onEdit={() => openDialog(titolo)}
                  onDelete={() => setPendingDelete(titolo)}
                />
              ))}

              <button
                type="button"
                className="investments__add"
                onClick={() => openDialog(null)}
              >
                <i className="ph-bold ph-plus" aria-hidden="true" />
                {t("investments_add")}
              </button>
            </>
          )}
        </PageContent>
      </Page>

      <InvestimentoDialog
        visible={dialogOpen}
        investimento={editing}
        onHide={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />

      <OperazioniDialog
        visible={opsFor !== null}
        investimento={liveOps}
        onHide={() => setOpsFor(null)}
      />

      <Alert
        open={pendingDelete !== null}
        title={t("investments_delete_title")}
        description={t("investments_delete_text")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function TitoloCard({
  titolo,
  onOperations,
  onEdit,
  onDelete,
}: {
  titolo: Investimento;
  onOperations: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  const quantity = Number(titolo.quantita_totale ?? 0);
  const average = Number(titolo.prezzo_medio_carico ?? 0);
  const current = Number(titolo.prezzo_attuale ?? 0);
  const value = Number(titolo.valore_posizione ?? 0);

  const invested = quantity * average;
  const gain = invested > 0 ? ((value - invested) / invested) * 100 : null;

  const updated = titolo.data_ultimo_aggiornamento
    ? new Intl.DateTimeFormat(localeTag()).format(
        new Date(titolo.data_ultimo_aggiornamento),
      )
    : null;

  return (
    <Card className="titolo">
      <div className="titolo__head">
        <div className="titolo__identity">
          <span className="titolo__name">{titolo.nome_titolo}</span>

          <div className="titolo__codes">
            {titolo.ticker && (
              <span className="titolo__code titolo__code--ticker">
                {titolo.ticker}
              </span>
            )}
            {titolo.isin && (
              <span className="titolo__code">{titolo.isin}</span>
            )}
          </div>
        </div>

        {gain !== null && (
          <span
            className={`titolo__gain titolo__gain--${gain >= 0 ? "up" : "down"}`}
          >
            {`${gain >= 0 ? "+" : "−"}${Math.abs(gain).toFixed(2)}%`}
          </span>
        )}
      </div>

      <div className="titolo__grid">
        <Figure
          label={t("investments_quantity")}
          value={formatQuantity(quantity)}
        />
        <Figure
          label={t("investments_average_price")}
          value={<Amount value={average} />}
        />
        <Figure
          label={t("investments_current_price")}
          value={<Amount value={current} />}
        />
        <Figure
          label={t("total")}
          value={<Amount className="titolo__value" value={value} />}
        />
      </div>

      <div className="titolo__footer">
        <span className="titolo__updated">
          {updated ? `${t("investments_updated")} ${updated}` : ""}
        </span>

        <div className="titolo__actions">
          <button
            type="button"
            className="titolo__action titolo__action--wide"
            onClick={onOperations}
          >
            {t("investments_operations")}
          </button>

          <button
            type="button"
            className="titolo__action"
            aria-label={t("edit")}
            onClick={onEdit}
          >
            <i className="ph-bold ph-pencil-simple" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="titolo__action titolo__action--danger"
            aria-label={t("delete")}
            onClick={onDelete}
          >
            <i className="ph-bold ph-trash" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function Figure({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="figure">
      <span className="figure__label">{label}</span>
      <span className="figure__value">{value}</span>
    </div>
  );
}
