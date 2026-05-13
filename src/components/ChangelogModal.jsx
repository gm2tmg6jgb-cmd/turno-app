import { version } from "../../package.json";
import Modal from "./Modal";

const CHANGELOG = [
    {
        version: "1.8.5",
        data: "13 Maggio 2026",
        label: "Fix: SG4 mancante nel Report Produzione DCT ECO",
        modifiche: [
            {
                categoria: "🐛 Bugfix",
                voci: [
                    "Componente SG4_ECO aggiunto al report produzione: ora DCT ECO mostra correttamente tutti 6 componenti (SG2, SG3, SG4, SG5, SGR, RG)",
                ]
            }
        ]
    },
    {
        version: "1.8.4",
        data: "12 Maggio 2026",
        label: "Ordini Cliente DCT300 — Varianti 1A / 21A",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "Import Excel ordini cliente DCT300: carica file con colonne Data, 1A, 21A dalla tab Configurazione → Ordini DCT300",
                    "Calcolo automatico target settimanale per variante (1A e 21A) in sostituzione del target fisso",
                    "Sequenza produzione ottimale: la variante con prima consegna più urgente viene pianificata per prima, poi CO, poi l'altra",
                    "Componenti condivisi (SG1, SGR, DG-REV): target = somma 1A + 21A, nessun changeover tra varianti",
                    "Componenti variante-specifici (SG3, SG4, SG5, SG6, SG7, DG, RG): due item separati nel Gantt con target e avanzamento proporzionale",
                    "Stato settimana: macchine DCT300 mostrano 'SG3·DCT·1A' e 'SG3·DCT·21A' con percentuale SAP proporzionale",
                    "Ordini persistiti in localStorage con reset automatico a cambio settimana",
                ]
            }
        ]
    },
    {
        version: "1.8.3",
        data: "12 Maggio 2026",
        label: "Fix Raccomandazione Componente su Tutte le Macchine",
        modifiche: [
            {
                categoria: "🐛 Bugfix",
                voci: [
                    "Raccomandazione 'continua con': ora usa SAP shortLabel/color direttamente senza cercare il componente in itemsWithProgress (falliva se la macchina era pianificata su un componente diverso da quello SAP)",
                    "Macchine con CO scaduto: aggiunta visualizzazione '● {comp SAP} → passa a ● {target}' per mostrare cosa è in produzione ora prima dell'istruzione di changeover",
                    "Fix sistematico per tutte le macchine, non solo per DRA10062",
                ]
            }
        ]
    },
    {
        version: "1.8.2",
        data: "11 Maggio 2026",
        label: "Bugfix Alert Pianificazione Changeover",
        modifiche: [
            {
                categoria: "🐛 Bugfix",
                voci: [
                    "Alert CO scaduto: corretto accesso ai campi changeover (toCompKey/toLabel invece di compKey/proj inesistenti)",
                    "Alert CO in corso: ora usa machine.blocks invece di machine.changeovers (solo i blocks hanno startH/endH)",
                    "Alert CO imminente: stessa correzione forma dati del CO scaduto",
                    "machineStatus useMemo: aggiunto upstreamPhaseConfig al dep array (gli override upstream non triggheravano il ricalcolo)",
                    "Alert ritardo produzione: guard contro Math.min() su array vuoto che generava 'Sei Infinity% dietro'",
                ]
            },
            {
                categoria: "🛡️ Robustezza",
                voci: [
                    "Alert useEffect: early-return se machineStatus vuoto o showToast non definito al primo render",
                    "Alert componente completato: usa direttamente item.shortLabel (già formattato) invece di ricostruire proj::comp",
                ]
            }
        ]
    },
    {
        version: "1.8.1",
        data: "11 Maggio 2026",
        label: "Smart Changeover Alerts per Operatori",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "🔴 Alert CO Scaduto: avvisa quando il changeover pianificato è già passato (es. 'CAMBIO SCADUTO: dovevi passare a SG2·ECO 2.3h fa')",
                    "🔄 Alert CO In Corso: notifica quando il blocco changeover è attivo in questo momento con tempo rimanente",
                    "⏳ Alert CO Imminente: avvisa 0–4h prima del prossimo changeover pianificato",
                    "✅ Alert Componente Completato: notifica quando prodotto ≥ target con indicazione del prossimo componente",
                    "⚠ Alert Ritardo Produzione: scatta quando la macchina è ≥15% sotto il ritmo previsto",
                ]
            },
            {
                categoria: "⚙️ Tecnico",
                voci: [
                    "Debounce 60 secondi per alert: ogni evento non si ripete per la stessa macchina prima di 60s",
                    "machineStatus spostato da StatusTab al componente padre GanttPianificazioneView per condividerlo con il sistema alert",
                    "StatusTab riceve machineStatus come prop invece di calcolarlo internamente",
                ]
            }
        ]
    },
    {
        version: "1.8.0",
        data: "6 Maggio 2026",
        label: "Gantt Pianificazione v2 — Stato Settimana + Raccomandazioni",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "Dashboard macchina con avanzamento SAP reale vs target, badge urgenza CO e produzione",
                    "Raccomandazione automatica per ogni macchina: azione corrente, prossimo changeover con orario esatto",
                    "Filtri per fase, urgenza (CO scaduto/imminente/ok) e progetto",
                    "KPI cards: macchine urgenti, in attenzione, in regola",
                    "Configurazione vincolo upstream per ogni coppia macchina+componente (fase + ID macchina)",
                    "Override stock grezzo manuale per simulare disponibilità upstream",
                    "Report Mancato Target: analisi per macchina delle perdite settimanali",
                ]
            },
            {
                categoria: "📊 Algoritmo",
                voci: [
                    "Scheduler con epoche giornaliere: distribuisce il lavoro proporzionalmente ogni 24h (no big-bang)",
                    "Urgency score per prioritizzare i componenti più critici nel planning",
                    "Throughput DB (componente_fasi) → localStorage → costanti con merge per fase",
                ]
            }
        ]
    },
    {
        version: "1.7.0",
        data: "5 Maggio 2026",
        label: "Gantt Pianificazione Changeover",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "Nuova vista 'Pianificazione Changeover' con Gantt per macchina e sequenza ottimale lotti",
                    "Algoritmo greedy EarliestDueDate con changeover giornalieri proporzionali",
                    "Tab Configurazione: target settimanali, ore changeover per fase, bundle DG+DG-REV",
                    "Zona grigia = ore già trascorse: visibilità immediata sull'orizzonte reale",
                ]
            }
        ]
    },
    {
        version: "1.6.4",
        data: "5 Maggio 2026",
        label: "Reset Inventario Settimanale",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "Bottone 'Reset Periodo' in Laboratorio Inventario per ripartire dalla data odierna",
                    "Dialog di conferma con nuova data di inizio periodo",
                ]
            }
        ]
    },
    {
        version: "1.4.0",
        data: "30 Aprile 2026",
        label: "Fix Fermi + Fasi DCT300 + Target + Riorganizzazione Sidebar",
        modifiche: [
            {
                categoria: "🔧 Fix",
                voci: [
                    "Modale fermo: macchina pre-compilata dalla configurazione cella (material_fino_overrides)",
                    "Modale fermo: dropdown motivi filtra per tecnologia fase con fallback universale",
                    "Motivi automazione: filtro corretto con is_automazione=true",
                    "Target settimanale: corretto calcolo per giorni lavorati (non turni distinti)",
                    "Target turno singolo: base / 4 invece di base / 3",
                    "Tabella dettagli cella: macchina da overrides mostrata come fallback se SAP vuota",
                ]
            },
            {
                categoria: "🆕 Novità",
                voci: [
                    "DCT300: aggiunta fase Rettifica Denti 2 (SLW) dopo Tornitura Hard (TH)",
                    "DCT300: rimossa fase MZA Soft (ut_soft) dal flusso",
                    "Header target settimanale: mostra 'target ad oggi / target settimanale'",
                    "Anagrafica SAP spostata come tab in Hub SAP",
                    "Anagrafica Zone spostata come tab in Assegnazioni",
                ]
            }
        ]
    },
    {
        version: "1.3.0",
        data: "30 Aprile 2026",
        label: "Fasi Componente da DB + Vista Backup",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "Aggiunta vista 'Avanzamento Backup' nel menu Report & Dati",
                    "Nuova tabella Supabase componente_fasi per configurare fasi per progetto/componente",
                    "Nuova utility componentiPhases.js per caricare fasi da DB con fallback a STD_PHASES",
                ]
            },
            {
                categoria: "🔧 Tecnico",
                voci: [
                    "Migration 20260429_create_componente_fasi.sql con RLS e dati iniziali per tutti i progetti",
                    "Funzioni loadComponentPhases, loadProjectPhases, saveComponentPhase esposte dalla utility",
                ]
            }
        ]
    },
    {
        version: "1.2.0",
        data: "29 Aprile 2026",
        label: "Data e Ora Ultimo Scarico SAP",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "Banner settimanale: aggiunto timestamp completo (data + ora) dell'ultimo scarico SAP",
                    "Nuovo campo importato_il in conferme_sap traccia quando i dati sono stati importati da SAP",
                    "Mostra formato: '29/04 00:48' quando è disponibile il timestamp",
                ]
            },
            {
                categoria: "🔧 Fix",
                voci: [
                    "Semplificato il fetching dei dati eliminando query separata a storico_produzione",
                    "Timestamp importato_il deve essere settato esplicitamente durante l'importazione SAP",
                ]
            }
        ]
    },
    {
        version: "1.1.1",
        data: "29 Aprile 2026",
        label: "Fix Conteggio Turni Banner Settimanale",
        modifiche: [
            {
                categoria: "🔧 Fix",
                voci: [
                    "Banner settimanale: corretto conteggio turni che ora conta combinazioni uniche (data + turno_id)",
                    "Banner visualizza correttamente 8/20 turni completati",
                    "Target cumulativo calcolato moltiplicando target per turno × numero turni lavorati",
                ]
            },
            {
                categoria: "🎨 UI",
                voci: [
                    "Banner settimanale con gradiente blu e informazioni aggiornamento dati",
                    "Visualizza turni completati/totali e numero turni mancanti",
                    "⚠️ Avviso per turni completati senza dati SAP",
                ]
            }
        ]
    },
    {
        version: "1.1.0",
        data: "24 Aprile 2026",
        label: "Tempi di Attraversamento",
        modifiche: [
            {
                categoria: "🆕 Novità",
                voci: [
                    "Nuova vista 'Tempi Attraversamento' nel menu — tabella fasi con ore per fase, cumulato e barra proporzionale",
                    "Widget '⏱ Attraversamento' nel toolbar di Avanzamento Componenti — pillole fasi con ore e totale giorni",
                    "Tab '⏱ Throughput' nel modal dettaglio cella — mostra le fasi del componente con evidenza sulla fase corrente",
                ]
            },
            {
                categoria: "⚙️ Parametri",
                voci: [
                    "Formula: (Lotto ÷ (Pz/h × OEE)) + Change over",
                    "SGR DCT300: Saldatura Soft 130pz/h, Dentatura 86pz/h, T.T. 8h fisso, Tornitura Hard 104pz/h, Rettifica Denti 100pz/h",
                    "Lotto: 1200 pz · OEE: 85% · Change over: 1h/fase · Totale: ~68h (~2.8 giorni)",
                ]
            }
        ]
    },
    {
        version: "1.1.1",
        data: "24 Aprile 2026",
        label: "Fix Macchina nel Modal Dettaglio",
        modifiche: [
            {
                categoria: "🔧 Fix",
                voci: [
                    "Fix: campo macchina_id ora incluso nel mapping degli override — il nome macchina configurato appare correttamente nel modal dettaglio cella",
                    "Fix: fallback macchina esteso a macchina_id SAP → work_center_sap → macchina configurata manualmente",
                ]
            }
        ]
    },
    {
        version: "1.1.0",
        data: "23 Aprile 2026",
        label: "Performance e Fix QuickConfigModal",
        modifiche: [
            {
                categoria: "🚀 Performance",
                voci: [
                    "Lazy-load jsPDF e html2canvas: -150KB bundle iniziale",
                    "Costanti PROCESS_STEPS e PROJECT_COMPONENTS spostate in constants.js",
                    "Rimossi console.log di debug dalla produzione",
                ]
            },
            {
                categoria: "🔧 Fix",
                voci: [
                    "Fix QuickConfigModal: dati esistenti ora caricati correttamente",
                    "Fix QuickConfigModal: supporto 3 codici materiale per componenti DCT300 (DG, SG3-7)",
                    "Fix: vincolo unico material_fino_overrides corretto (per fase+componente+progetto)",
                    "Fix: macchina_id salvata direttamente in material_fino_overrides",
                ]
            },
            {
                categoria: "🎨 UI",
                voci: [
                    "Modal uniformati con design coerente in tutta l'app",
                ]
            }
        ]
    },
    {
        version: "1.0.0",
        data: "23 Aprile 2026",
        label: "Prima Release Stabile",
        modifiche: [
            {
                categoria: "🔐 Sicurezza",
                voci: [
                    "Login con email e password",
                    "Recupero password via email",
                    "Database protetto — solo utenti autenticati accedono ai dati",
                    "Dipendenze vulnerabili aggiornate",
                ]
            },
            {
                categoria: "🔧 Fix Pianificazione",
                voci: [
                    "Pulsanti turno corretti (A, B, C, D)",
                    "Celle mostrano la fascia oraria corretta (N, M, P, S)",
                    "Colori motivi assenza rispettano la configurazione",
                ]
            },
            {
                categoria: "🆕 Novità",
                voci: [
                    "Versione app visibile nella sidebar e nel login",
                    "Changelog delle modifiche per ogni versione",
                    "Modal uniformati con design coerente in tutta l'app",
                ]
            }
        ]
    }
];

export default function ChangelogModal({ onClose }) {
    return (
        <Modal
            title="📋 Note di Versione"
            subtitle={<>Versione attuale: <strong style={{ color: "var(--accent)" }}>v{version}</strong></>}
            onClose={onClose}
            width={520}
            zIndex={3000}
        >
            {CHANGELOG.map((v, i) => (
                <div key={i} style={{
                    marginBottom: 28,
                    paddingBottom: 28,
                    borderBottom: i < CHANGELOG.length - 1 ? "1px solid var(--border)" : "none"
                }}>
                    {/* Versione header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <span style={{
                            background: "var(--accent)",
                            color: "white",
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "3px 10px",
                            borderRadius: 20,
                        }}>v{v.version}</span>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{v.label}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{v.data}</span>
                    </div>

                    {/* Categorie */}
                    {v.modifiche.map(cat => (
                        <div key={cat.categoria} style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
                                {cat.categoria}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                                {cat.voci.map((voce, j) => (
                                    <li key={j} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 3, lineHeight: 1.5 }}>
                                        {voce}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ))}
        </Modal>
    );
}
