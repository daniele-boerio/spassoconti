import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import Sheet from "../../components/sheet/sheet";
import Button from "../../components/button/button";
import { showToast } from "../../features/ui/ui_slice";
import {
  addPasskey,
  deletePasskey,
  getPasskeys,
} from "../../features/profile/api_calls";
import { selectPasskeys } from "../../features/profile/profile_slice";

type Props = {
  open: boolean;
  onClose: () => void;
};

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

/**
 * Passkey dell'account: Face ID / impronta / PIN al posto della password.
 * Una per dispositivo o portachiavi (iCloud, Google): quella dell'iPhone vale
 * anche sul Mac con lo stesso Apple ID.
 */
export default function PasskeySheet({ open, onClose }: Props) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const passkeys = useAppSelector(selectPasskeys);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) dispatch(getPasskeys());
  }, [open, dispatch]);

  const add = async () => {
    setBusy(true);
    try {
      const created = await dispatch(addPasskey()).unwrap();
      if (created) {
        dispatch(showToast({ variant: "success", title: t("passkey_added") }));
      }
    } catch {
      // Mostrato dall'errorMiddleware.
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await dispatch(deletePasskey(id)).unwrap();
      dispatch(showToast({ variant: "success", title: t("passkey_removed") }));
    } catch {
      // Mostrato dall'errorMiddleware.
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("passkey_title")}
      className="two-factor"
      footer={
        <Button block icon="ph-bold ph-fingerprint" disabled={busy} onClick={add}>
          {t("passkey_add")}
        </Button>
      }
    >
      <p className="two-factor__text">{t("passkey_intro")}</p>

      {passkeys && passkeys.length > 0 && (
        <ul className="passkey-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="passkey-list__item">
              <i className="ph-bold ph-fingerprint" aria-hidden="true" />
              <span className="passkey-list__text">
                <span className="passkey-list__name">{passkey.nome}</span>
                <span className="passkey-list__meta">
                  {passkey.last_used_at
                    ? `${t("passkey_last_used")} ${formatDate(passkey.last_used_at)}`
                    : `${t("passkey_created")} ${formatDate(passkey.created_at)}`}
                </span>
              </span>
              <button
                type="button"
                className="passkey-list__remove"
                aria-label={`${t("passkey_remove")} ${passkey.nome}`}
                onClick={() => remove(passkey.id)}
              >
                <i className="ph-bold ph-trash" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
