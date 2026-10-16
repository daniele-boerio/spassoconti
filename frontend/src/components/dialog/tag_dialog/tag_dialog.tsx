import React, { useState, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import "./tag_dialog.scss"; // Puoi unificare i due SCSS in questo
import { useAppDispatch } from "../../../store/store";
import { createTag, updateTag } from "../../../features/tags/api_calls";
import { Tag } from "../../../features/tags/interfaces";
import { useI18n } from "../../../i18n/use-i18n";

interface TagDialogProps {
  visible: boolean;
  onHide: () => void;
  tag?: Tag | null; // Se presente, siamo in modalità Update
  loading?: boolean;
}

export default function TagDialog({
  visible,
  onHide,
  tag,
  loading: externalLoading,
}: TagDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const [nome, setNome] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);

  // Sincronizzazione dello stato all'apertura/chiusura
  useEffect(() => {
    if (visible) {
      if (tag) {
        setNome(tag.nome);
      } else {
        setNome("");
      }
    }
  }, [visible, tag]);

  const handleConfirm = async () => {
    const trimmedNome = nome.trim();
    if (!trimmedNome) return;

    // Se stiamo modificando e il nome è uguale, chiudiamo senza chiamare l'API
    if (tag && trimmedNome === tag.nome) {
      onHide();
      return;
    }

    setInternalLoading(true);
    try {
      if (tag?.id) {
        // UPDATE
        await dispatch(updateTag({ id: tag.id, nome: trimmedNome })).unwrap();
      } else {
        // CREATE
        await dispatch(createTag({ nome: trimmedNome })).unwrap();
      }
      onHide();
    } catch (error) {
      console.error("Error saving tag:", error);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Dialog
      header={tag ? t("edit_tag") : `${t("create_new")} ${t("tag")}`}
      visible={visible}
      className="dialog-custom tag-dialog"
      style={{ width: "95vw", maxWidth: "25rem" }}
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
            label={tag ? t("save_changes") : t("save")}
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
      <div className="tag-settings-dialog-content">
        <div className="main-tag-section">
          <InputText
            label={t("tag_name")}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("ex_urgent")}
            autoFocus
          />
        </div>
      </div>
    </Dialog>
  );
}
