import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import { Card } from "../../components/card/card";
import Amount from "../../components/amount/amount";
import Alert from "../../components/alert/alert";
import ProgressBar from "../../components/progress_bar/progress_bar";
import SkeletonList from "../../components/skeleton/skeleton";
import EmptyState from "../../components/empty_state/empty_state";
import Button from "../../components/button/button";
import PickerSheet from "../../components/picker_sheet/picker_sheet";
import Sheet from "../../components/sheet/sheet";
import ThreeDotsActionsMenu from "../../components/three_dots_action_menu/three_dots_action_menu";
import AccountDialog from "../../components/dialog/account_dialog/account_dialog";
import BankConnectDialog from "../../components/dialog/bank_connect_dialog/bank_connect_dialog";
import "./conti_page.scss";
import {
  absorbVirtualConto,
  consolidateConti,
  moveAllToVirtualConto,
  countContoTransactions,
  deleteConto,
  getConti,
  getPatrimonio,
  getVerificaSaldi,
  updateConto,
} from "../../features/conti/api_calls";
import { Conto } from "../../features/conti/interfaces";
import {
  selectContiConti,
  selectContiLoading,
  selectContiPatrimonio,
} from "../../features/conti/conto_slice";
import { selectIsOpenBankingAdmin } from "../../features/profile/profile_slice";
import { getInvestimenti } from "../../features/investimenti/api_calls";
import { selectInvestimenti } from "../../features/investimenti/investimento_slice";
import { showToast } from "../../features/ui/ui_slice";
import SaldiCheck from "../../components/saldi_check/saldi_check";
import { relativeTime } from "../../services/dates";

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

/** Il conto in attesa di conferma di eliminazione, col suo conto transazioni. */
type PendingDelete = { conto: Conto; transactions: number | null };

const isCollegato = (conto: Conto) => Boolean(conto.bank_connector_account_id);

// L'icona segue il tipo scelto; i conti aperti prima che i tipi esistessero si
// riconoscono dai campi che hanno.
const ICONE: Record<string, string> = {
  conto: "ph-bold ph-bank",
  carta: "ph-bold ph-credit-card",
  salvadanaio: "ph-bold ph-wallet",
  contanti: "ph-bold ph-money",
};

const tipoOf = (conto: Conto) => {
  if (conto.tipo) return conto.tipo;
  if (conto.budget_obiettivo) return "salvadanaio";
  if (conto.ricarica_automatica) return "carta";
  return "conto";
};

const contoIcon = (conto: Conto) => ICONE[tipoOf(conto)] ?? ICONE.conto;

