import en from "./en.json";
import it from "./it.json";

type Locale = "en" | "it";
type TranslationValue = string | TranslationMap;
interface TranslationMap {
  [key: string]: TranslationValue;
}

const translations: Record<Locale, TranslationMap> = {
  en: en as TranslationMap,
  it: it as TranslationMap,
};

/**
 * Funzione helper per rilevare la lingua del browser.
 * Cerca tra le lingue preferite dell'utente e ritorna "it" o "en".
 */
const detectBrowserLocale = (): Locale => {
  // navigator.languages (array) o navigator.language (stringa)
  const browserLang =
    (navigator.languages && navigator.languages[0]) || navigator.language;

  // Prendi solo le prime due lettere (es. "it-IT" diventa "it")
  const shortLang = browserLang.toLowerCase().split("-")[0];

  // Se la lingua è supportata (it), usala, altrimenti vai di default su "en"
  return shortLang === "it" ? "it" : "en";
};

// Inizializza currentLocale con la lingua rilevata
let currentLocale: Locale = detectBrowserLocale();

export function setLocale(locale: Locale) {
  if (translations[locale]) currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string): string {
  const keys = key.split(".");
  let value: TranslationValue = translations[currentLocale];

  for (const k of keys) {
    if (typeof value === "object" && value !== null && k in value) {
      value = value[k];
    } else {
      return key;
    }
  }

  return typeof value === "string" ? value : key;
}
