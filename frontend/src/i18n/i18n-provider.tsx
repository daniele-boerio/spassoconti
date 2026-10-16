import React, { useState } from "react";
import { I18nContext } from "./use-i18n";
import { getLocale, setLocale as rawSetLocale, t as rawT } from ".";

export interface I18nContextProps {
  locale: string;
  setLocale: (l: "en" | "it") => void;
  t: (key: string) => string;
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [locale, _setLocaleState] = useState<"en" | "it">(getLocale());

  const changeLocale = (l: "en" | "it") => {
    rawSetLocale(l);
    _setLocaleState(l);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale: changeLocale, t: rawT }}>
      {children}
    </I18nContext.Provider>
  );
};
