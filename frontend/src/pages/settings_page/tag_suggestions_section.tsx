import { useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import Toggle from "../../components/toggle/toggle";
import Sheet from "../../components/sheet/sheet";
import TagSuggestionSheet from "../../components/tag_suggestion_sheet/tag_suggestion_sheet";
import { showToast } from "../../features/ui/ui_slice";
import { updatePreferences } from "../../features/profile/api_calls";
import { selectSuggerimentiTag } from "../../features/profile/profile_slice";
import {
  applyTag,
  getTagProposals,
  rejectTagSuggestion,
} from "../../features/tags/api_calls";
import { TagSuggestion } from "../../features/tags/interfaces";

/**
 * Sezione "Tag" delle Impostazioni:
 * - l'interruttore della domanda al salvataggio (la proposta del tag dalla
 *   descrizione);
 * - "Riordina i tag": la stessa logica su tutta la storia, per raggruppare
 *   in blocco le transazioni rimaste senza tag. Resta disponibile anche con
 *   l'interruttore spento: la si apre a mano.
 */
export default function TagSuggestionsSection() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectSuggerimentiTag);

  const [listOpen, setListOpen] = useState(false);
  // Lista effimera della pulizia: vive finché lo sheet è aperto.
  const [proposals, setProposals] = useState<TagSuggestion[] | null>(null);
  const [current, setCurrent] = useState<TagSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  const openList = async () => {
    setListOpen(true);
    setProposals(null);
    try {
      setProposals(await dispatch(getTagProposals()).unwrap());
    } catch {
      // Mostrato dall'errorMiddleware.
      setProposals([]);
    }
  };

  const removeCurrent = () => {
    if (!current) return;
    setProposals(
      (list) => list?.filter((proposal) => proposal.chiave !== current.chiave) ?? null,
    );
    setCurrent(null);
  };

  const apply = async (selectedIds: string[]) => {
    if (!current) return;
    setBusy(true);
    try {
      const result = await dispatch(
        applyTag({
          tag_id: current.tag_id,
          nome: current.nome,
          transazione_ids: selectedIds,
        }),
      ).unwrap();
      dispatch(
        showToast({
          variant: "success",
          title: t("tag_suggest_applied")
            .replace("{count}", String(result.aggiornate))
            .replace("{nome}", result.tag.nome),
        }),
      );
      removeCurrent();
    } catch {
      // Mostrato dall'errorMiddleware.
    } finally {
      setBusy(false);
    }
  };

  const never = () => {
    if (!current) return;
    dispatch(rejectTagSuggestion({ chiave: current.chiave, nome: current.nome }));
    removeCurrent();
  };

  return (
    <section className="settings-group">
      <h2 className="settings-group__title">{t("tag_suggest_settings_title")}</h2>

      <div className="settings-card">
        <label className="settings-row">
          <span className="settings-row__text">
            <span className="settings-row__label">{t("tag_suggest_toggle")}</span>
            <span className="settings-row__hint">{t("tag_suggest_toggle_hint")}</span>
          </span>

          <Toggle
            checked={enabled}
            onChange={(checked) =>
              dispatch(updatePreferences({ suggerimenti_tag: checked }))
            }
          />
        </label>

        <button
          type="button"
          className="settings-row settings-row--tappable"
          onClick={openList}
        >
          <span className="settings-row__text">
            <span className="settings-row__label">{t("tag_suggest_cleanup")}</span>
            <span className="settings-row__hint">{t("tag_suggest_cleanup_hint")}</span>
          </span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </button>
      </div>

      <Sheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        title={t("tag_suggest_cleanup")}
        className="two-factor"
      >
        {proposals === null && <p className="two-factor__text">{t("loading")}</p>}

        {proposals?.length === 0 && (
          <p className="two-factor__text">{t("tag_suggest_cleanup_empty")}</p>
        )}

        {proposals && proposals.length > 0 && (
          <div className="settings-card">
            {proposals.map((proposal) => (
              <button
                key={proposal.chiave}
                type="button"
                className="settings-row settings-row--tappable"
                onClick={() => setCurrent(proposal)}
              >
                <span className="settings-row__text">
                  <span className="settings-row__label">
                    #{proposal.nome}
                    {proposal.tipo === "nuovo" && ` · ${t("tag_suggest_new_badge")}`}
                  </span>
                  <span className="settings-row__hint">
                    {`«${proposal.frase}» · ${t("tag_suggest_count").replace(
                      "{count}",
                      String(proposal.occorrenze),
                    )}`}
                  </span>
                </span>
                <i className="ph-bold ph-caret-right" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <TagSuggestionSheet
        open={current !== null}
        suggestion={current}
        context="cleanup"
        busy={busy}
        onAccept={apply}
        onDecline={() => setCurrent(null)}
        onNever={never}
        onClose={() => setCurrent(null)}
      />
    </section>
  );
}
