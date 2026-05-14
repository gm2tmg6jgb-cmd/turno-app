# Changelog

Tutte le modifiche significative di Turno App sono documentate in questo file.

---

## [1.8.7] — 2026-05-14 — Badge Limitante Intelligente + Fix Variante 1A

### ✨ Nuove Funzionalità
- **Badge "Non arriverai al target"** (`GanttPianificazioneView`): il vecchio badge "⚠️ limitante" è stato sostituito con un'analisi completa che considera:
  - Grezzo disponibile + materiale proveniente da fase upstream
  - Tempo rimasto nella settimana al netto del changeover (da `DEFAULT_CHANGEOVER_H`)
  - Pezzi producibili nel tempo rimasto (tempo × jph)
  - Deficit in pezzi e percentuale rispetto al target
  - Proiezione "Se parti ORA": pezzi che si riusciranno a produrre e quante ore aggiuntive servirebbero per raggiungere il target

### 🐛 Bugfix
- **Variante 1A non visualizzata** (`sapMapping.js`): aggiunto riconoscimento dei codici materiale con prefisso `2511109` come variante 1A (prima erano riconosciuti solo i codici `2511108`).
- **`changeoverConfig` non definito in `StatusTab`**: la prop `changeoverConfig` veniva passata al componente ma non era dichiarata nella firma della funzione → errore runtime che bloccava l'intera vista. Fix: aggiunto `changeoverConfig` ai parametri di `StatusTab`.

---

## [1.8.3] — 2026-05-14 — Mappa Flussi Definitivi Componenti OP10

### ✨ Nuove Funzionalità
- **Mappa flussi OP10** (`public/definitive-component-flows.html`): visualizzazione interattiva di tutti i 29 componenti con sequenza fasi, tipo macchina, zona produzione e tempi di attraversamento.
- **Script generazione** (`generate-definitive-component-flows.js`): legge da Supabase `componente_fasi` (157 righe) e `material_fino_overrides`; calcola tempi con lotto 1200 pz, OEE 85%, changeover 1h. Quando le macchine specifiche sono configurate in `material_fino_overrides`, le mostra; altrimenti mostra il tipo SAP (`[SCA]`, `[FRW]`, ecc.).
- **Filtro per progetto**: la mappa è filtrabile per DCT300, 8Fe, DCT ECO, RG+DH.
- **Legenda team colori**: T11 Soft (blu), T12 Hard (viola), T13 RG/DH (verde).

### 📊 Dati generati
- Tempo medio attraversamento: 119.3h (14.9 giorni lavorativi)
- 4 progetti · 29 componenti · ~157 fasi configurate in Supabase

---

## [1.8.2] — 2026-05-11 — Bugfix Alert Pianificazione Changeover

### 🐛 Bugfix Critici
- **Alert scope fix**: L'`useEffect` degli alert era dentro la funzione `StatusTab` ma referenziava
  `lastAlertTime`/`setLastAlertTime` definiti nel componente padre `GanttPianificazioneView` → errore
  runtime `lastAlertTime is not defined`. Fix: spostati `machineStatus` useMemo e alert `useEffect`
  nel componente principale dove lo stato è definito.
- **Forma dati changeover errata** (Check 1 – CO scaduto): l'alert usava `co.compKey` e `co.proj`
  che non esistono sull'oggetto changeover. Gli oggetti changeover hanno `toCompKey` e `toLabel`.
  Fix: `co.compKey` → `co.toCompKey`, messaggio usa direttamente `co.toLabel`.
- **startH/endH inesistenti su changeover** (Check 2 – CO in corso): il codice cercava
  `co.startH <= consumedH && co.endH > consumedH` su `machine.changeovers`, ma gli oggetti
  changeover hanno solo `at` (inizio). Solo i `blocks` hanno `startH`/`endH`.
  Fix: Check 2 ora usa `machine.blocks.find(b => b.type === "co" && b.startH <= ...)`.
- **Campi `proj`/`compKey` errati** (Check 3 – CO imminente): stessa forma sbagliata del Check 1.
  Fix: usa `machine.nextCO.toCompKey` e `machine.nextCO.toLabel`.