export default function ContiPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const conti = useAppSelector(selectContiConti);
  const loading = useAppSelector(selectContiLoading);
  const investimenti = useAppSelector(selectInvestimenti);
  const patrimonio = useAppSelector(selectContiPatrimonio);
  const isOpenBankingAdmin = useAppSelector(selectIsOpenBankingAdmin);

  const [editing, setEditing] = useState<Conto | null>(null);
  const [isAccountDialogVisible, setIsAccountDialogVisible] = useState(false);
  const [bankAccount, setBankAccount] = useState<Conto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [orphans, setOrphans] = useState(0);
  const [worthOpen, setWorthOpen] = useState(false);
  const [worthDraft, setWorthDraft] = useState("");
  const [worthInvalid, setWorthInvalid] = useState(false);

  useEffect(() => {
    dispatch(getConti());
    // Il patrimonio conta anche il valore di mercato dei titoli.
    dispatch(getInvestimenti(undefined));
    // Le foto dei mesi passati: senza almeno due non c'è confronto.
    dispatch(getPatrimonio());
    // Saldi che non tornano con i movimenti: di norma nessuno.
    dispatch(getVerificaSaldi());
  }, [dispatch]);

  // Il conto che l'app ha aperto da sé non compare in elenco: esiste perché
  // una transazione deve pur appoggiarsi da qualche parte, non perché
  // l'utente abbia deciso di avere un conto.
  const virtuale = conti.find((conto) => conto.virtuale);
  const visibili = useMemo(
    () => conti.filter((conto) => !conto.virtuale),
    [conti],
  );

  // Quanti movimenti sono rimasti sul conto invisibile. Finché non esiste un
  // conto vero non interessa a nessuno: è la condizione qui sotto a decidere
  // se il conteggio si vede, non il conteggio stesso.
  useEffect(() => {
    if (!virtuale || visibili.length === 0) return;

    let alive = true;

    dispatch(countContoTransactions({ id: virtuale.id }))
      .unwrap()
      .then((total) => alive && setOrphans(total))
      .catch(() => alive && setOrphans(0));

    return () => {
      alive = false;
    };
  }, [dispatch, virtuale, visibili.length]);

  const showOrphans =
    Boolean(virtuale) && visibili.length > 0 && orphans > 0;

  const contiTotal = useMemo(
    () => conti.reduce((sum, conto) => sum + Number(conto.saldo), 0),
    [conti],
  );

  const investimentiTotal = useMemo(
    () =>
      investimenti.reduce(
        (sum, titolo) => sum + Number(titolo.valore_posizione ?? 0),
        0,
      ),
    [investimenti],
  );

  const netWorth = contiTotal + investimentiTotal;

  // Il confronto esiste solo se il mese scorso è stato fotografato: prima
  // niente badge, invece di una percentuale senza un "rispetto a cosa".
  const precedente = patrimonio.at(-2)?.totale;
  const growth =
    precedente && precedente !== 0
      ? ((netWorth - precedente) / Math.abs(precedente)) * 100
      : null;

  // Senza un conto proprio non c'è nessuna card da aprire: i soldi stanno sul
  // conto che l'app tiene da parte, che in elenco non compare. Il patrimonio in
  // testata diventa allora l'unico punto da cui correggerlo — prima era un
  // numero e basta, e la cifra restava quella per sempre.
  const worthEditable = Boolean(virtuale) && visibili.length === 0;

  const openWorth = () => {
    setWorthDraft(netWorth ? String(netWorth) : "");
    setWorthInvalid(false);
    setWorthOpen(true);
  };

  const saveWorth = async () => {
    if (!virtuale) return;

    const parsed = Number(worthDraft.trim().replace(",", "."));

    if (worthDraft.trim() === "" || Number.isNaN(parsed)) {
      setWorthInvalid(true);
      return;
    }

    // L'utente scrive il patrimonio, non il saldo: quello che sta nei titoli
    // non è sul conto, e va tolto prima di scriverci sopra.
    const saldo = parsed - investimentiTotal;

    setWorthOpen(false);

    try {
      await dispatch(updateConto({ id: virtuale.id, saldo })).unwrap();
      await dispatch(getConti());
      dispatch(showToast({ variant: "success", title: t("accounts_net_worth_saved") }));
    } catch {
      // L'errore arriva dal middleware.
    }
  };

  const openCreate = () => {
    setEditing(null);
    setIsAccountDialogVisible(true);
  };

  const openEdit = (conto: Conto) => {
    setEditing(conto);
    setIsAccountDialogVisible(true);
  };

  const askDelete = async (conto: Conto) => {
    // L'alert si apre subito e il conteggio arriva quando arriva: aspettare la
    // rete prima di mostrare qualcosa farebbe sembrare il tocco perso.
    setPendingDelete({ conto, transactions: null });

    try {
      const transactions = await dispatch(
        countContoTransactions({ id: conto.id }),
      ).unwrap();

      setPendingDelete((current) =>
        current && current.conto.id === conto.id
          ? { ...current, transactions }
          : current,
      );
    } catch {
      // Il conteggio è informativo: se fallisce chiediamo comunque conferma,
      // con il messaggio prudente.
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;

    dispatch(deleteConto({ id: pendingDelete.conto.id }));
    dispatch(showToast({ variant: "success", title: t("accounts_deleted") }));
    setPendingDelete(null);
  };

  const deleteMessage = () => {
    if (!pendingDelete) return "";

    const { transactions } = pendingDelete;

    if (transactions === null) return t("delete_conto_error_count");
    if (transactions === 0) return t("delete_conto_message_zero");

    return t("delete_conto_message").replace("{count}", String(transactions));
  };

  const merge = async () => {
    setConfirmingMerge(false);

    try {
      await dispatch(consolidateConti()).unwrap();
      await dispatch(getConti());
      dispatch(showToast({ variant: "success", title: t("accounts_merged") }));
    } catch {
      // L'errore arriva dal middleware.
    }
  };

  const giveUp = async () => {
    setConfirmingGiveUp(false);

    try {
      await dispatch(moveAllToVirtualConto()).unwrap();
      await dispatch(getConti());
      dispatch(showToast({ variant: "success", title: t("accounts_given_up") }));
    } catch {
      // L'errore arriva dal middleware.
    }
  };

  const assign = async (contoId: string | null) => {
    setAssignOpen(false);
    if (!contoId) return;

    try {
      await dispatch(absorbVirtualConto({ id: contoId })).unwrap();
      await dispatch(getConti());
      dispatch(showToast({ variant: "success", title: t("accounts_assigned") }));
    } catch {
      // L'errore arriva dal middleware.
    }
  };

  return (
    <>
      <Page className="accounts">
        <PageHeader className="accounts__header">
          {/* Titolo come nelle altre schermate: senza, Conti era l'unica che
              si apriva direttamente su un numero. */}
          <h1 className="page-title accounts__title">{t("nav_accounts")}</h1>

          <div
            className={`accounts__worth${
              worthEditable ? " accounts__worth--editable" : ""
            }`}
            {...(worthEditable
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: openWorth,
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openWorth();
                    }
                  },
                }
              : {})}
          >
            <span className="accounts__eyebrow">
              {t("accounts_net_worth")}
              {worthEditable && (
                <i className="ph-bold ph-pencil-simple" aria-hidden="true" />
              )}
            </span>
            <Amount className="accounts__worth-value" value={netWorth} />

            {growth !== null && (
              <span
                className={`accounts__delta accounts__delta--${
                  growth >= 0 ? "up" : "down"
                }`}
              >
                <i
                  className={`ph-bold ${growth >= 0 ? "ph-arrow-up-right" : "ph-arrow-down-right"}`}
                  aria-hidden="true"
                />
                {`${Math.abs(growth).toFixed(1)}% ${t("accounts_vs_last_month")}`}
              </span>
            )}
          </div>

          <button
            type="button"
            className="accounts__add"
            aria-label={t("add_account")}
            onClick={openCreate}
          >
            <i className="ph-bold ph-plus" aria-hidden="true" />
          </button>
        </PageHeader>

        <PageContent>
          <SaldiCheck />

          {loading && conti.length === 0 && (
            <Card>
              <SkeletonList />
            </Card>
          )}

          {!loading && visibili.length === 0 && (
            <EmptyState
              icon="ph-bold ph-wallet"
              title={t("accounts_empty_title")}
              description={t("accounts_empty_text")}
              actions={
                <Button size="sm" onClick={openCreate}>
                  {t("add_account")}
                </Button>
              }
            />
          )}

          {visibili.length > 0 && (
            <div className="accounts__cards">
              {visibili.map((conto) => (
                <ContoCard
                  key={conto.id}
                  conto={conto}
                  actions={
                    <ThreeDotsActionsMenu
                      className="accounts__menu-button"
                      verticalDots
                      items={[
                        {
                          label: t("edit"),
                          icon: "ph-bold ph-pencil-simple",
                          command: () => openEdit(conto),
                        },
                        ...(isOpenBankingAdmin
                          ? [
                              {
                                label: isCollegato(conto)
                                  ? t("bank_connected")
                                  : t("link_bank"),
                                icon: "ph-bold ph-bank",
                                command: () => setBankAccount(conto),
                              },
                            ]
                          : []),
                        {
                          label: t("delete"),
                          icon: "ph-bold ph-trash",
                          command: () => askDelete(conto),
                        },
                      ]}
                    />
                  }
                />
              ))}
            </div>
          )}

          {showOrphans && (
            <Card className="accounts__orphans">
              <div className="accounts__orphans-text">
                <span className="accounts__orphans-title">
                  {`${orphans} ${t("accounts_orphans")}`}
                </span>
                <span className="accounts__orphans-hint">
                  {t("accounts_orphans_hint")}
                </span>
              </div>

              <button
                type="button"
                className="accounts__orphans-action"
                onClick={() => setAssignOpen(true)}
              >
                {t("accounts_assign")}
              </button>
            </Card>
          )}

          {conti.length > 1 && (
            <button
              type="button"
              className="accounts__merge"
              onClick={() => setConfirmingMerge(true)}
            >
              <i className="ph-bold ph-arrows-left-right" aria-hidden="true" />
              {t("accounts_merge")}
            </button>
          )}

          {/* Il contrario di "Assegna": chi non vuole gestire i conti se li
              toglie di torno e i movimenti restano, senza conto. */}
          {visibili.length > 0 && (
            <button
              type="button"
              className="accounts__merge"
              onClick={() => setConfirmingGiveUp(true)}
            >
              <i className="ph-bold ph-eye-slash" aria-hidden="true" />
              {t("accounts_give_up")}
            </button>
          )}
        </PageContent>
      </Page>

      {/* Montato solo da aperto: il form nasce già sul conto giusto, senza un
          effetto che lo rimetta a posto a ogni apertura. */}
      {isAccountDialogVisible && (
        <AccountDialog
          visible
          account={editing}
          onHide={() => {
            setIsAccountDialogVisible(false);
            setEditing(null);
          }}
          loading={loading}
        />
      )}

      <BankConnectDialog
        visible={Boolean(bankAccount)}
        conto={bankAccount}
        onHide={() => setBankAccount(null)}
      />

      <Sheet
        open={worthOpen}
        onClose={() => setWorthOpen(false)}
        title={t("accounts_net_worth")}
        footer={
          <>
            <Button variant="neutral" block onClick={() => setWorthOpen(false)}>
              {t("cancel")}
            </Button>
            <Button block onClick={saveWorth}>
              {t("save")}
            </Button>
          </>
        }
      >
        <label className="accounts__worth-field">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={worthDraft}
            aria-label={t("accounts_net_worth")}
            aria-invalid={worthInvalid}
            onChange={(event) => {
              setWorthDraft(event.target.value);
              setWorthInvalid(false);
            }}
          />
          <span className="accounts__worth-field-currency">€</span>
        </label>

        <p
          className={`accounts__worth-hint${
            worthInvalid ? " accounts__worth-hint--error" : ""
          }`}
        >
          {worthInvalid
            ? t("accounts_net_worth_invalid")
            : investimentiTotal !== 0
              ? t("accounts_net_worth_hint_investments")
              : t("accounts_net_worth_hint")}
        </p>
      </Sheet>

      <PickerSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={t("accounts_assign_title")}
        options={visibili.map((conto) => ({
          id: conto.id,
          label: conto.nome,
        }))}
        value={null}
        onSelect={assign}
      />

      <Alert
        open={Boolean(pendingDelete)}
        title={t("accounts_delete_title")}
        description={deleteMessage()}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Alert
        open={confirmingMerge}
        tone="accent"
        icon="ph-bold ph-arrows-left-right"
        title={t("accounts_merge_title")}
        description={t("accounts_merge_text")}
        confirmLabel={t("accounts_merge_confirm")}
        cancelLabel={t("cancel")}
        onConfirm={merge}
        onCancel={() => setConfirmingMerge(false)}
      />

      <Alert
        open={confirmingGiveUp}
        tone="accent"
        icon="ph-bold ph-eye-slash"
        title={t("accounts_give_up_title")}
        description={t("accounts_give_up_text")}
        confirmLabel={t("accounts_give_up_confirm")}
        cancelLabel={t("cancel")}
        onConfirm={giveUp}
        onCancel={() => setConfirmingGiveUp(false)}
      />
    </>
  );
}

