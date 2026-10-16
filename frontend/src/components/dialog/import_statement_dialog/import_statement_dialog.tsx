import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Checkbox } from "primereact/checkbox";
import Dropdown from "../../dropdown/dropdown";
import Calendar from "../../calendar/calendar";
import Button from "../../legacy_button/legacy_button";
import "./import_statement_dialog.scss";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { useI18n } from "../../../i18n/use-i18n";
import { selectContiConti } from "../../../features/conti/conto_slice";
import { getConti, importStatement } from "../../../features/conti/api_calls";
import { getPendingProposals } from "../../../features/bank_proposals/api_calls";

interface Props {
  visible: boolean;
  onHide: () => void;
  // Se aperto da un conto specifico, lo preselezioniamo.
  preselectedContoId?: string | null;
}

// Date -> "YYYY-MM-DD" in ora locale (niente shift di fuso).
const toApiDate = (d: Date | null): string | null => {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function ImportStatementDialog({
  visible,
  onHide,
  preselectedContoId,
}: Props) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const conti = useAppSelector(selectContiConti);

  const [contoId, setContoId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dataDa, setDataDa] = useState<Date | null>(null);
  const [dataA, setDataA] = useState<Date | null>(null);
  const [balanceColumn, setBalanceColumn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset del form ad ogni apertura.
  useEffect(() => {
    if (visible) {
      setContoId(preselectedContoId ?? null);
      setFile(null);
      setDataDa(null);
      setDataA(null);
      setBalanceColumn(false);
      setMessage(null);
      setIsError(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [visible, preselectedContoId]);

  const canSubmit = useMemo(
    () => !!contoId && !!file && !loading,
    [contoId, file, loading],
  );

  // Il flag "colonna saldo" ha senso solo per il PDF (parser euristico).
  const isPdf = useMemo(
    () => (file ? file.name.toLowerCase().endsWith(".pdf") : false),
    [file],
  );

  const handleImport = async () => {
    if (!contoId || !file) return;
    setLoading(true);
    setMessage(null);
    setIsError(false);
    try {
      const res = await dispatch(
        importStatement({
          conto_id: contoId,
          file,
          data_da: toApiDate(dataDa),
          data_a: toApiDate(dataA),
          balance_column: isPdf ? balanceColumn : false,
        }),
      ).unwrap();

      if (res.new_proposals > 0) {
        // Le nuove proposte fanno aprire in automatico il dialog di review.
        await dispatch(getPendingProposals());
        dispatch(getConti());
        onHide();
      } else if (res.parsed === 0) {
        // Parser locale: nessuna riga riconosciuta (layout non gestito).
        setIsError(true);
        setMessage(t("statement_import_none"));
      } else {
        setMessage(
          t("statement_import_all_duplicates").replace(
            "{count}",
            String(res.parsed),
          ),
        );
      }
    } catch {
      // Gli errori di rete/parse sono già gestiti dall'errorMiddleware.
      setIsError(true);
      setMessage(t("statement_import_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      header={t("import_statement_title")}
      visible={visible}
      onHide={onHide}
      className="dialog-custom import-statement-dialog"
      style={{ width: "95vw", maxWidth: "40rem" }}
      blockScroll
      draggable={false}
      resizable={false}
      footer={
        <div className="buttons-footer-dialog">
          <Button
            label={t("cancel")}
            className="reset-button"
            onClick={onHide}
          />
          <Button
            className="action-button"
            icon="ph-bold ph-upload-simple"
            iconPos="left"
            label={t("import")}
            onClick={handleImport}
            loading={loading}
            disabled={!canSubmit}
          />
        </div>
      }
    >
      <div className="import-statement-content">
        <p className="import-statement-subtitle">
          {t("import_statement_subtitle")}
        </p>

        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("bank_account")}
              value={contoId}
              options={conti}
              optionLabel="nome"
              optionValue="id"
              onChange={(e: any) => setContoId(e.value)}
              placeholder={t("bank_account_placeholder")}
              showClear={false}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label className="field-label">{t("statement_file")}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              className="import-statement-file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="import-statement-hint">
              {t("statement_file_hint")}
            </span>
          </div>
        </div>

        <div className="form-row two-cols">
          <div className="field">
            <Calendar
              label={t("date_from")}
              value={dataDa}
              onChange={(e) => setDataDa((e.value as Date) ?? null)}
              showIcon
              showButtonBar
            />
          </div>
          <div className="field">
            <Calendar
              label={t("date_to")}
              value={dataA}
              onChange={(e) => setDataA((e.value as Date) ?? null)}
              showIcon
              showButtonBar
            />
          </div>
        </div>

        {isPdf && (
          <div className="form-row">
            <div className="field import-statement-checkbox">
              <Checkbox
                inputId="balance_column"
                checked={balanceColumn}
                onChange={(e) => setBalanceColumn(!!e.checked)}
              />
              <label htmlFor="balance_column">
                {t("statement_has_balance_column")}
              </label>
            </div>
          </div>
        )}

        {message && (
          <div
            className={`import-statement-message ${isError ? "is-error" : ""}`}
          >
            {message}
          </div>
        )}
      </div>
    </Dialog>
  );
}
