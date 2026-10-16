import { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import Calendar from "../../calendar/calendar";
import Dropdown from "../../dropdown/dropdown";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import "./pay_debito_dialog.scss";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { payDebito } from "../../../features/debiti/api_calls";
import { useI18n } from "../../../i18n/use-i18n";
import { Debito } from "../../../features/debiti/interfaces";
import { selectContiConti } from "../../../features/conti/conto_slice";

interface PayDebitoDialogProps {
  visible: boolean;
  onHide: () => void;
  loading?: boolean;
  debito?: Debito | null;
  onPaid?: () => void;
}

export default function PayDebitoDialog({
  visible,
  onHide,
  loading,
  debito,
  onPaid,
}: PayDebitoDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const conti = useAppSelector(selectContiConti);

  const [importo, setImporto] = useState<string>("");
  const [contoId, setContoId] = useState<string | null>(null);
  const [data, setData] = useState<Date | null>(new Date());
  const [descrizione, setDescrizione] = useState<string>("");

  useEffect(() => {
    if (visible && debito) {
      setImporto("");
      setContoId(debito.conto_id || null);
      setData(new Date());
      setDescrizione("");
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
    if (!debito || importo.trim() === "") return;

    try {
      await dispatch(
        payDebito({
          id: debito.id,
          importo: parseFloat(importo),
          conto_id: contoId || undefined,
          data: data ? data.toISOString().split("T")[0] : undefined,
          descrizione: descrizione.trim() || undefined,
        }),
      ).unwrap();
      onPaid?.();
      onHide();
    } catch {
      // handled by global middleware
    }
  };

  return (
    <Dialog
      header={t("pay_debt")}
      visible={visible}
      className="dialog-custom pay-debito-dialog"
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
            label={t("save")}
            onClick={handleConfirm}
            loading={loading}
            disabled={importo.trim() === ""}
          />
        </div>
      }
      draggable={false}
      resizable={false}
    >
      <div className="pay-debito-form">
        <div className="form-row">
          <InputText
            label={t("pay_amount")}
            value={importo}
            onChange={(e) => handleNumberChange(e.target.value, setImporto)}
            placeholder={t("debt_amount_placeholder")}
            icon="ph-bold ph-currency-eur"
            iconPos="right"
            keyfilter={/^\d*[.,]?\d{0,2}$/}
            inputMode="decimal"
          />
        </div>

        <div className="form-row">
          <Dropdown
            label={t("bank_account")}
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

        <div className="form-row">
          <Calendar
            label={t("pay_date")}
            value={data}
            onChange={(e) => setData(e.value as Date | null)}
          />
        </div>

        <div className="form-row">
          <InputText
            label={t("pay_description")}
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder={t("description_placeholder")}
          />
        </div>
      </div>
    </Dialog>
  );
}