function ContoCard({
  conto,
  actions,
}: {
  conto: Conto;
  actions: React.ReactNode;
}) {
  const { t } = useI18n();

  const goal = Number(conto.budget_obiettivo ?? 0);
  const saldo = Number(conto.saldo);
  const progress = goal > 0 ? Math.min(1, saldo / goal) : 0;

  const sync = relativeTime(conto.bank_connector_last_sync, localeTag());
  const syncFailed = Boolean(conto.bank_connector_last_error);

  // Una sola forma per tutti i tipi: il tipo si legge dall'icona, non dalla
  // sagoma della card. Le righe in più (obiettivo, sincronizzazione) compaiono
  // se il conto ha qualcosa da dire, non perché è di una certa specie.
  return (
    <Card className="account-card">
      <div className="account-card__top">
        <span className="account-card__icon" aria-hidden="true">
          <i className={contoIcon(conto)} />
        </span>

        <span className="account-card__name">{conto.nome}</span>

        {isCollegato(conto) && (
          <span className="account-card__badge">{t("accounts_linked")}</span>
        )}

        {actions}
      </div>

      <div className="account-card__figures">
        <Amount className="account-card__balance" value={saldo} />

        {goal > 0 ? (
          <span className="account-card__percent">
            {`${Math.round(progress * 100)}%`}
          </span>
        ) : (
          sync && (
            <span
              className={`account-card__sync${
                syncFailed ? " account-card__sync--failed" : ""
              }`}
            >
              {syncFailed
                ? t("accounts_sync_failed")
                : `${t("accounts_sync")} ${sync}`}
            </span>
          )
        )}
      </div>

      {goal > 0 && (
        <>
          <ProgressBar
            label={conto.nome}
            segments={[{ value: progress, tone: "accent" }]}
          />
          <span className="account-card__goal">
            {`${t("accounts_goal")} `}
            <Amount value={goal} decimals={0} />
          </span>
        </>
      )}
    </Card>
  );
}
