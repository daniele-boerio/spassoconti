import { Password as PasswordPrime } from "primereact/password";
import React from "react";
import "./password.scss";

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
  feedback?: boolean;
  toggleMask?: boolean;
};

export default function Password(props: InputTextProps) {
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

        <PasswordPrime
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
          feedback={props.feedback}
          toggleMask={props.toggleMask || false}
        />

        {props.icon && props.iconPos === "right" && (
          <i className={`icon-inputtext ${props.icon ?? ""}`} />
        )}
      </div>
    </div>
  );
}
