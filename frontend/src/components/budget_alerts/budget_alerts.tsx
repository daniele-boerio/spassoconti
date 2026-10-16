import { useEffect } from "react";
import { useAppDispatch } from "../../store/store";
import { showToast } from "../../features/ui/ui_slice";
import { useI18n } from "../../i18n/use-i18n";
import {
  BudgetAlert,
  loadSeenAlerts,
  markSeen,
  monthKey,
  saveSeenAlerts,
  unseenAlerts,
} from "../../features/statistics/budget_alerts";
import { Card, CardTitle } from "../card/card";
import Amount from "../amount/amount";
import ProgressBar from "../progress_bar/progress_bar";
import "./budget_alerts.scss";

type BudgetAlertsCardProps = {
  alerts: BudgetAlert[];
};

/**
 * Budget vicini al limite o sforati, sulla Home.
 *
 * La card resta finché la condizione dura; il toast compare una volta sola per
 * budget e per livello nel mese (vedi `unseenAlerts`), così riaprire l'app non
 * ripete lo stesso avviso.
 */
export default function BudgetAlertsCard({ alerts }: BudgetAlertsCardProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const labelOf = (alert: BudgetAlert) => alert.nome ?? t("budget_alert_total");

  useEffect(() => {
    if (alerts.length === 0) return;

    const month = monthKey(new Date());
    const seen = loadSeenAlerts();
    const fresh = unseenAlerts(alerts, seen, month);
    if (fresh.length === 0) return;

    const [first] = fresh;
    const others = fresh.length - 1;
    dispatch(
      showToast({
        // La variante "error" è la card d'attenzione (bordo e triangolo),
        // giusta sia per il "quasi" sia per lo sforamento.
        variant: "error",
        title: `${labelOf(first)}: ${Math.round(first.percent)}% ${t("budget_alert_of_budget")}`,
        meta:
          others > 0
            ? t("budget_alert_others").replace("{count}", String(others))
            : undefined,
      }),
    );

    saveSeenAlerts(markSeen(fresh, seen, month));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <Card variant="alert" className="budget-alerts">
      <CardTitle>{t("budget_alert_title")}</CardTitle>

      <ul className="budget-alerts__list">
        {alerts.map((alert) => (
          <li key={alert.key} className="budget-alerts__row">
            <div className="budget-alerts__line">
              <span className="budget-alerts__name">{labelOf(alert)}</span>
              <span
                className={`budget-alerts__state budget-alerts__state--${alert.level}`}
              >
                {alert.level === "over"
                  ? t("budget_alert_over")
                  : `${Math.round(alert.percent)}%`}
              </span>
            </div>
            <ProgressBar
              label={labelOf(alert)}
              segments={[
                {
                  value: Math.min(1, alert.budget > 0 ? alert.speso / alert.budget : 1),
                  tone: alert.level === "over" ? "negative" : "accent",
                },
              ]}
            />
            <span className="budget-alerts__meta">
              <Amount value={alert.speso} decimals={0} /> {t("budget_alert_of")}{" "}
              <Amount value={alert.budget} decimals={0} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
