export default function AnalysisTable({ data }) {
    if (!data || !data.phaseInventory || data.phaseInventory.length === 0) {
        return <div style={{ color: "var(--text-muted)" }}>Nessun dato disponibile</div>;
    }

    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13
            }}>
                <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                        <th style={{ padding: 12, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)" }}>Fase</th>
                        <th style={{ padding: 12, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>Quantità</th>
                        <th style={{ padding: 12, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>Scarti</th>
                        <th style={{ padding: 12, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>% Input</th>
                        <th style={{ padding: 12, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>Ciclo (h)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.phaseInventory.map((phase, idx) => {
                        const inputQty = data.phaseInventory[0]?.quantity || 1;
                        const pctInput = Math.round((phase.quantity / inputQty) * 100);
                        const cycleTime = data.cycleTimesPerPhase[phase.phase] || '-';
                        const rowColor = pctInput >= 90 ? "var(--success)" : pctInput >= 50 ? "#f59e0b" : "#ef4444";

                        return (
                            <tr key={idx} style={{
                                borderBottom: "1px solid var(--border)",
                                background: idx % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent"
                            }}>
                                <td style={{ padding: 12, fontWeight: 600 }}>{phase.phase}</td>
                                <td style={{ padding: 12, textAlign: "right" }}>{phase.quantity}</td>
                                <td style={{ padding: 12, textAlign: "right", color: phase.scrap > 0 ? "#ef4444" : "var(--text-secondary)" }}>
                                    {phase.scrap}
                                </td>
                                <td style={{ padding: 12, textAlign: "right", color: rowColor, fontWeight: 700 }}>
                                    {pctInput}%
                                </td>
                                <td style={{ padding: 12, textAlign: "right" }}>{cycleTime}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