- **Dipendenza mancante nel useMemo** (`machineStatus`): `upstreamPhaseConfig` era usato nel
  calcolo ma assente dal dependency array → gli override upstream non triggheravano il ricalcolo.
  Fix: aggiunto `upstreamPhaseConfig` al dep array.
- **`Math.min()` su array vuoto** (Check 5 – ritardo produzione): se nessun item aveva target > 0,
  `Math.min(...[])` restituisce `Infinity`, generando alert `"Sei Infinity% dietro"`.
  Fix: guard `if (withTarget.length > 0)` prima di calcolare `worstDelta`.

### 🛡️ Guardie Aggiuntive
- Alert `useEffect`: aggiunto early-return se `machineStatus.length === 0` o `showToast` non
  definito, per evitare iterazioni a vuoto al primo render prima del caricamento dati.
- Check 4 (componente completato): il `nextLabel` ora usa `nextItem.shortLabel` (già formattato
  come `"DG·DCT"`) invece di ricostruire manualmente `PROJ_SHORT[proj]::compKey`.

---

## [1.8.1] — 2026-05-11 — Smart Changeover Alerts

### 🆕 Nuove Funzionalità
- **Sistema Alert Operatore** in Pianificazione Changeover (Tab "Stato Settimana"):
  - **🔴 CO Scaduto** — quando il changeover pianificato è già passato: `"CAMBIO SCADUTO: dovevi passare a DG·DCT 2.3h fa"`
  - **🔄 CO In Corso** — quando il blocco changeover è attivo in questo momento: `"IN CORSO: changeover → SG2·ECO (fine in 0.8h)"`
  - **⏳ CO Imminente** — quando il prossimo changeover è entro 4h: `"Tra 3.5h: cambia a SG2·ECO"`
  - **✅ Componente Completato** — quando `prodotto >= target`: `"DG·DCT completato! Prossimo: SG2·ECO"`
  - **⚠ Ritardo Produzione** — quando `prodUrgency >= 1` (≥15% sotto ritmo): `"HOB10001: Sei 22% dietro al ritmo previsto"`
- **Debounce 60 secondi**: ogni combinazione `machineId::evento` è tracciata in `lastAlertTime`
  per evitare toast ripetuti ad ogni re-render. Lo stesso alert non riparte prima di 60s.
- Gli alert usano il sistema toast esistente di `App.jsx` (nessun nuovo componente).

### 📐 Architettura
- `lastAlertTime` (stato) definito in `GanttPianificazioneView` — oggetto `Record<string, timestamp>`
- `machineStatus` useMemo spostato dal figlio `StatusTab` al padre `GanttPianificazioneView`
  per essere condiviso con l'`useEffect` degli alert
- `StatusTab` ora riceve `machineStatus` come prop invece di calcolarlo internamente

---

## [1.8.0] — 2026-05-06 — Gantt Pianificazione v2 "La Vista più Importante"

### 🆕 Nuove Funzionalità
- **Tab 1 — Stato Settimana**: avanzamento reale da SAP vs target
  - KPI cards: componenti totali, in linea (≥70%), critici (<30%), % media completamento
  - Tabella con progressbar e badge stato per ogni fase di ogni componente
  - Fonte: `conferme_sap` aggregata per progetto+componente+fase tramite `material_fino_overrides`
  - Timestamp ultimo scarico SAP in header
- **Tab 2 — Gantt Pianificazione**: schedula solo il **rimanente** (target − SAP)
  - Zona grigia = ore già trascorse questa settimana (orizzonte reale)
  - Bundle DG+DG-REV: job unico in fase Saldatura, zero changeover tra loro
  - Tabella job con target/prodotto/rimanente prima del Gantt
  - Legenda colori + "Ore passate" + suggerimento changeover giornaliero
- **Tab 3 — Configurazione**:
  - Sub-tab Target: tabella editabile con bottone "💾 Salva nel DB" → upsert `component_weekly_targets`
  - Sub-tab Ore Changeover: modifica ore changeover per fase in tempo reale
  - Sub-tab Bundle: visualizza i bundle configurati (DG+DG-REV)

