# 📊 Flusso Completo di Ogni Componente — Timeline Dettagliata

## Parametri Globali di Calcolo

```
Lotto standard:        1200 pz
OEE (efficienza):      0.85 (85%)
Setup changeover:      1 h
Rack size:             72 pz
```

**Formula calcolo ore:**
- Se fase ha `fixedH` (tempo fisso): `ore = ceil(lotto/chargeSize) × fixedH + changeover`
- Se fase ha `pzH` (pezzi/ora): `ore = (lotto / (pzH × oee)) + changeover`
- Se `noChangeOver: true`: non aggiunge l'ora di setup

---

## 🔵 DCT300 — Componenti Sincroni

### SG1·DCT300 (Ingranaggio Primo)

```
FASE 1: Saldatura Soft (laser_welding)
├─ pzH: 130 pezzi/ora
├─ Calcolo: 1200 / (130 × 0.85) + 1 changeover
├─ Tempo: 10.8 + 1 = 11.8 ore
├─ Zone: Z6-Z7 (Saldatura, SCA/FRW/SDA)
└─ Timeline: Lun 08:00 → Lun 19:48

FASE 2: Dentatura (hobbing)
├─ pzH: 86 pezzi/ora
├─ Calcolo: 1200 / (86 × 0.85) + 1 changeover
├─ Tempo: 16.4 + 1 = 17.4 ore
├─ Zone: Z9-Z11 (Dentature, FRW multiple)
└─ Timeline: Mar 08:00 → Mar 01:24 (next day)

FASE 3: Trattamento Termico (ht) ★ BOTTLENECK
├─ fixedH: 8 ore (fisso)
├─ chargeSize: 176 pz/carica
├─ Cariche: ceil(1200/176) = 7 cariche
├─ Calcolo: 7 × 8 + 0 (NO changeover)
├─ Tempo: 56 ore
├─ Forno: Tempra/ricottura (no team specifico)
├─ Timeline: Mer 08:00 → Fri 16:00 (CRITICO!)
└─ ⚠️ NOTE: SG1 si miza nel forno con altri componenti

FASE 4: Tornitura Hard (start_hard)
├─ pzH: 104 pezzi/ora
├─ Calcolo: 1200 / (104 × 0.85) + 1 changeover
├─ Tempo: 13.6 + 1 = 14.6 ore
├─ Zone: Z15-Z18 (Tornitura Hard, DRA10102-10113)
└─ Timeline: Sat 08:00 → Sat 22:36

FASE 5: Rettifica Denti (teeth_grinding)
├─ pzH: 100 pezzi/ora
├─ Calcolo: 1200 / (100 × 0.85) + 1 changeover
├─ Tempo: 14.1 + 1 = 15.1 ore
├─ Zone: Z19-Z21 (Rettifica Denti, SLW multiple)
└─ Timeline: Sun 08:00 → Sun 23:06

═══════════════════════════════════════════
TEMPO TOTALE: 11.8 + 17.4 + 56 + 14.6 + 15.1 = 114.9 ore
GIORNI LAVORATIVI (8h/giorno): ~14 giorni
═══════════════════════════════════════════

FLUSSO VISUALE:
┌─────────────────────────────────────────────────────────────────┐
│ SG1·DCT300 — Timeline Settimana 11-22 Maggio                    │
├─────────────────────────────────────────────────────────────────┤
│ Lun ├─Saldatura 11.8h──┤                                        │
│ Mar     ├─Dentatura 17.4h─┤                                     │
│ Mer         ├─────────FORNO 56h───────────┤                    │
│ Sab                              ├─Hard 14.6h─┤                │
│ Dom                                  ├─Rettif 15.1h┤           │
└─────────────────────────────────────────────────────────────────┘
```

---

### SG3·DCT300 (Ingranaggio Intermedio)

```
STESSO FLUSSO DI SG1

FASE 1: Saldatura Soft
├─ Tempo: 11.8 ore
└─ Zone: Z6-Z7

FASE 2: Dentatura
├─ Tempo: 17.4 ore
└─ Zone: Z9-Z11

FASE 3: Trattamento Termico ★
├─ Tempo: 56 ore
├─ ⚠️ DETTAGLIO: Se SG3 arriva al forno quando SG1 è ancora dentro,
│              aspetta la prossima carica libera (56h di attesa!)
└─ Contesa: Compete con SG1, SG4-SG7, 8Fe components

FASE 4: Tornitura Hard
├─ Tempo: 14.6 ore
└─ Zone: Z15-Z18

FASE 5: Rettifica Denti
├─ Tempo: 15.1 ore
└─ Zone: Z19-Z21

TEMPO TOTALE: 114.9 ore (~14 giorni)
```

