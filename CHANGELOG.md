# Changelog

Tutte le modifiche significative di Turno App sono documentate in questo file.

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
