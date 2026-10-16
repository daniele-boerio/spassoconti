import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { openSheet } from "../../features/ui/ui_slice";
import { selectTransactionPagination } from "../../features/transactions/transaction_slice";
import { selectRecurringRecurrings } from "../../features/recurrings/recurring_slice";
import { overdue } from "../../features/recurrings/commitment";
import "./nav_rail.scss";

type RailItem = {
  to: string;
  icon: string;
  labelKey: string;
  /** Numero a destra della voce: quanti sono, non se ci sono. */
  badge?: number;
  /** Il conteggio è una cosa da fare, non un totale: si scrive in rosso. */
  urgent?: boolean;
};

/**
 * La navigazione da schermo largo: il rail da 248px che prende il posto della
 * tab bar dai 900px in su.
 *
 * La tab bar ha sei fessure e ci stanno solo le destinazioni principali: il
 * resto — ricorrenze, categorie, debiti — vive dentro "Altro". Qui lo spazio
 * c'è, quindi "Altro" sparisce e quelle voci si vedono per nome sotto
 * "Gestione". Le impostazioni restano in fondo, attaccate a chi è collegato.
 */
export default function NavRail() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const pagination = useAppSelector(selectTransactionPagination);
  const recurrings = useAppSelector(selectRecurringRecurrings);
  // Le ricorrenze scadute sono le stesse che la loro schermata mette in
  // cima: qui si contano soltanto.
  const late = useMemo(() => overdue(recurrings).length, [recurrings]);
  const username = localStorage.getItem("username") ?? "";

  // Le iniziali di chi è collegato: due lettere se il nome è composto, la
  // prima altrimenti. Senza nome resta il quadrato vuoto, non "undefined".
  const initials = username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const primary: RailItem[] = [
    { to: "/", icon: "ph-bold ph-house", labelKey: "nav_home" },
    {
      to: "/transactions",
      icon: "ph-bold ph-list-bullets",
      labelKey: "nav_movements",
      // `total` è nullo finché la lista non è stata chiesta: zero e
      // "non lo so ancora" si scrivono allo stesso modo, cioè non si scrivono.
      badge: pagination.total ?? 0,
    },
    { to: "/analysis", icon: "ph-bold ph-chart-bar", labelKey: "nav_analysis" },
    { to: "/accounts", icon: "ph-bold ph-wallet", labelKey: "nav_accounts" },
  ];

  const management: RailItem[] = [
    {
      to: "/recurrings",
      icon: "ph-bold ph-arrows-clockwise",
      labelKey: "nav_recurrings",
      badge: late,
      urgent: true,
    },
    { to: "/categories", icon: "ph-bold ph-tag-simple", labelKey: "nav_categories" },
    {
      to: "/investments",
      icon: "ph-bold ph-chart-line-up",
      labelKey: "nav_investments",
    },
    { to: "/debts", icon: "ph-bold ph-receipt", labelKey: "nav_debts" },
  ];

  const renderItem = (item: RailItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `nav-rail__item ${isActive ? "nav-rail__item--on" : ""}`
      }
    >
      <i className={item.icon} aria-hidden="true" />
      <span className="nav-rail__label">{t(item.labelKey)}</span>

      {item.badge !== undefined && item.badge > 0 && (
        <span
          className={`nav-rail__badge ${
            item.urgent ? "nav-rail__badge--urgent" : ""
          }`}
        >
          {item.badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <nav className="nav-rail" aria-label={t("nav_primary")}>
      <div className="nav-rail__brand">
        <span className="nav-rail__mark" aria-hidden="true">
          S
        </span>
        <span className="nav-rail__name">SpassoConto</span>
      </div>

      <button
        type="button"
        className="nav-rail__new"
        onClick={() => dispatch(openSheet({ name: "newTransaction" }))}
      >
        <i className="ph-bold ph-plus" aria-hidden="true" />
        {t("new_transaction")}
      </button>

      <div className="nav-rail__group">{primary.map(renderItem)}</div>

      <div className="nav-rail__group">
        <span className="nav-rail__group-label">{t("nav_management")}</span>
        {management.map(renderItem)}
      </div>

      <NavLink to="/settings" className="nav-rail__user">
        <span className="nav-rail__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="nav-rail__identity">
          <span className="nav-rail__username">{username}</span>
          <span className="nav-rail__hint">{t("nav_settings")}</span>
        </span>
        <i className="ph-bold ph-gear" aria-hidden="true" />
      </NavLink>
    </nav>
  );
}
