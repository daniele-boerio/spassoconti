import { useMemo, useState } from "react";
import Sheet from "../sheet/sheet";
import Button from "../button/button";
import EmptyState from "../empty_state/empty_state";
import { useI18n } from "../../i18n/use-i18n";
import "./picker_sheet.scss";

export type PickerOption = {
  id: string;
  label: string;
  /** Seconda riga: il contesto della voce (il conto di una sottocategoria…). */
  meta?: string;
};

type PickerSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  /** Id selezionato, oppure il nome di una voce ancora da creare. */
  value: string | null;
  onSelect: (value: string | null) => void;
  /** Etichetta della voce che azzera la scelta; senza, non si può azzerare. */
  clearLabel?: string;
  /** Con questa etichetta compare "+ Nuova…": il valore scelto è il nome. */
  createLabel?: string;
};

// Sotto questa soglia la ricerca è più lavoro che scorrere.
const SEARCH_THRESHOLD = 8;

/**
 * Scelta di una voce fra tante, come foglio ancorato in basso.
 *
 * È la controparte generica delle righe-campo del form: la riga mostra il
 * valore, il tocco apre questo. Vale per conti, categorie, sottocategorie e
 * tag, che si scelgono tutti allo stesso modo.
 *
 * Quando si crea una voce nuova il valore che esce è il **nome**, non un id:
 * la creazione vera avviene al salvataggio, così un form abbandonato non
 * lascia in giro categorie vuote.
 */
export default function PickerSheet({
  open,
  onClose,
  title,
  options,
  value,
  onSelect,
  clearLabel,
  createLabel,
}: PickerSheetProps) {
  const { t } = useI18n();

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;

    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const close = () => {
    setQuery("");
    setDraft(null);
    onClose();
  };

  const choose = (next: string | null) => {
    onSelect(next);
    close();
  };

  const confirmDraft = () => {
    const name = draft?.trim();
    if (name) choose(name);
  };

  return (
    <Sheet open={open} onClose={close} title={title} className="picker">
      {options.length >= SEARCH_THRESHOLD && (
        <div className="picker__search">
          <i className="ph-bold ph-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={t("search")}
            aria-label={t("search")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

      <div className="picker__list">
        {clearLabel && (
          <button
            type="button"
            className="picker__option"
            onClick={() => choose(null)}
          >
            <span className="picker__label picker__label--muted">
              {clearLabel}
            </span>
            {value === null && (
              <i className="ph-bold ph-check picker__check" aria-hidden="true" />
            )}
          </button>
        )}

        {visible.map((option) => {
          const selected = String(option.id) === String(value);

          return (
            <button
              key={option.id}
              type="button"
              className="picker__option"
              onClick={() => choose(option.id)}
            >
              <span className="picker__text">
                <span className="picker__label">{option.label}</span>
                {option.meta && (
                  <span className="picker__meta">{option.meta}</span>
                )}
              </span>

              {selected && (
                <i className="ph-bold ph-check picker__check" aria-hidden="true" />
              )}
            </button>
          );
        })}

        {visible.length === 0 && (
          <EmptyState
            variant="search"
            icon="ph-bold ph-magnifying-glass"
            title={t("no_data")}
          />
        )}
      </div>

      {createLabel &&
        (draft === null ? (
          <Button
            variant="neutral"
            icon="ph-bold ph-plus"
            block
            onClick={() => setDraft(query.trim())}
          >
            {createLabel}
          </Button>
        ) : (
          <div className="picker__create">
            <input
              autoFocus
              value={draft}
              placeholder={createLabel}
              aria-label={createLabel}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmDraft();
              }}
            />
            <Button size="md" disabled={!draft.trim()} onClick={confirmDraft}>
              {t("add")}
            </Button>
          </div>
        ))}
    </Sheet>
  );
}
