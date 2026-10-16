import { NavLink } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch } from "../../store/store";
import { openSheet } from "../../features/ui/ui_slice";
import "./tab_bar.scss";

type Tab = {
  to: string;
  icon: string;
  labelKey: string;
  /** Etichetta sotto l'icona, quando il nome intero non ci sta. */
  shortKey?: string;
};

/**
 * Sei destinazioni più il FAB al centro: tre per lato, così il "+" resta in
 * mezzo. A sinistra il flusso — cosa succede ai soldi — a destra dove stanno.
 *
 * Icona più etichetta corta: con le sole icone "Analisi" e "Titoli" si
 * distinguevano a fatica, e la pagina in cui sei si leggeva solo dal colore.
 * Il nome intero resta come `aria-label`.
 */
const TABS: Tab[] = [
  { to: "/", icon: "ph-bold ph-house", labelKey: "nav_home" },
  { to: "/transactions", icon: "ph-bold ph-list-bullets", labelKey: "nav_movements" },
  { to: "/analysis", icon: "ph-bold ph-chart-bar", labelKey: "nav_analysis" },
  { to: "/accounts", icon: "ph-bold ph-wallet", labelKey: "nav_accounts" },
  {
    to: "/investments",
    icon: "ph-bold ph-chart-line-up",
    labelKey: "nav_investments",
    shortKey: "nav_investments_short",
  },
  { to: "/altro", icon: "ph-bold ph-dots-three", labelKey: "nav_more" },
];

export default function TabBar() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const [left, right] = [TABS.slice(0, 3), TABS.slice(3)];

  const renderTab = (tab: Tab) => (
    <NavLink
      key={tab.to}
      to={tab.to}
      end={tab.to === "/"}
      className="tab-bar__slot"
      aria-label={t(tab.labelKey)}
      title={t(tab.labelKey)}
    >
      <i className={tab.icon} aria-hidden="true" />
      <span className="tab-bar__label" aria-hidden="true">
        {t(tab.shortKey ?? tab.labelKey)}
      </span>
    </NavLink>
  );

  return (
    <nav className="tab-bar" aria-label={t("nav_primary")}>
      {left.map(renderTab)}

      <button
        type="button"
        className="tab-bar__fab"
        aria-label={t("new_transaction")}
        onClick={() => dispatch(openSheet({ name: "newTransaction" }))}
      >
        <i className="ph-bold ph-plus" aria-hidden="true" />
      </button>

      {right.map(renderTab)}
    </nav>
  );
}