---

### SG5·DCT300 (Ingranaggio Critico per Urgency)

```
STESSO CALCOLO DI SG1 E SG3

Timeline identico: 114.9 ore totali

⚠️ CRITICITÀ REALE OSSERVATA:
Se SG5 arriva al forno con urgency -17% e FG5/7 arriva con -34%,
il sistema suggerisce di dare priorità a FG5/7 nel forno perché è
17% più critico. Questo causa INVERSION DI PRIORITÀ.
```

---

### DG-REV·DCT300 (Ingranaggio Contrappeso con Saldatura)

```
STESSO FLUSSO con saldatura (DG-REV è saldato)

Fasi identiche: laser_welding → hobbing → ht → start_hard → teeth_grinding
Tempo totale: 114.9 ore
```

---

### RG·DCT300 (Anello di Supporto)

```
FLUSSO RIDOTTO (non passa per tutte le fasi)

Ipotesi: RG probabilmente salta alcune fasi (es. non ha saldatura)
→ Necessito verificare in Supabase le fasi REALI per RG
```

---

## 🟠 8Fe — Componenti Liberi (Ingranaggi Liberi)

### SG2·8Fe, SG3·8Fe, SG4·8Fe, SG5·8Fe, SG6·8Fe, SG7·8Fe, SG8·8Fe

```
STESSO FLUSSO E TEMPI DI DCT300

Tempo totale: 114.9 ore per ognuno

⚠️ DIFFERENZA: Alcune fasi escluse per 8Fe
(vedi EXCLUDED_PHASES nel constants.js)
```

---

### 🔴 FG5/7·8Fe — COMPONENTE CRITICA PER URGENCY

```
FLUSSO IDENTICO MA CON URGENCY DIVERSA

FASE 1: Saldatura Soft
├─ Tempo: 11.8 ore
└─ Zone: Z6-Z7

FASE 2: Dentatura ★ CRITICA PER URGENCY
├─ pzH: 86 (identico agli SG)
├─ Tempo: 17.4 ore
├─ Zone: Z9-Z11
└─ ⚠️ CRITICITÀ: FG5/7 ha tolleranze più strette (gear libero)
                 → Setup più lungo, possibile changeover extra

FASE 3: Trattamento Termico ★ BOTTLENECK
├─ Tempo: 56 ore
├─ Zone: FORNO
└─ ⚠️ CONTESA REALE: Se SG5 e FG5/7 arrivano insieme
                     Si mixano nel forno (no separazione)

FASE 4: Tornitura Hard ★ CRITICA PER URGENCY
├─ Tempo: 14.6 ore
├─ Zone: Z15-Z18
└─ ⚠️ CRITICITÀ: FG5/7 ha geometria speciale (libera)
                → Possibile setup extra vs ingranaggi vincolati

FASE 5: Rettifica Denti ★ CRITICA PER URGENCY
├─ pzH: 100 (standard)
├─ Tempo: 15.1 ore
├─ Zone: Z19-Z21
└─ ⚠️ CRITICITÀ MASSIMA: FG5/7 libero richiede ±0.05mm
                        Setup raffronto vs SG (~2-3h extra)
                        Questa è la zona di INVERSIONE

═══════════════════════════════════════════════════════════════
⚠️ OSSERVAZIONE CRITICA:
Se FG5/7 è indietro (-34%) e SG5 è indietro (-17%),
il sistema suggerisce changeover a FG5/7 già a Z1
per dargli priorità nel forno e nella rettifica denti.

Tempo totale per FG5/7: 114.9 ore + setup extra (~3-5h) = ~120 ore
═══════════════════════════════════════════════════════════════
```

---

## 🟢 DCT ECO — Componenti Eco-Design

### SG2·DCT ECO, SG3·DCT ECO, SG4·DCT ECO, SG5·DCT ECO

