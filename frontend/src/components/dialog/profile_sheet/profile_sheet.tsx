import { useState } from "react";
import Sheet from "../../sheet/sheet";
import Button from "../../button/button";
import { useI18n } from "../../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import {
  logout,
  requestPasswordReset,
  updateUsername,
} from "../../../features/profile/api_calls";
import {
  selectProfileEmail,
  selectProfileUsername,
} from "../../../features/profile/profile_slice";
import { showToast } from "../../../features/ui/ui_slice";
import "./profile_sheet.scss";

const initialsOf = (username: string | null) =>
  (username ?? "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

type ProfileSheetProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Chi sei e le due cose che puoi cambiare di te.
 *
 * Lo username si modifica qui; la password no — passa dalla casella di posta,
 * come dalla schermata di accesso: è l'unico modo per cambiarla che regge
 * anche quando qualcuno ti ha lasciato il telefono sbloccato in mano.
 */
export default function ProfileSheet({ open, onClose }: ProfileSheetProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const username = useAppSelector(selectProfileUsername);
  const email = useAppSelector(selectProfileEmail);

  const [draft, setDraft] = useState(username ?? "");
  const [editing, setEditing] = useState(false);

  const canSave = draft.trim() !== "" && draft.trim() !== username;

  const saveUsername = async () => {
    try {
      await dispatch(updateUsername(draft.trim())).unwrap();
      dispatch(showToast({ variant: "success", title: t("profile_saved") }));
      setEditing(false);
    } catch {
      // L'errore (username già preso) arriva dal middleware.
    }
  };

  const resetPassword = async () => {
    if (!email) return;

    try {
      await dispatch(requestPasswordReset(email)).unwrap();
      dispatch(showToast({ variant: "success", title: t("profile_reset_sent") }));
    } catch {
      // L'errore arriva dal middleware.
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("profile_title")}>
      <div className="profile__identity">
        <span className="profile__avatar" aria-hidden="true">
          {initialsOf(username)}
        </span>

        <div className="profile__text">
          <span className="profile__name">{username}</span>
          <span className="profile__email">{email}</span>
        </div>
      </div>

      {editing ? (
        <div className="profile__field">
          <label className="profile__label" htmlFor="profile-username">
            {t("username")}
          </label>

          <div className="profile__control">
            <input
              id="profile-username"
              autoFocus
              value={draft}
              placeholder={t("username_placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSave) saveUsername();
              }}
            />
          </div>

          <div className="profile__actions">
            <Button
              variant="neutral"
              size="md"
              block
              onClick={() => setEditing(false)}
            >
              {t("cancel")}
            </Button>
            <Button size="md" block disabled={!canSave} onClick={saveUsername}>
              {t("save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="profile__rows">
          <button
            type="button"
            className="profile__row"
            onClick={() => setEditing(true)}
          >
            <i className="ph-bold ph-user" aria-hidden="true" />
            <span className="profile__row-text">
              <span>{t("profile_change_username")}</span>
              <span className="profile__hint">{username}</span>
            </span>
            <i className="ph-bold ph-caret-right profile__chevron" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="profile__row"
            onClick={resetPassword}
          >
            <i className="ph-bold ph-lock" aria-hidden="true" />
            <span className="profile__row-text">
              <span>{t("profile_reset_password")}</span>
              <span className="profile__hint">
                {t("profile_reset_password_hint")}
              </span>
            </span>
          </button>
        </div>
      )}

      <button
        type="button"
        className="profile__logout"
        onClick={() => dispatch(logout())}
      >
        <i className="ph-bold ph-sign-out" aria-hidden="true" />
        {t("logout")}
      </button>
    </Sheet>
  );
}
