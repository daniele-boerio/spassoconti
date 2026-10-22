import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import Sheet from "../../components/sheet/sheet";
import Button from "../../components/button/button";
import { showToast } from "../../features/ui/ui_slice";
import { selectIsAdmin } from "../../features/profile/profile_slice";
import {
  banUser,
  getAdminUsers,
  unbanUser,
} from "../../features/admin/api_calls";
import {
  selectAdminLoading,
  selectAdminUsers,
} from "../../features/admin/admin_slice";

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

/**
 * Sezione "Utenti" delle Impostazioni, solo per l'admin: chi ha un account
 * (nome utente ed email) e il ban. Il ban blocca l'accesso e chiude le
 * sessioni aperte, ma non cancella il profilo né i dati.
 */
export default function AdminSection() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const users = useAppSelector(selectAdminUsers);
  const loading = useAppSelector(selectAdminLoading);

  // L'id e non l'utente: dopo il ban la riga nello store cambia, e lo sheet
  // deve mostrare quella aggiornata.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) dispatch(getAdminUsers());
  }, [isAdmin, dispatch]);

  if (!isAdmin) return null;

  const selected =
    users?.find((user) => String(user.id) === String(selectedId)) ?? null;

  const toggleBan = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected.banned_at) {
        await dispatch(unbanUser(selected.id)).unwrap();
        dispatch(showToast({ variant: "success", title: t("admin_unbanned") }));
      } else {
        await dispatch(banUser(selected.id)).unwrap();
        dispatch(showToast({ variant: "success", title: t("admin_banned_toast") }));
      }
      setSelectedId(null);
    } catch {
      // Mostrato dall'errorMiddleware.
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-group">
      <h2 className="settings-group__title">{t("admin_users_title")}</h2>

      <div className="settings-card">
        {users === null && loading && (
          <div className="settings-row">
            <span className="settings-row__hint">{t("loading")}</span>
          </div>
        )}

        {users?.map((user) =>
          user.is_admin ? (
            <div key={user.id} className="settings-row">
              <span className="settings-row__text">
                <span className="settings-row__label">{user.username}</span>
                <span className="settings-row__hint">{user.email}</span>
              </span>
              <span className="settings-row__value">{t("admin_you")}</span>
            </div>
          ) : (
            <button
              key={user.id}
              type="button"
              className="settings-row settings-row--tappable"
              onClick={() => setSelectedId(user.id)}
            >
              <span className="settings-row__text">
                <span className="settings-row__label">{user.username}</span>
                <span className="settings-row__hint">{user.email}</span>
              </span>
              {user.banned_at && (
                <span className="settings-row__value settings-row__value--negative">
                  {t("admin_banned")}
                </span>
              )}
              <i className="ph-bold ph-caret-right" aria-hidden="true" />
            </button>
          ),
        )}
      </div>

      <Sheet
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.username ?? ""}
        className="two-factor"
        footer={
          <>
            <Button variant="neutral" block onClick={() => setSelectedId(null)}>
              {t("cancel")}
            </Button>
            <Button
              block
              variant={selected?.banned_at ? "primary" : "danger"}
              disabled={busy}
              onClick={toggleBan}
            >
              {selected?.banned_at ? t("admin_unban") : t("admin_ban")}
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <p className="two-factor__text">{selected.email}</p>
            <p className="two-factor__text">
              {selected.banned_at
                ? `${t("admin_banned_since")} ${formatDate(selected.banned_at)}. ${t("admin_unban_hint")}`
                : t("admin_ban_hint")}
            </p>
          </>
        )}
      </Sheet>
    </section>
  );
}
