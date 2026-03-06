import { useState, useEffect } from "react";

const ProductionReportView = () => {
    const [config, setConfig] = useState(null);
    const [activeTab, setActiveTab] = useState("TUTTO");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/report_produzione_config.json")
            .then(res => res.json())
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Errore caricamento config:", err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div style={{ padding: 20 }}>Caricamento...</div>;
    if (!config) return <div style={{ padding: 20 }}>Errore nel caricamento del report.</div>;

    const { dati, soglie, colori_stato, configurazione_tab } = config;

    const getMacchineByTecnologia = (tecnologia) => {
        const macchine = Object.keys(dati);
        if (tecnologia === "TUTTO") return macchine;

        if (tecnologia === "DRA SOFT") {
            const draSoft = [
                'DRA10060', 'DRA10061', 'DRA10062', 'DRA10063/64', 'DRA10065/66',
                'DRA10067/68', 'DRA10069/70', 'DRA10071', 'DRA10072', 'DRA11042',
                'DRA10058', 'DRA10059', 'DRA11044'
            ];
            return macchine.filter(m => draSoft.includes(m));
        }

        if (tecnologia === "DRA HARD") {
            const draSoft = [
                'DRA10060', 'DRA10061', 'DRA10062', 'DRA10063/64', 'DRA10065/66',
                'DRA10067/68', 'DRA10069/70', 'DRA10071', 'DRA10072', 'DRA11042',
                'DRA10058', 'DRA10059', 'DRA11044'
            ];
            return macchine.filter(m => m.startsWith('DRA') && !draSoft.includes(m));
        }

        return macchine.filter(m => m.startsWith(tecnologia.split(' ')[0]));
    };

    const getColorStato = (value) => {
        if (value === "" || value === 0) return "#FFFFFF";
        if (value > soglie.ottimale_minimo) return colori_stato.ottimale;
        if (value > soglie.avvertenza_minimo) return colori_stato.avvertenza;
        return colori_stato.critico;
    };

    const getSommaRiga = (macchina) => {
        return Object.values(dati[macchina] || {}).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    };

    const macchineFiltrate = getMacchineByTecnologia(activeTab);
    const tuttiComponenti = Array.from(new Set(Object.values(dati).flatMap(m => Object.keys(m)))).sort();

    return (
        <div className="fade-in" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Report Produzione</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Matrice produzione componenti per macchina</p>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>v{config.version}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{config.data_creazione}</div>
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto", paddingBottom: 10 }}>
                {configurazione_tab.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: activeTab === tab ? "var(--accent)" : "var(--bg-card)",
                            color: activeTab === tab ? "white" : "var(--text-primary)",
                            cursor: "pointer",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            transition: "all 0.2s"
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-secondary)", borderBottom: "2px solid var(--border)" }}>
                                <th style={{ padding: 15, textAlign: "left", width: 140, position: "sticky", left: 0, background: "var(--bg-secondary)", zIndex: 10 }}>Macchina</th>
                                <th style={{ padding: 15, textAlign: "center", fontWeight: 800, borderRight: "2px solid var(--border)", background: "rgba(0,0,0,0.05)", width: 100 }}>TOTALE</th>
                                {tuttiComponenti.map(comp => (
                                    <th key={comp} style={{ padding: 15, textAlign: "center", minWidth: 90 }}>{comp}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {macchineFiltrate.map(m => (
                                <tr key={m} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }}>
                                    <td style={{ padding: 15, fontWeight: 700, position: "sticky", left: 0, background: "var(--bg-card)", zIndex: 5, borderRight: "1px solid var(--border)" }}>{m}</td>
                                    <td style={{ padding: 15, textAlign: "center", fontWeight: 800, background: "rgba(0,0,0,0.02)", borderRight: "2px solid var(--border)" }}>
                                        {getSommaRiga(m)}
                                    </td>
                                    {tuttiComponenti.map(comp => {
                                        const val = (dati[m] || {})[comp];
                                        return (
                                            <td
                                                key={comp}
                                                style={{
                                                    padding: 15,
                                                    textAlign: "center",
                                                    background: val ? getColorStato(val) : "transparent",
                                                    color: val ? "white" : "var(--text-primary)",
                                                    fontWeight: val ? 700 : 400,
                                                    opacity: val ? 1 : 0.3
                                                }}
                                            >
                                                {val || "0"}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: "var(--bg-secondary)", borderRadius: 10, display: "flex", flexWrap: "wrap", gap: 24, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Legenda Soglie:</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: colori_stato.ottimale }} />
                    <span style={{ fontWeight: 600 }}>Ottimale</span> (&gt;{soglie.ottimale_minimo})
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: colori_stato.avvertenza }} />
                    <span style={{ fontWeight: 600 }}>Avvertenza</span> (&gt;{soglie.avvertenza_minimo})
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: colori_stato.critico }} />
                    <span style={{ fontWeight: 600 }}>Critico</span> (&le;{soglie.avvertenza_minimo})
                </div>
            </div>

            <div style={{ marginTop: 30, padding: 20, borderRadius: 12, border: "1px dashed var(--border)", textAlign: "center", color: "var(--text-muted)" }}>
                <p style={{ margin: 0, fontSize: 13 }}>
                    I dati in questa tabella sono sincronizzati con l'ultimo export SAP caricato nel sistema.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{ marginTop: 12, background: "none", border: "1px solid var(--border)", padding: "6px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "var(--text-primary)" }}
                >
                    Forza Sincronizzazione
                </button>
            </div>
        </div>
    );
};

export default ProductionReportView;
