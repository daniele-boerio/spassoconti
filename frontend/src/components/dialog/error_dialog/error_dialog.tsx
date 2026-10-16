import { Dialog } from "primereact/dialog";
import Button from "../../legacy_button/legacy_button";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { hideError, selectError } from "../../../features/error/error_slice";
import { useI18n } from "../../../i18n/use-i18n";

export default function ErrorDialog() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  // Grazie al setup di store.ts, lo stato 'error' è già tipizzato
  const { isOpen, message, title } = useAppSelector(selectError);

  const onHide = () => {
    dispatch(hideError());
  };

  const footerContent = (
    <div>
      <Button
        label={t("close")}
        icon="ph-bold ph-check"
        onClick={onHide}
        className="p-button-text"
      />
    </div>
  );

  return (
    <Dialog
      style={{ width: "90vw", maxWidth: "25rem" }}
      className="dialog-custom"
      header={title || t("error")}
      visible={isOpen}
      onHide={onHide}
      blockScroll={true}
      footer={footerContent}
      draggable={false}
      resizable={false}
      closable={false}
    >
      <div>
        <span>{message}</span>
      </div>
    </Dialog>
  );
}