### 📊 Architettura
- **Multi-progetto nativo**: macchine fisiche lavorano componenti di tutti i progetti
- **Aggregazione SAP**: nuovo `src/utils/sapMapping.js` con `aggregateSapByPhase()` (logica estratta da ComponentFlowView)
- **Throughput priority**: DB (`componente_fasi`) → localStorage → `THROUGHPUT_CONFIG` costanti
- **Scheduler**: greedy EarliestDueDate su ore rimanenti (non full week)
- **WEEK_HOURS = 144**: 4 turni × 6h × 6 giorni lun–sab

### 🗃️ Query DB
- `macchine` (attivo=true)
- `material_fino_overrides` (per aggregare SAP)
- `componente_fasi` (throughput da DB)
- `component_weekly_targets` filtrato per settimana
- `conferme_sap` filtrato per range settimana (via `fetchAllRows`)

---

## [1.7.0] — 2026-05-05 — Gantt Pianificazione Changeover

### 🆕 Nuove Funzionalità
- **Pianificazione Changeover (Gantt)**: Nuova vista "Pianificazione Changeover" nella sidebar
  - Seleziona settimana e progetto (DCT300, 8Fe, DCT ECO, RG+DH)
  - Tab per fase critica: Dentatura (FRW), Tornitura Hard (DRA), Tratt. Termico (HOK), Rettifica Denti (SLW), Saldatura (SCA)
  - **Gantt per macchina**: visualizza la sequenza ottimale di lotti per ogni macchina con changeover evidenziati
  - **Algoritmo greedy EarliestDueDate**: assegna lotti alle macchine con minor tempo libero, minimizzando i changeover
  - **Cards capacità**: macchine disponibili, ore totali, utilizzo %, changeover totali
  - **Avviso overload**: alert visivo se la domanda supera la capacità disponibile
  - **Tabella target editabile**: modifica i target settimanali in tempo reale per simulare scenari diversi
  - **Suggerimento Changeover**: per ogni componente mostra target/giorno, ore/giorno, ritmo changeover consigliato
  - **Schema giornaliero**: timeline visiva proporzionale che mostra la ripartizione di una macchina condivisa in 24h

### 📊 Algoritmo
- Carica macchine da DB (`macchine` dove `attivo=true`)
- Mappa macchine → fase tramite `tecnologia_id` + prefisso ID (HOK→ht, SLW→teeth_grinding, ecc.)
- Carica target da `component_weekly_targets`
- Per ogni componente calcola: `ore/lotto = phaseHours(phase, cfg)`, `lotti = ceil(target/lotto)`
- Scheduling greedy: ordina per lavoro totale desc, assegna alla macchina con `freeAt` minore, aggiunge 1h changeover quando cambia componente

---

## [1.6.4] — 2026-05-05 — Reset Inventario Settimanale

### 🆕 Nuove Funzionalità
- **Reset Inventario Periodo**: Aggiunto bottone "🔄 Reset Periodo" in Laboratorio Inventario
  - Resetta il periodo dell'inventario fisico al giorno odierno
  - Esclude dalla vista i dati della settimana precedente (rimangono nel DB)
  - I dati SAP ripartiranno dalla nuova data di inizio inventario
  - Dialogo di conferma per evitare reset accidentali
  - Resetta anche le esclusioni di celle applicate

### 🎨 UI/UX
- Modal di conferma reset con design coerente
- Bottone rosso per indicare azione critica
- Visualizzazione della nuova data di inizio nel dialog
- Toast notification con conferma del reset
- Messaggio informativo che i dati non vengono cancellati

---

## [1.6.3] — 2026-05-05 — Throughput Configurabile

### 🆕 Nuove Funzionalità
- **Configurazione Throughput**: Bottone "⚙️ Configura" nel tab Throughput
  - Modifica Lotto (numero di pezzi) per il componente selezionato
  - Modifica OEE (efficienza %) da 1 a 100%
  - La configurazione si salva nel localStorage per ogni componente
  - L'aggiornamento è istantaneo e ricalcola il throughput in tempo reale

---

## [1.6.2] — 2026-05-05 — Fix Evidenziazione Operatori e Throughput Intelligente

### 🐛 Bug Fix
- **Evidenziazione operatori**: Ripristinato il report che mostra gli operatori
  - Usa `rawMatrixData` (non filtrato) per mostrare TUTTI gli operatori indipendentemente dai filtri attivi
  - L'evidenziazione delle celle con bordo rosso ora funziona correttamente
