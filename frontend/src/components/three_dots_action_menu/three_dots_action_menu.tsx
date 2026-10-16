import { Menu } from "primereact/menu";
import type { MenuItem } from "primereact/menuitem";
import { OverlayPanel } from "primereact/overlaypanel";
import { useEffect, useRef, useState } from "react";
import "./three_dots_action_menu.scss";

export type ThreeDotsActionsMenuProps = {
  className?: string;
  items: MenuItem[];
  verticalDots?: boolean;
  onClickThreeDots?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export default function ThreeDotsActionsMenu(props: ThreeDotsActionsMenuProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const ref = useRef<OverlayPanel>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (ref.current) {
        ref.current.hide();
      }
    };

    window.addEventListener("scroll", handleScroll, true); // usa 'true' per catturare lo scroll in profondità

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isInsideMenu = ref.current
        ?.getElement()
        ?.contains(event.target as Node);
      const isInsideButton = buttonRef.current?.contains(event.target as Node);
      if (!isInsideMenu && !isInsideButton) {
        ref.current?.hide();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (props.items.length) {
      setItems(
        props.items.map((i: MenuItem) => {
          return {
            ...i,
            command: (e) => {
              if (i.command) {
                i.command(e);
              }
              if (ref.current) {
                ref.current.hide();
              }
            },
          };
        }),
      );
    }
  }, [props.items]);

  return (
    <div className={`three-dots ${props.className ?? ""}`}>
      <button
        ref={buttonRef}
        className="p-button p-button-text"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (ref.current) {
            ref.current.toggle(e);
          }
          if (props.onClickThreeDots) {
            props.onClickThreeDots(e);
          }
        }}
      >
        <i
          className="ph-bold ph-dots-three-vertical"
          style={{ transform: `rotate(${props.verticalDots ? "0" : "90"}deg)` }}
        />
      </button>
      <OverlayPanel
        ref={ref}
        pt={{
          content: () => ({
            style: {
              padding: "0px",
            },
          }),
        }}
      >
        <Menu
          model={items}
          pt={{
            root: () => ({
              style: {
                padding: "0px",
                width: "auto",
              },
            }),
            menuitem: () => ({
              style: {
                padding: "0.5rem 0",
              },
            }),
          }}
        />
      </OverlayPanel>
    </div>
  );
}
