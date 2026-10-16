import { ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import { Card } from "../../components/card/card";
import SectionHeader from "../../components/section_header/section_header";
import Amount from "../../components/amount/amount";
import Alert from "../../components/alert/alert";
import EmptyState from "../../components/empty_state/empty_state";
import SkeletonList from "../../components/skeleton/skeleton";
import Button from "../../components/button/button";
import Sheet from "../../components/sheet/sheet";
import ThreeDotsActionsMenu from "../../components/three_dots_action_menu/three_dots_action_menu";
import RecurrenceDialog from "../../components/dialog/recurrence_dialog/recurrence_dialog";
import "./recurrings_page.scss";
import {
  deleteRecurring,
  executeRecurring,
  getRecurrings,
} from "../../features/recurrings/api_calls";
import {
  selectRecurringLoading,
  selectRecurringRecurrings,
} from "../../features/recurrings/recurring_slice";
import {
  monthlyCommitment,
  overdue,
  upcoming,
} from "../../features/recurrings/commitment";
import { Recurring } from "../../features/recurrings/interfaces";
import { getConti, getCurrentMonthExpenses } from "../../features/conti/api_calls";
import {
  selectContiConti,
  selectContiMonthIncome,
} from "../../features/conti/conto_slice";
import { getCategorie } from "../../features/categorie/api_calls";
import { selectCategoriaCategorie } from "../../features/categorie/categoria_slice";
import { showToast } from "../../features/ui/ui_slice";
import { dayKey } from "../../services/dates";

// Orizzonte del primo gruppo, come nel design.
const HORIZON_DAYS = 30;

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

const FREQUENCY_KEYS: Record<string, string> = {
  GIORNALIERA: "daily",
  SETTIMANALE: "weekly",
  MENSILE: "monthly",
  ANNUALE: "yearly",
};

export default function RecurringsPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const recurrings = useAppSelector(selectRecurringRecurrings);
  const loading = useAppSelector(selectRecurringLoading);
  const conti = useAppSelector(selectContiConti);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const income = useAppSelector(selectContiMonthIncome);

  const [editing, setEditing] = useState<Recurring | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Recurring | null>(null);
  // Ricorrenza a importo variabile in registrazione: si chiede la cifra vera.
  const [askingAmount, setAskingAmount] = useState<Recurring | null>(null);
  const [actualAmount, setActualAmount] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    dispatch(getRecurrings(undefined));
    dispatch(getConti());
    dispatch(getCategorie());
    // Le entrate del mese fanno il denominatore di "su entrate".
    dispatch(getCurrentMonthExpenses());
  }, [dispatch]);

  const commitment = useMemo(
    () => monthlyCommitment(recurrings),
    [recurrings],
  );

  const late = useMemo(() => overdue(recurrings), [recurrings]);

  // Una variabile in scadenza oggi sta già fra le scadute: non la ripetiamo.
  const next = useMemo(() => {
    const lateIds = new Set(late.map((item) => String(item.id)));
    return upcoming(recurrings, HORIZON_DAYS).filter(
      (item) => !lateIds.has(String(item.id)),
    );
  }, [recurrings, late]);

  // Quello che non è né in ritardo né in arrivo: annuali lontane e sospese.
  const rest = useMemo(() => {
    const shown = new Set([...late, ...next].map((item) => String(item.id)));
    return recurrings.filter((item) => !shown.has(String(item.id)));
  }, [recurrings, late, next]);

  const share = income > 0 ? Math.round((commitment / income) * 100) : null;

  const nameOf = (list: { id: string; nome: string }[], id?: string) =>
    id
      ? list.find((item) => String(item.id) === String(id))?.nome
      : undefined;

  const metaOf = (recurring: Recurring) =>
    [
      t(FREQUENCY_KEYS[recurring.frequenza] ?? "monthly"),
      recurring.importo_variabile ? t("recurrence_meta_variable") : null,
      recurring.rate_rimanenti !== null && recurring.rate_rimanenti !== undefined
        ? t("recurrence_meta_installments").replace(
            "{count}",
            String(recurring.rate_rimanenti),
          )
        : null,
      recurring.data_fine
        ? `${t("recurrence_meta_until")} ${new Intl.DateTimeFormat(localeTag(), {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(`${recurring.data_fine}T00:00:00`))}`
        : null,
      nameOf(categorie, recurring.categoria_id),
      nameOf(conti, recurring.conto_id),
    ]
      .filter(Boolean)
      .join(" · ");

  const openEdit = (recurring?: Recurring) => {
    setEditing(recurring);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    try {
      await dispatch(deleteRecurring({ id: target.id })).unwrap();
      dispatch(
        showToast({ variant: "success", title: t("recurring_deleted") }),
      );
    } catch {
      // L'errore lo mostra il middleware; la ricorrenza resta in elenco.
    }
  };

  // "Registra" su una ricorrenza variabile chiede prima l'importo vero.
  const startRegister = (recurring: Recurring) => {
    if (recurring.importo_variabile) {
      setActualAmount(String(recurring.importo));
      setAskingAmount(recurring);
      return;
    }
    register(recurring);
  };

  const register = async (recurring: Recurring, importo?: number) => {
    if (registering) return;
    setRegistering(true);

    try {
      await dispatch(executeRecurring({ id: recurring.id, importo })).unwrap();
      setAskingAmount(null);
      dispatch(
        showToast({ variant: "success", title: t("recurring_registered") }),
      );
      // Il saldo del conto si è mosso: la card dell'impegno e le entrate del
      // mese vanno rilette, o restano indietro di una transazione.
      dispatch(getConti());
      dispatch(getCurrentMonthExpenses());
    } catch {
      // L'errore arriva dal middleware: qui non c'è niente da aggiungere.
    } finally {
      setRegistering(false);
    }
  };

  const parsedAmount = parseFloat(actualAmount.replace(",", "."));

  const row = (recurring: Recurring, tone?: "late") => (
    <RecurringRow
      key={recurring.id}
      recurring={recurring}
      meta={metaOf(recurring)}
      tone={tone}
      onOpen={() => openEdit(recurring)}
      onRegister={tone === "late" ? () => startRegister(recurring) : undefined}
      actions={
        <ThreeDotsActionsMenu
          className="recurrings__menu"
          verticalDots
          items={[
            {
              label: t("edit"),
              icon: "ph-bold ph-pencil-simple",
              command: () => openEdit(recurring),
            },
            {
              label: t("delete"),
              icon: "ph-bold ph-trash",
              command: () => setPendingDelete(recurring),
            },
          ]}
        />
      }
    />
  );

  return (
    <>
      <Page className="recurrings">
        <PageHeader className="recurrings__header">
          <div className="recurrings__top">
            <button
              type="button"
              className="recurrings__back"
              aria-label={t("back")}
              onClick={() => navigate(-1)}
            >
              <i className="ph-bold ph-arrow-left" aria-hidden="true" />
            </button>
            <h1 className="page-title">{t("nav_recurrings")}</h1>
          </div>

          <div className="recurrings__commitment">
            <div className="recurrings__commitment-main">
              <span className="recurrings__eyebrow">
                {t("recurring_commitment")}
              </span>
              <Amount
                className="recurrings__commitment-value"
                value={commitment}
              />
            </div>

            {share !== null && (
              <div className="recurrings__commitment-share">
                <span className="recurrings__commitment-label">
                  {t("recurring_on_income")}
                </span>
                <span className="recurrings__commitment-percent">{`${share}%`}</span>
              </div>
            )}
          </div>
        </PageHeader>

        <PageContent className="recurrings__content">
          {loading && recurrings.length === 0 ? (
            <Card>
              <SkeletonList />
            </Card>
          ) : recurrings.length === 0 ? (
            <EmptyState
              icon="ph-bold ph-arrows-clockwise"
              title={t("recurring_empty_title")}
              description={t("recurring_empty_text")}
              actions={
                <Button size="sm" onClick={() => openEdit(undefined)}>
                  {t("recurring_add")}
                </Button>
              }
            />
          ) : (
            <>
              {late.length > 0 && (
                <section className="recurrings__group">
                  <SectionHeader>{t("recurring_overdue")}</SectionHeader>
                  <Card variant="alert" className="recurrings__card">
                    {late.map((recurring) => row(recurring, "late"))}
                  </Card>
                </section>
              )}

              {next.length > 0 && (
                <section className="recurrings__group">
                  <SectionHeader>
                    {`${t("recurring_next")} ${HORIZON_DAYS} ${t("home_days")}`}
                  </SectionHeader>
                  <Card className="recurrings__card">
                    {next.map((recurring) => row(recurring))}
                  </Card>
                </section>
              )}

              {rest.length > 0 && (
                <section className="recurrings__group">
                  <SectionHeader>{t("recurring_all")}</SectionHeader>
                  <Card className="recurrings__card">
                    {rest.map((recurring) => row(recurring))}
                  </Card>
                </section>
              )}

              <button
                type="button"
                className="recurrings__add"
                onClick={() => openEdit(undefined)}
              >
                <i className="ph-bold ph-plus" aria-hidden="true" />
                {t("recurring_add")}
              </button>
            </>
          )}
        </PageContent>
      </Page>

      <RecurrenceDialog
        visible={dialogOpen}
        recurring={editing}
        onHide={() => {
          setDialogOpen(false);
          setEditing(undefined);
        }}
      />

      <Sheet
        open={askingAmount !== null}
        onClose={() => setAskingAmount(null)}
        title={askingAmount?.nome}
        footer={
          <Button
            block
            disabled={registering || !(parsedAmount > 0)}
            onClick={() => askingAmount && register(askingAmount, parsedAmount)}
          >
            {t("recurring_register")}
          </Button>
        }
      >
        <p className="recurrings__amount-hint">
          {t("recurrence_actual_amount_hint")}
        </p>
        <div className="recurrings__amount">
          <input
            value={actualAmount}
            onChange={(event) => {
              const value = event.target.value.replace(",", ".");
              if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                setActualAmount(value);
              }
            }}
            inputMode="decimal"
            placeholder="0"
            aria-label={t("amount")}
            autoFocus
          />
          <span>€</span>
        </div>
      </Sheet>

      <Alert
        open={pendingDelete !== null}
        title={t("recurring_delete_title")}
        description={t("recurring_delete_text")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

type RecurringRowProps = {
  recurring: Recurring;
  meta: string;
  tone?: "late";
  onOpen: () => void;
  /** Presente solo sulle scadute: le registra adesso. */
  onRegister?: () => void;
  actions: ReactNode;
};

function RecurringRow({
  recurring,
  meta,
  tone,
  onOpen,
  onRegister,
  actions,
}: RecurringRowProps) {
  const { t } = useI18n();

  const date = new Date(`${dayKey(recurring.prossima_esecuzione)}T00:00:00`);
  const isIncome = recurring.tipo === "ENTRATA";

  return (
    <div className={`recurring-row${tone ? ` recurring-row--${tone}` : ""}`}>
      <button type="button" className="recurring-row__main" onClick={onOpen}>
        <span className="recurring-row__date">
          <span className="recurring-row__day">{date.getDate()}</span>
          <span className="recurring-row__month">
            {new Intl.DateTimeFormat(localeTag(), { month: "short" }).format(
              date,
            )}
          </span>
        </span>

        <span className="recurring-row__text">
          <span className="recurring-row__name">{recurring.nome}</span>
          <span className="recurring-row__meta">{meta}</span>
        </span>

        <span className="recurring-row__figures">
          <Amount
            value={isIncome ? recurring.importo : -recurring.importo}
            sign="always"
            tone={isIncome ? "positive" : "neutral"}
            hideCurrency
          />
          <span
            className={`recurring-row__state recurring-row__state--${
              tone === "late" ? "late" : recurring.attiva ? "on" : "off"
            }`}
          >
            {tone === "late"
              ? t("recurring_state_late")
              : recurring.attiva
                ? t("recurring_state_active")
                : t("recurring_state_suspended")}
          </span>
        </span>
      </button>

      {onRegister && (
        <button
          type="button"
          className="recurring-row__register"
          onClick={onRegister}
        >
          {t("recurring_register")}
        </button>
      )}

      {actions}
    </div>
  );
}
