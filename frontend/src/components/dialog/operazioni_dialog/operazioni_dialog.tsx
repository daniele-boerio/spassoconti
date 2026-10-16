import { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import { SelectButton } from "primereact/selectbutton";
import { confirmPopup } from "primereact/confirmpopup";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import Calendar from "../../calendar/calendar";
import "./operazioni_dialog.scss";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import {
  createOperazione,
  deleteOperazione,
  getInvestimenti,
  updateOperazione,
} from "../../../features/investimenti/api_calls";
import { selectInvestimentiLoading } from "../../../features/investimenti/investimento_slice";
import { useI18n } from "../../../i18n/use-i18n";
import {
  Investimento,
  Operazione,
} from "../../../features/investimenti/interfaces";

interface OperazioniDialogProps {
  visible: boolean;
  onHide: () => void;
  investimento: Investimento | null;
}

type OpType = "BUY" | "SELL";

export default function OperazioniDialog({
  visible,
  onHide,
  investimento,
}: OperazioniDialogProps) {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectInvestimentiLoading);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<OpType>("BUY");
  const [quantita, setQuantita] = useState<string>("");
  const [prezzo, setPrezzo] = useState<string>("");
  const [data, setData] = useState<Date | null>(new Date());

  const resetForm = () => {
    setEditingId(null);
    setTipo("BUY");
    setQuantita("");
    setPrezzo("");
    setData(new Date());
  };

  useEffect(() => {
    if (visible) resetForm();
  }, [visible, investimento]);

  const handleNumberChange = (
    value: string,
    setter: (value: string) => void,
  ) => {
    const cleaned = value.replace(",", ".");
    if (cleaned === "" || /^\d*\.?\d{0,6}$/.test(cleaned)) {
      setter(cleaned);
    }
  };

  const formatDate = (d: Date | null) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : "";

  const tipoOptions = [
    { label: t("investment_buy"), value: "BUY" },
    { label: t("investment_sell"), value: "SELL" },
  ];

  const startEdit = (op: Operazione) => {
    setEditingId(op.id);
    setTipo(op.quantita < 0 ? "SELL" : "BUY");
    setQuantita(Math.abs(op.quantita).toString());
    setPrezzo(op.prezzo_unitario.toString());
    setData(op.data ? new Date(op.data) : new Date());
  };

  const isValid =
    !!investimento && quantita.trim() !== "" && prezzo.trim() !== "" && !!data;

  const handleSave = async () => {
    if (!isValid || !investimento) return;

    const qty = Math.abs(parseFloat(quantita));
    const signedQty = tipo === "SELL" ? -qty : qty;

    try {
      if (editingId) {
        await dispatch(
          updateOperazione({
            id: editingId,
            investimento_id: investimento.id,
            data: formatDate(data),
            quantita: signedQty,
            prezzo_unitario: parseFloat(prezzo),
          }),
        ).unwrap();
      } else {
        await dispatch(
          createOperazione({
            investimento_id: investimento.id,
            data: formatDate(data),
            quantita: signedQty,
            prezzo_unitario: parseFloat(prezzo),
          }),
        ).unwrap();
      }
      // Gli aggregati (quantità totale, prezzo medio) sono calcolati dal BE:
      // ricarichiamo per riflettere i nuovi valori.
      dispatch(getInvestimenti());
      resetForm();
    } catch {
      // Gestito dal middleware
    }
  };

  const handleDelete = (
    event: React.MouseEvent<HTMLButtonElement>,
    op: Operazione,
  ) => {
    if (!investimento) return;
    confirmPopup({
      target: event.currentTarget,
      message: t("delete_message"),
      icon: "ph-bold ph-warning",
      acceptClassName: "p-button-danger",
      acceptLabel: t("yes"),
      rejectLabel: t("no"),
      accept: async () => {
        try {
          await dispatch(
            deleteOperazione({ id: op.id, investimento_id: investimento.id }),
          ).unwrap();
          dispatch(getInvestimenti());
          if (editingId === op.id) resetForm();
        } catch {
          // Gestito dal middleware
        }
      },
    });
  };

  const storico = investimento?.storico
    ? [...investimento.storico].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
      )
    : [];

  const dateLocale = locale === "it" ? "it-IT" : "en-US";

  return (
    <Dialog
      header={`${t("investment_operations")}${
        investimento ? ` · ${investimento.nome_titolo}` : ""
      }`}
      visible={visible}
      className="dialog-custom operazioni-dialog"
      style={{ width: "95vw", maxWidth: "42rem" }}
      onHide={onHide}
      blockScroll
      draggable={false}
      resizable={false}
    >
      <div className="operazioni-content">
        {/* FORM AGGIUNTA / MODIFICA */}
        <div className="op-form">
          <SelectButton
            value={tipo}
            options={tipoOptions}
            onChange={(e) => e.value && setTipo(e.value)}
            className="op-type-selector"
          />

          <div className="op-form-row">
            <InputText
              label={t("investment_quantity")}
              value={quantita}
              onChange={(e) => handleNumberChange(e.target.value, setQuantita)}
              placeholder="0"
              inputMode="decimal"
              keyfilter={/^\d*[.,]?\d{0,6}$/}
            />
            <InputText
              label={t("investment_unit_price")}
              value={prezzo}
              onChange={(e) => handleNumberChange(e.target.value, setPrezzo)}
              placeholder="0.00"
              icon="ph-bold ph-currency-eur"
              iconPos="right"
              inputMode="decimal"
              keyfilter={/^\d*[.,]?\d{0,6}$/}
            />
            <Calendar
              label={t("date")}
              value={data}
              onChange={(e) => setData(e.value as Date)}
              showIcon
              showButtonBar
            />
          </div>

          <div className="op-form-actions">
            {editingId && (
              <Button
                label={t("cancel")}
                className="reset-button"
                onClick={resetForm}
              />
            )}
            <Button
              className="action-button"
              label={editingId ? t("save_changes") : t("add")}
              icon="ph-bold ph-plus"
              iconPos="left"
              onClick={handleSave}
              loading={loading}
              disabled={!isValid}
            />
          </div>
        </div>

        {/* LISTA STORICO */}
        <div className="op-list">
          {storico.length > 0 ? (
            storico.map((op) => {
              const isSell = op.quantita < 0;
              const controvalore = Math.abs(op.quantita) * op.prezzo_unitario;
              return (
                <div key={op.id} className="op-item">
                  <span
                    className={`op-badge ${isSell ? "sell" : "buy"}`}
                  >
                    {isSell ? t("investment_sell") : t("investment_buy")}
                  </span>
                  <div className="op-info">
                    <span className="op-main">
                      {Math.abs(op.quantita).toLocaleString(dateLocale)} ×{" "}
                      {op.prezzo_unitario.toLocaleString(dateLocale, {
                        minimumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                    <span className="op-sub">
                      {new Date(op.data).toLocaleDateString(dateLocale)} ·{" "}
                      {controvalore.toLocaleString(dateLocale, {
                        minimumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <div className="op-actions">
                    <Button
                      className="trasparent-button"
                      icon="ph-bold ph-pencil-simple"
                      compact
                      onClick={() => startEdit(op)}
                    />
                    <Button
                      className="trasparent-danger-button"
                      icon="ph-bold ph-trash"
                      compact
                      onClick={(event) =>
                        handleDelete(
                          event as React.MouseEvent<HTMLButtonElement>,
                          op,
                        )
                      }
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="no-data">{t("no_data")}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
