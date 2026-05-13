# Mappa dei Flussi di Componenti 🔄

## Panoramica: Come i Componenti si Muovono attraverso la Produzione

I componenti passano attraverso **tre team di produzione** in sequenza, con ogni team specializzato in una fase specifica del processo:

```
┌─────────────────────────────────────────────────────────────────────┐
│  FLUSSO GENERALE DI PRODUZIONE                                      │
│                                                                      │
│  START (Materia Prima)                                              │
│         ↓                                                             │
│  T11 SOFT (Tornitura Soft + Saldatura + Dentatura Soft)             │
│  Zone: Z1-Z14                                                        │
│         ↓                                                             │
│  TRATTAMENTO TERMICO (fase critica, no changeover)                  │
│  Tempra/ricottura in forno                                          │
│         ↓                                                             │
│  T12 HARD (Tornitura Hard + Rettifica Denti)                        │
│  Zone: Z15-Z26                                                       │
│         ↓                                                             │
│  T13 RG+DH (Tornitura/Rettifica Finale RG + Assembly DH)            │
│  Zone: Z27-Z34                                                       │
│         ↓                                                             │
│  END (Prodotto Finito)                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Team 11 SOFT — Tornitura Soft e Operazioni Iniziali

**Obiettivo:** Forme iniziali, saldature, dentature soft

**Zone di Lavoro:**
- **Z1-Z3**: Tornitura Soft (DRA10061-10071) — 4 macchine per zona
- **Z4**: Dentatura (FRW11042, DRA10072, FRW11060) — Dentature iniziali
- **Z5**: Stozzatura/Pressatura (STW11002, FRA11025)
- **Z6-Z7**: Saldatura (SCA, FRW, SDA) — Giunture critiche
- **Z8**: Smussatura (EGW11006)
- **Z9-Z11**: Dentature (FRW) — Dentature principali
- **Z12-Z13**: SGS/Brocciatura (STW, FRD)
- **Z14**: Marcatura (ZBA11019)

### Componenti che Passano per T11:

**DCT300 (⚙️ Ingranaggi sincroni):**
- SG1, SG3, SG4, SG5, SG6, SG7 → Tornitura + Dentatura
- DG-REV, DG → Saldature + Tornitura
- SGR → Ingranaggio contrappeso
- RG → Anello di supporto

**8Fe (⚙️ Ingranaggi liberi):**
- SG2, SG3, SG4, SG5, SG6, SG7, SG8 → Tornitura + Dentatura
- FG5/7 → Dentatura libera (critica per urgency)
- PG → Ingranaggio pinione
- SGR → Ingranaggio contrappeso

**DCT ECO (⚙️ Ingranaggi eco-design):**
- SG2, SG3, SG4, SG5 → Tornitura + Dentatura
- SGR → Ingranaggio contrappeso

**RG+DH (⚙️ Componenti speciali):**
- RG FD1, RG FD2 → Tornitura RG

---

## Trattamento Termico — Fase Critica (No Changeover)

**Obiettivo:** Indurire gli ingranaggi mediante tempra/ricottura

**Caratteristiche Critiche:**
- **noChangeOver: true** — Non si ferma tra cariche
- **chargeSize: 176 pz** — Capacità forni
- **fixedH: 8** — Tempo fisso indipendente da velocità
- **Tempi:** ~3-6 giorni per completare un ciclo di tempra

**Implicazioni:**
- Se un componente arriva al forno quando ce n'è un altro in ciclo, deve aspettare
- I componenti si mixano nel forno (non c'è separazione per variante)
- Criticalità: Il forno è il collo di bottiglia tra T11 e T12

---

## Team 12 HARD — Tornitura Hard e Rettificazione

**Obiettivo:** Finitura precisione, rettificazione denti post-tempra

**Zone di Lavoro:**
- **Z15-Z18**: Tornitura Hard (DRA10102-10113, DRA10119) — 4 macchine per zona
  - Rimuove trucioli e impurità dalla tempra
- **Z19-Z21**: Rettifica Denti (SLW11009-11027) — 8 macchine
  - Affila i denti dopo indurimento (precisione ±0.05mm)
- **Z22-Z24**: Torno Rettifica (SLA11057-11109) — 7 macchine
  - Finitura conica e superfici di supporto
- **Z25**: Torno Rettifica + Lavatrice (SLA11091-11092)
- **Z26**: UT/Controllo ultrasuoni (MZA11006)

### Componenti che Richiedono T12:

Tutti i componenti SG* e i principali FG passano per:
- **Tornitura Hard** (Z15-Z18) per rimuovere layer di tempra
- **Rettifica Denti** (Z19-Z21) per precisione post-tempra
- **Finitura Conica** (Z22-Z24) per geometria finale

---

## Team 13 RG+DH — Tornitura Finale e Assembly

**Obiettivo:** Tornitura finale, assembly di componenti speciali, marcatura finale

**Zone di Lavoro:**
- **Z27**: Tornitura/Dentatura RG (DRA10058-10059, FRW10109, EGW11007, BOA10094)
  - RG FD1, RG FD2 (anelli finali)
- **Z28**: Smussatura/Foratura RG (DRA4FRW15 — Mini DPF)
- **Z29**: Tornitura/Rettifica RG (DRA10100)
- **Z30**: Rettifica Denti/Tornitura (SLW11045, DRA10096, SLW11125)
  - Finitura finale denti
- **Z31**: Tornitura DH Sinus (DRA11130-11133)
  - Prodotti DH (doppi sinus)
- **Z32**: Assembly/Laser DH (MON12051, SCA11051)
  - Assemblaggio DH per saldature finali
- **Z33**: Marcatura (ZBA11022)
  - Marchiatura finale con numero lotto
- **Z34**: Misurazioni (MISURE)
  - Controllo qualità finale

### Componenti che Passano per T13:

**RG (Anelli di Supporto):**
- RG (DCT300, 8Fe) → Z27-Z30
- RG FD1, RG FD2 (DCT ECO, RG+DH) → Z27-Z30

**DH (Doppi Sinus):**
- DH TORNITURA → Z31
- DH ASSEMBLAGGIO → Z32
- DH SALDATURA → Z32

---

## Come i Componenti si Intrecciano su Macchine Specifiche

### Esempio 1: SG5 (DCT300) - Flusso Completo

```
SG5·DCT300
    ↓
