import React, { useState, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import { confirmPopup } from "primereact/confirmpopup";
import InputText from "../../input_text/input_text";
import Switch from "../../switch/switch";
import Button from "../../legacy_button/legacy_button";
import { Categoria } from "../../../features/categorie/interfaces";
import "./category_dialog.scss";
import { useAppDispatch } from "../../../store/store";
import {
  createCategoria,
  updateCategoria,
  updateSottoCategoria,
  createSottoCategorie,
  deleteSottoCategoria,
} from "../../../features/categorie/api_calls";
import { useI18n } from "../../../i18n/use-i18n";

interface CategoryDialogProps {
  visible: boolean;
  onHide: () => void;
  category?: Categoria | null;
  loading?: boolean;
}

interface SubState {
  id?: string;
  nome: string;
  solo_entrata: boolean;
  solo_uscita: boolean;
}

export default function CategoryDialog({
  visible,
  onHide,
  category,
  loading: externalLoading,
}: CategoryDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const [nome, setNome] = useState("");
  const [isCatSoloUscita, setIsCatSoloUscita] = useState(true);
  const [isCatSoloEntrata, setIsCatSoloEntrata] = useState(true);
  // Il budget resta una stringa mentre si scrive: "" è "nessun budget", e
  // convertirlo a ogni battuta trasformerebbe il campo vuoto in uno zero.
  const [budget, setBudget] = useState("");
  const [subs, setSubs] = useState<SubState[]>([]);
  const [subsToDelete, setSubsToDelete] = useState<string[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  // 1. POPOLAMENTO DATI (EDIT vs CREATE)
  useEffect(() => {
    if (visible) {
      if (category) {
        setNome(category.nome);
        setIsCatSoloEntrata(category.solo_entrata);
        setIsCatSoloUscita(category.solo_uscita);
        setBudget(
          category.budget_mensile === null ? "" : String(category.budget_mensile),
        );
        setSubs(
          category.sottocategorie?.map((s) => ({
            id: s.id,
            nome: s.nome,
            solo_entrata: s.solo_entrata,
            solo_uscita: s.solo_uscita,
          })) || [],
        );
      } else {
        setNome("");
        setIsCatSoloEntrata(true);
        setIsCatSoloUscita(true);
        setBudget("");
        setSubs([]);
      }
      setSubsToDelete([]);
    }
  }, [visible, category]);

  // 2. LOGICA DI EREDITARIETÀ: Se la madre cambia, le sub si adeguano
  useEffect(() => {
    setSubs((prevSubs) =>
      prevSubs.map((sub) => ({
        ...sub,
        solo_entrata: isCatSoloEntrata ? sub.solo_entrata : false,
        solo_uscita: isCatSoloUscita ? sub.solo_uscita : false,
      })),
    );
  }, [isCatSoloEntrata, isCatSoloUscita]);

  const handleAddSub = () => {
    setSubs([
      ...subs,
      {
        nome: "",
        solo_entrata: isCatSoloEntrata,
        solo_uscita: isCatSoloUscita,
      },
    ]);
  };

  const handleSubChange = ({
    index,
    text,
    solo_entrata,
    solo_uscita,
  }: {
    index: number;
    text?: string;
    solo_entrata?: boolean;
    solo_uscita?: boolean;
  }) => {
    setSubs((prevSubs) => {
      const newSubs = [...prevSubs];
      const currentSub = { ...newSubs[index] };

      if (text !== undefined) currentSub.nome = text;

      if (solo_entrata !== undefined) {
        currentSub.solo_entrata = isCatSoloEntrata ? solo_entrata : false;
      }

      if (solo_uscita !== undefined) {
        currentSub.solo_uscita = isCatSoloUscita ? solo_uscita : false;
      }

      newSubs[index] = currentSub;
      return newSubs;
    });
  };

  const handleRemoveSub = (
    event: React.MouseEvent<unknown>,
    index: number,
  ) => {
    const subToRemove = subs[index];

    const removeSub = () => {
      if (subToRemove.id) {
        setSubsToDelete((prev) => [...prev, subToRemove.id!]);
      }
      setSubs((prev) => prev.filter((_, i) => i !== index));
    };

    // Chiedi conferma solo per le sottocategorie già salvate; per una riga
    // appena aggiunta (senza id) rimuoviamo direttamente.
    if (subToRemove.id) {
      confirmPopup({
        target: event.currentTarget as HTMLElement,
        message: t("delete_message"),
        icon: "ph-bold ph-warning",
        acceptClassName: "p-button-danger",
        acceptLabel: t("yes"),
        rejectLabel: t("no"),
        accept: removeSub,
        reject: () => {},
      });
    } else {
      removeSub();
    }
  };

  const handleConfirm = async () => {
    if (!nome.trim()) return;
    setInternalLoading(true);

    try {
      let currentCatId = category?.id;

      // Campo vuoto vuol dire "nessun budget": `null` lo toglie, e il BE lo
      // distingue da "non l'ho toccato" perché la chiave c'è comunque.
      //
      // Su una categoria che non è di uscita il campo non si vede nemmeno: un
      // tetto di spesa non le si applica, e lasciarci quello di prima
      // vorrebbe dire mandare un valore che la schermata dichiara di non
      // avere. Un numero che non si legge diventa `null` per lo stesso motivo
      // per cui `NaN` non deve mai arrivare al BE: `JSON.stringify` lo
      // scriverebbe `null`, cioè cancellerebbe il budget in silenzio.
      const scritto = Number(budget.replace(",", "."));
      const budgetValue =
        !isCatSoloUscita || budget.trim() === "" || !Number.isFinite(scritto)
          ? null
          : scritto;

      // GESTIONE CATEGORIA PADRE
      if (!currentCatId) {
        const newCat = await dispatch(
          createCategoria({
            nome: nome.trim(),
            solo_entrata: isCatSoloEntrata,
            solo_uscita: isCatSoloUscita,
            budget_mensile: budgetValue,
          }),
        ).unwrap();
        currentCatId = newCat.id;
      } else {
        // Aggiorniamo sempre i permessi e il nome se necessario
        await dispatch(
          updateCategoria({
            id: currentCatId,
            nome: nome.trim(),
            solo_entrata: isCatSoloEntrata,
            solo_uscita: isCatSoloUscita,
            budget_mensile: budgetValue,
          }),
        ).unwrap();
      }

      const promises: Promise<any>[] = [];

      // Eliminazione sottocategorie
      subsToDelete.forEach((subId) => {
        promises.push(
          dispatch(
            deleteSottoCategoria({ catId: currentCatId!, subId }),
          ).unwrap(),
        );
      });

      // Aggiornamento sottocategorie esistenti
      subs.forEach((sub) => {
        if (sub.id) {
          promises.push(
            dispatch(
              updateSottoCategoria({
                id: sub.id,
                nome: sub.nome.trim(),
                solo_entrata: sub.solo_entrata,
                solo_uscita: sub.solo_uscita,
              }),
            ).unwrap(),
          );
        }
      });

      // Creazione nuove sottocategorie
      const newSubsToCreate = subs
        .filter((s) => !s.id && s.nome.trim() !== "")
        .map((s) => ({
          nome: s.nome.trim(),
          solo_entrata: s.solo_entrata,
          solo_uscita: s.solo_uscita,
        }));

      if (newSubsToCreate.length > 0) {
        promises.push(
          dispatch(
            createSottoCategorie({
              id: currentCatId!,
              subList: newSubsToCreate,
            }),
          ).unwrap(),
        );
      }

      if (promises.length > 0) await Promise.all(promises);
      onHide();
    } catch (error) {
      console.error("Error saving category/subs:", error);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Dialog
      header={
        category ? t("edit_category") : `${t("create_new_f")} ${t("category")}`
      }
      visible={visible}
      className="dialog-custom category-dialog"
      style={{ width: "95vw", maxWidth: "40rem" }}
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
            label={category ? t("save_changes") : t("save")}
            onClick={handleConfirm}
            loading={externalLoading || internalLoading}
            disabled={!nome.trim()}
          />
        </div>
      }
      draggable={false}
      resizable={false}
      closable={false}
    >
      <div className="category-settings-dialog-content">
        <div className="main-category-section">
          <InputText
            label={t("category_name")}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("ex_grocery")}
            autoFocus
          />
          <div className="cat_choises">
            <Switch
              label={t("income")}
              checked={isCatSoloEntrata}
              onChange={(e) => setIsCatSoloEntrata(e.value)}
            />
            <Switch
              label={t("expenses")}
              checked={isCatSoloUscita}
              onChange={(e) => setIsCatSoloUscita(e.value)}
            />
          </div>

          {/* Il budget ha senso solo dove si spende: su una categoria di sole
              entrate un tetto di spesa non vorrebbe dire niente. */}
          {isCatSoloUscita && (
            <div className="cat_budget">
              <InputText
                label={t("category_budget")}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder={t("category_budget_placeholder")}
                inputMode="decimal"
                keyfilter={/^\d*[.,]?\d{0,2}$/}
              />
              <span className="cat_budget__hint">
                {t("category_budget_hint")}
              </span>
            </div>
          )}
        </div>

        <div className="subcategories-section">
          <div className="section-header">
            <span>{t("sub_categories")}</span>
          </div>

          <div className="subs-list">
            {subs.length === 0 && (
              <p className="empty-subs">{t("no_sub_categories")}</p>
            )}

            {subs.map((sub, index) => (
              <div key={index} className="sub-input-group">
                <InputText
                  value={sub.nome}
                  onChange={(e) =>
                    handleSubChange({ index, text: e.target.value })
                  }
                  placeholder={t("name_sub_categories")}
                />
                <div className="sub_choises">
                  <Switch
                    label={t("income")}
                    checked={sub.solo_entrata}
                    disabled={!isCatSoloEntrata}
                    onChange={(e) =>
                      handleSubChange({ index, solo_entrata: e.value })
                    }
                  />
                  <Switch
                    label={t("expenses")}
                    checked={sub.solo_uscita}
                    disabled={!isCatSoloUscita}
                    onChange={(e) =>
                      handleSubChange({ index, solo_uscita: e.value })
                    }
                  />
                </div>
                <Button
                  icon="ph-bold ph-trash"
                  className="trasparent-danger-button"
                  onClick={(e) => handleRemoveSub(e, index)}
                  compact
                  rounded
                />
              </div>
            ))}

            <Button
              icon="ph-bold ph-plus"
              className="action-button icon-button"
              onClick={handleAddSub}
              compact
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
