import React, { useState, useMemo, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import Button from "../../legacy_button/legacy_button";
import Dropdown from "../../dropdown/dropdown";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import { selectTagTags } from "../../../features/tags/tag_slice";
import { MigrateTagAction } from "../../../features/categorie/interfaces";
import { showToast } from "../../../features/ui/ui_slice";
import { migrateTransactions } from "../../../features/categorie/api_calls";
import { useI18n } from "../../../i18n/use-i18n";
import { getTransactionsPaginated } from "../../../features/transactions/api_calls";
import "./migrate_transactions_dialog.scss";

interface MigrateTransactionsDialogProps {
  visible: boolean;
  onHide: () => void;
}

export default function MigrateTransactionsDialog({
  visible,
  onHide,
}: MigrateTransactionsDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const categorie = useAppSelector(selectCategoriaCategorie);
  const tags = useAppSelector(selectTagTags);

  const [oldCategoriaId, setOldCategoriaId] = useState<string | null>(null);
  const [oldSottoCategoriaId, setOldSottoCategoriaId] = useState<string | null>(
    null,
  );
  const [newCategoriaId, setNewCategoriaId] = useState<string | null>(null);
  const [newSottoCategoriaId, setNewSottoCategoriaId] = useState<string | null>(
    null,
  );
  // Vincolo sul tag: l'origine si può restringere a un tag, e la destinazione
  // decide se il tag dei movimenti spostati resta, cambia o se ne va.
  const [oldTagId, setOldTagId] = useState<string | null>(null);
  const [tagAction, setTagAction] = useState<MigrateTagAction>("keep");
  const [newTagId, setNewTagId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setOldCategoriaId(null);
      setOldSottoCategoriaId(null);
      setNewCategoriaId(null);
      setNewSottoCategoriaId(null);
      setOldTagId(null);
      setTagAction("keep");
      setNewTagId(null);
    }
  }, [visible]);

  const tagActionOptions = [
    { label: t("migrate_tag_keep"), value: "keep" },
    { label: t("migrate_tag_set"), value: "set" },
    { label: t("migrate_tag_clear"), value: "clear" },
  ];

  // Derivazione delle sottocategorie di origine
  const oldSottocategorie = useMemo(() => {
    const cat = categorie.find((c) => c.id === oldCategoriaId);
    return cat?.sottocategorie || [];
  }, [categorie, oldCategoriaId]);

  // Se cambio la categoria di origine, resetto la sottocategoria
  useEffect(() => {
    setOldSottoCategoriaId(null);
  }, [oldCategoriaId]);

  // Derivazione delle sottocategorie di destinazione
  const newSottocategorie = useMemo(() => {
    const cat = categorie.find((c) => c.id === newCategoriaId);
    return cat?.sottocategorie || [];
  }, [categorie, newCategoriaId]);

  // Se cambio la categoria di destinazione, resetto la sottocategoria
  useEffect(() => {
    setNewSottoCategoriaId(null);
  }, [newCategoriaId]);

  const handleMigrate = async () => {
    if (!oldCategoriaId || !newCategoriaId) return;
    if (tagAction === "set" && !newTagId) return;

    setLoading(true);
    try {
      const result = await dispatch(
        migrateTransactions({
          old_categoria_id: oldCategoriaId,
          old_sottocategoria_id: oldSottoCategoriaId || undefined,
          new_categoria_id: newCategoriaId,
          new_sottocategoria_id: newSottoCategoriaId || undefined,
          old_tag_id: oldTagId || undefined,
          tag_action: tagAction,
          new_tag_id: tagAction === "set" ? newTagId || undefined : undefined,
        }),
      ).unwrap();

      dispatch(
        showToast({
          variant: "success",
          title: t("migrate_done")
            .replace("{tx}", String(result.transazioni_aggiornate))
            .replace("{ric}", String(result.ricorrenze_aggiornate)),
        }),
      );

      // Aggiorniamo le transazioni per riflettere i cambiamenti se siamo in quella pagina
      // o comunque per tenere aggiornato lo store
      dispatch(getTransactionsPaginated({ page: 1, size: 12 }));

      onHide();
    } catch {
      // L'errore lo mostra il middleware; il dialog resta aperto con le scelte.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      header={t("migrate_transactions_title")}
      visible={visible}
      className="dialog-custom migrate-dialog"
      style={{ width: "95vw", maxWidth: "45rem" }}
      onHide={onHide}
      blockScroll={true}
      footer={
        <div className="dialog-footer">
          <Button
            label={t("cancel")}
            className="reset-button"
            onClick={onHide}
            disabled={loading}
          />
          <Button
            className="action-button"
            label={t("save_changes")}
            onClick={handleMigrate}
            loading={loading}
            disabled={
              !oldCategoriaId ||
              !newCategoriaId ||
              (tagAction === "set" && !newTagId)
            }
          />
        </div>
      }
      draggable={false}
      resizable={false}
    >
      <div className="migrate-form">
        <h3 className="section-title">{t("migrate_from")}</h3>
        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("source_category")}
              value={oldCategoriaId}
              options={categorie}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => setOldCategoriaId(e.value)}
              placeholder={t("category_placeholder")}
              showClear={false}
            />
          </div>
          <div className="field">
            <Dropdown
              label={t("source_subcategory")}
              value={oldSottoCategoriaId}
              options={oldSottocategorie}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => setOldSottoCategoriaId(e.value)}
              placeholder={t("sub_category_placeholder")}
              disabled={!oldCategoriaId}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("migrate_source_tag")}
              value={oldTagId}
              options={tags}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => setOldTagId(e.value ?? null)}
              placeholder={t("migrate_any_tag")}
            />
          </div>
        </div>

        <h3 className="section-title">{t("migrate_to")}</h3>
        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("destination_category")}
              value={newCategoriaId}
              options={categorie}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => setNewCategoriaId(e.value)}
              placeholder={t("category_placeholder")}
              showClear={false}
            />
          </div>
          <div className="field">
            <Dropdown
              label={t("destination_subcategory")}
              value={newSottoCategoriaId}
              options={newSottocategorie}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => setNewSottoCategoriaId(e.value)}
              placeholder={t("sub_category_placeholder")}
              disabled={!newCategoriaId}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <Dropdown
              label={t("migrate_tag_action")}
              value={tagAction}
              options={tagActionOptions}
              onChange={(e) => {
                setTagAction(e.value);
                if (e.value !== "set") setNewTagId(null);
              }}
              placeholder={t("migrate_tag_keep")}
              showClear={false}
            />
          </div>
          {tagAction === "set" && (
            <div className="field">
              <Dropdown
                label={t("migrate_destination_tag")}
                value={newTagId}
                options={tags}
                optionLabel="nome"
                optionValue="id"
                onChange={(e) => setNewTagId(e.value ?? null)}
                placeholder={t("tag_placeholder")}
              />
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
