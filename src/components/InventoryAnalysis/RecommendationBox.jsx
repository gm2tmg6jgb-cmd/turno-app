export default function RecommendationBox({ recommendations = [] }) {
    const getPriorityColor = (impact) => {
        if (impact === 'HIGH') return { bg: "rgba(239, 68, 68, 0.1)", border: "#ef4444" };
        if (impact === 'MEDIUM') return { bg: "rgba(245, 158, 11, 0.1)", border: "#f59e0b" };
        return { bg: "rgba(96, 165, 250, 0.1)", border: "#60a5fa" };
    };

    const icons = {
        'HIGH': '🔴',
        'MEDIUM': '🟠',
        'LOW': '🟡'
    };

    if (recommendations.length === 0) {
        return (
            <div style={{
                padding: 16,
                background: "rgba(34, 197, 94, 0.1)",
                borderRadius: 8,
                border: "1px solid #22c55e33",
                color: "#22c55e",
                textAlign: "center"
            }}>
                ✅ Nessuna azione consigliata - tutto procede secondo il piano
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recommendations.map((rec, idx) => {
                const colors = getPriorityColor(rec.impact);
                return (
                    <div key={idx} style={{
                        padding: 12,
                        background: colors.bg,
                        borderRadius: 8,
                        border: `1px solid ${colors.border}66`,
                        borderLeft: `4px solid ${colors.border}`
                    }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <div style={{ fontSize: 16, minWidth: 20 }}>
                                {icons[rec.impact]}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                                    {rec.action}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                                    {rec.details}
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: colors.border,
                                    fontWeight: 600
                                }}>
                                    Priorità: {rec.priority}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
