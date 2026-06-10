export default function KPICard({ icon, title, value, unit, status = "info" }) {
    const statusColors = {
        success: { bg: "rgba(34, 197, 94, 0.1)", color: "#22c55e" },
        warning: { bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" },
        danger: { bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444" },
        info: { bg: "rgba(96, 165, 250, 0.1)", color: "#60a5fa" }
    };

    const colors = statusColors[status] || statusColors.info;

    return (
        <div style={{
            background: colors.bg,
            borderRadius: 12,
            padding: 16,
            border: `1px solid ${colors.color}33`,
            display: "flex",
            flexDirection: "column",
            gap: 8
        }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                {title}
            </div>
            <div style={{
                fontSize: 28,
                fontWeight: 900,
                color: colors.color,
                display: "flex",
                alignItems: "baseline",
                gap: 4
            }}>
                {value}
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    {unit}
                </span>
            </div>
        </div>
    );
}
