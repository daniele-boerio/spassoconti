import { useState, useEffect, useMemo } from "react";
import { Dialog } from "primereact/dialog";
import { SelectButton } from "primereact/selectbutton";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import Dropdown from "../../dropdown/dropdown";
import Switch from "../../switch/switch"; // Importato il tuo componente Switch
import { useAppDispatch, useAppSelector } from "../../../store/store";
import "./recurrence_dialog.scss";
import { tipoTransaction } from "../../../features/transactions/interfaces";
import { useI18n } from "../../../i18n/use-i18n";
import Calendar from "../../calendar/calendar";
import {
  createCategoria,
  createSottoCategorie,
} from "../../../features/categorie/api_calls";
import { createTag } from "../../../features/tags/api_calls";
import { selectContiConti } from "../../../features/conti/conto_slice";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import { selectTagTags } from "../../../features/tags/tag_slice";
import { Recurring } from "../../../features/recurrings/interfaces";
import {
  createRecurring,
  updateRecurring,
} from "../../../features/recurrings/api_calls";
import { getDebiti } from "../../../features/debiti/api_calls";
import { selectDebitiDebiti } from "../../../features/debiti/debito_slice";

/** Come finisce una ricorrenza: mai, a una data, dopo un numero di rate. */
type EndMode = "MAI" | "DATA" | "RATE";

// Date LOCALI: toISOString() passa per UTC e in Italia anticiperebbe di un giorno.
const toLocalIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const fromLocalIso = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Valori con cui aprire il form in creazione. Li passa il foglio "Nuova
 * transazione" quando si tocca "Rendi ricorrente": la ricorrenza nasce dai
 * dati già scritti lì, non da un form vuoto.
 */
export interface RecurrenceDefaults {
  nome?: string;
  importo?: string;
  tipo?: tipoTransaction;
  conto_id?: string | null;
  categoria_id?: string | null;
  sottocategoria_id?: string | null;
  tag_id?: string | null;
  prossima_esecuzione?: Date | null;
}

interface RecurrenceDialogProps {
  visible: boolean;
  onHide: () => void;
  recurring?: Recurring;
  defaults?: RecurrenceDefaults;
}

