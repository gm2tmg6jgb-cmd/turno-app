# Changelog

Tutte le modifiche significative di Turno App sono documentate in questo file.

---

## [1.2.0] — 2026-04-29 — Data e Ora Ultimo Scarico SAP

### 🔧 Fix
- **Banner settimanale**: Aggiunto timestamp completo (data + ora) dell'ultimo scarico SAP
- Fetch separato da `storico_produzione` per ottenere `importato_il`
- Mostra formato: "29/04 00:48" invece della sola data

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