Z1-Z3: Tornitura Soft (DRA10061-10064)  ← compete per gli slot di tornitura
    ↓
Z9: Dentatura Soft (FRW10103-10079)     ← 4 dentature, code possibili
    ↓
FORNO: Trattamento Termico (ht)         ← nodo critico, max 176 pz/carica
    ↓
Z15-Z17: Tornitura Hard (DRA10102-10113)← 3 zone, load-balancing
    ↓
Z19: Rettifica Denti (SLW11009-11027)   ← 4 macchine parallele
    ↓
Z22: Torno Rettifica (SLA11057-11108)   ← 4 macchine
    ↓
Z33: Marcatura + Z34: Misurazioni
    ↓
Fine
```

### Esempio 2: FG5/7 (8Fe) - Percorso Critico di Urgency

```
FG5/7·8Fe (CRITICA PER URGENCY)
    ↓
Z1-Z3: Tornitura Soft (compete con SG*)
    ↓
Z9-Z11: Dentatura Soft (4 macchine FRW)
    ↓
FORNO: Trattamento Termico (compete con tutti)
    ↓
Z15-Z18: Tornitura Hard (compete con SG* per hard)
    ↓
Z19-Z21: Rettifica Denti (AREA CRITICA — serve 100 pz/h)
    ↓
Z22-Z24: Torno Rettifica
    ↓
