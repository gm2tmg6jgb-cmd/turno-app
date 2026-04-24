import { version } from "../../package.json";
import Modal from "./Modal";

const CHANGELOG = [
    {
        version: "1.2.0",
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
