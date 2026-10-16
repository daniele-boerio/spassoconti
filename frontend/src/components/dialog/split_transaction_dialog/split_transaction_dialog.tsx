import { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import clsx from "clsx";
import Button from "../../legacy_button/legacy_button";
import InputText from "../../input_text/input_text";
import Dropdown from "../../dropdown/dropdown";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { splitTransaction } from "../../../features/transactions/api_calls";
import { Transaction } from "../../../features/transactions/interfaces";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import { selectTagTags } from "../../../features/tags/tag_slice";
import "./split_transaction_dialog.scss";
import { useI18n } from "../../../i18n/use-i18n";

interface SplitPart {
  // Importo tenuto come stringa "grezza" mentre si digita (come negli altri
  // dialog), così virgola/punto e decimali intermedi non vengono persi.
  importo: string;
  categoria_id?: string | null;
  sottocategoria_id?: string | null;
  tag_id?: string | null;
  descrizione?: string | null;
  debito_id?: number | null;
}

interface Props {
  visible: boolean;
  onHide: () => void;
  transaction?: Transaction | null;
}

const formatEuro = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

export default function SplitTransactionDialog({
  visible,
  onHide,
  transaction,
}: Props) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const categorie = useAppSelector(selectCategoriaCategorie);
  const tags = useAppSelector(selectTagTags);

  const [parts, setParts] = useState<SplitPart[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && transaction) {
      // Si parte da una sola parte uguale all'intero importo
      setParts([
        {
          importo: transaction.importo ? String(transaction.importo) : "",
          categoria_id: transaction.categoria_id || null,
          sottocategoria_id: transaction.sottocategoria_id || null,
          tag_id: transaction.tag_id || null,
          descrizione: transaction.descrizione || null,
          debito_id: (transaction as any).debito_id || null,
        },
      ]);
      setError(null);
    }
  }, [visible, transaction]);

  const categoriesOptions = useMemo(() => categorie || [], [categorie]);
  const tagOptions = useMemo(() => tags || [], [tags]);

  const original = Number(transaction?.importo || 0);
  const total = parts.reduce((s, p) => s + (parseFloat(p.importo) || 0), 0);
  const remaining = original - total;
  const balanced = Math.abs(remaining) < 0.01;

  const updatePart = (index: number, field: keyof SplitPart, value: any) => {
    const copy = [...parts];
    (copy[index] as any)[field] = value;
    setParts(copy);
  };

  // Cambiando categoria azzeriamo la sottocategoria: una sottocategoria di
  // un'altra categoria non ha senso (e il BE la slegherebbe comunque).
  const handleCategoriaChange = (index: number, value: any) => {
    const copy = [...parts];
    copy[index] = {
      ...copy[index],
      categoria_id: value ?? null,
      sottocategoria_id: null,
    };
    setParts(copy);
  };

  // Sottocategorie disponibili per la categoria scelta in questa parte.
  const getSottocategorieOptions = (categoriaId?: string | null) => {
    if (!categoriaId) return [];
    const cat = categoriesOptions.find(
      (c: any) => String(c.id) === String(categoriaId),
    );
    return (cat as any)?.sottocategorie || [];
  };

  const handleImporto = (index: number, raw: string) => {
    const cleaned = raw.replace(",", ".");
    if (cleaned === "" || /^\d*\.?\d{0,2}$/.test(cleaned)) {
      updatePart(index, "importo", cleaned);
    }
  };

  const addPart = () => {
    // La nuova parte riceve di default l'importo ancora da assegnare
    const leftover = remaining > 0 ? remaining.toFixed(2) : "";
    setParts([
      ...parts,
      {
        importo: leftover,
        categoria_id: null,
        sottocategoria_id: null,
        tag_id: null,
        descrizione: null,
      },
    ]);
  };

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handleSplit = async () => {
    if (!transaction) return;

    if (!balanced) {
      setError(t("split_mismatch"));
      return;
    }

    try {
      await dispatch(
        splitTransaction({
          id: String(transaction.id),
          parts: parts.map((p) => ({
            importo: parseFloat(p.importo) || 0,
            categoria_id: p.categoria_id ?? null,
            sottocategoria_id: p.sottocategoria_id ?? null,
            tag_id: p.tag_id ?? null,
            descrizione: p.descrizione ?? null,
            debito_id: p.debito_id ?? null,
          })),
        }),
      ).unwrap();

      onHide();
    } catch (e: any) {
      setError(e?.detail || e?.message || String(e));
    }
  };

  return (
    <Dialog
      header={t("split_transaction")}
      visible={visible}
      onHide={onHide}
      className="dialog-custom split-dialog"
      style={{ width: "95vw", maxWidth: "46rem" }}
      blockScroll={true}
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
            className="split-button"
            icon="ph-bold ph-tree-structure"
            iconPos="left"
            label={t("split_transaction")}
            onClick={handleSplit}
            disabled={!balanced || parts.length === 0}
          />
        </div>
      }
    >
      {transaction ? (
        <div className="split-content">
          <p className="split-subtitle">{t("split_subtitle")}</p>

          {/* RIEPILOGO */}
          <div className="split-summary">
            <div className="split-summary__item">
              <span className="label">{t("original_amount")}</span>
              <span className="value">{formatEuro(original)}</span>
            </div>
            <div className="split-summary__item">
              <span className="label">{t("split_assigned")}</span>
              <span className="value">{formatEuro(total)}</span>
            </div>
            <div className="split-summary__item">
              <span className="label">{t("split_remaining")}</span>
              <span
                className={clsx(
                  "value",
                  balanced ? "is-ok" : "is-warning",
                )}
              >
                {formatEuro(remaining)}
              </span>
            </div>
          </div>

          {/* PARTI */}
          <div className="split-parts">
            {parts.map((p, idx) => (
              <div className="split-part" key={idx}>
                <div className="split-part__header">
                  <span className="split-part__title">
                    {t("split_part")} {idx + 1}
                  </span>
                  <Button
                    className="trasparent-danger-button"
                    icon="ph-bold ph-trash"
                    compact
                    disabled={parts.length <= 1}
                    onClick={() => removePart(idx)}
                  />
                </div>

                <div className="form-row">
                  <div className="field">
                    <InputText
                      label={t("amount")}
                      value={p.importo}
                      onChange={(e) => handleImporto(idx, e.target.value)}
                      icon="ph-bold ph-currency-eur"
                      iconPos="right"
                      keyfilter={/^\d*[.,]?\d{0,2}$/}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="field">
                    <Dropdown
                      label={t("category")}
                      options={categoriesOptions}
                      optionLabel="nome"
                      optionValue="id"
                      value={p.categoria_id || null}
                      onChange={(e: any) =>
                        handleCategoriaChange(idx, e.value)
                      }
                      placeholder={t("select_category")}
                    />
                  </div>
                  <div className="field">
                    <Dropdown
                      label={t("sub_category")}
                      options={getSottocategorieOptions(p.categoria_id)}
                      optionLabel="nome"
                      optionValue="id"
                      value={p.sottocategoria_id || null}
                      onChange={(e: any) =>
                        updatePart(idx, "sottocategoria_id", e.value)
                      }
                      placeholder={t("sub_category_placeholder")}
                      disabled={!p.categoria_id}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="field">
                    <Dropdown
                      label={t("tag")}
                      options={tagOptions}
                      optionLabel="nome"
                      optionValue="id"
                      value={p.tag_id || null}
                      onChange={(e: any) => updatePart(idx, "tag_id", e.value)}
                      placeholder={t("select_tag")}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="field">
                    <InputText
                      label={t("description")}
                      value={p.descrizione || ""}
                      onChange={(e) =>
                        updatePart(idx, "descrizione", e.target.value)
                      }
                      placeholder={t("description")}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            label={t("add_part")}
            icon="ph-bold ph-plus"
            iconPos="left"
            className="table-add-button split-add-button"
            onClick={addPart}
          />

          {error && <div className="split-error">{error}</div>}
        </div>
      ) : null}
    </Dialog>
  );
}
