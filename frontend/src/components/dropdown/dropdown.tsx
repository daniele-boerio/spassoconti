import {
  Dropdown as DropdownPrime,
  type DropdownChangeEvent,
} from "primereact/dropdown";
import "./dropdown.scss";

export type DropdownProps = {
  panelWidth?: string;
  className?: string;
  label?: string;
  id?: string;
  value: unknown;
  onChange: (e: DropdownChangeEvent) => void;
  options: unknown[];
  optionLabel?: string;
  optionValue?: string;
  placeholder: string;
  optionGroupLabel?: string;
  optionGroupTemplate?: (option: unknown) => React.ReactNode;
  optionGroupChildren?: string;
  filter?: boolean;
  disabled?: boolean;
  itemTemplate?: (option: unknown) => React.ReactNode;
  valueTemplate?: (option: unknown) => React.ReactNode;
  hidden?: boolean;
  /**
   * Il pulsante "x" per svuotare la selezione. Default: `true`.
   *
   * Poter tornare indietro è la norma, non l'eccezione: quasi tutti i campi a
   * tendina qui sono opzionali (tag, categoria, filtri) e senza il clear una
   * scelta fatta per sbaglio non era più annullabile. Va messo esplicitamente a
   * `false` solo dove il vuoto è uno stato illegale — anno e mese delle
   * statistiche, conto di una transazione, frequenza di una ricorrenza.
   */
  showClear?: boolean;
  editable?: boolean;
};

export default function Dropdown(props: DropdownProps) {
  // Il clear di PrimeReact emette `value: undefined`, non `null`. La differenza
  // non è cosmetica: `JSON.stringify` toglie del tutto le chiavi `undefined`, il
  // campo sparisce dal PUT e il BE — che applica `model_dump(exclude_unset=True)`
  // — lo lascia com'era. Risultato: svuoti una tendina, salvi, e il vecchio
  // valore è ancora lì. Normalizziamo qui così vale per ogni chiamante.
  const handleChange = (e: DropdownChangeEvent) => {
    if (e.value === undefined) {
      e.value = null;
    }
    props.onChange(e);
  };

  return (
    <div className={`div-dropdown ${props.className ?? ""}`}>
      {props.label && <p className="label-dropdown">{props.label}</p>}
      <DropdownPrime
        id={props.id}
        value={props.value}
        onChange={handleChange}
        options={props.options}
        optionLabel={props.optionLabel}
        optionValue={props.optionValue}
        placeholder={props.placeholder}
        optionGroupLabel={props.optionGroupLabel}
        optionGroupTemplate={props.optionGroupTemplate}
        optionGroupChildren={props.optionGroupChildren}
        filter={props.filter}
        disabled={props.disabled}
        itemTemplate={props.itemTemplate}
        valueTemplate={props.valueTemplate}
        className={props.hidden ? "hidden-dropdown" : ""}
        showClear={props.showClear ?? true}
        editable={props.editable}
        pt={{
          panel: {
            style: {
              width: props.panelWidth,
            },
          },
        }}
      />
    </div>
  );
}
