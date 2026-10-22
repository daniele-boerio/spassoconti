import { useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import Sheet from "../sheet/sheet";
import Button from "../button/button";
import Amount from "../amount/amount";
import { TagSuggestion } from "../../features/tags/interfaces";
import { toggleId } from "../../features/tags/suggestion";
import "./tag_suggestion_sheet.scss";

type Props = {
  open: boolean;
  suggestion: TagSuggestion | null;
  /**
   * "save": la domanda quando si salva una transazione (la transazione nuova
   * prende comunque il tag accettato); "cleanup": un gruppo della pulizia in
   * blocco delle Impostazioni.
   */
  context: "save" | "cleanup";
  busy?: boolean;
  /** Sì: con gli id delle transazioni passate lasciate spuntate. */
  onAccept: (selectedIds: string[]) => void;
  /** No / Non ora: solo questa volta. */
  onDecline: () => void;
  /** Non chiederlo più per questa frase e questo tag. */
  onNever: () => void;
  /** X, overlay, Esc: si torna indietro senza decidere. */
  onClose: () => void;
};

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

const formatDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(localeTag(), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(iso))
    : "";

/**
 * Proposta di tag: "Metto in #gaia?" oppure "Creo #paolo e ci metto queste?".
 * L'anteprima elenca le transazioni passate, tutte spuntate: si tolgono quelle
 * sbagliate prima di dire sì, perché il sì modifica dati vecchi.
 */
export default function TagSuggestionSheet({
  open,
  suggestion,
  context,
  busy = false,
  onAccept,
  onDecline,
  onNever,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  // Proposta nuova → tutte spuntate. Riallineato durante il render (il
  // pattern di React per lo stato che dipende da una prop), non in un effetto.
  const [selectedFor, setSelectedFor] = useState<TagSuggestion | null>(null);
  if (suggestion !== selectedFor) {
    setSelectedFor(suggestion);
    setSelected(suggestion?.transazioni.map((transazione) => transazione.id) ?? []);
  }

  if (!suggestion) return null;

  const fill = (key: string) =>
    t(key)
      .replace("{nome}", suggestion.nome)
      .replace("{frase}", suggestion.frase)
      .replace("{count}", String(suggestion.occorrenze));

  const isNew = suggestion.tipo === "nuovo";
  const preview = suggestion.transazioni;

  const title = isNew ? fill("tag_suggest_title_new") : fill("tag_suggest_title_existing");

  let intro: string;
  if (context === "cleanup") {
    intro = fill("tag_suggest_cleanup_intro");
  } else if (isNew) {
    intro = fill("tag_suggest_new_intro");
  } else if (suggestion.occorrenze > 0) {
    intro = fill("tag_suggest_existing_intro");
  } else {
    intro = fill("tag_suggest_named_intro");
  }

  const acceptLabel =
    context === "cleanup"
      ? t("tag_suggest_apply")
      : isNew
        ? fill("tag_suggest_accept_new")
        : fill("tag_suggest_accept_existing");

  // Nella pulizia senza transazioni spuntate non resta niente da fare.
  const acceptDisabled = busy || (context === "cleanup" && selected.length === 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      className="tag-suggest"
      footer={
        <>
          <Button variant="neutral" block disabled={busy} onClick={onDecline}>
            {context === "cleanup" ? t("tag_suggest_not_now") : t("tag_suggest_no")}
          </Button>
          <Button
            block
            icon="ph-bold ph-hash"
            disabled={acceptDisabled}
            onClick={() => onAccept(selected)}
          >
            {acceptLabel}
          </Button>
        </>
      }
    >
      <p className="tag-suggest__intro">{intro}</p>

      {preview.length > 0 && (
        <>
          <div className="tag-suggest__head">
            <span className="tag-suggest__eyebrow">
              {t("tag_suggest_preview")} · {selected.length}/{preview.length}
            </span>
            <button
              type="button"
              className="tag-suggest__toggle-all"
              onClick={() =>
                setSelected(
                  selected.length === preview.length
                    ? []
                    : preview.map((transazione) => transazione.id),
                )
              }
            >
              {selected.length === preview.length
                ? t("tag_suggest_select_none")
                : t("tag_suggest_select_all")}
            </button>
          </div>

          <ul className="tag-suggest__list">
            {preview.map((transazione) => {
              const checked = selected.includes(transazione.id);
              return (
                <li key={transazione.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    className="tag-suggest__row"
                    onClick={() => setSelected(toggleId(selected, transazione.id))}
                  >
                    <i
                      className={`ph-bold ${checked ? "ph-check-square" : "ph-square"} tag-suggest__check`}
                      aria-hidden="true"
                    />
                    <span className="tag-suggest__text">
                      <span className="tag-suggest__desc">
                        {transazione.descrizione}
                      </span>
                      <span className="tag-suggest__date">
                        {formatDate(transazione.data)}
                      </span>
                    </span>
                    <Amount value={transazione.importo} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button
        type="button"
        className="tag-suggest__never"
        disabled={busy}
        onClick={onNever}
      >
        {t("tag_suggest_never")}
      </button>
    </Sheet>
  );
}
