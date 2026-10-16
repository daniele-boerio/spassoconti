/**
 * Il registro degli errori che l'utente può copiare dalla schermata di errore.
 *
 * Su un iPhone la console non si apre: quando l'app si ferma, quello che è
 * successo prima non lo sa nessuno. Qui teniamo le ultime righe di log e le
 * impacchettiamo in un testo che si incolla in una chat.
 *
 * Sì, `console.error` viene sostituita. È invasivo, ed è il prezzo per avere
 * una traccia su un dispositivo che non ne lascia: l'originale viene comunque
 * chiamata, quindi in sviluppo la console resta quella di sempre.
 */

/** Quante righe teniamo. Oltre, il testo da incollare diventa illeggibile. */
const MAX_ENTRIES = 25;

/** Una riga lunga è quasi sempre un oggetto serializzato: ne basta l'inizio. */
const MAX_TEXT = 300;

/** Righe di stack: oltre le prime si entra nel codice di React. */
const MAX_STACK_LINES = 14;

export type LogLevel = "error" | "warn" | "unhandled";

export interface LogEntry {
  time: string;
  level: LogLevel;
  text: string;
}

const entries: LogEntry[] = [];

const clip = (text: string) =>
  text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;

const timeOf = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

/** Un argomento di console come testo, senza far esplodere i cicli. */
const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export function record(level: LogLevel, ...args: unknown[]) {
  entries.push({
    time: timeOf(new Date()),
    level,
    text: clip(args.map(asText).join(" ")),
  });

  // Buffer circolare: teniamo le ultime, che sono quelle vicine al guasto.
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function recentEntries(): LogEntry[] {
  return [...entries];
}

/** Solo per i test: il buffer è un modulo, non uno stato di React. */
export function clearEntries() {
  entries.length = 0;
}

let installed = false;

/**
 * Aggancia il registro a console.error/warn e agli errori che nessuno cattura.
 * Chiamata una volta sola all'avvio; ripetuta, non fa niente.
 */
export function installErrorLog() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    record("error", ...args);
    originalError(...args);
  };

  console.warn = (...args: unknown[]) => {
    record("warn", ...args);
    originalWarn(...args);
  };

  window.addEventListener("error", (event) => {
    record("unhandled", event.message, `(${event.filename}:${event.lineno})`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    record("unhandled", asText(event.reason));
  });
}

const firstLines = (stack: string | null | undefined, limit: number) =>
  (stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);

/**
 * Il testo da incollare: che errore è, dove stava l'utente, e cosa si era
 * scritto nei log poco prima.
 */
export function buildErrorReport(
  error: Error | null,
  componentStack?: string | null,
): string {
  const now = new Date();

  const blocks: string[] = [
    "SpassoConto — segnalazione errore",
    `Quando: ${now.toLocaleString()}`,
    `Dove: ${window.location.pathname}${window.location.search}`,
    `Browser: ${navigator.userAgent}`,
    "",
    `Errore: ${error ? `${error.name}: ${error.message}` : "(nessuno)"}`,
  ];

  const stack = firstLines(error?.stack, MAX_STACK_LINES);
  if (stack.length > 0) blocks.push("", "Stack:", ...stack);

  const tree = firstLines(componentStack, MAX_STACK_LINES);
  if (tree.length > 0) blocks.push("", "Componenti:", ...tree);

  const log = recentEntries();
  if (log.length > 0) {
    blocks.push(
      "",
      "Ultimi log:",
      ...log.map((entry) => `[${entry.time}] ${entry.level}: ${entry.text}`),
    );
  }

  return blocks.join("\n");
}

/**
 * Copia negli appunti. `navigator.clipboard` vuole https e un gesto
 * dell'utente: quando manca (o l'utente ha negato il permesso) non c'è un
 * ripiego che funzioni davvero su iOS, quindi lo diciamo a chi chiama, che
 * mostrerà il testo da selezionare a mano.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
