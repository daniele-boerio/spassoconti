import {
  Checkbox as CheckboxPrime,
  type CheckboxChangeEvent,
} from "primereact/checkbox";
import "./checkbox.scss";

export type CheckboxProps = {
  onChange: (e: CheckboxChangeEvent) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  checked: boolean;
  disabled?: boolean;
  value?: string;
  id?: string;
  label?: string;
  labelNoTranslate?: string;
  className?: string;
  invisible?: boolean;
};

export default function Checkbox(props: CheckboxProps) {
  return (
    <div
      className={`div-checkbox ${props.className ?? ""} ${
        props.invisible ? "invisible" : ""
      }`}
    >
      <CheckboxPrime
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        onClick={props.onClick}
        checked={props.checked}
        disabled={props.disabled}
      />
      {props.label && <p className={`label-checkbox`}>{props.label}</p>}
      {props.labelNoTranslate && (
        <p className={`label-no-translate-checkbox`}>
          {props.labelNoTranslate}
        </p>
      )}
    </div>
  );
}
