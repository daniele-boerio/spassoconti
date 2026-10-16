import { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import Dropdown from "../../dropdown/dropdown";
import InputText from "../../input_text/input_text";
import Button from "../../legacy_button/legacy_button";
import "./bank_proposals_dialog.scss";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { useI18n } from "../../../i18n/use-i18n";
import {
  selectBankProposals,
  selectBankProposalsLoading,
} from "../../../features/bank_proposals/bank_proposals_slice";
import {
  importProposal,
  discardProposal,
} from "../../../features/bank_proposals/api_calls";
import { selectContiConti } from "../../../features/conti/conto_slice";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import { selectTagTags } from "../../../features/tags/tag_slice";
import { getConti } from "../../../features/conti/api_calls";

interface Props {
  visible: boolean;
  onHide: () => void;
}

export default function BankProposalsDialog({ visible, onHide }: Props) {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();

  const proposals = useAppSelector(selectBankProposals);
  const loading = useAppSelector(selectBankProposalsLoading);
  const conti = useAppSelector(selectContiConti);
  const categorie = useAppSelector(selectCategoriaCategorie);
  const tags = useAppSelector(selectTagTags);

  // Lavoriamo sempre sulla prima proposta: appena gestita viene rimossa e
  // scala la successiva.
  const current = proposals.length > 0 ? proposals[0] : null;

  const [contoId, setContoId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [sottoCategoriaId, setSottoCategoriaId] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [descrizione, setDescrizione] = useState("");

  // Reset del form ad ogni nuova proposta (la descrizione la inserisce l'utente).
  useEffect(() => {
    if (current) {
      setCategoriaId(null);
      setSottoCategoriaId(null);
      setTagId(null);
      setDescrizione("");
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preseleziona il conto da cui arriva la proposta. Usa l'id reale del conto
  // trovato così il tipo combacia col Dropdown (le proposte hanno conto_id come
  // stringa, i conti come numero) e ricalcola quando la lista conti si carica.
  useEffect(() => {
    if (!current) return;
    const match = conti.find(
      (c) => String(c.id) === String(current.conto_id),
    );
    setContoId(match ? (match.id as string) : current.conto_id);
  }, [current?.id, conti]); // eslint-disable-line react-hooks/exhaustive-deps

  const categorieFiltrate = useMemo(() => {
    if (!current) return categorie;
    return categorie.filter((cat) => {
      if (current.tipo === "ENTRATA") return cat.solo_entrata === true;
      if (current.tipo === "USCITA") return cat.solo_uscita === true;
      return true;
    });
  }, [categorie, current]);

  const sottocategorieOptions = useMemo(() => {
    const cat = categorie.find((c) => String(c.id) === String(categoriaId));
    return cat?.sottocategorie || [];
  }, [categorie, categoriaId]);

  const dateLocale = locale === "it" ? "it-IT" : "en-US";

  const getContoName = (id?: string | null) =>
    conti.find((c) => String(c.id) === String(id))?.nome || "";

  const handleApprove = async () => {
    if (!current) return;
    try {
      await dispatch(
        importProposal({
          conto_origin_id: current.conto_id,
          proposal_id: current.id,
          conto_id: contoId,
          categoria_id: categoriaId,
          sottocategoria_id: sottoCategoriaId,
          tag_id: tagId,
          descrizione: descrizione.trim() || null,
        }),
      ).unwrap();
      // Il saldo del conto è cambiato lato BE: ricarichiamo i conti
      dispatch(getConti());
    } catch {
      // gestito dall'errorMiddleware
    }
  };

  const handleReject = async () => {
    if (!current) return;
    try {
      await dispatch(
        discardProposal({
          conto_origin_id: current.conto_id,
          proposal_id: current.id,
        }),
      ).unwrap();
    } catch {
      // gestito dall'errorMiddleware
    }
  };

  const isExpense = current?.tipo === "USCITA";
  const amountStr = current
    ? `${isExpense ? "-" : "+"}${current.importo.toLocaleString(dateLocale, {
        minimumFractionDigits: 2,
      })} €`
    : "";

  return (
    <Dialog
      header={t("bank_proposals_title")}
      visible={visible}
      className="dialog-custom bank-proposals-dialog"
      style={{ width: "95vw", maxWidth: "40rem" }}
      onHide={onHide}
      blockScroll
      draggable={false}
      resizable={false}
    >
      {current ? (
        <div className="bank-proposals-content">
          <p className="bank-proposals-subtitle">
            {t("bank_proposals_subtitle")} ({proposals.length})
          </p>

          {/* Riepilogo proposta */}
          <div className={`proposal-summary ${isExpense ? "uscita" : "entrata"}`}>
            <div className="proposal-summary__main">
              <span className="proposal-summary__desc">
                {current.descrizione || t("transaction")}
              </span>
              <span className="proposal-summary__amount">{amountStr}</span>
            </div>
            <div className="proposal-summary__sub">
              {new Date(current.data).toLocaleDateString(dateLocale)} ·{" "}
              {getContoName(current.conto_id)}
            </div>
          </div>

          {/* Campi modificabili */}
          <div className="form-row two-cols">
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
            <Dropdown
              label={t("tag")}
              value={tagId}
              options={tags}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => setTagId(e.value)}
              placeholder={t("tag_placeholder")}
            />
          </div>

          <div className="form-row two-cols">
            <Dropdown
              label={t("category")}
              value={categoriaId}
              options={categorieFiltrate}
              optionLabel="nome"
              optionValue="id"
              onChange={(e) => {
                setCategoriaId(e.value);
                setSottoCategoriaId(null);
              }}
              placeholder={t("category_placeholder")}
            />
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
          </div>

          <div className="form-row">
            <InputText
              label={t("description")}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder={t("description_placeholder")}
            />
          </div>

          <div className="bank-proposals-actions">
            <Button
              label={t("reject")}
              className="trasparent-danger-button"
              icon="ph-bold ph-x"
              iconPos="left"
              onClick={handleReject}
              loading={loading}
            />
            <Button
              label={t("approve")}
              className="action-button"
              icon="ph-bold ph-check"
              iconPos="left"
              onClick={handleApprove}
              loading={loading}
              disabled={!contoId}
            />
          </div>
        </div>
      ) : (
        <p className="no-data">{t("no_data")}</p>
      )}
    </Dialog>
  );
}
