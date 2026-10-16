import { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import Calendar from "../../calendar/calendar";
import "./investimento_dialog.scss";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import {
  createInvestimento,
  updateInvestimento,
} from "../../../features/investimenti/api_calls";
import { selectInvestimentiLoading } from "../../../features/investimenti/investimento_slice";
import { useI18n } from "../../../i18n/use-i18n";
import { Investimento } from "../../../features/investimenti/interfaces";

interface InvestimentoDialogProps {
  visible: boolean;
  onHide: () => void;
  investimento?: Investimento | null;
  onSaved?: () => void;
}

export default function InvestimentoDialog({
  visible,
  onHide,
  investimento,
  onSaved,
}: InvestimentoDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectInvestimentiLoading);

  const isEdit = !!investimento;

  const [isin, setIsin] = useState("");
  const [ticker, setTicker] = useState("");
  const [nomeTitolo, setNomeTitolo] = useState("");
  // Solo creazione (operazione iniziale)
  const [quantita, setQuantita] = useState<string>("");
  const [prezzoCarico, setPrezzoCarico] = useState<string>("");
  const [data, setData] = useState<Date | null>(new Date());
  // Solo modifica (override prezzo attuale)
  const [prezzoAttuale, setPrezzoAttuale] = useState<string>("");

  useEffect(() => {
    if (!visible) return;
    if (investimento) {
      setIsin(investimento.isin || "");
      setTicker(investimento.ticker || "");
      setNomeTitolo(investimento.nome_titolo || "");
      setPrezzoAttuale(
        investimento.prezzo_attuale !== null &&
          investimento.prezzo_attuale !== undefined
          ? investimento.prezzo_attuale.toString()
          : "",
      );
      setQuantita("");
      setPrezzoCarico("");
      setData(new Date());
    } else {
      setIsin("");
      setTicker("");
      setNomeTitolo("");
      setQuantita("");
      setPrezzoCarico("");
      setData(new Date());
      setPrezzoAttuale("");
    }
  }, [visible, investimento]);

  const handleNumberChange = (
    value: string,
    setter: (value: string) => void,
  ) => {
    const cleaned = value.replace(",", ".");
    // Quote e prezzi: fino a 6 decimali (precisione titoli)
    if (cleaned === "" || /^\d*\.?\d{0,6}$/.test(cleaned)) {
      setter(cleaned);
    }
  };

  const formatDate = (d: Date | null) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : "";

  const createValid =
    isin.trim() !== "" &&
    nomeTitolo.trim() !== "" &&
    quantita.trim() !== "" &&
    prezzoCarico.trim() !== "" &&
    !!data;

  const editValid = isin.trim() !== "" && nomeTitolo.trim() !== "";

  const isValid = isEdit ? editValid : createValid;

  const handleConfirm = async () => {
    if (!isValid) return;

    try {
      if (isEdit && investimento) {
        await dispatch(
          updateInvestimento({
            id: investimento.id,
            isin: isin.trim(),
            ticker: ticker.trim() || undefined,
            nome_titolo: nomeTitolo.trim(),
            prezzo_attuale:
              prezzoAttuale.trim() === ""
                ? undefined
                : parseFloat(prezzoAttuale),
          }),
        ).unwrap();
      } else {
        await dispatch(
          createInvestimento({
            isin: isin.trim(),
            ticker: ticker.trim() || undefined,
            nome_titolo: nomeTitolo.trim(),
            quantita_iniziale: parseFloat(quantita),
            prezzo_carico_iniziale: parseFloat(prezzoCarico),
            data_iniziale: formatDate(data),
          }),
        ).unwrap();
      }
      onSaved?.();
      onHide();
    } catch {
      // Gli errori sono gestiti dal middleware
    }
  };

  return (
    <Dialog
      header={isEdit ? t("edit_investment") : t("new_investment")}
      visible={visible}
      className="dialog-custom investimento-dialog"
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
            label={isEdit ? t("save_changes") : t("save")}
            onClick={handleConfirm}
            loading={loading}
            disabled={!isValid}
          />
        </div>
      }
      draggable={false}
      resizable={false}
    >
      <div className="investimento-form">
        <div className="form-row two-cols">
          <InputText
            label={t("investment_name")}
            value={nomeTitolo}
            onChange={(e) => setNomeTitolo(e.target.value)}
            placeholder={t("investment_name_placeholder")}
            autoFocus
          />
          <InputText
            label={t("investment_ticker")}
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder={t("investment_ticker_placeholder")}
          />
        </div>

        <div className="form-row">
          <InputText
            label={t("investment_isin")}
            value={isin}
            onChange={(e) => setIsin(e.target.value)}
            placeholder={t("investment_isin_placeholder")}
          />
        </div>

        {!isEdit && (
          <>
            <div className="form-row two-cols">
              <InputText
                label={t("investment_initial_quantity")}
                value={quantita}
                onChange={(e) => handleNumberChange(e.target.value, setQuantita)}
                placeholder="0"
                inputMode="decimal"
                keyfilter={/^\d*[.,]?\d{0,6}$/}
              />
              <InputText
                label={t("investment_load_price")}
                value={prezzoCarico}
                onChange={(e) =>
                  handleNumberChange(e.target.value, setPrezzoCarico)
                }
                placeholder="0.00"
                icon="ph-bold ph-currency-eur"
                iconPos="right"
                inputMode="decimal"
                keyfilter={/^\d*[.,]?\d{0,6}$/}
              />
            </div>
            <div className="form-row">
              <Calendar
                label={t("investment_purchase_date")}
                value={data}
                onChange={(e) => setData(e.value as Date)}
                showIcon
                showButtonBar
              />
            </div>
          </>
        )}

        {isEdit && (
          <div className="form-row">
            <InputText
              label={t("investment_current_price_override")}
              value={prezzoAttuale}
              onChange={(e) =>
                handleNumberChange(e.target.value, setPrezzoAttuale)
              }
              placeholder="0.00"
              icon="ph-bold ph-currency-eur"
              iconPos="right"
              inputMode="decimal"
              keyfilter={/^\d*[.,]?\d{0,6}$/}
            />
            <small className="field-hint">
              {t("investment_current_price_hint")}
            </small>
          </div>
        )}
      </div>
    </Dialog>
  );
}
