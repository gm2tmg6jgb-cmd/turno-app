const STATO_LABELS = {
    completed: "Completata",
    in_progress: "In corso",
    pending: "In attesa"
};

export default function PhaseTimeline({ phases = [] }) {
    if (phases.length === 0) {
        return <div style={{ color: "var(--text-muted)" }}>Nessuna fase disponibile</div>;
    }

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—';

    const getStatoColor = (stato, urgencyDelta) => {
        if (stato === 'completed') return "#22c55e";
        if (urgencyDelta < -10) return "#ef4444";
        if (urgencyDelta < 0) return "#f59e0b";
        if (stato === 'in_progress') return "#60a5fa";
        return "var(--text-muted)";
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {phases.map((p) => {
                const color = getStatoColor(p.stato, p.urgencyDelta);
                return (
                    <div key={p.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.02)",
                        border: "1px solid var(--border)"
                    }}>
                        <div style={{ width: 140, flexShrink: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{STATO_LABELS[p.stato] || p.stato}</div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                position: "relative",
                                height: 16,
                                borderRadius: 8,
                                background: "rgba(0,0,0,0.06)",
                                overflow: "hidden"
                            }}>
                                <div style={{
                                    position: "absolute",
                                    left: 0, top: 0, bottom: 0,
                                    width: `${Math.min(100, p.pct)}%`,
                                    background: color,
                                    borderRadius: 8,
                                    transition: "width 0.3s"
                                }} />
                                <div style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: p.pct > 50 ? "#fff" : "var(--text-secondary)"
                                }}>
                                    {p.pct}% ({p.prodotti}/{p.totale})
                                </div>
                            </div>
                        </div>

                        <div style={{ width: 110, flexShrink: 0, textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
                            {fmtDate(p.dataInizio)} → {fmtDate(p.dataFinePrevista)}
                        </div>

                        <div style={{
                            width: 56, flexShrink: 0, textAlign: "right",
                            fontSize: 12, fontWeight: 700,
                            color: p.urgencyDelta < 0 ? "#ef4444" : "#22c55e"
                        }}>
                            {p.urgencyDelta > 0 ? '+' : ''}{p.urgencyDelta}%
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
