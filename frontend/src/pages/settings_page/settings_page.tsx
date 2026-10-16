import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import Sheet from "../../components/sheet/sheet";
import Toggle from "../../components/toggle/toggle";
import Button from "../../components/button/button";
import Amount from "../../components/amount/amount";
import ImportStatementDialog from "../../components/dialog/import_statement_dialog/import_statement_dialog";
import {
  selectTheme,
  setTheme,
  showToast,
} from "../../features/ui/ui_slice";
import type { ThemePreference } from "../../features/ui/theme";
import {
  selectProfileEmail,
  selectProfileUsername,
} from "../../features/profile/profile_slice";
import { logout } from "../../features/profile/api_calls";
import {
  getConti,
  getCurrentMonthExpenses,
  updateBudget,
} from "../../features/conti/api_calls";
import {
  selectContiConti,
  selectContiMonthlySpending,
  selectIncludeFutureRecurring,
  setIncludeFutureRecurring,
} from "../../features/conti/conto_slice";
import "./settings_page.scss";

const THEMES: ThemePreference[] = ["light", "dark", "system"];

const initialsOf = (username: string | null) =>
  (username ?? "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

export default function SettingsPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const theme = useAppSelector(selectTheme);
  const username = useAppSelector(selectProfileUsername);
  const email = useAppSelector(selectProfileEmail);
  const spending = useAppSelector(selectContiMonthlySpending);
  const conti = useAppSelector(selectContiConti);
  const includeFutureRecurring = useAppSelector(selectIncludeFutureRecurring);

  const [importOpen, setImportOpen] = useState(false);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [budgetInvalid, setBudgetInvalid] = useState(false);

  useEffect(() => {
    // Il tetto di spesa arriva con la card del mese.
    dispatch(getCurrentMonthExpenses());
    // "Banche collegate" conta i conti con un collegamento attivo.
    dispatch(getConti());
  }, [dispatch]);

  const linkedAccounts = conti.filter(
    (conto) => conto.bank_connector_account_id,
  ).length;

  /**
   * Il flag cambia il *calcolo* del budget, non solo la vista: dopo averlo
   * mosso il totale del mese va richiesto di nuovo, o resta quello di prima.
   */
  const toggleFutureRecurring = (checked: boolean) => {
    dispatch(setIncludeFutureRecurring(checked));
    dispatch(getCurrentMonthExpenses({ include_future_recurring: checked }));
  };

  const openBudgetSheet = () => {
    setBudgetDraft(spending.budget !== null ? String(spending.budget) : "");
    setBudgetInvalid(false);
    setBudgetSheetOpen(true);
  };

  const saveBudget = async () => {
    const normalized = budgetDraft.trim().replace(",", ".");
    const parsed = normalized === "" ? null : Number(normalized);

    // Numero non valido: lo sheet resta aperto con l'errore sotto al campo,
    // invece di non fare niente in silenzio.
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setBudgetInvalid(true);
      return;
    }

    setBudgetSheetOpen(false);

    const result = await dispatch(
      updateBudget({ monthly_spending_budget: parsed }),
    );

    if (updateBudget.fulfilled.match(result)) {
      dispatch(showToast({ variant: "success", title: t("save") }));
    }
  };

  return (
    <Page className="settings-page">
      <PageHeader className="settings-page__header">
        <button
          type="button"
          className="settings-page__back"
          aria-label={t("back")}
          onClick={() => navigate(-1)}
        >
          <i className="ph-bold ph-arrow-left" aria-hidden="true" />
        </button>
        <h1 className="page-title">{t("nav_settings")}</h1>
      </PageHeader>

      <PageContent>
        <section className="settings-card settings-profile">
          <span className="settings-profile__avatar">
            {initialsOf(username)}
          </span>
          <div className="settings-profile__identity">
            <span className="settings-profile__name">{username}</span>
            <span className="settings-profile__email">{email}</span>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group__title">{t("settings_appearance")}</h2>

          <div className="settings-card">
            <div
              className="theme-picker"
              role="radiogroup"
              aria-label={t("settings_appearance")}
            >
              {THEMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={option === theme}
                  className={`theme-picker__option theme-picker__option--${option}`}
                  onClick={() => dispatch(setTheme(option))}
                >
                  <span className="theme-picker__preview" aria-hidden="true" />
                  <span className="theme-picker__label">
                    {t(`theme_${option}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h2 className="settings-group__title">{t("settings_money")}</h2>

          <div className="settings-card">
            <button
              type="button"
              className="settings-row settings-row--tappable"
              onClick={openBudgetSheet}
            >
              <span className="settings-row__text">
                <span className="settings-row__label">
                  {t("settings_spending_budget")}
                </span>
                <span className="settings-row__hint">
                  {t("settings_spending_budget_hint")}
                </span>
              </span>

              <span className="settings-row__value">
                {spending.budget !== null ? (
                  <Amount value={spending.budget} decimals={0} />
                ) : (
                  t("settings_spending_budget_none")
                )}
              </span>
              <i className="ph-bold ph-caret-right" aria-hidden="true" />
            </button>

            <label className="settings-row">
              <span className="settings-row__text">
                <span className="settings-row__label">
                  {t("include_future_recurring")}
                </span>
                <span className="settings-row__hint">
                  {t("settings_future_recurring_hint")}
                </span>
              </span>

              <Toggle
                checked={includeFutureRecurring}
                onChange={toggleFutureRecurring}
              />
            </label>

            <button
              type="button"
              className="settings-row settings-row--tappable"
              onClick={() => setImportOpen(true)}
            >
              <span className="settings-row__text">
                <span className="settings-row__label">
                  {t("import_statement_title")}
                </span>
              </span>
              <i className="ph-bold ph-caret-right" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="settings-row settings-row--tappable"
              onClick={() => navigate("/accounts")}
            >
              <span className="settings-row__text">
                <span className="settings-row__label">
                  {t("settings_linked_banks")}
                </span>
                <span className="settings-row__hint">
                  {linkedAccounts > 0
                    ? `${linkedAccounts} ${t("settings_linked_count")}`
                    : t("settings_linked_none")}
                </span>
              </span>
              <i className="ph-bold ph-caret-right" aria-hidden="true" />
            </button>
          </div>
        </section>

        <button
          type="button"
          className="settings-logout"
          onClick={() => dispatch(logout())}
        >
          <i className="ph-bold ph-sign-out" aria-hidden="true" />
          {t("logout")}
        </button>
      </PageContent>

      <ImportStatementDialog
        visible={importOpen}
        onHide={() => setImportOpen(false)}
      />

      <Sheet
        open={budgetSheetOpen}
        onClose={() => setBudgetSheetOpen(false)}
        title={t("settings_spending_budget")}
        footer={
          <>
            <Button
              variant="neutral"
              block
              onClick={() => setBudgetSheetOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button block onClick={saveBudget}>
              {t("save")}
            </Button>
          </>
        }
      >
        <label className="budget-field">
          <input
            className="budget-field__input"
            type="text"
            inputMode="decimal"
            autoFocus
            value={budgetDraft}
            placeholder={t("settings_spending_budget_placeholder")}
            aria-invalid={budgetInvalid}
            onChange={(event) => {
              setBudgetDraft(event.target.value);
              setBudgetInvalid(false);
            }}
          />
          <span className="budget-field__currency">€</span>
        </label>

        <p
          className={`budget-field__hint ${
            budgetInvalid ? "budget-field__hint--error" : ""
          }`}
        >
          {budgetInvalid
            ? t("settings_spending_budget_invalid")
            : t("settings_spending_budget_hint")}
        </p>
      </Sheet>
    </Page>
  );
}