Fine
```

**Perché FG5/7 è critica:**
- Componente bottleneck per urgency nell'8Fe
- Rettifica denti richiede precisione alta (±0.05mm)
- Se arriva al forno insieme a SG* DCT300, compete per slot

---

## Intertwining su Macchine Comuni

### Zone di Contesa (Dove i Componenti si Intrecciano):

#### Z1-Z3: Tornitura Soft (12 macchine DRA)
Componenti contemporanei:
- SG1, SG3, SG4, SG5, SG6, SG7 (DCT300)
- SG2, SG3, SG4, SG5, SG6, SG7, SG8 (8Fe)
- SG2, SG3, SG4, SG5 (DCT ECO)

**Intertwining:** Cambio rapido tra progetti/componenti, setup changeover ~1h per set di utensili

#### Z9-Z11: Dentature Soft (16 macchine FRW)
Componenti che richiedono dentatura:
- SG3-SG7 (DCT300) + SG2-SG8 (8Fe) + SG2-SG5 (DCT ECO)
- FG5/7 (8Fe) — **CRITICA PER URGENCY**

**Intertwining:** 4 zone parallele, ogni macchina è specializzata per un profilo di dente specifico. FG5/7 spesso dedicate a zone specifiche per urgency.

#### FORNO: Trattamento Termico
Componenti mixati:
- Tutti gli SG da DCT300, 8Fe, DCT ECO insieme
- **Limite:** chargeSize=176, ciclo fisso 8h
- **Critico:** Se un progetto arriva con urgenza >75%, il forno diventa collo di bottiglia

**Intertwining:** Non c'è separazione per variante (1A/21A mixano nel forno) — questo è intenzionale per efficienza termica

#### Z15-Z18: Tornitura Hard (10 macchine DRA)
Componenti dopo tempra:
- Tutti gli SG precedentemente sottoposti a tempra (DCT300, 8Fe, DCT ECO)

**Intertwining:** Setup changeover ~2h per configurazione geometrica diversa (profili conici diversi per SG1 vs SG5 vs 8Fe)

#### Z19-Z21: Rettifica Denti (12 macchine SLW)
Componenti criici per urgency:
- SG3-SG7 (DCT300)
- FG5/7 (8Fe) — **CRITICA**
- SG3-SG5 (DCT ECO)

**Intertwining:** 3 zone parallele, ogni zona specializzata su profilo. FG5/7 causa inversioni di priorità frequenti se ritardo >30%.

#### Z22-Z24: Torno Rettifica (7 macchine SLA)
Componenti che richiedono cono finale:
- SG1-SG7 (DCT300)
- SG2-SG8 (8Fe)
- SG2-SG5 (DCT ECO)

**Intertwining:** Cicli lunghi (30-60 min per pezzo), macchine dedicate per geometria. Load balancing critico.

---

## Varianti 1A vs 21A (DCT300 Specifico)

Percorso identico **fino al forno:**
```
SG5-1A·DCT300 ─┐
               ├─→ Z1-Z3 Tornitura (stessi utensili)
SG5-21A·DCT300 ─┤   Z9-Z11 Dentatura (stessi profili)
               │   FORNO Tempra (nessuna differenza)
               └─→ ...Z15+ identico dopo
```

**Intertwining:** Le varianti si dividono solo per **target e sequenza pianificazione**:
- Se 1A ha 2 giorni di urgency e 21A ha 5, si pianifica 1A prima nel forno
- Ma nel forno fisico si mixano (max efficienza termica)

**Changeover tra varianti:** Viene suggerito dal sistema **solo se urgency >15% divisa**, altrimenti si mantiene la sequenza pianificata

---

## Percorsi Speciali (RG+DH)

### RG FD1 / RG FD2 (Anelli Finali)
```
RG FD1·DCT ECO
    ↓
Z27: Tornitura/Dentatura RG (macchine specializzate)
    ↓
Z28-Z30: Smussatura/Foratura/Rettifica RG
    ↓
Esce dal flusso principale, entra nell'assembly finale
```

**Intertwining:** RG FD1/FD2 sono create in parallelo agli SG per synchronizzazione — se SG5 arriva a Z22, FD1 deve arrivare a Z32 nello stesso periodo per assembly.

### DH SINUS (Doppi Speciali)
```
DH TORNITURA·RG+DH
    ↓
Z31: Tornitura DH Sinus (4 macchine DRA11130-11133)
    ↓
Z32: Assembly + Laser (MON12051, SCA11051)
    ↓