export default function RecurrenceDialog({
  visible,
  onHide,
  recurring,
  defaults,
}: RecurrenceDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const conti = useAppSelector(selectContiConti);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const tags = useAppSelector(selectTagTags);
  const debiti = useAppSelector(selectDebitiDebiti);

  const [nome, setNome] = useState<string>("");
  const [tipo, setTipo] = useState<tipoTransaction>("USCITA");
  const [importo, setImporto] = useState<string>("");
  const [frequenza, setFrequenza] = useState<string>("MENSILE");
  const [prossimaEsecuzione, setProssimaEsecuzione] = useState<Date>(
    new Date(),
  );
  const [attiva, setAttiva] = useState<boolean>(true);
  const [contoId, setContoId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [sottoCategoriaId, setSottoCategoriaId] = useState<string | null>(null);
  const [newSubCategoryName, setNewSubCategoryName] = useState<string>("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState<string>("");
  const [endMode, setEndMode] = useState<EndMode>("MAI");
  const [dataFine, setDataFine] = useState<Date | null>(null);
  const [rate, setRate] = useState<string>("");
  const [importoVariabile, setImportoVariabile] = useState<boolean>(false);
  const [debitoId, setDebitoId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // La lista dei debiti serve al menu "Rata di un debito": la pagina
  // Ricorrenze di suo non la carica.
  useEffect(() => {
    if (visible && debiti.length === 0) dispatch(getDebiti());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (recurring) {
        setNome(recurring.nome);
        setImporto(recurring.importo.toString());
        setTipo(recurring.tipo);
        setFrequenza(recurring.frequenza);
        // Parse come data LOCALE (YYYY-MM-DD) per evitare lo shift di fuso
        {
          const [y, m, d] = recurring.prossima_esecuzione
            .split("-")
            .map(Number);
          setProssimaEsecuzione(new Date(y, m - 1, d));
        }
        setAttiva(recurring.attiva);
        setContoId(recurring.conto_id);
        setCategoriaId(recurring.categoria_id);
        setSottoCategoriaId(recurring.sottocategoria_id);
        setTagId(recurring.tag_id);
        setDataFine(
          recurring.data_fine ? fromLocalIso(recurring.data_fine) : null,
        );
        const rateLeft = recurring.rate_rimanenti ?? null;
        setRate(rateLeft !== null ? String(rateLeft) : "");
        setEndMode(
          recurring.data_fine ? "DATA" : rateLeft !== null ? "RATE" : "MAI",
        );
        setImportoVariabile(Boolean(recurring.importo_variabile));
        setDebitoId(recurring.debito_id ?? null);
      } else {
        setNome(defaults?.nome ?? "");
        setImporto(defaults?.importo ?? "");
        setTipo(defaults?.tipo ?? "USCITA");
        setFrequenza("MENSILE");
        setProssimaEsecuzione(defaults?.prossima_esecuzione ?? new Date());
        setAttiva(true);
        setContoId(defaults?.conto_id ?? null);
        setCategoriaId(defaults?.categoria_id ?? null);
        setSottoCategoriaId(defaults?.sottocategoria_id ?? null);
        setTagId(defaults?.tag_id ?? null);
        setNewCategoryName("");
        setNewSubCategoryName("");
        setNewTagName("");
        setEndMode("MAI");
        setDataFine(null);
        setRate("");
        setImportoVariabile(false);
        setDebitoId(null);
      }
    }
    // `defaults` è un oggetto ricreato a ogni render del form chiamante:
    // metterlo fra le dipendenze ripulirebbe questo form a ogni battuta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, recurring]);

  const categorieFiltrate = useMemo(() => {
    if (!categorie) return [];

    return categorie.filter((cat) => {
      if (tipo === "ENTRATA") {
        return cat.solo_entrata === true;
      }
      if (tipo === "USCITA") {
        return cat.solo_uscita === true;
      }
      return true; // Caso di fallback se tipo non è ancora definito
    });
  }, [categorie, tipo]);

  const categorieOptions = useMemo(() => {
    return [
      ...categorieFiltrate,
      {
        id: "NEW_CATEGORY",
        nome: `+ ${t("add_new_category")}`,
      },
    ];
  }, [categorieFiltrate, t]);

  const filteredSottoCategorie = useMemo(() => {
    const cat = categorie.find((c) => c.id === categoriaId);
    if (!cat || !cat.sottocategorie) return [];

    return cat.sottocategorie.filter((sub) => {
      if (tipo === "ENTRATA") return sub.solo_entrata === true;
      if (tipo === "USCITA") return sub.solo_uscita === true;
      return true;
    });
  }, [categoriaId, categorie, tipo]);

  const sottocategorieOptions = useMemo(() => {
    return [
      ...filteredSottoCategorie,
      {
        id: "NEW_SUBCATEGORY",
        nome: `+ ${t("add_new_subcategory")}`,
      },
    ];
  }, [filteredSottoCategorie, t]);

  const tagOptions = useMemo(() => {
    return [
      ...tags,
      {
        id: "NEW_TAG",
        nome: `+ ${t("add_new_tag")}`,
      },
    ];
  }, [tags, t]);

  const handleSave = async () => {
    // Niente doppio invio: con la rete lenta un secondo tocco creava due
    // ricorrenze identiche.
    if (saving) return;
    setSaving(true);

    try {
      await save();
      onHide();
    } catch {
      // L'errore lo mostra il middleware; il form resta aperto con i dati.
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const formattedDate = toLocalIso(prossimaEsecuzione);
    const numericImporto = parseFloat(importo);
    const numericRate = parseInt(rate, 10);

    let finalTagId = tagId === "NEW_TAG" ? newTagName : tagId;
    let finalCategoriaId =
      categoriaId === "NEW_CATEGORY" ? newCategoryName : categoriaId;
    let finalSottoCategoriaId =
      sottoCategoriaId === "NEW_SUBCATEGORY"
        ? newSubCategoryName
        : sottoCategoriaId;

    // --- 1. CONTROLLO E CREAZIONE TAG ---
    if (finalTagId) {
      const tagExists = tags.find(
        (t) =>
          String(t.id) === String(finalTagId) ||
          t.nome.toLowerCase() === String(finalTagId).toLowerCase(),
      );
      if (tagExists) {
        finalTagId = tagExists.id;
      } else {
        const newTag = await dispatch(
          createTag({ nome: String(finalTagId) }),
        ).unwrap();
        finalTagId = newTag.id;
      }
    }

    // --- 2. CONTROLLO E CREAZIONE CATEGORIA ---
    if (finalCategoriaId) {
      const catExists = categorie.find(
        (c) =>
          String(c.id) === String(finalCategoriaId) ||
          c.nome.toLowerCase() === String(finalCategoriaId).toLowerCase(),
      );
      if (catExists) {
        finalCategoriaId = catExists.id;
      } else {
        const newCat = await dispatch(
          createCategoria({
            nome: String(finalCategoriaId),
            solo_entrata: tipo === "ENTRATA" || tipo === "RIMBORSO",
            solo_uscita: tipo === "USCITA" || tipo === "RIMBORSO",
          }),
        ).unwrap();
        finalCategoriaId = newCat.id;
      }
    }

    // --- 3. CONTROLLO E CREAZIONE SOTTOCATEGORIA ---
    if (finalSottoCategoriaId && finalCategoriaId) {
      const parentCat = categorie.find(
        (c) => String(c.id) === String(finalCategoriaId),
      );
      const subExists = parentCat?.sottocategorie?.find(
        (s) =>
          String(s.id) === String(finalSottoCategoriaId) ||
          s.nome.toLowerCase() === String(finalSottoCategoriaId).toLowerCase(),
      );

      if (subExists) {
        finalSottoCategoriaId = subExists.id;
      } else {
        const createdSubs = await dispatch(
          createSottoCategorie({
            id: finalCategoriaId as string,
            subList: [
              {
                nome: String(finalSottoCategoriaId),
                solo_entrata: tipo === "ENTRATA" || tipo === "RIMBORSO",
                solo_uscita: tipo === "USCITA" || tipo === "RIMBORSO",
              },
            ],
          }),
        ).unwrap();
        finalSottoCategoriaId = createdSubs[0].id;
      }
    }

    // --- 4. PREPARAZIONE PAYLOAD E SALVATAGGIO ---
    const payload: any = {
      nome,
      importo: isNaN(numericImporto) ? 0 : numericImporto,
      tipo,
      frequenza,
      prossima_esecuzione: formattedDate,
      attiva,
      conto_id: contoId ?? "",
      categoria_id: finalCategoriaId,
      sottocategoria_id: finalSottoCategoriaId,
      tag_id: finalTagId,
      data_fine: endMode === "DATA" && dataFine ? toLocalIso(dataFine) : null,
      rate_rimanenti:
        endMode === "RATE" && !isNaN(numericRate) ? numericRate : null,
      importo_variabile: importoVariabile,
      debito_id: debitoId,
    };

    if (recurring?.id) {
      await dispatch(
        updateRecurring({ id: recurring.id, ...payload }),
      ).unwrap();
    } else {
      await dispatch(createRecurring(payload)).unwrap();
    }
  };

  const tipoOptions = [
    { label: t("income"), value: "ENTRATA" },
    { label: t("expenses"), value: "USCITA" },
    { label: t("compensation"), value: "RIMBORSO" },
  ];

  const frequenzaOptions = [
    { label: t("weekly"), value: "SETTIMANALE" },
    { label: t("monthly"), value: "MENSILE" },
    { label: t("yearly"), value: "ANNUALE" },
  ];

  const endModeOptions = [
    { label: t("recurrence_end_never"), value: "MAI" },
    { label: t("recurrence_end_date"), value: "DATA" },
    { label: t("recurrence_end_installments"), value: "RATE" },
  ];

  const handleImportoChange = (val: string) => {
    const cleanedValue = val.replace(",", ".");
    if (cleanedValue === "" || /^\d*\.?\d{0,2}$/.test(cleanedValue)) {
      setImporto(cleanedValue);
    }
  };

  return (
    <Dialog
      header={recurring ? t("edit_recurring") : t("new_recurring")}
      visible={visible}
      className="dialog-custom recurrence-dialog"
      style={{ width: "95vw", maxWidth: "45rem" }}
      onHide={onHide}
      blockScroll={true}
      footer={
        <div className="dialog-footer">
          <Button
            label={t("cancel")}
            className="reset-button"
            onClick={onHide}
          />
          <Button
            className="action-button"
            label={recurring ? t("save_changes") : t("save")}
            onClick={handleSave}
            disabled={
              saving ||
              !importo ||
              !contoId ||
              !nome.trim() ||
              (endMode === "DATA" && !dataFine) ||
              (endMode === "RATE" && !(parseInt(rate, 10) > 0))
            }
          />
        </div>
      }
    >
      <div className="recurrence-form">
        <div className="form-row">
          <SelectButton
            value={tipo}
            options={tipoOptions}
            onChange={(e) => setTipo(e.value || "USCITA")}
            className="type-selector"
          />
        </div>

        <div className="form-row">
          <div className="field">
            <InputText
              label={t("recurrence_name")}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={t("recurrence_name_placeholder")}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("active")}</label>
            <Switch checked={attiva} onChange={(e) => setAttiva(e.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <InputText
              value={importo}
              onChange={(e) => handleImportoChange(e.target.value)}
              label={t("amount")}
              icon="ph-bold ph-currency-eur"
              iconPos="right"
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
          <div className="field">
            <Calendar
              label={t("next_execution")}
              value={prossimaEsecuzione}
              onChange={(e) => setProssimaEsecuzione(e.value as Date)}
              showIcon
              minDate={new Date()}
              showButtonBar
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("frequency")}
              value={frequenza}
              options={frequenzaOptions}
              onChange={(e) => setFrequenza(e.value)}
              placeholder={t("select_frequency")}
              showClear={false}
            />
          </div>
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
        </div>

        {/* Fine della ricorrenza: abbonamenti annuali, rate di un finanziamento */}
        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("recurrence_end")}
              value={endMode}
              options={endModeOptions}
              onChange={(e) => setEndMode(e.value)}
              placeholder={t("recurrence_end")}
              showClear={false}
            />
          </div>
          <div className="field">
            {endMode === "DATA" && (
              <Calendar
                label={t("recurrence_end_date")}
                value={dataFine}
                onChange={(e) => setDataFine((e.value as Date) ?? null)}
                showIcon
                minDate={prossimaEsecuzione}
              />
            )}
            {endMode === "RATE" && (
              <InputText
                label={t("recurrence_installments_left")}
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="12"
              />
            )}
          </div>
        </div>

        {/* Rata di un debito: ogni esecuzione ne scala il residuo, e a debito
            estinto la ricorrenza si ferma. Importo variabile: bollette, che
            si registrano a mano con la cifra vera. */}
        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("recurrence_debt")}
              value={debitoId}
              options={debiti}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => setDebitoId(e.value ?? null)}
              placeholder={t("recurrence_debt_placeholder")}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("recurrence_variable")}</label>
            <Switch
              checked={importoVariabile}
              onChange={(e) => setImportoVariabile(Boolean(e.value))}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <div className="field-inline">
              <Dropdown
                label={t("category")}
                value={categoriaId}
                options={categorieOptions}
                optionLabel="nome"
                optionValue="id"
                onChange={(e) => setCategoriaId(e.value)}
                placeholder={t("category_placeholder")}
              />
              {categoriaId === "NEW_CATEGORY" && (
                <InputText
                  label={t("new_category_name")}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("ex_subscriptions")}
                  autoFocus
                />
              )}
            </div>
          </div>
          <div className="field">
            <div className="field-inline">
              <Dropdown
                label={t("sub_category")}
                value={sottoCategoriaId}
                options={sottocategorieOptions}
                optionLabel="nome"
                optionValue="id"
                onChange={(e) => setSottoCategoriaId(e.value)}
                placeholder={t("sub_category_placeholder")}
                disabled={!categoriaId}
              />
              {sottoCategoriaId === "NEW_SUBCATEGORY" && (
                <InputText
                  label={t("new_subcategory_name")}
                  value={newSubCategoryName}
                  onChange={(e) => setNewSubCategoryName(e.target.value)}
                  placeholder={t("ex_netflix")}
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>

        <div className="form-row">
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
      </div>
    </Dialog>
  );
}