- **Throughput da fase selezionata**: Quando clicchi su una fase, il tempo di throughput parte da lì
  - Esclude automaticamente le fasi precedenti
  - Esclude le fasi finali (assembly, saldatura, ecc.)
  - Ore cumulative ricalcolate da 0 partendo dalla fase selezionata

---

## [1.6.1] — 2026-05-05 — Fix Totale Cella e Miglioramenti Filtri Istantanei

### 🐛 Bug Fix
- **Totale cella griglia**: Risolto problema dove il totale della cella non rifletteva i filtri attivi
  - Prima: cella mostrava 677 (lordo con storni), dettaglio mostrava 351 (netto senza storni) — inconsistente
  - Dopo: cella e dettaglio mostrano lo stesso totale quando i filtri sono attivi — coerente
  - Causa: `filterExcludeSto` e `filterExcludeOperators` non erano nelle dipendenze dell'useEffect di caricamento dati

### 🚀 Performance & UX
- **Filtri istantanei**: Applicazione dei filtri senza ricaricare dati dal database
  - Nuovo state `rawMatrixData` mantiene i dati non filtrati in memoria
  - useMemo applica i filtri in tempo reale ai dati già caricati
  - Risultato: aggiornamento immediato (zero delay) quando cambi i filtri
  - Ricaricare da database solo quando cambiano data/turno/ecc., non per ogni cambio filtro

### 🆕 Nuove Funzionalità
- **Ricerca nel report operatori**: Aggiunto input per cercare operatori in tempo reale
  - Filtra case-insensitive mentre digiti
  - Resetta automaticamente quando chiudi il modal
- **Bottone "Resetta filtri"**: Azzera tutti i filtri attivi in un click
  - Resetta `Escludi storni` a false
  - Resetta `Escludi operatori` a lista vuota
  - Pulisce il localStorage e applica istantaneamente (zero delay)

---

## [1.6.0] — 2026-05-04 — Filtri Operatori e Report Storni in Avanzamento Componenti

### 🆕 Nuove Funzionalità
- **Filtro Storni e Operatori**: Aggiunto bottone "🔽 Filtra" in Avanzamento Componenti per:
  - Escludere automaticamente storni (righe dove colonna "sto" = "X")
  - Escludere operazioni di specifici operatori (basato su colonna "acq. da")
  - Persistenza filtri in localStorage
- **Report Operatori (📊)**: Nuovo bottone che mostra:
  - Elenco di tutti gli operatori che hanno effettuato modifiche
  - Numero di celle interessate per ogni operatore
  - Numero totale di pezzi modificati per operatore
  - Impatto immediato del filtro (quante celle sarebbero eliminate)
- **Evidenziazione Celle**: Quando attivi un operatore nel report, le celle che contengono le sue modifiche si evidenziano con bordo rosso per individuazione visiva immediata

### 🔧 Miglioramenti
- Aggiunte colonne `acq_da` (TEXT) e `sto` (TEXT) alla tabella `conferme_sap` con relativi indici
- Aggiornati pattern di riconoscimento SAP per includere varianti di "Acq. da" e "Sto"
- Corretto mapping delle colonne SAP durante l'importazione (acq_da e sto ora vengono estratti correttamente)
- Expanded SelectFields in ComponentFlowView per includere le nuove colonne

### 🐛 Bug Fix
- Risolto problema di non riconoscimento delle colonne "Acq. da" e "Sto" durante l'anteprima importazione
- Fixed data extraction for acq_da and sto fields in handlePreview function

### 📊 Database
```sql
ALTER TABLE conferme_sap ADD COLUMN IF NOT EXISTS acq_da TEXT;
ALTER TABLE conferme_sap ADD COLUMN IF NOT EXISTS sto TEXT;
CREATE INDEX idx_conferme_sap_acq_da ON conferme_sap (acq_da);
CREATE INDEX idx_conferme_sap_sto ON conferme_sap (sto);
```

---

## [1.5.0] — 2026-05-01 — Configurazione Fasi RG + DH

### 🆕 Nuove Funzionalità
- **Fasi specifiche RG + DH**: Aggiunte nuove fasi operative (TSF, ORE, ASM) solo per progetto RG + DH
  - TSF (Tornitura Sferico): Operazione di tornithura sferica
  - ORE: Tracciamento ore lavoro
  - ASM (Assembly): Operazioni di assemblaggio
