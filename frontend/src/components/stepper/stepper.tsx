import { Stepper as StepperPrime } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";
import React, { useState } from "react";
import "./stepper.scss";

export type StepperProps = {
  id?: string;
  ref?: React.Ref<StepperPrime> | null | undefined;
  panels?: { label: string; content: React.ReactNode; subLabel: string }[];
  className?: string;
  orientation?: "horizontal" | "vertical";
  linear?: boolean;
  headerPosition?: "top" | "right" | "left" | "bottom";
};

export default function Stepper(props: StepperProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleChange = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className={`div-stepper ${props.className ?? ""}`}>
      <StepperPrime
        id={props.id}
        ref={props.ref}
        orientation={props.orientation ?? "horizontal"}
        linear={props.linear ?? true}
        headerPosition={props.headerPosition ?? "right"}
        onChangeStep={(e) => handleChange(e.index)}
      >
        {props.panels?.map((panel, index) => (
          <StepperPanel
            key={index}
            header={panel.label}
            pt={{
              number: {
                className:
                  activeIndex > index
                    ? "p-stepper-number completed ph-bold ph-check"
                    : "p-stepper-number",
              },
              separator: {
                className:
                  activeIndex > index //|| index == 0
                    ? "p-stepper-separator completed"
                    : "p-stepper-separator",
              },
              title: {
                className: "custom-stepper-title",
                "data-sub-label": panel.subLabel ? panel.subLabel : undefined,
              },
            }}
          >
            {panel.content}
          </StepperPanel>
        ))}
      </StepperPrime>
    </div>
  );
}
