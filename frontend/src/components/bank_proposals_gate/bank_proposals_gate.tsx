import { Suspense, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { getPendingProposals } from "../../features/bank_proposals/api_calls";
import { selectBankProposals } from "../../features/bank_proposals/bank_proposals_slice";
import { getConti } from "../../features/conti/api_calls";
import { getCategorie } from "../../features/categorie/api_calls";
import { getTags } from "../../features/tags/api_calls";
import { lazyWithRetry } from "../../services/lazy_with_retry";

// Caricato solo quando ci sono proposte: importato subito portava nel bundle
// iniziale Dropdown e VirtualScroller di PrimeReact (~15 KB gzip) per un
// dialog che la maggior parte delle volte non si apre.
const BankProposalsDialog = lazyWithRetry(
  () => import("../dialog/bank_proposals_dialog/bank_proposals_dialog"),
);

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

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <BankProposalsDialog visible onHide={() => setOpen(false)} />
    </Suspense>
  );
}
