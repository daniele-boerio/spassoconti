import {
  MultiSelect as MultiSelectPrime,
  type MultiSelectChangeEvent,
} from "primereact/multiselect";
import type { VirtualScrollerProps } from "primereact/virtualscroller";
import React from "react";
import "./multiselect.scss";

export type MultiselectProps = {
  id?: string;
  className?: string;
  value: unknown;
  onChange: (e: MultiSelectChangeEvent) => void;
  options: unknown[];
  placeholder?: string;
  disabled?: boolean;
  hidden?: boolean;
  display?: "chip";
  label?: string;
  filter?: boolean;
  optionLabel?: string;
  optionGroupLabel?: string;
  optionGroupChildren?: string;
  optionValue?: string;
  itemTemplate?: (option: unknown) => React.ReactNode;
  selectedItemTemplate?: (option: unknown) => React.ReactNode;
  loading?: boolean;
  virtualScrollerOptions?: VirtualScrollerProps;
  maxSelectedLabes?: number;
};

export default function Multiselect(props: MultiselectProps) {
  const isGrouped = !!(props.optionGroupLabel && props.optionGroupChildren);

  return (
    <div className={`div-multiselect ${props.className ?? ""}`}>
      {props.label && (
        <p className={`label-multiselect`}>
          <label htmlFor={props.id}>{props.label}</label>
        </p>
      )}

      <MultiSelectPrime
        id={props.id}
        maxSelectedLabels={props.maxSelectedLabes || 3}
        value={props.value}
        onChange={props.onChange}
        options={props.options}
        filter={props.filter}
        placeholder={props.placeholder || ""}
        disabled={props.disabled}
        display={props.display || undefined}
        optionLabel={!isGrouped ? props.optionLabel : undefined}
        optionGroupLabel={isGrouped ? props.optionGroupLabel : undefined}
        optionGroupChildren={isGrouped ? props.optionGroupChildren : undefined}
        optionValue={props.optionValue}
        itemTemplate={props.itemTemplate}
        selectedItemTemplate={props.selectedItemTemplate}
        loading={props.loading}
        virtualScrollerOptions={props.virtualScrollerOptions}
        className={props.hidden ? "hidden-multiselect" : ""}
        removeIcon="ph-bold ph-x"
        pt={{
          labelContainer: () => ({
            style: {
              height: "100%",
              display: "flex",
              alignItems: "center",
            },
          }),
        }}
      />
    </div>
  );
}
