import clsx from "clsx";
import { Badge } from "primereact/badge";
import { Button as ButtonPrime } from "primereact/button";
import React from "react";
import "./legacy_button.scss";

export type ButtonProps = {
  label?: string;
  labelNoTraduction?: string;
  onClick?: (event: React.MouseEvent<unknown>) => void;
  disabled?: boolean;
  icon?: string;
  showIconBadge?: boolean;
  iconPos?: "top" | "bottom" | "left" | "right";
  rounded?: boolean;
  className?: string;
  size?: "small" | "large";
  buttonStyle?: React.CSSProperties;
  onMouseDown?: (event: React.MouseEvent<unknown>) => void;
  compact?: boolean;
  invisible?: boolean;
  loading?: boolean;
};

export default function Button(props: ButtonProps) {
  const primeReactIcon = (
    <i
      className={clsx(
        "icon-button",
        props.icon,
        props.showIconBadge && "p-overlay-badge",
      )}
    >
      {props.showIconBadge && <Badge />}
    </i>
  );

  return (
    <div
      className={`div-button ${props.className ?? ""} ${
        props.invisible ? "invisible" : ""
      }`}
    >
      <ButtonPrime
        aria-label={(props.label && props.label) || props.labelNoTraduction}
        onClick={props.onClick}
        iconPos={props.iconPos}
        rounded={props.rounded || false}
        size={props.size}
        disabled={props.disabled}
        onMouseDown={props.onMouseDown}
        loading={props.loading}
        style={props.buttonStyle}
        className={clsx(props.compact && "compact")}
      >
        <div
          className={`div-icon-label-button ${
            props.iconPos === "top" || props.iconPos === "bottom"
              ? "column"
              : "row"
          } ${props.compact ? "compact" : ""}`}
        >
          {props.iconPos && props.icon ? (
            <>
              {(props.iconPos === "left" || props.iconPos === "top") &&
                (props.icon && props.icon.endsWith(".png") ? (
                  <img src={props.icon} className="icon-button-img" />
                ) : (
                  primeReactIcon
                ))}

              <span className="span-button">
                {props.label && props.label}
                {props.labelNoTraduction}
              </span>

              {(props.iconPos === "right" || props.iconPos === "bottom") && (
                <>
                  {props.icon && props.icon.endsWith(".png") ? (
                    <img src={props.icon} className="icon-button-img" />
                  ) : (
                    primeReactIcon
                  )}
                </>
              )}
            </>
          ) : (
            props.icon &&
            !props.iconPos &&
            (props.icon && props.icon.endsWith(".png") ? (
              <img src={props.icon} className="icon-button-img" />
            ) : (
              primeReactIcon
            ))
          )}

          {!props.icon && (props.label || props.labelNoTraduction) && (
            <span className="span-button">
              {props.label && props.label}
              {props.labelNoTraduction}
            </span>
          )}
        </div>
      </ButtonPrime>
    </div>
  );
}
