import React, { useState, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import InputText from "../../input_text/input_text";
import "./budget_settings_dialog.scss";
import { useAppSelector } from "../../../store/store";
import Button from "../../legacy_button/legacy_button";
import { useI18n } from "../../../i18n/use-i18n";
import { selectContiLoading } from "../../../features/conti/conto_slice";

// 1. Definiamo la struttura dei dati del budget
interface BudgetData {
  total_budget: number | null;
}

// 2. Definiamo le Props del componente
interface BudgetSettingsDialogProps {
  visible: boolean;
  onHide: () => void;
  initialData: BudgetData;
  onSave: (data: BudgetData) => Promise<void> | void;
}

export default function BudgetSettingsDialog({
  visible,
  onHide,
  initialData,
  onSave,
}: BudgetSettingsDialogProps) {
  const { t } = useI18n();
  // Prendiamo il loading dallo slice del profilo (o conto, a seconda di dove lo gestisci)
  const loading = useAppSelector(selectContiLoading);

  const [formData, setFormData] = useState({
    amount: initialData?.total_budget?.toString() || "",
  });

  // Sincronizziamo lo stato locale se initialData cambia (es. quando la dialog si riapre)
  useEffect(() => {
    setFormData({
      amount: initialData?.total_budget?.toString() || "",
    });
  }, [initialData]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Regex per accettare numeri con virgola o punto
    const validationRegex = /^[0-9]*[.,]?[0-9]*$/;
    if (validationRegex.test(val)) {
      setFormData({ ...formData, amount: val });
    }
  };

  const handleSave = () => {
    const dataToSave: BudgetData = {
      total_budget: formData.amount
        ? parseFloat(formData.amount.replace(",", "."))
        : null,
    };
    onSave(dataToSave);
  };

  return (
    <Dialog
      style={{ width: "90vw", maxWidth: "25rem" }}
      header={t("dialog_budget_title")}
      visible={visible}
      className="dialog-custom budget-settings-dialog"
      onHide={onHide}
      blockScroll={true}
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
            onClick={handleSave}
            loading={loading}
          />
        </div>
      }
      draggable={false}
      resizable={false}
      closable={false}
    >
      <div className="budget-settings-dialog-content">
        <InputText
          value={formData.amount}
          onChange={handleAmountChange}
          placeholder={t("dialog_budget_input_placeholder")}
          icon="ph-bold ph-currency-eur"
          iconPos="right"
          label={t("dialog_budget_input_label")}
          className="budget-settings-input"
        />
      </div>
    </Dialog>
  );
}
