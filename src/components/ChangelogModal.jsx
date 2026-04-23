import { version } from "../../package.json";

const CHANGELOG = [
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
                ]
            }
        ]
    }
];

export default function ChangelogModal({ onClose }) {
    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)"
        }} onClick={onClose}>
            <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 32,
                width: 520,
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Note di Versione</h2>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                            Versione attuale: <strong style={{ color: "var(--accent)" }}>v{version}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
                </div>

                {/* Versioni */}
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
            </div>
        </div>
    );
}