Fine
```

**Intertwining:** DH non passa per il trattamento termico come gli SG. Percorso parallelo indipendente.

---

## Punti di Sincronizzazione Critica

### 1️⃣ **Forno (ht) — Nodo Critico Principale**
- **Bottleneck:** chargeSize=176, ciclo fisso 8h
- **Implicazione:** Se un progetto arriva con urgency +50%, il forno rallenta tutto
- **Changeover:** noChangeOver=true significa che se riempi il forno con DCT300, i componenti 8Fe aspettano

### 2️⃣ **Rettifica Denti (Z19-Z21) — Collo Rettificazione**
- **Bottleneck:** 12 macchine, pz/h variabile per profilo
- **Critica per:** FG5/7 (8Fe) che richiede precisione ±0.05mm
- **Urgency Inversion:** Spesso FG5/7 salta la coda se ritardo >30%

### 3️⃣ **Tornitura Soft (Z1-Z3) — Accesso Iniziale**
- **Bottleneck:** 12 macchine DRA
- **Contesa:** Tutti i progetti DCT300, 8Fe, DCT ECO competono qui
- **Setup:** ~1h per cambio utensili, impatta il flusso successivo

---

## Come il Sistema Suggerisce Changeover (Smart Recommendation)

Quando guardi la **Pianificazione Gantt** per una macchina:

```
Macchina: DRA10061 (Z1 - Tornitura Soft)
┌──────────────────────────────────────────┐
│ 📊 Stato Settimana                       │
│ Adesso: SG5-DCT300 (-17%, 3366 pz)       │
│ ⚠️ FG5/7-8Fe è -34% (+17% urgenza!)      │
│ → Considera changeover: FG5/7            │
│ (4154 pz indietro vs 3366)                │
└──────────────────────────────────────────┘
```

Il sistema usa:
1. **Calcolo urgency relativa** = (target - produced) / target per ogni componente
2. **Soglia di delta** = 15% (se FG5/7 è 15%+ più critico, suggerisce changeover)
3. **Componenti sulla stessa macchina** = sa che DRA10061 può processare sia SG5 che FG5/7

---

## Riepilogo: I 3 Team di Produzione

| Team | Zone | Specialità | Componenti | Bottleneck |
|------|------|-----------|-----------|-----------|
| **T11 SOFT** | Z1-Z14 | Tornitura iniziale, saldatura, dentature soft | SG1-SG7, FG5/7, DG, SGR | Tornitura soft (12x DRA) |
| **TERMICO** | — | Tempra/ricottura | Tutti SG + componenti | Forno (chargeSize=176) |
| **T12 HARD** | Z15-Z26 | Tornitura hard, rettifica denti, finitura | SG1-SG7, FG5/7 | Rettifica denti (12x SLW) |
| **T13 RG+DH** | Z27-Z34 | Tornitura finale, assembly laser, marcatura | RG, RG FD*, DH | Assembly laser DH |

---

## Visualizzazione: Come un Componente si Intrecciai

```
Settimana di Maggio (es. 11-16 maggio)

FLUSSO SG5·DCT300 (rosso)
FLUSSO FG5/7·8Fe (blu)
FLUSSO RG FD1·DCT ECO (verde)

LUN   MAR   MER   GIO   VEN   SAB
 |     |     |     |     |     |
[——SG5 SOFT——→][———FG5/7 SOFT→][———RG SOFT→]
 |     |     |     |     |     |
              [=====FORNO (SG5+FG5/7 mix)=====]
 |     |     |     |     |     |
                          [———SG5 HARD→][FG5/7 HARD→]
 |     |     |     |     |     |
                                  [RG RETT→][MARCA→FINE]

Intertwining osservato:
- SG5 e FG5/7 nel forno insieme (no separazione variante)
- SG5 torna a T12 prima di FG5/7
- RG entra T13 parallelo, esce prima di SG5
```

Perfetto! Ora hai una mappa completa di come i componenti si muovono attraverso il sistema e dove si intrecciano. La prossima volta che guardi la Gantt, avrai una visione chiara di **quali macchine sono collo di bottiglia** e **perché il sistema suggerisce certi changeover**.
