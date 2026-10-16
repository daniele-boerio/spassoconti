# Handoff: redesign SpassoConto (app di contabilità personale)

## Overview

SpassoConto è una web app di contabilità personale (React + TypeScript + SCSS + PrimeReact + Chart.js) che oggi ha l'aspetto di un back-office aziendale: densità da tabella, navigazione a hamburger + sidebar, tipografia piatta, palette incoerente (gradienti lilla/ciano accanto al verde/rosso di default di PrimeReact).

Questo handoff descrive il redesign consumer: mobile-first, un numero protagonista per schermata, navigazione a tab bar, due temi (chiaro e scuro) derivati dallo stesso set di token.

## About the Design Files

I file HTML in questo pacchetto sono **riferimenti di design**, non codice di produzione. Sono prototipi che mostrano aspetto e comportamento previsti. Il compito è **ricreare questi design nell'ambiente esistente del repo** — componenti React, SCSS per file, PrimeReact dove già in uso — non incollare l'HTML.

- `SpassoConto - Design completo.dc.html` — il design nuovo: spec del sistema, 13 schermate chiare, 4 varianti scure, 9 tavole di dialog/stati, e in fondo la mappa schermata → file del repo.
- `SpassoConto - Stato attuale.dc.html` — ricostruzione dell'interfaccia attuale, per confronto.
- `PROMPT.md` — il prompt operativo da dare a Claude Code.

Per aprirli serve `support.js`, incluso nella cartella.

## Fidelity

**Hi-fi.** Colori, dimensioni tipografiche, pesi, spaziature, raggi e ombre sono definitivi e vanno riprodotti fedelmente. Le uniche libertà: micro-animazioni non specificate e il layout desktop (il design è a 430px; su schermi larghi centra una colonna da max 480px).

## Design Tokens

Dichiara i token in `:root` e l'override in `[data-theme="dark"]`. Nessun colore letterale nei componenti.

| Token | Chiaro (Menta) | Scuro (Notte) | Uso |
| --- | --- | --- | --- |
| `--bg` | `#f6f8f7` | `#0a1526` | fondo pagina |
| `--surface` | `#ffffff` | `#101f38` | card, tab bar, sheet |
| `--surface-2` | `#eef1f0` | `#16294a` | riempimenti, track, chip inattivi |
| `--ink` | `#12211c` | `#eaf0f8` | testo primario |
| `--muted` | `#5d6b65` | `#8fa2bd` | testo secondario, meta |
| `--muted-2` | `#68786f` | `#6a7d99` | label assi, icone inattive |
| `--line` | `#e8ecea` | `rgba(255,255,255,.10)` | bordi |
| `--line-soft` | `#f1f4f3` | `rgba(255,255,255,.06)` | separatori interni lista |
| `--accent` | `#0e7c5a` | `#e2a44f` | azioni, budget, stato attivo |
| `--accent-soft` | `#e4f2ec` | `rgba(226,164,79,.14)` | badge e quadrati icona |
| `--on-accent` | `#ffffff` | `#10203a` | testo su accento |
| `--positive` | `#0e7c5a` | `#5ec98f` | entrate, delta positivi |
| `--negative` | `#c2513c` | `#e4796b` | sforamenti, azioni distruttive |
| `--negative-soft` | `#f4ece7` | `rgba(228,121,107,.16)` | fondo badge negativi |
| `--invert-surface` | `#0f2e24` | `transparent` + bordo `rgba(226,164,79,.28)` | card "In arrivo", toast di successo |

