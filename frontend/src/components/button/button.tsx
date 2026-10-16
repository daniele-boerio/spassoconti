import { ReactNode } from "react";
import "./button.scss";

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  /** `neutral` è il bottone secondario su `--surface-2` (Annulla, Indietro). */
  variant?: "primary" | "secondary" | "neutral" | "danger";
  /** lg = 54px (azione di schermata), md = 50px (alert), sm = compatto. */
  size?: "lg" | "md" | "sm";
  icon?: string;
  block?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  size = "lg",
  icon,
  block = false,
  disabled = false,
  type = "button",
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${
        block ? "btn--block" : ""
      } ${className ?? ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <i className={icon} aria-hidden="true" />}
      {children}
    </button>
  );
}
