import React from "react";

const SECTIONS = [
    {
        label: "Weisser",
        color: "#3c6ef0",
        machines: [
            {
                id: "DRA10060",
                priorities: [
                    { n: 1, component: "SGR",   material: "M0153391/s",  current: false, cancelled: false },
                    { n: 2, component: "SG2",   material: "M0153389/s",  current: true,  cancelled: false },
                ]
            },
            {
                id: "DRA10061",
                priorities: [
                    { n: 1, component: "SG5",   material: "M0155199/s",  current: false, cancelled: false },
                    { n: 2, component: "FG5-7", material: "M0155197/s",  current: true,  cancelled: false },
                ]
            },
            {
                id: "DRA10062",
                priorities: [
                    { n: 1, component: "P.G.", material: "M0154996/s",  current: true,  cancelled: false },
                    { n: 2, component: "SG8",  material: "M0153397/s",  current: false, cancelled: false },
                ]
            },
            {
                id: "DRA10065/66",
                priorities: [
                    { n: 1, component: "SG4", material: "M0170686/s",   current: false, cancelled: false },
                    { n: 2, component: "SG5", material: "2511109051/s", current: true,  cancelled: false },
                    { n: 3, component: "SG5", material: "2511122951/s", current: false, cancelled: false },
                ]
            },
            {
                id: "DRA10067/68",
                priorities: [
                    { n: 1, component: "SG3", material: "M0133401/s",   current: false, cancelled: true  },
                    { n: 2, component: "DG2", material: "2511108350/s", current: false, cancelled: false },
                    { n: 3, component: "DG2", material: "2511122350/s", current: true,  cancelled: false },
                ]
            },
            {
                id: "DRA10069/70",
                priorities: [
                    { n: 1, component: "SG6", material: "2511109250/s", current: false, cancelled: false },
                    { n: 2, component: "SG7", material: "M0155201/s",   current: false, cancelled: false },
                    { n: 3, component: "SG6", material: "2511123150/s", current: true,  cancelled: false },
                    { n: 4, component: "SG6", material: "M0153387/s",   current: false, cancelled: false },
                ]
            },
            {
                id: "DRA10071",
                priorities: [
                    { n: 1,   component: "SG3", material: "8Fe",          current: true,  cancelled: false },
                    { n: "-", component: "",    material: "2511109350/s", current: false, cancelled: true  },
                    { n: 2,   component: "SGR", material: "M0153391/s",   current: false, cancelled: false },
                    { n: 3,   component: "",    material: "2511123250/s", current: false, cancelled: false },
                ]
            },
        ]
    },
    {
        label: "Laser",
        color: "#e05c2a",
        machines: [
            {
                id: "SCA11006",
                priorities: [
                    { n: 1, component: "DG2", material: "2511124650/s", current: false, cancelled: false },
                    { n: 2, component: "SGR", material: "M0162523/s",   current: false, cancelled: false },
                    { n: 3, component: "DG2", material: "2511108350/s", current: false, cancelled: false },
                    { n: 4, component: "SG2", material: "M0153389/s",   current: false, cancelled: false },
                    { n: 5, component: "DG2", material: "2511122350/s", current: true,  cancelled: false },
                ]
            },
            {
                id: "SCA11008",
                note: "Fine C",
                priorities: [
                    { n: 1, component: "SG3", material: "M0153401/s",   current: false, cancelled: false },
                    { n: 2, component: "SG1", material: "2511108150/s", current: true,  cancelled: false },
                    { n: 3, component: "SG1", material: "2511124450/s", current: false, cancelled: false },
                    { n: 4, component: "SGR", material: "M0153391/s",   current: false, cancelled: false },
                ]
            },
            {
                id: "SCA11010",
                priorities: [
                    { n: 1, component: "SG3", material: "M0153401/s",   current: true,  cancelled: false },
                    { n: 2, component: "SGR", material: "2511109451/s", current: false, cancelled: false },
                    { n: 3, component: "SG2", material: "M0153389/s",   current: false, cancelled: false },
                ]
            },
            {
                id: "SCA10151",
                priorities: [
                    { n: 1, component: "SG7", material: "M0155201/s",  current: false, cancelled: false },
                    { n: 2, component: "SG6", material: "M0153387/s",  current: true,  cancelled: false },
                    { n: 3, component: "SG8", material: "M0153397/s",  current: false, cancelled: false },
                ]
            },
            {
                id: "SCA11009",
                note: "Fine C",
                priorities: [
                    { n: 1, component: "SG4", material: "2511124953/s", current: false, cancelled: false },
                    { n: 2, component: "SG4", material: "M0170686/s",   current: false, cancelled: false },
                    { n: 3, component: "SG5", material: "M0155199/s",   current: false, cancelled: false },
                    { n: 4, component: "SG4", material: "2511122651/s", current: false, cancelled: false },
                    { n: 5, component: "SG4", material: "2511108751/s", current: true,  cancelled: false },
                ]
            },
            {
                id: "SCA11078",
                note: "Chamos — BAP3",
                priorities: [
                    { n: 1, component: "SG6", material: "2511125351",   current: false, cancelled: false },
                    { n: 2, component: "SG5", material: "2511125150",   current: false, cancelled: false },
                    { n: 3, component: "SG3", material: "M0162623/S",   current: false, cancelled: false },
                    { n: 4, component: "SG5", material: "M0162621",     current: false, cancelled: false },
                    { n: 5, component: "SG5", material: "2511108952",   current: false, cancelled: false },
                    { n: 6, component: "SG6", material: "2511109151",   current: false, cancelled: false },
                    { n: 7, component: "SG4", material: "M0162637",     current: false, cancelled: false },
                    { n: 8, component: "SG5", material: "2511122851",   current: true,  cancelled: false },
                    { n: 9, component: "SG6", material: "2511123050",   current: false, cancelled: false },
                ]
            },
        ]
    },
    {
        label: "Pfauter",
        color: "#2a9e6e",
        machines: [
            {
                id: "FRW11010",
                priorities: [
                    { n: 1, component: "SG7", material: "M0155201/s",  current: false, cancelled: false },
                    { n: 2, component: "SG6", material: "M0153387/s",  current: true,  cancelled: false },
                ]
            },
            {
                id: "FRW10074",
                priorities: [
                    { n: 1, component: "SG5", material: "2511125250/s", current: false, cancelled: false },
                    { n: 2, component: "SG5", material: "2511122951/s", current: false, cancelled: false },
                    { n: 3, component: "SG5", material: "2511109051/s", current: true,  cancelled: false },
                ]
            },
            {
                id: "FRW10075",
                priorities: [
                    { n: 1, component: "SG6", material: "2511125451/s", current: false, cancelled: false },
                    { n: 2, component: "SG6", material: "2511109250/s", current: false, cancelled: false },
                    { n: 3, component: "SG6", material: "2511123150/s", current: true,  cancelled: false },
                ]
            },
            {
                id: "FRW10076",
                note: "Saldap — SG3 Eco",
                priorities: [
                    { n: 1, component: "DG2", material: "2511124650/s", current: false, cancelled: false },
                    { n: 2, component: "SG3", material: "M0162623/S",   current: false, cancelled: false },
                    { n: 3, component: "DG2", material: "2511108350/s", current: true,  cancelled: false },
                    { n: 4, component: "DG2", material: "2511122350/s", current: false, cancelled: false },
                ]
            },
            {
                id: "FRW10078",
                priorities: [
                    { n: 1, component: "SG4",   material: "2511124953/s", current: false, cancelled: false },
                    { n: 2, component: "SG2",   material: "M0162644/s",   current: false, cancelled: false },
                    { n: 3, component: "FG5-7", material: "M0155197/s",   current: true,  cancelled: false },
                    { n: 4, component: "SG4",   material: "2511122651/s", current: false, cancelled: false },
                    { n: 5, component: "SG4",   material: "2511108751/s", current: false, cancelled: false },
                ]
            },
            {
                id: "FRW10079",
                note: "Turno C",
                priorities: [
                    { n: 1, component: "SG4", material: "M0170686/s",  current: false, cancelled: false },
                    { n: 2, component: "SGR", material: "M0162523/s",  current: false, cancelled: false },
                    { n: 3, component: "SG3", material: "M0153401/s",  current: false, cancelled: false },
                ]
            },
            {
                id: "FRW82",
                priorities: [
                    { n: 1, component: "SG5",  material: "M0162622/s",  current: true,  cancelled: false },
                    { n: 2, component: "SG5",  material: "M0155199/s",  current: false, cancelled: false },
                    { n: 3, component: "P.G.", material: "M0154996/s",  current: false, cancelled: false },
                ]
            },
        ]
    },
];

