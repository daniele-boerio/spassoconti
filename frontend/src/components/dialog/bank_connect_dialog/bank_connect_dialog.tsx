import { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { confirmPopup } from "primereact/confirmpopup";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import "./bank_connect_dialog.scss";
import { useAppDispatch } from "../../../store/store";
import {
  disconnectBank,
  getInstitutions,
  startBankAuth,
} from "../../../features/conti/api_calls";
import { Conto, Institution } from "../../../features/conti/interfaces";
import { useI18n } from "../../../i18n/use-i18n";

interface BankConnectDialogProps {
  visible: boolean;
  onHide: () => void;
  conto?: Conto | null;
}

export default function BankConnectDialog({
  visible,
  onHide,
  conto,
}: BankConnectDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [search, setSearch] = useState("");
  // Se il conto è già collegato mostriamo lo stato; "Cambia banca" passa alla lista.
  const [showList, setShowList] = useState(false);

  const isLinked = !!conto?.bank_connector_account_id;
  // La lista banche serve quando non è collegato, oppure quando si vuole ricollegare
  const listMode = !isLinked || showList;

  useEffect(() => {
    if (!visible) {
      setInstitutions([]);
      setSearch("");
      setRedirecting(false);
      setDisconnecting(false);
      setShowList(false);
      return;
    }

    if (!listMode) return;

    let active = true;
    setLoading(true);
    dispatch(getInstitutions("IT"))
      .unwrap()
      .then((data) => {
        if (active) setInstitutions(data);
      })
      .catch(() => {
        // L'errore è già mostrato dall'errorMiddleware
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible, listMode, dispatch]);

  const handleDisconnect = (event: React.MouseEvent<unknown>) => {
    if (!conto) return;
    confirmPopup({
      target: event.currentTarget as HTMLElement,
      message: t("disconnect_bank_confirm"),
      icon: "ph-bold ph-warning",
      acceptClassName: "p-button-danger",
      acceptLabel: t("yes"),
      rejectLabel: t("no"),
      accept: () => {
        setDisconnecting(true);
        dispatch(disconnectBank({ conto_id: conto.id }))
          .unwrap()
          .then(() => onHide())
          .catch(() => {
            // gestito dall'errorMiddleware
          })
          .finally(() => setDisconnecting(false));
      },
    });
  };

  const formatLastSync = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return institutions;
    return institutions.filter((i) => i.name.toLowerCase().includes(q));
  }, [institutions, search]);

  const handleSelect = (institution: Institution) => {
    if (!conto || redirecting) return;
    setRedirecting(true);
    dispatch(
      startBankAuth({
        conto_id: conto.id,
        aspsp_name: institution.name,
        aspsp_country: institution.country,
      }),
    )
      .unwrap()
      .then(({ url }) => {
        // Step 3: redirect in uscita verso la banca.
        window.location.href = url;
      })
      .catch(() => {
        setRedirecting(false);
      });
  };

  return (
    <Dialog
      header={t("link_bank_title")}
      visible={visible}
      className="dialog-custom bank-connect-dialog"
      style={{ width: "95vw", maxWidth: "32rem" }}
      onHide={onHide}
      blockScroll={true}
      draggable={false}
      resizable={false}
    >
      <div className="bank-connect-content">
        {redirecting ? (
          <div className="bank-connect-status">
            <ProgressSpinner style={{ width: "48px", height: "48px" }} />
            <span>{t("redirecting_to_bank")}</span>
          </div>
        ) : !listMode ? (
          // --- VISTA "CONNESSO" ---
          <div className="bank-connected">
            <i className="ph-bold ph-check-circle bank-connected__icon" />
            <div className="bank-connected__title">{t("bank_connected")}</div>

            {conto?.bank_connector_institution_id && (
              <div className="bank-connected__row">
                <span>{t("connected_to")}</span>
                <strong>{conto.bank_connector_institution_id}</strong>
              </div>
            )}
            {formatLastSync(conto?.bank_connector_last_sync) && (
              <div className="bank-connected__row">
                <span>{t("last_sync")}</span>
                <strong>{formatLastSync(conto?.bank_connector_last_sync)}</strong>
              </div>
            )}
            {conto?.bank_connector_last_error && (
              <div className="bank-connected__error">
                {conto.bank_connector_last_error}
              </div>
            )}

            <div className="bank-connected__actions">
              <Button
                label={t("change_bank")}
                className="reset-button"
                icon="ph-bold ph-arrows-clockwise"
                iconPos="left"
                onClick={() => setShowList(true)}
              />
              <Button
                label={t("disconnect_bank")}
                className="trasparent-danger-button"
                icon="ph-bold ph-link"
                iconPos="left"
                loading={disconnecting}
                onClick={handleDisconnect}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="bank-connect-subtitle">{t("link_bank_subtitle")}</p>
            <InputText
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_bank")}
              icon="ph-bold ph-magnifying-glass"
              iconPos="left"
              inputMode="search"
            />

            {loading ? (
              <div className="bank-connect-status">
                <ProgressSpinner style={{ width: "48px", height: "48px" }} />
              </div>
            ) : filtered.length > 0 ? (
              <ul className="bank-list">
                {filtered.map((institution) => (
                  <li key={`${institution.name}-${institution.country}`}>
                    <button
                      type="button"
                      className="bank-list__item"
                      onClick={() => handleSelect(institution)}
                    >
                      {institution.logo ? (
                        <img
                          src={institution.logo}
                          alt={institution.name}
                          className="bank-list__logo"
                        />
                      ) : (
                        <i className="ph-bold ph-buildings bank-list__logo-placeholder" />
                      )}
                      <span className="bank-list__name">{institution.name}</span>
                      <i className="ph-bold ph-caret-right bank-list__chevron" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-data">{t("no_banks_found")}</p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
