import { useId } from "react";
import {
  InputSwitch as SwitchPrime,
  type InputSwitchChangeEvent,
} from "primereact/inputswitch";
import "./switch.scss";

export type SwitchProps = {
  className?: string;
  label?: string;
  id?: string;
  checked?: boolean;
  onChange?: (e: InputSwitchChangeEvent) => void;
  disabled?: boolean;
  hidden?: boolean;
};

export default function Switch(props: SwitchProps) {
  // L'etichetta è un <label> collegato all'input (prima un <p> scollegato:
  // VoiceOver leggeva "interruttore" senza dire quale).
  const generatedId = useId();
  const inputId = props.id ?? generatedId;

  return (
    <div className={`div-switch ${props.className ?? ""}`}>
      {props.label && (
        <label className="label-switch" htmlFor={inputId}>
          {props.label}
        </label>
      )}
      <SwitchPrime
        inputId={inputId}
        checked={props.checked || false}
        onChange={props.onChange}
        disabled={props.disabled}
        className={props.hidden ? "hidden-switch" : ""}
      />
    </div>
  );
}