function MachineCard({ machine, accentColor }) {
    return (
        <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "10px 16px", background: accentColor, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>{machine.id}</span>
                {machine.note && (
                    <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 4 }}>{machine.note}</span>
                )}
            </div>
            <div style={{ padding: "6px 0" }}>
                {machine.priorities.map((p, i) => (
                    <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 16px",
                        background: p.current ? "rgba(255, 214, 0, 0.15)" : "transparent",
                        borderLeft: p.current ? "3px solid #FFD600" : "3px solid transparent",
                        borderBottom: i < machine.priorities.length - 1 ? "1px solid var(--border-light)" : "none",
                    }}>
                        <span style={{
                            minWidth: 24, height: 24, borderRadius: "50%",
                            background: p.current ? "#FFD600" : "var(--bg-tertiary)",
                            border: "1px solid var(--border)",
                            color: p.current ? "#333" : "var(--text-muted)",
                            fontSize: 11, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0
                        }}>{p.n}</span>
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            {p.component && (
                                <span style={{
                                    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                                    color: p.cancelled ? "var(--text-lighter)" : "var(--text-secondary)",
                                    textDecoration: p.cancelled ? "line-through" : "none",
                                }}>{p.component}</span>
                            )}
                            <span style={{
                                fontSize: 12, fontFamily: "monospace",
                                fontWeight: p.current ? 700 : 500,
                                color: p.cancelled ? "var(--text-lighter)" : p.current ? "var(--text-primary)" : "var(--text-secondary)",
                                textDecoration: p.cancelled ? "line-through" : "none",
                            }}>{p.material}</span>
                        </div>
                        {p.current && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#b8860b", background: "rgba(255,214,0,0.3)", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>
                                IN CORSO
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function WeisserPrioritiesView() {
    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", padding: "16px 20px", paddingBottom: 32 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                    Priorità Macchine
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                    Ordine di lavorazione per macchina — la riga evidenziata indica la priorità in corso.
                </p>
            </div>

            {SECTIONS.map(section => (
                <div key={section.label} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 4, height: 24, borderRadius: 2, background: section.color }} />
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                            {section.label}
                        </h2>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                        {section.machines.map(machine => (
                            <MachineCard key={machine.id} machine={machine} accentColor={section.color} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
