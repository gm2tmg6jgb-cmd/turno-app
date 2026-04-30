import { version } from "../../package.json";
import Modal from "./Modal";

const CHANGELOG = [
    {
        version: "1.4.0",
        data: "30 Aprile 2026",
        label: "Fix Fermi + Fasi DCT300 + Target Ad Oggi",
        modifiche: [
            {
                categoria: "🔧 Fix",
                voci: [
                    "Modale fermo: macchina pre-compilata dalla configurazione cella (material_fino_overrides)",
                    "Modale fermo: dropdown motivi ora filtra per tecnologia fase con fallback universale",
                    "Motivi automazione: filtro corretto con is_automazione=true invece di tecnologia_id='automazione'",
                ]
            },
            {
                categoria: "🆕 Novità",
                voci: [
                    "DCT300: aggiunta fase Rettifica Denti 2 (SLW) dopo Tornitura Hard (TH)",
                    "DCT300: rimossa fase MZA Soft (ut_soft) dal flusso",
                    "Header target settimanale: mostra 'target ad oggi / target settimanale' in modalità weekly",
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
                <div key={v.version} style={{
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
