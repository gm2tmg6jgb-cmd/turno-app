export default function TimelineChart({ data }) {
    if (!data || !data.phaseInventory) {
        return <div style={{ color: "var(--text-muted)" }}>Nessun dato disponibile</div>;
    }

    const completionDate = data.completionDate;
    const today = new Date();
    const targetDate = data.targetProgress?.data_target_fine ? new Date(data.targetProgress.data_target_fine) : null;

    const daysDiff = completionDate ? Math.ceil((completionDate - today) / (1000 * 60 * 60 * 24)) : 0;
    const isLate = targetDate && completionDate > targetDate;

    return (
        <div>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
                padding: 12,
                background: "rgba(0,0,0,0.1)",
                borderRadius: 8
            }}>
                <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Completamento Stimato</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {completionDate ? completionDate.toLocaleDateString('it-IT') : 'N/A'}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Giorni Rimanenti</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: daysDiff < 0 ? "#ef4444" : "#22c55e" }}>
                        {daysDiff} gg
                    </div>
                </div>
                {targetDate && (
                    <div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Target Pianificato</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: isLate ? "#ef4444" : "#22c55e" }}>
                            {targetDate.toLocaleDateString('it-IT')} {isLate ? '⚠️' : '✅'}
                        </div>
                    </div>
                )}
            </div>

            {/* Barra di progresso semplificata */}
            <div style={{
                width: "100%",
                height: 8,
                background: "rgba(0,0,0,0.1)",
                borderRadius: 4,
                overflow: "hidden"
            }}>
                <div style={{
                    height: "100%",
                    width: `${Math.min(100, (data.phaseInventory[0]?.quantity || 0) / 12)}%`,
                    background: "var(--success)",
                    transition: "width 0.3s ease"
                }} />
            </div>
        </div>
    );
}
