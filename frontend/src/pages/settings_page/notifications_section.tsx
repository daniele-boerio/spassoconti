import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import Toggle from "../../components/toggle/toggle";
import { showToast } from "../../features/ui/ui_slice";
import {
  disablePushOnDevice,
  enablePushOnDevice,
  getNotifiche,
  sendTestNotification,
  updatePreferenzeNotifiche,
} from "../../features/notifiche/api_calls";
import {
  selectNotificheConfig,
  selectNotificheLoading,
  selectNotificheThisDevice,
} from "../../features/notifiche/notifiche_slice";
import {
  detectPushSupport,
  notificationPermission,
} from "../../features/notifiche/push";

/**
 * Sezione "Notifiche" delle Impostazioni. Si attivano per dispositivo (il
 * permesso è del browser), si scelgono per account (cosa ricevere).
 *
 * Non compare se il server non ha le chiavi VAPID.
 */
export default function NotificationsSection() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectNotificheConfig);
  const thisDevice = useAppSelector(selectNotificheThisDevice);
  const loading = useAppSelector(selectNotificheLoading);

  const support = useMemo(() => detectPushSupport(), []);
  const [blocked, setBlocked] = useState(
    () => notificationPermission() === "denied",
  );

  useEffect(() => {
    dispatch(getNotifiche());
  }, [dispatch]);

  if (!config?.disponibili) return null;

  const toggleDevice = async (checked: boolean) => {
    if (!checked) {
      dispatch(disablePushOnDevice());
      return;
    }
    if (!config.vapid_public_key) return;

    try {
      const result = await dispatch(
        enablePushOnDevice(config.vapid_public_key),
      ).unwrap();
      if (result.denied) {
        setBlocked(notificationPermission() === "denied");
        dispatch(
          showToast({ variant: "error", title: t("notifications_denied") }),
        );
        return;
      }
      if (result.failed) {
        dispatch(
          showToast({ variant: "error", title: t("notifications_failed") }),
        );
        return;
      }
      dispatch(showToast({ variant: "success", title: t("notifications_on") }));
    } catch {
      // Mostrato dall'errorMiddleware.
    }
  };

  const sendTest = async () => {
    try {
      const result = await dispatch(sendTestNotification()).unwrap();
      dispatch(
        showToast({
          variant: result.inviate > 0 ? "success" : "error",
          title:
            result.inviate > 0
              ? t("notifications_test_sent")
              : t("notifications_test_failed"),
        }),
      );
    } catch {
      // Mostrato dall'errorMiddleware.
    }
  };

  let deviceRow;
  if (support === "needs_install") {
    deviceRow = (
      <div className="settings-row">
        <span className="settings-row__text">
          <span className="settings-row__label">
            {t("notifications_this_device")}
          </span>
          <span className="settings-row__hint">
            {t("notifications_needs_install")}
          </span>
        </span>
      </div>
    );
  } else if (support === "unsupported") {
    deviceRow = (
      <div className="settings-row">
        <span className="settings-row__text">
          <span className="settings-row__label">
            {t("notifications_this_device")}
          </span>
          <span className="settings-row__hint">
            {t("notifications_unsupported")}
          </span>
        </span>
      </div>
    );
  } else {
    deviceRow = (
      <label className="settings-row">
        <span className="settings-row__text">
          <span className="settings-row__label">
            {t("notifications_this_device")}
          </span>
          <span className="settings-row__hint">
            {blocked && !thisDevice
              ? t("notifications_blocked")
              : t("notifications_this_device_hint")}
          </span>
        </span>

        <Toggle
          checked={thisDevice}
          disabled={loading || (blocked && !thisDevice)}
          onChange={toggleDevice}
        />
      </label>
    );
  }

  return (
    <section className="settings-group">
      <h2 className="settings-group__title">{t("settings_notifications")}</h2>

      <div className="settings-card">
        {deviceRow}

        <label className="settings-row">
          <span className="settings-row__text">
            <span className="settings-row__label">
              {t("notifications_budget")}
            </span>
            <span className="settings-row__hint">
              {t("notifications_budget_hint")}
            </span>
          </span>
          <Toggle
            checked={config.budget}
            onChange={(checked) =>
              dispatch(updatePreferenzeNotifiche({ budget: checked }))
            }
          />
        </label>

        <label className="settings-row">
          <span className="settings-row__text">
            <span className="settings-row__label">
              {t("notifications_recurring")}
            </span>
            <span className="settings-row__hint">
              {t("notifications_recurring_hint")}
            </span>
          </span>
          <Toggle
            checked={config.ricorrenze}
            onChange={(checked) =>
              dispatch(updatePreferenzeNotifiche({ ricorrenze: checked }))
            }
          />
        </label>

        {thisDevice && (
          <button
            type="button"
            className="settings-row settings-row--tappable"
            disabled={loading}
            onClick={sendTest}
          >
            <span className="settings-row__text">
              <span className="settings-row__label">
                {t("notifications_test")}
              </span>
            </span>
            <i className="ph-bold ph-caret-right" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
