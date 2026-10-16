import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { getPendingProposals } from "../../features/bank_proposals/api_calls";
import { selectBankProposals } from "../../features/bank_proposals/bank_proposals_slice";
import { getConti } from "../../features/conti/api_calls";
import { getCategorie } from "../../features/categorie/api_calls";
import { getTags } from "../../features/tags/api_calls";
import BankProposalsDialog from "../dialog/bank_proposals_dialog/bank_proposals_dialog";

/**
 * Montato nell'area autenticata: al landing chiede al BE se ci sono proposte
 * di transazione pendenti (una sola chiamata, nessun pulsante). Se ce ne sono,
 * apre automaticamente il dialog per approvarle/rifiutarle.
 */
export default function BankProposalsGate() {
  const dispatch = useAppDispatch();
  const proposals = useAppSelector(selectBankProposals);
  const [open, setOpen] = useState(false);

  // Controllo automatico al montaggio + dati di riferimento per i dropdown
  useEffect(() => {
    dispatch(getPendingProposals());
    dispatch(getConti());
    dispatch(getCategorie());
    dispatch(getTags());
  }, [dispatch]);

  // Apre quando arrivano proposte, chiude quando sono state tutte gestite.
  useEffect(() => {
    if (proposals.length > 0) setOpen(true);
    else setOpen(false);
  }, [proposals.length]);

  return (
    <BankProposalsDialog visible={open} onHide={() => setOpen(false)} />
  );
}
