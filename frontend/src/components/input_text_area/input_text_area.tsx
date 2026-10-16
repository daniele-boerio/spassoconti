import { InputTextarea as InputTextareaPrime } from "primereact/inputtextarea";
import React from "react";
import "./input_text_area.scss";

export type InputTextareaProps = {
  id?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  autoFocus?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  icon?: string;
  iconPos?: "left" | "right";
  rows?: number;
};

export default function InputTextarea(props: InputTextareaProps) {
  return (
    <div className={`div-inputtextarea ${props.className ?? ""}`}>
      {props.label && (
        <p className={`label-inputtextarea`}>
          <label htmlFor={props.id}>{props.label}</label>
        </p>
      )}

      <div className={`div-div-inputtextarea`}>
        {props.icon && props.iconPos === "left" && (
          <i className={`icon-inputtextarea ${props.icon ?? ""}`} />
        )}

        <InputTextareaPrime
          id={props.id}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder || ""}
          autoFocus={props.autoFocus}
          onClick={props.onClick}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          disabled={props.disabled}
          rows={props.rows}
        />

        {props.icon && props.iconPos === "right" && (
          <i className={`icon-inputtextarea ${props.icon ?? ""}`} />
        )}
      </div>
    </div>
  );
}
