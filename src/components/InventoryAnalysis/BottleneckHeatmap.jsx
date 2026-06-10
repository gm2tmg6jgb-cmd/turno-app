export default function BottleneckHeatmap({ data }) {
    if (!data || !data.phaseInventory || data.phaseInventory.length === 0) {
        return <div style={{ color: "var(--text-muted)" }}>Nessun dato disponibile</div>;
    }

    const maxQty = Math.max(...data.phaseInventory.map(p => p.quantity));

    const getColor = (qty) => {
        const ratio = qty / maxQty;
        if (ratio >= 0.9) return { bg: "rgba(34, 197, 94, 0.3)", color: "#22c55e" };
        if (ratio >= 0.7) return { bg: "rgba(245, 158, 11, 0.3)", color: "#f59e0b" };
        if (ratio >= 0.5) return { bg: "rgba(249, 115, 22, 0.3)", color: "#f97316" };
        return { bg: "rgba(239, 68, 68, 0.3)", color: "#ef4444" };
    };

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 8,
            marginBottom: 16
        }}>
            {data.phaseInventory.map((phase, idx) => {
                const colors = getColor(phase.quantity);
                const ratio = (phase.quantity / data.phaseInventory[0].quantity) * 100;

                return (
                    <div key={idx} style={{
                        padding: 12,
                        background: colors.bg,
                        borderRadius: 8,
                        textAlign: "center",
                        border: `2px solid ${colors.color}66`
                    }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                            {phase.phase.substring(0, 10)}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.color }}>
                            {phase.quantity}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                            {Math.round(ratio)}% input
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
