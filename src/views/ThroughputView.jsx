import { THROUGHPUT_CONFIG } from "../data/constants";
import { computeThroughput } from "../utils/throughput";

export default function ThroughputView() {
    const entries = Object.entries(THROUGHPUT_CONFIG.components);

    return (
        <div style={{ padding: "32px", maxWidth: 900, margin: "0 auto" }}>
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>
                    ⏱ Tempi di Attraversamento
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                    Formula: (Lotto ÷ (Pz/h × OEE)) + Change over &nbsp;·&nbsp;
                    Lotto: <strong>{THROUGHPUT_CONFIG.lotto} pz</strong> &nbsp;·&nbsp;
                    OEE: <strong>{(THROUGHPUT_CONFIG.oee * 100).toFixed(0)}%</strong> &nbsp;·&nbsp;
                    CO: <strong>{THROUGHPUT_CONFIG.changeOverH}h / fase</strong>
                </p>
            </div>

            {entries.map(([key]) => {
                const [proj, comp] = key.split("::");
                const phases = computeThroughput(key, THROUGHPUT_CONFIG);
                const totalH = phases.at(-1)?.cumH || 0;
                const totalDays = (totalH / 24).toFixed(1);

                return (
                    <div key={key} style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        padding: "24px",
                        marginBottom: 24
                    }}>
                        {/* Header componente */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                            <span style={{
                                background: "var(--accent)", color: "white",
                                fontSize: 12, fontWeight: 800,
                                padding: "3px 10px", borderRadius: 20
                            }}>{proj}</span>
                            <span style={{ fontWeight: 800, fontSize: 17 }}>{comp}</span>
                            <div style={{ marginLeft: "auto", textAlign: "right" }}>
                                <span style={{ fontSize: 26, fontWeight: 900, color: "var(--accent)" }}>{totalH}h</span>
                                <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>≈ {totalDays} giorni</span>
                            </div>
                        </div>

                        {/* Tabella fasi */}
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-tertiary)" }}>
                                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 700, borderRadius: "6px 0 0 6px" }}>#</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>FASE</th>
                                    <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>PZ/H</th>
                                    <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>TEMPO LOTTO</th>
                                    <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>CHANGE OVER</th>
                                    <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>TOTALE FASE</th>
                                    <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, color: "var(--text-muted)", fontWeight: 700, borderRadius: "0 6px 6px 0" }}>CUMULATO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {phases.map((p, i) => {
                                    const lottoH = p.fixedH != null ? p.fixedH : +(THROUGHPUT_CONFIG.lotto / (p.pzH * THROUGHPUT_CONFIG.oee)).toFixed(1);
                                    const barWidth = Math.round((p.h / totalH) * 100);
                                    return (
                                        <tr key={p.phaseId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "12px", fontSize: 12, color: "var(--text-muted)" }}>{i + 1}</td>
                                            <td style={{ padding: "12px" }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</div>
                                                {/* barra proporzionale */}
                                                <div style={{ marginTop: 4, height: 4, borderRadius: 4, background: "var(--bg-tertiary)", width: "100%", maxWidth: 200 }}>
                                                    <div style={{ height: 4, borderRadius: 4, background: "var(--accent)", width: `${barWidth}%` }} />
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
                                                {p.pzH != null ? p.pzH : "—"}
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 13 }}>
                                                {p.fixedH != null ? `${p.fixedH}h fisso` : `${lottoH}h`}
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
                                                {THROUGHPUT_CONFIG.changeOverH}h
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--accent)" }}>
                                                {p.h}h
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>
                                                {p.cumH}h
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: "var(--bg-tertiary)", borderTop: "2px solid var(--border)" }}>
                                    <td colSpan={5} style={{ padding: "12px", fontWeight: 800, fontSize: 14 }}>TOTALE</td>
                                    <td style={{ padding: "12px", textAlign: "right", fontSize: 16, fontWeight: 900, color: "var(--accent)" }}>{totalH}h</td>
                                    <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>≈ {totalDays} gg</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}