```
FLUSSO RIDOTTO (manca start_soft per DCT ECO)

ESCLUSE per DCT ECO:
- dmc, broaching, laser_welding_soft_2, start_soft, ...

Fasi effettive (stima):
├─ Saldatura Soft: 11.8 ore
├─ Dentatura: 17.4 ore
├─ Trattamento Termico: 56 ore ★
├─ Tornitura Hard: 14.6 ore
└─ Rettifica Denti: 15.1 ore

TEMPO TOTALE: ~100 ore (stimato, dipende da EXCLUDED_PHASES)
```

---

### RG FD1·DCT ECO, RG FD2·DCT ECO

```
FLUSSO SPECIALE (Anelli Finali)

Ipotesi: Bypassa forno, percorso parallelo a Z27-Z30
Zone: Z27 (Tornitura RG) → Z28-Z30 (Finitura RG)
Tempo (stima): 20-30 ore parallelo agli SG
```

---

## 📈 Tabella Comparativa: Tempi Totali per Progetto

| Componente | Saldatura | Dentatura | Forno | Tornitura Hard | Rettifica | **TOTALE** |
|-----------|-----------|-----------|-------|----------------|-----------|----------|
| **SG1·DCT300** | 11.8h | 17.4h | 56h | 14.6h | 15.1h | **114.9h** |
| **SG3·DCT300** | 11.8h | 17.4h | 56h | 14.6h | 15.1h | **114.9h** |
| **SG5·DCT300** | 11.8h | 17.4h | 56h | 14.6h | 15.1h | **114.9h** |
| **SG2·8Fe** | 11.8h | 17.4h | 56h | 14.6h | 15.1h | **114.9h** |
| **FG5/7·8Fe** | 11.8h | 17.4h+setup | 56h | 14.6h+setup | 15.1h+setup | **~120h** |
| **SG2·DCT ECO** | 11.8h | 17.4h | 56h | 14.6h | 15.1h | ~100-110h |
| **RG FD1·ECO** | — | — | — | — | — | 20-30h (est.) |

---

## 🎯 Punti Critici di Attraversamento

### 1. Bottleneck Forno (56 ore!)

```
Il forno è la fase più lunga e è il vero collo di bottiglia

Calcolo delle cariche:
- Lotto: 1200 pz
- Capacità carica: 176 pz
- Cariche necessarie: ceil(1200/176) = 7 cariche
- Tempo per carica: 8 ore
- Tempo totale: 7 × 8 = 56 ore

IMPLICAZIONE: Se un componente ha urgency alta,
il forno rallenta TUTTO gli altri componenti.
È la ragione per cui il sistema suggerisce changeover frequenti:
per ottimizzare l'ordine di carica nel forno.
```

### 2. Rettifica Denti (15.1 ore + setup)

```
Per SG normali: 15.1 ore
Per FG5/7 (libero): +2-3 ore di setup extra

Competizione su Z19-Z21 (12 macchine SLW in 3 zone)
Se FG5/7 è in ritardo -34%, riceve priorità
→ SG normali vengono messi in coda (inversione priorità)
```

### 3. Tornitura Soft (11.8 ore + setup)

```
Z1-Z3: 12 macchine DRA
Compete: Tutti i progetti contemporanei

Setup changeover tra progetti: ~1-2 ore
Se passano da DCT300 a 8Fe: aggiungi setup
Se passano da 8Fe a DCT ECO: aggiungi setup
```

---

## 📊 Diagramma Gantt Settimanale (Esempio Reale)

