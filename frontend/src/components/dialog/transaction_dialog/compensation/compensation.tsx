import { useState, useMemo, useRef, useEffect } from "react";
import Stepper from "../../../stepper/stepper";
import InputText from "../../../input_text/input_text";
import Button from "../../../legacy_button/legacy_button";
import Dropdown from "../../../dropdown/dropdown";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import "./compensation.scss";
import {
  getTransaction,
  getTransactionsByCategory,
} from "../../../../features/transactions/api_calls";
import { Transaction } from "../../../../features/transactions/interfaces";
import { useI18n } from "../../../../i18n/use-i18n";
import Calendar from "../../../calendar/calendar";
import { selectContiConti } from "../../../../features/conti/conto_slice";
import { selectCategoriaCategorie } from "../../../../features/categorie/categoria_slice";
import { selectTagTags } from "../../../../features/tags/tag_slice";

interface CompensationDialogProps {
  importo: string;
  setImporto: (val: string) => void;
  data: Date | null;
  setData: (val: Date | null) => void;
  contoId: string | null;
  setContoId: (val: string | null) => void;
  categoriaId: string | null;
  setCategoriaId: (val: string | null) => void;
  sottoCategoriaId: string | null;
  setSottoCategoriaId: (val: string | null) => void;
  tagId: string | null;
  setTagId: (val: string | null) => void;
  newTagName: string;
  setNewTagName: (val: string) => void;
  transactionId: string | null;
  setTransactionId: (val: string | null) => void;
  descrizione: string;
  setDescrizione: (val: string) => void;
  from_data: Date | null;
  setFromData: (val: Date | null) => void;
  to_data: Date | null;
  setToData: (val: Date | null) => void;
}

