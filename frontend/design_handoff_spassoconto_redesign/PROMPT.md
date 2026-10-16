# Prompt per Claude Code — redesign SpassoConto

> Incolla tutto il testo qui sotto in Claude Code, dentro il repo `calcolatore-spese-FE`, dopo aver copiato la cartella `design_handoff_spassoconto_redesign/` nella root del progetto.

---

Devi convertire l'interfaccia di questa app (React + TypeScript + SCSS + PrimeReact) al nuovo design che trovi in `design_handoff_spassoconto_redesign/`.

## Cosa sono i file allegati

`SpassoConto - Design completo.dc.html` è il **riferimento di design**: un prototipo HTML hi-fi, non codice da copiare. Aprilo nel browser: contiene, in ordine,

1. la spec del design system (tabella token chiaro/scuro, scala tipografica, regole di sistema);
2. 13 schermate in tema chiaro;
3. 4 schermate in tema scuro (per mostrare che cambia solo il blocco di variabili);
4. 9 tavole di dialog, sheet, stati vuoti, skeleton e toast;
5. in fondo, la tabella **"Mappa schermata → codice esistente"**: dice quale schermata sostituisce quali file del repo.

`SpassoConto - Stato attuale.dc.html` è la ricostruzione dell'interfaccia **attuale**, utile per capire da dove si parte.

`README.md` contiene la spec scritta: token esatti, misure, tipografia, comportamenti, stati. Leggilo prima di scrivere codice — è la fonte di verità quando l'HTML e il testo divergono.

Il design è **hi-fi**: colori, dimensioni, pesi e spaziature vanno riprodotti fedelmente. Riscrivili però con le convenzioni del repo (componenti React esistenti, SCSS per file, PrimeReact dove già usato) — non incollare l'HTML del prototipo.

## Vincoli non negoziabili

- **Mobile-first.** Il target è una PWA su telefono, 430px di larghezza di riferimento. Il layout desktop è secondario: centra il contenuto in una colonna da max 480px.
- **Niente hamburger, niente sidebar.** La navigazione è una tab bar fissa in basso a 5 slot: Home · Movimenti · **+** (FAB centrale) · Analisi · Conti. Il vecchio menu laterale (`src/components/navbar/`) va smontato: le sue voci finiscono nella lista dentro "Conti".
- **Statistiche e Grafici si fondono** in un'unica sezione "Analisi" con tab Mese / Anno / Categorie. `statistics_page` e `charts_page` diventano una sola route.
- **Un solo blocco di token, due temi.** Definisci le custom properties CSS in `:root` e l'override in `[data-theme="dark"]`. Nessun componente deve contenere un colore letterale: solo `var(--…)`. La tabella dei token è nel README.
- **Via i colori attuali.** Gradienti lilla/ciano, verde e rosso PrimeReact di default, colori per-categoria: tutti da rimuovere. La palette è quella del README, e il colore ha significato (accento = budget e azioni; positive/negative solo su importi e delta).
- **Importi sempre `font-variant-numeric: tabular-nums`**, segno prima del numero, valuta dopo: `−42,30 €`.
- **Target tocco minimo 44×44px.**
- **Ogni lista ha uno stato vuoto** con una frase e un'azione — mai una tabella vuota. Le tavole degli stati vuoti sono nel prototipo.

## Ordine di lavoro

Procedi a step, un commit per step, e fermati a mostrarmi il risultato dopo ogni gruppo.

1. **Fondamenta**: riscrivi `src/styles/_variables.scss` con i token, aggiungi lo switch di tema (`data-theme` su `<html>`, persistito in localStorage, default `system`), imposta i font (Plus Jakarta Sans per la UI; Instrument Serif solo per i titoli del tema scuro).
2. **Navigazione**: nuova `TabBar` + FAB, rimozione della navbar laterale, nuove route per Analisi unificata.
3. **Componenti condivisi**: `Card`, `ListRow` (icona + titolo + meta + importo), `Chip`, `SegmentedControl`, `SectionHeader`, `Sheet` (bottom sheet), `Alert`, `EmptyState`, `Skeleton`, `Toast`, `ProgressBar`, `StatTrio`.
4. **Schermate**, in questo ordine: Home → Movimenti → Nuova transazione (sheet) → Conti → Analisi mese/anno → Dettaglio categoria → Ricorrenze → Categorie e tag → Investimenti → Debiti → Impostazioni → Login.
5. **Dialog e sheet**: selettore categoria, dettaglio transazione, filtri, giro tra conti, nuovo conto, import estratto conto, collega banca, alert di eliminazione.
6. **Stati**: vuoti, skeleton, errore di sync, offline.
7. **Pulizia**: rimuovi CSS morto, componenti non più usati e i colori residui hard-coded. Verifica che `grep -rE "#[0-9a-fA-F]{6}" src/ --include=*.scss` non restituisca nulla fuori da `_variables.scss`.

## Dati che oggi non esistono

Tre pezzi del nuovo design richiedono dati non ancora esposti. Implementali come componenti che accettano i dati via prop e, se l'endpoint manca, calcolali client-side dai movimenti già in memoria — non inventare endpoint nuovi senza dirmelo:

- **Spesa per giorno della settimana corrente** (grafico a barre della Home).
- **Ricorrenze in arrivo nei prossimi giorni** con somma (card "In arrivo").
- **Ricorrenze scadute non confermate** (blocco in cima a Ricorrenze).
- **Confronti**: "−8% vs agosto" sull'hero e "sopra media" sulle categorie richiedono la media dei 3 mesi precedenti.

## Come voglio le domande

Se una scelta è ambigua, non indovinare: chiedimi. In particolare fermati a chiedere se serve toccare il backend, se un dato non è ricavabile dal frontend, o se un componente PrimeReact non riesce a rendere il design richiesto (in quel caso proponi: override CSS o componente custom).
