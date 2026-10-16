import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import { Card } from "../../components/card/card";
import Amount from "../../components/amount/amount";
import Alert from "../../components/alert/alert";
import ProgressBar from "../../components/progress_bar/progress_bar";
import EmptyState from "../../components/empty_state/empty_state";
import SkeletonList from "../../components/skeleton/skeleton";
import Button from "../../components/button/button";
import DebitoDialog from "../../components/dialog/debito_dialog/debito_dialog";
import PayDebitoDialog from "../../components/dialog/pay_debito_dialog/pay_debito_dialog";
import "./debiti_page.scss";
import { deleteDebito, getDebiti } from "../../features/debiti/api_calls";
import {
  selectDebitiDebiti,
  selectDebitiLoading,
} from "../../features/debiti/debito_slice";
import { Debito } from "../../features/debiti/interfaces";
import { getConti } from "../../features/conti/api_calls";
import { selectContiConti } from "../../features/conti/conto_slice";
import { showToast } from "../../features/ui/ui_slice";

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

/** Quanto resta da restituire: `residuo` a null vuol dire "tutto". */
const residuoOf = (debito: Debito) =>
  Number(debito.residuo ?? debito.ammontare);

const isOpen = (debito: Debito) => residuoOf(debito) > 0;

export default function DebitiPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const debiti = useAppSelector(selectDebitiDebiti);
  const loading = useAppSelector(selectDebitiLoading);
  const conti = useAppSelector(selectContiConti);

  const [editing, setEditing] = useState<Debito | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paying, setPaying] = useState<Debito | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Debito | null>(null);

  useEffect(() => {
    dispatch(getDebiti());
    dispatch(getConti());
  }, [dispatch]);

  const totals = useMemo(() => {
    const open = debiti.filter(isOpen);

    return {
      open: open.length,
      closed: debiti.length - open.length,
      // Il totale contrattato conta tutti i debiti: la percentuale rimborsata
      // deve includere quelli già chiusi, o al primo estinto scenderebbe.
      contracted: debiti.reduce(
        (sum, debito) => sum + Number(debito.ammontare),
        0,
      ),
      residual: debiti.reduce((sum, debito) => sum + residuoOf(debito), 0),
    };
  }, [debiti]);

  const repaid =
    totals.contracted > 0
      ? (totals.contracted - totals.residual) / totals.contracted
      : 0;

  const openDialog = (debito: Debito | null) => {
    setEditing(debito);
    setDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    dispatch(deleteDebito({ id: pendingDelete.id, force: true }));
    dispatch(showToast({ variant: "success", title: t("debts_deleted") }));
    setPendingDelete(null);
  };

  const contoOf = (debito: Debito) =>
    conti.find((conto) => String(conto.id) === String(debito.conto_id))?.nome;

  return (
    <>
      <Page className="debts">
        <PageHeader className="debts__header">
          <div className="debts__top">
            <button
              type="button"
              className="debts__back"
              aria-label={t("back")}
              onClick={() => navigate(-1)}
            >
              <i className="ph-bold ph-arrow-left" aria-hidden="true" />
            </button>
            <h1 className="page-title">{t("nav_debts")}</h1>
          </div>

          <Card className="debts__summary">
            <div className="debts__summary-top">
              <span className="debts__eyebrow">{t("debts_residual_total")}</span>
              <span className="debts__counts">
                {`${totals.open} ${t("debts_open")} · ${totals.closed} ${t("debts_closed")}`}
              </span>
            </div>

            <Amount
              className="debts__residual"
              value={totals.residual}
              tone={totals.residual > 0 ? "negative" : "positive"}
            />

            {totals.contracted > 0 && (
              <div className="debts__progress">
                <ProgressBar
                  height={8}
                  label={t("debts_repaid")}
                  segments={[{ value: repaid, tone: "accent" }]}
                />

                <span className="debts__legend">
                  {`${t("debts_repaid")} `}
                  <strong>{`${Math.round(repaid * 100)}%`}</strong>
                  {" "}
                  {t("debts_of")}{" "}
                  <Amount value={totals.contracted} decimals={0} />
                </span>
              </div>
            )}
          </Card>
        </PageHeader>

        <PageContent className="debts__list">
          {loading && debiti.length === 0 ? (
            <Card>
              <SkeletonList />
            </Card>
          ) : debiti.length === 0 ? (
            <EmptyState
              icon="ph-bold ph-receipt"
              title={t("debts_empty_title")}
              description={t("debts_empty_text")}
              actions={
                <Button size="sm" onClick={() => openDialog(null)}>
                  {t("debts_add")}
                </Button>
              }
            />
          ) : (
            <>
              {debiti.map((debito) => (
                <DebitoCard
                  key={debito.id}
                  debito={debito}
                  conto={contoOf(debito)}
                  onPay={() => setPaying(debito)}
                  onEdit={() => openDialog(debito)}
                  onDelete={() => setPendingDelete(debito)}
                />
              ))}

              <button
                type="button"
                className="debts__add"
                onClick={() => openDialog(null)}
              >
                <i className="ph-bold ph-plus" aria-hidden="true" />
                {t("debts_add")}
              </button>
            </>
          )}
        </PageContent>
      </Page>

      <DebitoDialog
        visible={dialogOpen}
        debito={editing}
        onHide={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSaved={() => dispatch(getDebiti())}
      />

      <PayDebitoDialog
        visible={paying !== null}
        debito={paying}
        onHide={() => setPaying(null)}
        onPaid={() => {
          dispatch(getDebiti());
          // Il pagamento è una transazione vera: il saldo del conto si è mosso.
          dispatch(getConti());
        }}
      />

      <Alert
        open={pendingDelete !== null}
        title={t("debts_delete_title")}
        description={t("debts_delete_text")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function DebitoCard({
  debito,
  conto,
  onPay,
  onEdit,
  onDelete,
}: {
  debito: Debito;
  conto?: string;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  const residuo = residuoOf(debito);
  const ammontare = Number(debito.ammontare);
  const open = residuo > 0;

  // "2027-06" scritto come lo direbbe una persona. Assente quando il ritmo
  // dei pagamenti non basta a stimare niente.
  const fine = debito.fine_stimata
    ? new Intl.DateTimeFormat(localeTag(), {
        month: "long",
        year: "numeric",
      }).format(
        new Date(
          Number(debito.fine_stimata.slice(0, 4)),
          Number(debito.fine_stimata.slice(5, 7)) - 1,
          1,
        ),
      )
    : null;
  const repaid = ammontare > 0 ? (ammontare - residuo) / ammontare : 1;

  // Un debito chiuso non ha più niente da fare: resta come riga di storia.
  if (!open) {
    return (
      <Card className="debt debt--closed">
        <div className="debt__closed-row">
          <div className="debt__identity">
            <span className="debt__name">{debito.nome}</span>
            <span className="debt__badge debt__badge--paid">
              {t("debts_state_paid")}
            </span>
          </div>

          <Amount className="debt__closed-value" value={ammontare} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="debt">
      <div className="debt__head">
        <div className="debt__identity">
          <span className="debt__name">{debito.nome}</span>
          <span className="debt__badge debt__badge--open">
            {t("debts_state_open")}
          </span>
        </div>

        <div className="debt__figures">
          <Amount className="debt__residual" value={residuo} />
          <span className="debt__of">
            {`${t("debts_of")} `}
            <Amount value={ammontare} />
          </span>
        </div>
      </div>

      <ProgressBar
        label={debito.nome}
        segments={[{ value: repaid, tone: "accent" }]}
      />

      <div className="debt__meta">
        {debito.descrizione && <span>{debito.descrizione}</span>}
        {conto && <span>{conto}</span>}
        {/* Pagato da una ricorrenza: ogni rata scala il residuo da sola, e la
            fine stimata è quella del piano, non del ritmo passato. */}
        {debito.ricorrenza_id && (
          <span>
            <i className="ph-bold ph-arrows-clockwise" aria-hidden="true" />{" "}
            {t("debts_auto_installment")}
          </span>
        )}
        {fine && (
          <span>
            {`${t("debts_estimated_end")} ${fine}`}
          </span>
        )}
      </div>

      <div className="debt__actions">
        <button
          type="button"
          className="debt__action debt__action--primary"
          onClick={onPay}
        >
          {t("debts_pay")}
        </button>

        <button
          type="button"
          className="debt__action"
          aria-label={t("edit")}
          onClick={onEdit}
        >
          <i className="ph-bold ph-pencil-simple" aria-hidden="true" />
        </button>

        <button
          type="button"
          className="debt__action debt__action--danger"
          aria-label={t("delete")}
          onClick={onDelete}
        >
          <i className="ph-bold ph-trash" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
