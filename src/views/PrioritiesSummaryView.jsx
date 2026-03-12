import { useState, useEffect } from "react";
import { SECTIONS, STORAGE_KEY } from "../data/weisserPrioritiesConstants";
import { Icons } from "../components/ui/Icons";

function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr() {
    return localDateStr(new Date());
}

function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

/** Calcola n e isCurrent in base alla posizione */
function withRanks(items) {
    const firstActive = items.findIndex(x => !x.cancelled && !x.completed);
    let rank = 0;
    return items.map((item, idx) => {
        if (!item.cancelled && !item.completed) {
            rank++;
            return { ...item, n: rank, isCurrent: idx === firstActive };
        }
        return { ...item, n: "—", isCurrent: false };
    });
}

function PrioritiesSummaryView({ turnoCorrente }) {
    const today = getTodayStr();
    const [allData, setAllData] = useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch { }
        return {};
    });

    const [currentDate, setCurrentDate] = useState(today);
    const [search, setSearch] = useState("");

    const states = allData[currentDate] || {};

    const availableDates = Object.keys(allData).sort().reverse();

    const groupedData = SECTIONS.map(section => {
        const machines = section.machines.map(machine => {
            const state = states[machine.id];
            if (!state) return null;
            
            const displayed = withRanks(state.items);
            const current = displayed.find(p => p.isCurrent);
            const next = displayed.find(p => p.n === 2);
            
            return {
                machineId: machine.id,
                machineNote: machine.note || state.note,
                current,
                next
            };
        }).filter(Boolean);

        return {
            ...section,
            machinesData: machines
        };
    }).filter(s => s.machinesData.length > 0);

    const filteredSections = groupedData.map(section => ({
        ...section,
        machinesData: section.machinesData.filter(row => 
            row.machineId.toLowerCase().includes(search.toLowerCase()) ||
            (row.current?.material?.toLowerCase()?.includes(search.toLowerCase())) ||
            (row.current?.component?.toLowerCase()?.includes(search.toLowerCase()))
        )
    })).filter(section => section.machinesData.length > 0);

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", padding: "16px 20px", paddingBottom: 32 }}>
            {/* Header */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Riepilogo Priorità</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                        Panoramica delle attività per tecnologia.
                    </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Date Selector */}
                    <select
                        value={currentDate}
                        onChange={e => setCurrentDate(e.target.value)}
                        style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                    >
                        <option value={today}>Oggi ({formatDateLabel(today)})</option>
                        {availableDates.filter(d => d !== today).map(d => (
                            <option key={d} value={d}>{formatDateLabel(d)}</option>
                        ))}
                    </select>

                    <div style={{ width: 240 }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Cerca macchina o materiale..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ height: 38 }}
                        />
                    </div>
                </div>
            </div>

            {/* Content grouped by section */}
            {filteredSections.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                    Nessun dato trovato per i criteri selezionati.
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    {filteredSections.map(section => (
                        <div key={section.label}>
                             <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <div style={{ width: 4, height: 24, borderRadius: 2, background: section.color }} />
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{section.label}</h2>
                            </div>
                            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                                <div className="table-container">
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                                                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", width: "16%" }}>Macchina</th>
                                                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", width: "28%" }}>Attività Corrente (1)</th>
                                                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", width: "28%" }}>Dettagli</th>
                                                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", width: "28%" }}>Prossima (2)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {section.machinesData.map((row, idx) => (
                                                <tr key={row.machineId} style={{ borderBottom: "1px solid var(--border-light)", background: idx % 2 === 0 ? "transparent" : "var(--bg-tertiary-low-opacity, rgba(0,0,0,0.02))" }}>
                                                    <td style={{ padding: "12px 16px" }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{row.machineId}</div>
                                                        {row.machineNote && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{row.machineNote}</div>}
                                                    </td>
                                                    <td style={{ padding: "12px 16px" }}>
                                                        {row.current ? (
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                                <span style={{ fontSize: 13, fontWeight: 600 }}>{row.current.component || "—"}</span>
                                                                <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{row.current.material}</span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: "var(--text-lighter)", fontStyle: "italic", fontSize: 13 }}>Nessuna attività</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "12px 16px" }}>
                                                        {row.current ? (
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                                                                <div style={{ display: "flex", gap: 12 }}>
                                                                    <div title="Lotto">
                                                                        <span style={{ color: "var(--text-muted)", fontSize: 11, marginRight: 4 }}>Lotto:</span>
                                                                        <span style={{ fontWeight: 600 }}>{row.current.lotto || "—"}</span>
                                                                    </div>
                                                                    <div title="Prodotti">
                                                                        <span style={{ color: "var(--text-muted)", fontSize: 11, marginRight: 4 }}>Prod:</span>
                                                                        <span style={{ fontWeight: 600 }}>{row.current.prodotti || "—"}</span>
                                                                    </div>
                                                                </div>
                                                                <div title="Turno">
                                                                    <span style={{ color: "var(--text-muted)", fontSize: 11, marginRight: 4 }}>Turno:</span>
                                                                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>{row.current.turno || "—"}</span>
                                                                </div>
                                                            </div>
                                                        ) : "—"}
                                                    </td>
                                                    <td style={{ padding: "12px 16px" }}>
                                                        {row.next ? (
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, opacity: 0.8 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 500 }}>{row.next.component || "—"}</span>
                                                                <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>{row.next.material}</span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: "var(--text-lighter)", fontSize: 12 }}>—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Stats Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 32 }}>
                <div className="card" style={{ padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>{groupedData.reduce((acc, s) => acc + s.machinesData.length, 0)}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Macchine Totali</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--success)" }}>{groupedData.reduce((acc, s) => acc + s.machinesData.filter(r => r.current).length, 0)}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>In Produzione</div>
                </div>
            </div>
        </div>
    );
}

export default PrioritiesSummaryView;