Serie grafici (nell'ordine, per categoria):

- chiaro: `#0e7c5a`, `#3f9d7f`, `#6fbba1`, `#9ed9c1`, `#c2513c`
- scuro: `#e2a44f`, `#c98d3f`, `#a97633`, `#5ec98f`, `#e4796b`

### Tipografia

Font UI: **Plus Jakarta Sans** (400/500/600/700/800). Font display: **Instrument Serif** — usato solo per i titoli nel tema scuro (`--font-display`); nel tema chiaro `--font-display` è Plus Jakarta Sans 800.

| Ruolo | Size / weight / tracking |
| --- | --- |
| hero (numero) | 46px / 800 / −0.04em / `tabular-nums` — 56px in Instrument Serif nel tema scuro |
| hero sheet (input importo) | 52px / 800 / −0.04em |
| titolo pagina | 24px / 800 / −0.03em (28px Instrument Serif nel tema scuro) |
| numero grande (patrimonio) | 32–34px / 800 / −0.035em |
| numero card | 26px / 800 / −0.03em |
| titolo card | 15px / 700 / −0.01em (20px Instrument Serif nel tema scuro) |
| titolo sheet | 19px / 800 / −0.02em |
| riga lista | 14.5px / 600 |
| importo riga lista | 15px / 700 / `tabular-nums` |
| corpo | 13.5–14px / 400–600 / line-height 1.45–1.5 |
| meta | 12px / 400 / `--muted` |
| eyebrow | 11px / 700 / 0.1em / uppercase / `--muted` |
| header di gruppo lista | 12px / 700 / 0.08em / `--muted` |
| label tab bar | 10.5px / 600 (700 se attiva) |

### Spaziature, raggi, ombre

- Gutter pagina 20px. Gap tra card 14px. Padding card 20–22px. Riga lista 13px verticale. Padding sheet 14px sopra / 20px lati / 24px sotto.
- Raggi: card 22, card interna / lista 20, input e bottone 16, quadrato icona 12, sheet `28px 28px 0 0`, alert 24, pillole 999.
- Ombra unica tema chiaro: `0 1px 2px rgba(18,33,28,.04)`. Tab bar: `0 -8px 20px -12px rgba(18,33,28,.25)`. FAB: `0 10px 22px -8px rgba(14,124,90,.7)`. Nel tema scuro le card non hanno ombra: si separano con `--surface`.
- Overlay dei modali: `rgba(18,33,28,.45)`; per l'alert `.5`.

## Screens / Views

Layout comune a tutte le schermate principali: colonna flex su fondo `--bg`; header non scrollabile (padding `20px 20px 14px`); contenuto scrollabile con `padding: 0 20px 100px`; tab bar fissa in basso, 82px di altezza + safe-area.

### Tab bar (globale)

5 slot equidistanti su `--surface`, bordo superiore `--line`. Slot: icona 18px + label 10.5px, colore `--muted`, `--accent` + weight 700 quando attivo. Terzo slot: FAB 56×56 tondo, `--accent`, icona `+` 20px, sollevato di 14px sopra la barra. Apre lo sheet "Nuova transazione".

### 1. Login

Colonna con `padding: 64px 24px 32px`, `justify-content: space-between`. Logo 52×52 raggio 18 su `--accent` con la lettera S. Titolo "Bentornato" 30px/800. Sottotitolo 14.5px `--muted`. Due campi (email, password) con label 12.5px/700 `--muted`, input `--surface` bordo `--line` raggio 16 padding 15/16, icona a sinistra e occhio a destra sulla password; `box-sizing: border-box` obbligatorio. "Password dimenticata?" 13px/700 accento allineato a destra. Bottone primario 54px raggio 16 `--accent`; secondario stesso formato su `--surface` con bordo. In fondo, riga "Non hai un account? **Registrati**".

### 2. Home

Header: "Ciao Daniele" 13px `--muted` + "Settembre 2026" 17px/700; a destra icona calendario (38px tonda, `--surface`, bordo) e avatar iniziali (38px tondo, `--accent-soft`, testo `--accent` 800).

Contenuto, nell'ordine:

1. **Card hero.** Eyebrow "Spese di settembre" + badge delta ("−8% vs agosto", `--accent-soft`). Numero 46px con "€" 20px in `--muted-2`. Barra budget: track 10px `--surface-2`, segmento speso 74% `--accent`, segmento previsto 14% `#9ed9c1`. Sotto, due righe 12.5px: "74% del budget di **1.200 €**" e "restano **135 €**".
2. **Trio metriche.** Card con `grid-template-columns: 1fr 1fr 1fr`, celle padding 14/12, separatori verticali `--line-soft`; eyebrow 11px + valore 16px/800 (Risparmio in `--positive`).
3. **Questa settimana.** Titolo card + "media **38 €**/giorno". 7 barre flex `gap: 10px`, altezza area 96px, raggio 8, `--accent-soft` per i giorni passati, `--accent` per il massimo, `--surface-2` per i giorni futuri; label giorno 11px sotto ogni barra.
4. **Dove vanno i soldi.** 4 righe: quadrato icona 34px raggio 12 `--accent-soft`, nome + importo su una riga 13.5px, barra 6px sotto con il colore della serie. La categoria fuori media usa `--negative-soft`/`--negative` e il suffisso "· sopra media".
5. **In arrivo.** Card `--invert-surface` (`#0f2e24` nel chiaro), testo `#eaf3ef`, meta `#9ed9c1`. Titolo + "663 € nei prossimi 10 giorni", poi righe ricorrenza con quadrato icona su `rgba(255,255,255,.1)`.
6. **Ultimi movimenti** (3 righe) con link "Vedi tutti".

### 3. Movimenti

Header: titolo + due icone tonde (refresh, filtri). Campo di ricerca pill `--surface` bordo `--line`. Riga di chip filtro scorrevole: il chip attivo è `#0f2e24` (tema chiaro) / `--accent` (scuro) con testo invertito; gli altri `--surface` bordo `--line`. Card riepilogo: "Saldo del mese" eyebrow + valore 20px/800 `--positive`, a destra Entrate/Uscite in colonna.

Lista raggruppata per giorno: header di gruppo (data uppercase a sinistra, subtotale a destra, entrambi 12px/700 `--muted`) e card con righe separate da `--line-soft`. Riga: cerchio icona 36px (`--bg`, o `--accent-soft` per le entrate), titolo 14.5px/600, meta "Categoria · Sottocategoria · #tag", importo 15px/700 a destra (`--positive` se entrata).

### 4. Nuova transazione (bottom sheet)

Sheet ancorato in basso, raggio superiore 28, handle 44×4 `--surface-2` centrato. Titolo + X. Segmented control Uscita / Entrata / Giro su `--surface-2` con pillola attiva `--surface` e ombra leggera. Importo centrato 52px/800 con "€" 24px; sotto, 12.5px `--muted`: "Conto Principale · saldo dopo: 2.376,60 €". Poi righe-campo su `--bg` raggio 16: Categoria e Conto (quadrato icona + label 11.5px/700 + valore 14.5px + chevron), coppia Data/Tag affiancata, Descrizione. Due chip azione: "Rendi ricorrente", "Dividi". Bottone primario 54px "Salva transazione".

### 5. Ricorrenze

Header con back + titolo. Card `--invert-surface`: "Impegno fisso mensile" 26px/800 e, a destra, "su entrate 44%". Gruppo "Prossimi 30 giorni": righe con colonna data a sinistra (giorno 16px/800 + mese 10.5px/700 uppercase, larghezza 42px), titolo + meta "Mensile · Categoria · Conto", importo + stato ("attiva" `--positive` / "sospesa" `--muted-2`). Gruppo "Scadute da confermare": card con bordo `#eddcd4`, icona `--negative-soft`, bottone pill "Registra".

### 6. Conti (e menu)

Header: eyebrow "Patrimonio netto" + numero 34px/800 e badge delta a destra.

Card conto: quadrato icona + nome + badge "collegato"; sotto, saldo 26px/800 e "sync 2 ore fa". Salvadanaio: aggiunge obiettivo, percentuale e barra 6px. Prepagata: card compatta a una riga.

Poi una card-lista che assorbe il vecchio menu laterale: Investimenti (con valore), Debiti (valore `--negative`), Categorie e tag, Ricorrenze ("4 attive"), Impostazioni. Chiude un pulsante tratteggiato "Aggiungi conto" (bordo `1px dashed --line`, testo `--accent`).

### 7. Investimenti

Header con back. Card riepilogo: "Valore di mercato" 32px/800, badge percentuale, e sotto Investito / P&L. Per titolo: card con nome 15.5px/700, chip ticker `--accent-soft` e chip ISIN `--surface-2`, badge percentuale (positivo `--accent-soft`, negativo `--negative-soft`), griglia 2×2 Quantità / Prezzo medio / Prezzo attuale / Valore, footer con data e azioni ("Operazioni", matita). Chiude "Aggiungi titolo" tratteggiato.

### 8. Debiti

Card riepilogo: "Residuo totale" 32px/800 `--negative`, barra di rimborso 8px, riga "Rimborsato il **59%** di 6.120 € · fine stimata giugno 2027". Per debito: nome, badge stato ("Aperto" `--negative-soft` / "Pagato" `--accent-soft`), residuo 22px/800 con "di 6.000,00 €", barra 6px, due righe di meta, footer con "Registra pagamento" (pieno) + matita + cestino (`--negative-soft`). I debiti chiusi hanno `opacity: .72` e card compatta.

### 9. Categorie e tag

Header con back, titolo e chip "Migra". Segmented Uscite / Entrate / Tag. Card categoria: quadrato icona, nome 15px/700, meta "N sottocategorie · importo del mese", chevron. Se espansa, i figli sono chip su `--surface-2` con importo in `--muted` bold, più un chip tratteggiato "+ Aggiungi", indentati di 48px. Card "Senza categoria" con bottone "Assegna". In fondo, blocco "Tag più usati": pill `--surface` bordo `--line` con conteggio.

### 10. Analisi — Mese

Header: titolo + selettore periodo pill. Segmented Mese / Anno / Categorie.

1. **Card risparmio**: eyebrow + 30px/800 `--positive` + badge delta; barra impilata 12px (uscite `--accent`, accantonato `#9ed9c1`, rimasto `--surface-2`); legenda a 3 righe con pallini 9px raggio 3; footer con Entrate e Rimborsi.
2. **Uscite per categoria**: 4 righe con barra 6px e chevron (portano al dettaglio categoria).
3. **Da notare**: due insight con quadrato icona (uno `--negative-soft`, uno `--accent-soft`) e frase 13.5px con la parte quantitativa in bold.

### 11. Analisi — Anno

1. **Entrate e uscite**: 6 gruppi di due barre affiancate (`gap: 3px`, raggio `6px 6px 0 0`), area 130px; entrate `--accent`, uscite `--surface-2`, mese corrente `#9ed9c1`; legenda a 3 voci.
2. **Trend risparmio**: SVG `viewBox="0 0 360 150"` — area `#eaf5f0`, polilinea `--accent` 3px con `stroke-linejoin: round`, linea di tendenza tratteggiata `--muted-2` `5 5`, punto finale r=5.5. Sotto, label mesi 10.5px.
3. **Tabella totali**: Entrate, Uscite, Accantonato, Risparmio netto (ultima riga 16px/800 `--positive`).

### 12. Dettaglio categoria

Da Analisi. Header con back, nome categoria, selettore "6 mesi". Card: mese corrente 30px/800 + media 6 mesi a destra; sparkline SVG 120px con linea media tratteggiata. Poi "Sottocategorie" con barre, e "Movimenti del mese · N" come lista raggruppata.

### 13. Impostazioni

Card profilo (avatar 52px, nome 16px/700, email 12.5px, chevron). Gruppo "Aspetto": tre anteprime tema affiancate 56px di altezza (chiaro `#f6f8f7`, scuro `#0a1526`, sistema con gradiente 120° a metà), bordo 2px `--accent` sulla selezionata. Gruppo "Soldi": Budget mensile, toggle "Includi ricorrenti future", Importa estratto conto, Banche collegate. Gruppo "Privacy": toggle "Nascondi importi", toggle "Sblocco con Face ID". Chiude "Esci" (`--surface`, bordo, testo `--negative`).

Toggle: 46×28 raggio 999, track `--accent` se on / `--surface-2` se off, pallino 22px bianco.

## Dialog e sheet

Regola: form e scelte → bottom sheet ancorato in basso; conferme distruttive → alert centrato 326px. Mai dialog a tutta pagina.

- **Selettore categoria** — sheet al 74% dell'altezza. Ricerca, blocco "Usate di recente" con chip (il selezionato è pieno `--accent`), lista "Tutte" con categorie espandibili; i figli sono righe indentate 46px con spunta tonda 20px `--accent` sul selezionato. Footer a due bottoni: "Nuova categoria" (`--surface-2`) e "Conferma" (pieno).
- **Dettaglio transazione** — sheet ad altezza contenuto. Intestazione: quadrato icona 52px, titolo 17px/700 + data/ora, importo 24px/800. Tabella su `--bg` con Categoria, Conto, Tag, Saldo dopo. Blocco "Nota". Riga allegato su `--accent-soft` con nome file e icona download. Footer: "Modifica" pieno + duplica + elimina (`--negative-soft`).
- **Filtri** — Periodo (chip, l'ultimo tratteggiato "Personalizzato"), Tipo (segmented a 4), Conti (chip multipli con spunta), Importo (range slider: track 6px, due maniglie 22px `--surface` bordo 2px `--accent`), toggle "Solo senza categoria", bottone "Mostra 42 movimenti". Header con "Azzera" a destra.
- **Giro tra conti** — importo centrato, due righe-campo Da/A con bottone scambio 36px sovrapposto a destra, card `--accent-soft` "Saldi dopo il giro" con le due righe, barra obiettivo e nota percentuale, coppia Data/Ripeti, bottone "Sposta 200,00 €".
- **Nuovo conto** — griglia 2×2 di tipi (selezionato: `--accent-soft` + bordo 1.5px `--accent`, testo e icona `--accent`), Nome, coppia Saldo iniziale/Valuta, due toggle, riga tratteggiata "Collega la banca", bottone "Crea conto".
- **Import estratto conto** — wizard: sottotitolo "Passo 2 di 3", tre segmenti di progresso 4px, card file con conteggio righe e X, trio Nuove/Duplicati/Da rivedere (numeri 20px/800), lista "Da rivedere" con bordo `#eddcd4` e bottone "Assegna", toggle "Salta i duplicati", footer Indietro (1fr) + "Importa 58 movimenti" (2fr).
- **Collega banca** — sheet al 78%, ricerca, lista banche con monogramma 38px, nota di sicurezza su `--accent-soft` con icona scudo, link testuale "Preferisco importare un file".
- **Alert elimina** — 326px, icona 52px tonda `--negative-soft`, titolo 18px/800, spiegazione con la conseguenza esplicita ("il saldo torna a…"), bottone `--negative` pieno + "Annulla" su `--surface-2`.

## Stati vuoti, caricamento, feedback

- **Lista vuota**: card, quadrato icona 52px raggio 18 `--accent-soft`, titolo 16px/700, testo 13.5px `--muted` (max 30ch), due bottoni ("Aggiungi spesa" pieno, "Importa file" su `--surface-2`).
- **Ricerca senza risultati**: variante più compatta, icona su `--surface-2`, titolo che cita il termine cercato, link "Azzera i filtri".
- **Skeleton**: tre righe lista con cerchio 36px e barre `--surface-2` / `--line-soft` di larghezze diverse (58%/36%, 44%/52%, 66%/30%). Animazione: pulse 1.4s ease-in-out infinite su `opacity` .6→1.
- **Toast successo**: `--invert-surface`, icona check `#9ed9c1`, testo 14px/600, azione "Annulla" a destra. **Errore sync**: `--surface` bordo `#eddcd4`, icona triangolo `--negative`, titolo + meta, azione "Riprova". **Offline**: `--surface-2`, testo `--muted`.

## Interactions & Behavior

- Cambio tab: nessuna transizione di pagina, solo swap del contenuto; lo stato di scroll di ogni tab si conserva.
- FAB → sheet "Nuova transazione": slide-up 220ms `cubic-bezier(.32,.72,0,1)`, overlay in fade 160ms. Chiusura per tap sull'overlay, X, o drag verso il basso oltre 120px.
- Chip filtro: toggle immediato, la lista si aggiorna senza spinner a tutta pagina (skeleton solo al primo caricamento).
- Riga movimento: tap → sheet dettaglio. Swipe da destra a sinistra → azioni elimina/duplica.
- Categoria in Analisi: tap → pagina dettaglio categoria.
- Pull-to-refresh su Home e Movimenti → sync dei conti collegati; in caso di errore mostra il toast "Sync non riuscita" senza bloccare la vista.
- Eliminazione: alert di conferma, poi toast con "Annulla" attivo per 5 secondi (undo ottimistico).
- Cambio tema: nessuna animazione sui colori (evita il flash), applica `data-theme` e salva.
- "Nascondi importi": sostituisce ogni cifra con `••••` mantenendo la larghezza; si sblocca con Face ID o riaprendo l'app.
- Stati interattivi: `:active` scala 0.97 su bottoni e card tappabili, 120ms. Focus visibile: outline 2px `--accent` offset 2px.

## State Management

Nessun cambio d'architettura richiesto: riusa il pattern del repo. Stato nuovo da introdurre:

- `theme: 'light' | 'dark' | 'system'` — globale, persistito in localStorage.
- `hideAmounts: boolean` — globale, persistito.
- `activeTab` — dal router, non da stato locale.
- Per Movimenti: `{ period, accounts[], type, categories[], amountRange, onlyUncategorized, query }` in un unico oggetto filtri, riflesso nell'URL così i filtri sopravvivono al refresh.
- Per Analisi: `{ scope: 'month' | 'year' | 'categories', period }`.
- Per gli sheet: uno stato di navigazione modale (quale sheet è aperto + payload), non un booleano per dialog.

## Assets

Nessuna immagine. Icone: **PrimeIcons** (già nel repo), 13–20px secondo il contesto — nel prototipo sono usate `pi-home`, `pi-list`, `pi-chart-bar`, `pi-wallet`, `pi-plus`, `pi-search`, `pi-sliders-h`, `pi-refresh`, `pi-calendar`, `pi-shopping-cart`, `pi-shopping-bag`, `pi-car`, `pi-ticket`, `pi-bolt`, `pi-home`, `pi-credit-card`, `pi-building-columns`, `pi-chart-line`, `pi-receipt`, `pi-tags`, `pi-tag`, `pi-hashtag`, `pi-arrow-up-right`, `pi-arrow-down-right`, `pi-chevron-right/down`, `pi-arrow-left`, `pi-times`, `pi-check`, `pi-check-circle`, `pi-exclamation-circle`, `pi-exclamation-triangle`, `pi-trash`, `pi-pencil`, `pi-clone`, `pi-paperclip`, `pi-download`, `pi-file-excel`, `pi-link`, `pi-shield`, `pi-wifi`, `pi-sign-out`, `pi-cog`, `pi-user`, `pi-lock`, `pi-eye`, `pi-id-card`, `pi-sort-alt`, `pi-align-left`, `pi-money-bill`, `pi-play`, `pi-star`, `pi-ellipsis-h`, `pi-arrow-right-arrow-left`.

Font da Google Fonts: `Plus+Jakarta+Sans:wght@400;500;600;700;800` e `Instrument+Serif`.

I grafici restano su Chart.js: cambiano solo colori (serie sopra), rimozione delle griglie non necessarie, legende a pallini quadrati 9px raggio 3, tooltip su `--surface` con testo `--ink`.

## Mappa schermata → codice esistente

| Schermata nuova | Sostituisce | Note |
| --- | --- | --- |
| Home | `home_page/*`, `components/budget_card`, `card_carousel`, `credit_card`, `transaction_list`, `charts/custom_doughnut_chart` | hero = spese del mese, non risparmio; servono settimana corrente e ricorrenze in arrivo |
| Movimenti | `transaction_page/*`, `transaction_page/transactions/*` | raggruppamento per giorno con subtotale; i filtri della sidebar diventano chip |
| Ricorrenze | `transaction_page/recurrings/*` | nuovo blocco "scadute da confermare" |
| Conti | `conti_page/*`, `components/credit_card`, `components/navbar/*` | le card colorate diventano righe patrimonio; qui vive il menu ex-hamburger |
| Investimenti | `investimenti_page/*` | card per titolo con griglia 2×2 |
| Debiti | `debiti_page/*` | progressione di rimborso in evidenza |
| Categorie e tag | `category_page/*`, `tags_page/*` | una pagina, tre tab; sottocategorie come chip |
| Analisi mese/anno | `statistics_page/*`, `month_statistics/*`, `charts_page/*`, `components/charts/*` | fusione in una sola route |
| Dettaglio categoria | `dialog/transactions_list_dialog/*`, `components/custom_card` | da dialog a pagina |
| Nuova transazione | `dialog/transaction_dialog/*` | bottom sheet |
| Selettore categoria | parte di `transaction_dialog` | sheet dedicato |
| Filtri | filtri in `navbar` / `transaction_page` | sheet dedicato |
| Nuovo conto | `dialog/*` conti | sheet |
| Import estratto conto | `dialog/import_statement_dialog/*` | wizard 3 passi |
| Collega banca | `dialog/bank_connect_dialog/*` | sheet con lista banche |
| Impostazioni | `dialog/budget_settings_dialog/*` + voci sparse | pagina unica |
| Login | `auth_page/*` | — |

## Files

- `SpassoConto - Design completo.dc.html` — design nuovo (spec + 26 tavole)
- `SpassoConto - Stato attuale.dc.html` — interfaccia attuale ricostruita
- `support.js` — runtime necessario per aprire i due file nel browser
- `PROMPT.md` — prompt operativo per Claude Code