export default function Compensation({
  importo,
  setImporto,
  data,
  setData,
  contoId,
  setContoId,
  categoriaId,
  setCategoriaId,
  sottoCategoriaId,
  setSottoCategoriaId,
  tagId,
  setTagId,
  newTagName,
  setNewTagName,
  transactionId,
  setTransactionId,
  descrizione,
  setDescrizione,
  from_data,
  setFromData,
  to_data,
  setToData,
}: CompensationDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const stepperRef = useRef<any | null>(null);

  // Dati da store
  const conti = useAppSelector(selectContiConti);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const tags = useAppSelector(selectTagTags);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // La spesa già rimborsata, caricata una volta sola per id.
  const fetchedParentId = useRef<string | null>(null);

  // In modifica il padre è già scelto, ma la lista dei candidati è vuota finché
  // non si rifà il primo passo: il dropdown mostrava un campo bianco al posto
  // della spesa rimborsata, e non c'era modo di sapere a cosa fosse agganciato
  // il rimborso che si stava modificando. Lo carichiamo da solo.
  useEffect(() => {
    if (!transactionId) return;
    if (fetchedParentId.current === String(transactionId)) return;
    if (transactions.some((tx) => String(tx.id) === String(transactionId)))
      return;

    fetchedParentId.current = String(transactionId);

    dispatch(getTransaction({ id: String(transactionId) }))
      .unwrap()
      .then((parent) => setTransactions((prima) => [parent, ...prima]))
      // Il padre può non essere più raggiungibile (cancellato): la scelta resta
      // com'è, senza far saltare il form.
      .catch(() => {});
  }, [transactionId, transactions, dispatch]);

  const filteredSottoCategorie = useMemo(() => {
    const cat = categorie.find(
      (categoria) => String(categoria.id) === String(categoriaId),
    );
    return cat?.sottocategorie || [];
  }, [categoriaId, categorie]);

  const tagOptions = useMemo(() => {
    return [
      ...tags,
      {
        id: "NEW_TAG",
        nome: `+ ${t("add_new_tag")}`,
      },
    ];
  }, [tags, t]);

  // Creiamo le etichette formattate: Data - Importo - Descrizione
  const transactionOptions = useMemo(() => {
    return transactions.map((tx) => {
      // Formattiamo la data (es. 15/04/2024)
      const formattedDate = new Date(tx.data).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      // Formattiamo l'importo in Euro (es. 150,00 €)
      const formattedAmount = Number(tx.importo).toLocaleString("it-IT", {
        style: "currency",
        currency: "EUR",
      });

      // Gestiamo l'eventuale assenza di descrizione
      const desc = tx.descrizione ? tx.descrizione : t("no_description");

      return {
        ...tx,
        displayLabel: `${formattedDate} - ${formattedAmount} - ${desc}`,
      };
    });
  }, [transactions, t]);

  const handleFetchTransactionsAndNext = async () => {
    try {
      const res = await dispatch(
        getTransactionsByCategory({
          categoria_id: categoriaId ?? undefined,
          sottocategoria_id: sottoCategoriaId ?? undefined,
          data_inizio: from_data
            ? `${from_data.getFullYear()}-${String(from_data.getMonth() + 1).padStart(2, "0")}-${String(from_data.getDate()).padStart(2, "0")}`
            : undefined,
          data_fine: to_data
            ? `${to_data.getFullYear()}-${String(to_data.getMonth() + 1).padStart(2, "0")}-${String(to_data.getDate()).padStart(2, "0")}`
            : undefined,
          tipo: "USCITA",
        }),
      ).unwrap();
      setTransactions(res || []);
    } catch {
      setTransactions([]);
    } finally {
      stepperRef.current?.nextCallback();
    }
  };

  const handleImportoChange = (val: string) => {
    const cleanedValue = val.replace(",", ".");
    if (cleanedValue === "" || /^\d*\.?\d{0,2}$/.test(cleanedValue)) {
      setImporto(cleanedValue);
    }
  };

  return (
    <div className="compensation-form">
      {(() => {
        const panels = [
          {
            label: t("category_and_subcategory"),
            subLabel: "",
            content: (
              <>
                <div className="form-row">
                  <div className="field">
                    <Dropdown
                      label={t("category")}
                      value={categoriaId}
                      options={categorie}
                      optionLabel="nome"
                      optionValue="id"
                      onChange={(e) => setCategoriaId(e.value)}
                      placeholder={t("category_placeholder")}
                    />
                  </div>
                  <div className="field">
                    <Dropdown
                      label={t("sub_category")}
                      value={sottoCategoriaId}
                      options={filteredSottoCategorie}
                      optionLabel="nome"
                      optionValue="id"
                      onChange={(e) => setSottoCategoriaId(e.value)}
                      placeholder={t("sub_category_placeholder")}
                      disabled={!categoriaId}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <Calendar
                      label={t("from_date")}
                      value={from_data}
                      onChange={(e) => setFromData(e.value as Date)}
                      showIcon
                      showTime={false}
                      hourFormat="24"
                      showButtonBar
                    />
                  </div>
                  <div className="field">
                    <Calendar
                      label={t("to_date")}
                      value={to_data}
                      onChange={(e) => setToData(e.value as Date)}
                      showIcon
                      showTime={false}
                      hourFormat="24"
                      showButtonBar
                    />
                  </div>
                </div>
                <div className="buttons next">
                  <Button
                    className="action-button"
                    label={t("next")}
                    onClick={handleFetchTransactionsAndNext}
                  />
                </div>
              </>
            ),
          },
          {
            label: t("transaction_details"),
            subLabel: "",
            content: (
              <>
                <div className="form-row">
                  <div className="field">
                    <Dropdown
                      key={transactions.length}
                      label={t("transactions")}
                      value={transactionId}
                      options={transactionOptions}
                      optionLabel="displayLabel"
                      optionValue="id"
                      onChange={(e) => setTransactionId(e.value)}
                      placeholder={t("transaction_placeholder")}
                      showClear={false}
                    />
                  </div>
                </div>
                <div className="buttons">
                  <Button
                    className="reset-button"
                    label={t("previous")}
                    onClick={() => stepperRef.current?.prevCallback()}
                  />
                  <Button
                    className="action-button"
                    label={t("next")}
                    onClick={() => stepperRef.current?.nextCallback()}
                  />
                </div>
              </>
            ),
          },
          {
            label: t("basic_info"),
            subLabel: "",
            content: (
              <>
                <div className="form-row">
                  <div className="field">
                    <InputText
                      value={importo}
                      onChange={(e) => handleImportoChange(e.target.value)}
                      label={t("amount")}
                      icon="ph-bold ph-currency-eur"
                      iconPos="right"
                      keyfilter={/^\d*[.,]?\d{0,2}$/} // Filtro lato PrimeReact
                      inputMode="decimal" // Forza tastiera numerica con punto/virgola su mobile
                      placeholder="0.00"
                    />
                  </div>
                  <div className="field">
                    <Calendar
                      label={t("date")}
                      value={data}
                      onChange={(e) => setData(e.value as Date)}
                      showIcon
                      showTime={false}
                      hourFormat="24"
                      showButtonBar
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <Dropdown
                      label={t("bank_account")}
                      value={contoId}
                      options={conti}
                      optionLabel="nome"
                      optionValue="id"
                      onChange={(e) => setContoId(e.value)}
                      placeholder={t("bank_account_placeholder")}
                      showClear={false}
                    />
                  </div>
                  <div className="field">
                    <Dropdown
                      label={t("tag")}
                      value={tagId}
                      options={tagOptions}
                      optionLabel="nome"
                      optionValue="id"
                      onChange={(e) => setTagId(e.value)}
                      placeholder={t("tag_placeholder")}
                    />
                  </div>
                </div>
                {tagId === "NEW_TAG" && (
                  <div className="form-row">
                    <div className="field" style={{ width: "100%" }}>
                      <InputText
                        label={t("new_tag_name")}
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder={t("ex_corsica")}
                      />
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <div className="field">
                    <InputText
                      label={t("description")}
                      value={descrizione}
                      onChange={(e) => setDescrizione(e.target.value)}
                      placeholder={t("description_placeholder")}
                    />
                  </div>
                </div>
                <div className="buttons previous">
                  <Button
                    className="reset-button"
                    label={t("previous")}
                    onClick={() => stepperRef.current?.prevCallback()}
                  />
                </div>
              </>
            ),
          },
        ];

        return (
          <Stepper ref={stepperRef} panels={panels} orientation="vertical" />
        );
      })()}
    </div>
  );
}