- **Nuovo TH secondario**: Aggiunto start_hard_2 dopo grinding_cone per sequenze specifiche

### 🔧 Fix e Miglioramenti
- Rimosso MZA da DH ASSEMBLAGGIO in RG + DH
- DMC (marcatura) aggiunto dopo EGW solo in progetto 8Fe
- Riposizionamento start_hard (TH) dopo OKU (shot_peening) per sequenza corretta
- Escluse TSF, ORE, ASM dai progetti DCT300, 8Fe e DCT ECO per evitare duplicati
- Configurazione corretta delle fasi per visualizzazione griglia RG + DH: TH → TSF → ORE → ASM → SCA

---

## [1.2.0] — 2026-04-29 — Data e Ora Ultimo Scarico SAP

### 🆕 Nuove Funzionalità
- **Banner settimanale**: Aggiunto timestamp completo (data + ora) dell'ultimo scarico SAP
- Nuovo campo `importato_il` in `conferme_sap` traccia quando i dati sono stati importati da SAP
- Mostra formato: "29/04 00:48" quando è disponibile il timestamp

### 🔧 Fix
- Semplificato il fetching dei dati eliminando query separata a storico_produzione
- Timestamp `importato_il` deve essere settato esplicitamente durante l'importazione SAP

---

## [1.1.1] — 2026-04-29 — Fix Conteggio Turni Banner Settimanale

### 🔧 Fix
- **Banner settimanale**: Corretto conteggio turni che ora conta combinazioni uniche (data + turno_id) anziché solo turni_id
- Banner ora visualizza correttamente 8/20 turni completati (precedentemente mostrava 4/20)
- Target cumulativo ora calcolato moltiplicando target per turno × numero turni lavorati
- Aggiunto useEffect per visualizzare alert con turni contati al click su progetto in weekly view

### 🎨 UI
- Banner settimanale con gradiente blu e informazioni aggiornamento dati
- Mostra giorno di ultimo aggiornamento (es. "martedì")
- Visualizza turni completati/totali e numero turni mancanti

---

## [1.1.0] — 2026-04-23 — Performance e Fix QuickConfigModal

### 🚀 Performance
- Lazy-load jsPDF e html2canvas (-150KB bundle iniziale): caricati solo al click su "Esporta PDF"
- Costanti PROCESS_STEPS e PROJECT_COMPONENTS spostate in constants.js

### 🔧 Fix
- Rimossi console.log di debug dalla produzione (QuickConfigModal, ComponentFlow)
- Fix QuickConfigModal: dati esistenti ora caricati correttamente
- Fix QuickConfigModal: supporto 3 codici materiale per componenti DCT300 (DG, SG3-7)
- Fix: vincolo unico material_fino_overrides corretto (per fase+componente+progetto)
- Fix: macchina_id salvata direttamente in material_fino_overrides

### 🎨 UI
- Modal uniformati con design coerente in tutta l'app

---

## [1.0.0] — 2026-04-23 — Prima Release Stabile

### 🔐 Sicurezza
- Aggiunto sistema di login con email e password (Supabase Auth)
- Aggiunto recupero password via email
- Abilitato Row Level Security (RLS) su tutte le 36 tabelle del database
- Rimosse tutte le policy pubbliche — solo utenti autenticati accedono ai dati
- Aggiornato jsPDF (fix 5 CVE critiche)
- Aggiornate dipendenze vulnerabili (da 10 a 1 vulnerabilità rimasta)
- Rimossi log di debug dalla produzione

### 🔧 Fix Pianificazione
- Corretti pulsanti turno da M,P,S,N,D → A,B,C,D (turni di rotazione validi)
- Rimossa conversione errata D→1: ora mostra la fascia oraria corretta (N, M, P, S)
- Fix visualizzazione turno di oggi: usa getSlotForGroup per calcolare la fascia oraria
- Colori motivi assenza ora rispettano il colore configurato nel database

### 🆕 Nuove Funzionalità
- Versione app visibile nella sidebar e nella pagina di login
- Changelog delle modifiche per ogni versione

---

## Prossime Versioni

Le versioni future saranno documentate qui con le relative modifiche.