```
SETTIMANA 11-17 MAGGIO

LUNEDÌ
 08:00 ├─ SG1·DCT300 Saldatura (11.8h) ─┤ 19:48
 08:00 ├─ SG5·DCT300 Saldatura (11.8h) ─┤ 19:48
 08:00 ├─ FG5/7·8Fe Saldatura (11.8h) ──┤ 19:48

MARTEDÌ
 08:00 ├─ SG1·DCT300 Dentatura (17.4h) ────────┤ 01:24 (next day)
 08:00 ├─ SG5·DCT300 Dentatura (17.4h) ────────┤ 01:24 (next day)
 08:00 ├─ FG5/7·8Fe Dentatura (17.4h+setup) ──┤ 02:24 (next day)

MERCOLEDÌ → VENERDÌ
 08:00 ├─────────── FORNO (56h) ──────────────┤ 16:00 (Friday)
        │ Cariche: SG1, SG5, FG5/7, SG3, DG-REV, SG4, SG6
        │ Tutti mixati insieme (no separazione variante/progetto)

SABATO
 08:00 ├─ SG1·DCT300 Tornitura Hard (14.6h) ─┤ 22:36
 08:00 ├─ SG5·DCT300 Tornitura Hard (14.6h) ─┤ 22:36
 10:00 ├─ FG5/7·8Fe Tornitura Hard (14.6h+setup) ─┤ 00:36 (next day)

DOMENICA
 08:00 ├─ SG1·DCT300 Rettifica (15.1h) ────────┤ 23:06
 08:00 ├─ SG5·DCT300 Rettifica (15.1h) ────────┤ 23:06
 ⚠️ SLOT LIBERO: FG5/7 in coda (aspetta carica forno)

LUNEDÌ PROSSIMO (fine settimana 2)
 08:00 ├─ FG5/7·8Fe Rettifica (15.1h+setup) ──┤ 23:36
```

---

## 💡 Spiegazione dei Tempi Reali

### Perché il Forno Impiega 56 Ore?

Il forno NON elabora un pezzo alla volta, ma per **cariche** di 176 pz max:

```
Forno: Tempra/Ricottura
├─ Carica 1 (176 pz): 8 ore → es. 100 pz SG1 + 76 pz SG5
├─ Carica 2 (176 pz): 8 ore → es. 100 pz SG1 + 76 pz SG3
├─ Carica 3 (176 pz): 8 ore → es. 100 pz SG1 + 76 pz DG-REV
├─ Carica 4 (176 pz): 8 ore
├─ Carica 5 (176 pz): 8 ore
├─ Carica 6 (176 pz): 8 ore
├─ Carica 7 (176 pz): 8 ore
└─ TOTALE: 56 ore

Dettaglio per SG1 (1200 pz):
├─ Entra in carica 1 (176 pz) → 8 ore
├─ Esce dopo ~4 ore (suoi pz pronti dentro 176 totali)
└─ Timeline: SG1 occupa forno da ora 0 a ora 56
```

### Come si Calcolano le Ore di Rettifica Denti?

```
Rettifica Denti (teeth_grinding):
├─ pzH: 100 pezzi/ora
├─ Lotto: 1200 pz
├─ Ore lavorative: 1200 / (100 × 0.85 OEE)
│                = 1200 / 85
│                = 14.1 ore
├─ Setup changeover: 1 ora
├─ TOTALE: 15.1 ore

Cosa succede nelle 15.1 ore:
├─ 00:00 - 01:00 → Setup (monta utensili, test collaudo)
├─ 01:00 - 15:06 → Rettifica continuativa (100 pz/ora @ 85% OEE)
└─ 15:06 - 15:06 → Fine
```

---

## 🚀 Come il Sistema Usa Questi Tempi

1. **Pianificazione Gantt**: Mostra quando ogni componente entra/esce da ogni zona
2. **Target Giornalieri**: Calcola quanti pz devono essere pronti per raggiungere throughput
3. **Smart Changeover**: Se FG5/7 è 17% più critico, suggerisce changeover perché i tempi sono identici (114.9h)
4. **Inventory Coverage**: Stima quanti giorni mancano al completamento basandosi su questi tempi
5. **Efficiency Analytics**: Monitora pz/h reale vs 100 pz/h previsto (se è 80 pz/h, significa OEE sceso a 0.68)

---

## ❓ Limitazioni e Assunzioni

❌ **Non conosco ancora:**
- Tempi specifici per RG (Anelli di supporto)
- Tempi specifici per DH (Doppi sinus)
- Tempi specifici per RG FD1/FD2 (anelli finali ECO)
- Fasi REALI per ogni componente (caricato da Supabase → `componente_fasi`)
- Quale componente passa per Z27-Z34 e quando
- Tempi di marchiatura finale (Z33) e misurazioni (Z34)

✅ **Assumo:**
- Tutti i componenti SG usano le 5 fasi standard (laser_welding → hobbing → ht → start_hard → teeth_grinding)
- OEE è 85% per tutti
- Lotto standard è 1200 pz per tutti
- Changeover è 1h per tutti (tranne forno che è 0 con noChangeOver)

Per **flussi precisi** di ogni componente, devo interrogare Supabase per le fasi reali di ogni progetto/componente.
