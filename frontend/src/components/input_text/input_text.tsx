import { InputText as InputTextPrime } from "primereact/inputtext";
import React from "react";
import "./input_text.scss";
import { KeyFilterType } from "primereact/keyfilter";

export type InputTextProps = {
  id?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  autoFocus?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  icon?: string;
  iconPos?: "left" | "right";
  invalid?: boolean;
  type?: string;
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  keyfilter?: KeyFilterType;
};

export default function InputText(props: InputTextProps) {
  return (
    <div className={`div-inputtext ${props.className ?? ""}`}>
      {props.label && (
        <p className={`label-inputtext`}>
          <label htmlFor={props.id}>{props.label}</label>
        </p>
      )}

      <div className={`div-div-inputtext`}>
        {props.icon && props.iconPos === "left" && (
          <i className={`icon-inputtext ${props.icon ?? ""}`} />
        )}

        <InputTextPrime
          id={props.id}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder || ""}
          autoFocus={props.autoFocus}
          onClick={props.onClick}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          disabled={props.disabled}
          invalid={props.invalid}
          type={props.type || "text"}
          inputMode={props.inputMode}
          keyfilter={props.keyfilter}
        />

        {props.icon && props.iconPos === "right" && (
          <i className={`icon-inputtext ${props.icon ?? ""}`} />
        )}
      </div>
    </div>
  );
}
