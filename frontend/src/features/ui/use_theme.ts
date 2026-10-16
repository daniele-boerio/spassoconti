import { useEffect } from "react";
import { useAppSelector } from "../../store/store";
import { selectTheme } from "./ui_slice";
import { applyTheme, resolveTheme, watchSystemTheme } from "./theme";

/**
 * Tiene `data-theme` su <html> allineato alla preferenza dell'utente e, quando
 * questa è "system", alle variazioni del tema di sistema.
 */
export function useThemeSync(): void {
  const preference = useAppSelector(selectTheme);

  useEffect(() => {
    applyTheme(resolveTheme(preference));

    if (preference !== "system") return;

    return watchSystemTheme(applyTheme);
  }, [preference]);
}
