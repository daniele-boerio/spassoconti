import { createContext, useContext } from "react";
import type { I18nContextProps } from "./i18n-provider";
import { getLocale, t as rawT } from ".";

export const I18nContext = createContext<I18nContextProps>({
  locale: getLocale(),
  setLocale: () => {},
  t: rawT,
});

export const useI18n = () => useContext(I18nContext);
