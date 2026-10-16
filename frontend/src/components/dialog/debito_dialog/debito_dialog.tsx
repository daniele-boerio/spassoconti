import { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import Dropdown from "../../dropdown/dropdown";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import "./debito_dialog.scss";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { createDebito, updateDebito } from "../../../features/debiti/api_calls";
import { useI18n } from "../../../i18n/use-i18n";
import { Debito } from "../../../features/debiti/interfaces";
import { selectContiConti } from "../../../features/conti/conto_slice";

interface DebitoDialogProps {
  visible: boolean;
  onHide: () => void;
  loading?: boolean;
  debito?: Debito | null;
  onSaved?: () => void;
}

export default function DebitoDialog({
  visible,
  onHide,
  loading,
  debito,
  onSaved,
}: DebitoDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const conti = useAppSelector(selectContiConti);

  const [nome, setNome] = useState("");
  const [ammontare, setAmmontare] = useState<string>("");
  const [residuo, setResiduo] = useState<string>("");
  const [descrizione, setDescrizione] = useState<string>("");
  const [contoId, setContoId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (debito) {
        setNome(debito.nome);
        setAmmontare(debito.ammontare.toString());
        setResiduo(debito.residuo !== null ? debito.residuo.toString() : "");
        setDescrizione(debito.descrizione || "");
        setContoId(debito.conto_id || null);
      } else {
        setNome("");
        setAmmontare("");
        setResiduo("");
        setDescrizione("");
        setContoId(null);
      }
    }
  }, [visible, debito]);

  const handleNumberChange = (
    value: string,
    setter: (value: string) => void,
  ) => {
    const cleaned = value.replace(",", ".");
    if (cleaned === "" || /^\d*\.?\d{0,2}$/.test(cleaned)) {
      setter(cleaned);
    }
  };

  const handleConfirm = async () => {
    if (!nome.trim() || ammontare.trim() === "") return;

    const payload = {
      nome: nome.trim(),
      ammontare: parseFloat(ammontare),
      residuo: residuo.trim() === "" ? undefined : parseFloat(residuo),
      descrizione: descrizione.trim() || undefined,
      conto_id: contoId || undefined,
    };

    try {
      if (debito?.id) {
        await dispatch(updateDebito({ id: debito.id, ...payload })).unwrap();
      } else {
        await dispatch(createDebito(payload)).unwrap();
      }
      onSaved?.();
      onHide();
    } catch {
      // Error state is handled by middleware
    }
  };

  return (
    <Dialog
      header={debito ? t("edit_debt") : t("new_debt")}
      visible={visible}
      className="dialog-custom debito-dialog"
      style={{ width: "95vw", maxWidth: "40rem" }}
      onHide={onHide}
      blockScroll
      footer={
        <div className="buttons-footer-dialog">
          <Button
            label={t("cancel")}
            className="reset-button"
            onClick={onHide}
          />
          <Button
            className="action-button"
            label={debito ? t("save_changes") : t("save")}
            onClick={handleConfirm}
            loading={loading}
            disabled={!nome.trim() || ammontare.trim() === ""}
          />
        </div>
      }
      draggable={false}
      resizable={false}
    >
      <div className="debito-form">
        <div className="form-row">
          <InputText
            label={t("debt_name")}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("name")}
            autoFocus
          />
        </div>

        <div className="form-row">
          <InputText
            label={t("debt_amount")}
            value={ammontare}
            onChange={(e) => handleNumberChange(e.target.value, setAmmontare)}
            placeholder={t("debt_amount_placeholder")}
            icon="ph-bold ph-currency-eur"
            iconPos="right"
            keyfilter={/^\d*[.,]?\d{0,2}$/}
            inputMode="decimal"
          />
        </div>

        <div className="form-row">
          <InputText
            label={t("debt_residual")}
            value={residuo}
            onChange={(e) => handleNumberChange(e.target.value, setResiduo)}
            placeholder={t("debt_residual_placeholder")}
            icon="ph-bold ph-currency-eur"
            iconPos="right"
            keyfilter={/^\d*[.,]?\d{0,2}$/}
            inputMode="decimal"
          />
        </div>

        <div className="form-row">
          <InputText
            label={t("debt_description")}
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder={t("description_placeholder")}
          />
        </div>

        <div className="form-row">
          <Dropdown
            label={t("debt_account")}
            value={contoId}
            onChange={(e) => setContoId(e.value as string | null)}
            options={conti.map((conto) => ({
              label: conto.nome,
              value: conto.id,
            }))}
            optionLabel="label"
            optionValue="value"
            placeholder={t("bank_account_placeholder")}
          />
        </div>
      </div>
    </Dialog>
  );
}
