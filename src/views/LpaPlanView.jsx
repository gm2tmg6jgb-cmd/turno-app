import React, { useState, useMemo, useEffect } from "react";
import { Icons } from "../components/ui/Icons";
import { TURNI } from "../data/constants";

// --- CONSTANTS ---
const TEAMS_BASE = [
    { id: "T11", label: "Team 11 SOFT", leader: "Cianci", reparto: "BAP11" },
    { id: "T12", label: "Team 12 HARD", leader: "Cappelluti", reparto: "BAP12" },
    { id: "T13", label: "Team 13 SOFT", leader: "Ferrandes", reparto: "BAP13" }
];

const TECHNOLOGIES = {
    "Tornitura": { color: "#3B82F6" },
    "Dentatura": { color: "#10B981" },
    "Rettifica": { color: "#8B5CF6" },
    "Saldatura": { color: "#EC4899" },
    "Altro": { color: "#6B7280" }
};

// --- UTILS ---
const getStartDate = () => {
    // Monday, Dec 29, 2025
    return new Date(2025, 11, 29);
};

const getWeekRange = (weekNumber) => {
    const start = getStartDate();
    const monday = new Date(start);
    monday.setDate(start.getDate() + (weekNumber - 1) * 7);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    return { monday, saturday };
};

const formatShortDate = (date) => {
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
};

const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// --- DATA INITIALIZATION ---
// This would ideally come from the main machine list, but for specific LPA requirements, 
// we ensure we have a good distribution. Using the 'macchine' prop.
const getMachinesByTeam = (macchine) => {
    const map = { T11: [], T12: [], T13: [] };
    macchine.forEach(m => {
        if (map[m.reparto_id || m.reparto]) {
            // Infer technology from ID if not explicit
            let tech = "Altro";
            if (m.id.startsWith("DRA")) tech = "Tornitura";
            else if (m.id.startsWith("FRW") || m.id.startsWith("FRD")) tech = "Dentatura";
            else if (m.id.startsWith("SLA") || m.id.startsWith("SLW")) tech = "Rettifica";
            else if (m.id.startsWith("SCA")) tech = "Saldatura";

            map[m.reparto_id || m.reparto].push({ ...m, tecnologia: tech });
        }
    });
    return map;
};

export default function LpaPlanView({ macchine, dipendenti, showToast, turnoCorrente }) {
    const activeShift = useMemo(() => TURNI.find(t => t.id === (turnoCorrente || "A")) || TURNI[0], [turnoCorrente]);
    const activeCoordinator = activeShift.coordinatore || "Coordinatore";

    const activeTeams = useMemo(() => {
        return TEAMS_BASE.map(team => {
            const tl = dipendenti?.find(d =>
                (d.turno_default === turnoCorrente) &&
                (d.reparto_id === team.id) &&
                d.ruolo === "capoturno"
            );
            return {
                ...team,
                leader: tl ? `${tl.cognome}` : team.leader
            };
        });
    }, [dipendenti, turnoCorrente]);

    const [currentWeek, setCurrentWeek] = useState(1);
    const [view, setView] = useState("dashboard"); // dashboard, stats, grid
    const [data, setData] = useState(() => {
        const saved = localStorage.getItem("lpa_data_2026");
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem("lpa_data_2026", JSON.stringify(data));
    }, [data]);

    const machinesByTeam = useMemo(() => getMachinesByTeam(macchine), [macchine]);

    // Deterministic Coordinator Rotation (3-week cycle)
    const coordinatorTeam = useMemo(() => {
        const idx = (currentWeek - 1) % 3;
        return activeTeams[idx];
    }, [currentWeek, activeTeams]);

    const assignments = useMemo(() => {
        const turni = ["A", "B", "C", "D"];
        const resultByTurno = {};
        turni.forEach(t => resultByTurno[t] = { coord: [] });

        const weekSeed = currentWeek * 99999;
        const shuffle = (array, seedOffset) => {
            if (!array || array.length === 0) return [];
            let currentIndex = array.length, randomIndex;
            const shuffled = [...array];
            let i = 0;
            while (currentIndex !== 0) {
                const daySeed = weekSeed + seedOffset + i++;
                randomIndex = Math.floor(seededRandom(daySeed) * currentIndex);
                currentIndex--;
                [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
            }
            return shuffled;
        };

        // 1. Assign Team Leader Machines globally non-overlapping per week across shifts
        TEAMS_BASE.forEach(team => {
            turni.forEach(t => resultByTurno[t][team.id] = []);
            const teamMachines = machinesByTeam[team.id] || [];
            if (teamMachines.length === 0) return;

            const shuffled = shuffle(teamMachines, team.id.charCodeAt(2) * 100);
            let idx = 0;
            turni.forEach(t => {
                for (let i = 0; i < 6; i++) {
                    const machine = shuffled[idx % shuffled.length];
                    resultByTurno[t][team.id].push({ dayIndex: i, machine });
                    idx++;
                }
            });
        });

        // 2. Assign Coordinator Machines globally
        const allMachines = macchine.filter(m => !!(m.reparto_id || m.reparto));
        if (allMachines.length > 0) {
            const allShuffled = shuffle(allMachines, 1337);
            let cIdx = 0;
            turni.forEach(t => {
                for (let i = 0; i < 6; i++) {
                    const assignedMachine = allShuffled[cIdx % allShuffled.length];
                    resultByTurno[t].coord.push({
                        dayIndex: i,
                        machine: {
                            ...assignedMachine,
                            tecnologia: assignedMachine.id.startsWith("DRA") ? "Tornitura" :
                                assignedMachine.id.startsWith("FRW") || assignedMachine.id.startsWith("FRD") ? "Dentatura" :
                                    assignedMachine.id.startsWith("SLA") || assignedMachine.id.startsWith("SLW") ? "Rettifica" :
                                        assignedMachine.id.startsWith("SCA") ? "Saldatura" : "Altro"
                        }
                    });
                    cIdx++;
                }
            });
        }

        return resultByTurno[turnoCorrente || "A"];
    }, [currentWeek, machinesByTeam, macchine, turnoCorrente]);

    const updateStatus = (week, teamId, dayIdx, machineId, status) => {
        const key = `${turnoCorrente}_${week}_${teamId}_${dayIdx}_${machineId}`;
        setData(prev => ({
            ...prev,
            [key]: status
        }));
    };

    const deleteData = () => {
        if (window.confirm(`Sei sicuro di voler eliminare i dati LPA per il Turno ${turnoCorrente}?`)) {
            setData(prev => {
                const newData = { ...prev };
                Object.keys(newData).forEach(key => {
                    if (key.startsWith(`${turnoCorrente}_`)) {
                        delete newData[key];
                    }
                });
                return newData;
            });
            showToast(`Dati LPA Turno ${turnoCorrente} eliminati`, "success");
        }
    };

    const exportSAP = () => {
        // SAP Format: data_evento, matricola, cognome, nome, turno (D), stazione (macchina), reparto (BAP1/BAP11/BAP12/BAP13), tecnologia
        let csv = "data_evento,matricola,cognome,nome,turno,stazione,reparto,tecnologia,esito\n";

        const shiftData = Object.entries(data).filter(([key]) => key.startsWith(`${turnoCorrente}_`));

        shiftData.forEach(([key, esito]) => {
            const [shiftId, week, teamId, dayIdx, machineId] = key.split("_");
            const wStart = getStartDate();
            wStart.setDate(wStart.getDate() + (parseInt(week) - 1) * 7 + parseInt(dayIdx));
            const dateStr = wStart.toLocaleDateString("it-IT");

            let auditorName = "";
            let rep = "";
            if (teamId === "COORD") {
                auditorName = activeCoordinator;
                rep = "ALL";
            } else {
                const team = activeTeams.find(t => t.id === teamId);
                auditorName = team?.leader || "";
                rep = team?.reparto || "";
            }

            const machine = macchine.find(m => m.id === machineId);
            let tech = "Altro";
            if (machineId.startsWith("DRA")) tech = "Tornitura";
            else if (machineId.startsWith("FRW") || machineId.startsWith("FRD")) tech = "Dentatura";
            else if (machineId.startsWith("SLA") || machineId.startsWith("SLW")) tech = "Rettifica";
            else if (machineId.startsWith("SCA")) tech = "Saldatura";

            csv += `${dateStr},,${auditorName},,${turnoCorrente},${machine?.nome || machineId},${rep},${tech},${esito}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lpa_sap_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Rendering Helpers
    const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    const weekRange = getWeekRange(currentWeek);

    return (
        <div className="fade-in" style={{ padding: 12, fontSize: 13 }}>
            {/* Header Controls */}
            <div className="card" style={{ padding: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>Settimana:</span>
                        <select
                            className="input"
                            style={{ width: 220, padding: "4px 8px" }}
                            value={currentWeek}
                            onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
                        >
                            {Array.from({ length: 52 }).map((_, i) => {
                                const range = getWeekRange(i + 1);
                                return (
                                    <option key={i} value={i + 1}>
                                        Sett. {i + 1} ({formatShortDate(range.monday)} - {formatShortDate(range.saturday)})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div className="tabs" style={{ margin: 0, padding: 4, background: "var(--bg-secondary)" }}>
                        <button className={`tab ${view === "dashboard" ? "active" : ""}`} style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setView("dashboard")}>Dashboard</button>
                        <button className={`tab ${view === "stats" ? "active" : ""}`} style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setView("stats")}>Statistiche</button>
                        <button className={`tab ${view === "grid" ? "active" : ""}`} style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setView("grid")}>Griglia 52 Sett.</button>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11 }} onClick={exportSAP}>{Icons.download} Esporta CSV</button>
                    <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: 11 }} onClick={deleteData}>{Icons.trash} Reset</button>
                </div>
            </div>

            {view === "dashboard" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Coordinator Header & List */}
                    <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", padding: "16px 20px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600, textTransform: "uppercase" }}>Coordinatore (Turno {turnoCorrente})</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>{activeCoordinator}</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.2)", padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                                {formatShortDate(weekRange.monday)} — {formatShortDate(weekRange.saturday)}
                            </div>
                        </div>

                        {/* Coordinator Machines Grid */}
                        <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                            {DAYS.map((day, idx) => {
                                const assignment = assignments.coord?.find(a => a.dayIndex === idx);
                                if (!assignment) return <div key={idx} className="card" style={{ background: "rgba(255,255,255,0.1)", opacity: 0.5, height: 120 }}></div>;

                                const machine = assignment.machine;
                                const status = data[`${turnoCorrente}_${currentWeek}_COORD_${idx}_${machine.id}`];
                                const techColor = TECHNOLOGIES[machine.tecnologia || "Altro"]?.color || "#fff";

                                return (
                                    <div key={idx} className="card" style={{
                                        padding: 10,
                                        border: status ? `2px solid ${status === 'Sì' ? '#10B981' : status === 'No' ? '#EF4444' : '#F59E0B'}` : "1px solid rgba(255,255,255,0.2)",
                                        background: "white",
                                        color: "var(--text-primary)",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        minHeight: 120,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{day}</div>
                                            <div style={{ fontSize: 15, fontWeight: 800 }}>{machine.nome}</div>
                                            <div style={{ fontSize: 10, color: techColor, fontWeight: 600 }}>{machine.tecnologia}</div>
                                        </div>

                                        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                                            <button
                                                onClick={() => updateStatus(currentWeek, "COORD", idx, machine.id, "Sì")}
                                                className={`btn ${status === 'Sì' ? 'btn-success' : 'btn-ghost'}`}
                                                style={{ flex: 1, padding: "2px 0", fontSize: 10, height: 24 }}
                                            >Sì</button>
                                            <button
                                                onClick={() => updateStatus(currentWeek, "COORD", idx, machine.id, "No")}
                                                className={`btn ${status === 'No' ? 'btn-danger' : 'btn-ghost'}`}
                                                style={{ flex: 1, padding: "2px 0", fontSize: 10, height: 24 }}
                                            >No</button>
                                            <button
                                                onClick={() => updateStatus(currentWeek, "COORD", idx, machine.id, "A")}
                                                className={`btn ${status === 'A' ? 'btn-warning' : 'btn-ghost'}`}
                                                style={{ flex: 1, padding: "2px 0", fontSize: 10, height: 24, minWidth: 20 }}
                                            >Abs</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Team Grids */}
                    {activeTeams.map(team => (
                        <div key={team.id}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 12, height: 12, borderRadius: "50%", background: team.id === "T13" ? "#10B981" : "#3B82F6" }}></span>
                                {team.label} — TL: {team.leader}
                            </h3>

                            <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                                {DAYS.map((day, idx) => {
                                    const assignment = assignments[team.id]?.find(a => a.dayIndex === idx);
                                    if (!assignment) return <div key={idx} className="card" style={{ background: "var(--bg-tertiary)", opacity: 0.5, height: 120 }}></div>;

                                    const machine = assignment.machine;
                                    const status = data[`${turnoCorrente}_${currentWeek}_${team.id}_${idx}_${machine.id}`];
                                    const techColor = TECHNOLOGIES[machine.tecnologia || "Altro"]?.color || "#6B7280";

                                    return (
                                        <div key={idx} className="card" style={{
                                            padding: 10,
                                            border: status ? `1px solid ${status === 'Sì' ? '#10B981' : status === 'No' ? '#EF4444' : '#F59E0B'}` : "1px solid var(--border)",
                                            background: status === 'Sì' ? "rgba(16, 185, 129, 0.05)" : status === 'No' ? "rgba(239, 68, 68, 0.05)" : "var(--bg-card)",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            minHeight: 120
                                        }}>
                                            <div>
                                                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>{day}</div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{machine.nome}</div>
                                                <div style={{ fontSize: 10, color: techColor, fontWeight: 600 }}>{machine.tecnologia}</div>
                                            </div>

                                            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                                                <button
                                                    onClick={() => updateStatus(currentWeek, team.id, idx, machine.id, "Sì")}
                                                    className={`btn ${status === 'Sì' ? 'btn-success' : 'btn-ghost'}`}
                                                    style={{ flex: 1, padding: "2px 0", fontSize: 10, height: 24 }}
                                                >Sì</button>
                                                <button
                                                    onClick={() => updateStatus(currentWeek, team.id, idx, machine.id, "No")}
                                                    className={`btn ${status === 'No' ? 'btn-danger' : 'btn-ghost'}`}
                                                    style={{ flex: 1, padding: "2px 0", fontSize: 10, height: 24 }}
                                                >No</button>
                                                <button
                                                    onClick={() => updateStatus(currentWeek, team.id, idx, machine.id, "A")}
                                                    className={`btn ${status === 'A' ? 'btn-warning' : 'btn-ghost'}`}
                                                    style={{ flex: 1, padding: "2px 0", fontSize: 10, height: 24, minWidth: 20 }}
                                                >Abs</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view === "stats" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    {/* Overall Stats */}
                    <div className="card" style={{ gridColumn: "span 4", padding: 20, textAlign: "center" }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Rendimento Programma LPA 2026</h3>
                        {(() => {
                            const entries = Object.entries(data).filter(([key]) => key.startsWith(`${turnoCorrente}_`));
                            const total = entries.length;
                            const completed = entries.filter(([_, v]) => v === "Sì").length;
                            const failures = entries.filter(([_, v]) => v === "No").length;
                            const absent = entries.filter(([_, v]) => v === "A").length;
                            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                            return (
                                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 48, fontWeight: 900, color: "var(--accent)" }}>{percent}%</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>COMPLETAMENTO TOTALE</div>
                                    </div>
                                    <div style={{ width: 1, height: 60, background: "var(--border)" }}></div>
                                    <div>
                                        <div style={{ fontSize: 24, fontWeight: 800 }}>{total}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ISPEZIONI TOTALI</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--success)" }}>{completed}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>CONFORMI (SÌ)</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--danger)" }}>{failures}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>NON CONFORMI (NO)</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--warning)" }}>{absent}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ASSENTI</div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* TL Stats */}
                    {activeTeams.map(team => {
                        const teamEntries = Object.entries(data).filter(([key]) => key.startsWith(`${turnoCorrente}_`) && key.includes(`_${team.id}_`));
                        const total = teamEntries.length;
                        const completed = teamEntries.filter(([_, v]) => v === "Sì").length;
                        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                        return (
                            <div key={team.id} className="card" style={{ padding: 16 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>{team.label} (TL)</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: "var(--primary)" }}>{percent}%</div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11 }}>
                                    <span>Programmate: <strong>{total}</strong></span>
                                    <span>Completate: <strong>{completed}</strong></span>
                                </div>
                                <div style={{ height: 4, background: "var(--bg-secondary)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${percent}%`, background: "var(--primary)" }}></div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Coord Stats */}
                    {(() => {
                        const coordEntries = Object.entries(data).filter(([key]) => key.startsWith(`${turnoCorrente}_`) && key.includes(`_COORD_`));
                        const total = coordEntries.length;
                        const completed = coordEntries.filter(([_, v]) => v === "Sì").length;
                        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                        return (
                            <div className="card" style={{ padding: 16, border: "2px solid #8B5CF6" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#8B5CF6", marginBottom: 8 }}>COORDINATORE</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: "#8B5CF6" }}>{percent}%</div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11 }}>
                                    <span>Programmate: <strong>{total}</strong></span>
                                    <span>Completate: <strong>{completed}</strong></span>
                                </div>
                                <div style={{ height: 4, background: "rgba(139, 92, 246, 0.2)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${percent}%`, background: "#8B5CF6" }}></div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {view === "grid" && (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 250px)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
                                <tr>
                                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid var(--border)", width: 120 }}>Settimana</th>
                                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid var(--border)", width: 80 }}>Coord. T.</th>
                                    {activeTeams.map(t => (
                                        <th key={t.id} style={{ padding: "8px 12px", borderBottom: "2px solid var(--border)", minWidth: 200 }}>
                                            {t.label} (TL: {t.leader})
                                        </th>
                                    ))}
                                    <th style={{ padding: "8px 12px", borderBottom: "2px solid var(--border)", minWidth: 200, color: "#8B5CF6" }}>Ispezioni Coord.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 52 }).map((_, i) => {
                                    const weekNum = i + 1;
                                    const coord = activeTeams[(weekNum - 1) % 3];
                                    const currentWeekAssignments = {};
                                    TEAMS_BASE.forEach(team => {
                                        const teamMachines = machinesByTeam[team.id] || [];
                                        const shuffle = (array, seedOffset) => {
                                            if (!array || array.length === 0) return [];
                                            let currentIndex = array.length, randomIndex;
                                            const shuffled = [...array];
                                            let idx = 0;
                                            while (currentIndex !== 0) {
                                                const daySeed = weekNum * 99999 + seedOffset + idx++;
                                                randomIndex = Math.floor(seededRandom(daySeed) * currentIndex);
                                                currentIndex--;
                                                [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
                                            }
                                            return shuffled;
                                        };
                                        const shuffled = shuffle(teamMachines, team.id.charCodeAt(2) * 100);
                                        // Need to skip indices based on which turno we are in the sequence A,B,C,D
                                        const turni = ["A", "B", "C", "D"];
                                        const tIdx = turni.indexOf(turnoCorrente || "A");
                                        const startIdx = tIdx * 6;

                                        const assigned = [];
                                        for (let j = 0; j < 6; j++) {
                                            const machine = shuffled[(startIdx + j) % (shuffled.length || 1)];
                                            if (machine) assigned.push(machine);
                                        }
                                        currentWeekAssignments[team.id] = assigned;
                                    });

                                    // Generate Coord assignments for grid view specific to this turno
                                    const allMachines = macchine.filter(m => !!(m.reparto_id || m.reparto));
                                    const coordAssignedGrid = [];
                                    if (allMachines.length > 0) {
                                        const shuffle = (array, seedOffset) => {
                                            if (!array || array.length === 0) return [];
                                            let currentIndex = array.length, randomIndex;
                                            const shuffled = [...array];
                                            let idx = 0;
                                            while (currentIndex !== 0) {
                                                const daySeed = weekNum * 99999 + seedOffset + idx++;
                                                randomIndex = Math.floor(seededRandom(daySeed) * currentIndex);
                                                currentIndex--;
                                                [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
                                            }
                                            return shuffled;
                                        };
                                        const allShuffled = shuffle(allMachines, 1337);
                                        const turni = ["A", "B", "C", "D"];
                                        const tIdx = turni.indexOf(turnoCorrente || "A");
                                        const startIdx = tIdx * 6;
                                        for (let j = 0; j < 6; j++) {
                                            const machine = allShuffled[(startIdx + j) % allShuffled.length];
                                            coordAssignedGrid.push(machine);
                                        }
                                    }
                                    currentWeekAssignments.coord = coordAssignedGrid;

                                    return (
                                        <tr key={weekNum} style={{ borderBottom: "1px solid var(--border-light)", background: weekNum === currentWeek ? "rgba(var(--accent-rgb), 0.05)" : "transparent" }}>
                                            <td style={{ padding: "6px 12px", fontWeight: 700 }}>Sett. {weekNum}</td>
                                            <td style={{ padding: "6px 12px" }}>
                                                <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4, background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6", fontWeight: 700 }}>{activeCoordinator}</span>
                                            </td>
                                            {activeTeams.map(team => (
                                                <td key={team.id} style={{ padding: "6px 12px" }}>
                                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                        {currentWeekAssignments[team.id]?.map((m, dIdx) => {
                                                            const status = data[`${turnoCorrente}_${weekNum}_${team.id}_${dIdx}_${m.id}`];
                                                            const isAuditorCoord = team.id === coord.id;
                                                            return (
                                                                <div key={dIdx} style={{
                                                                    padding: "2px 6px",
                                                                    borderRadius: 4,
                                                                    background: status === 'Sì' ? "rgba(16, 185, 129, 0.2)" : status === 'No' ? "rgba(239, 68, 68, 0.2)" : status === 'A' ? "rgba(245, 158, 11, 0.2)" : "var(--bg-tertiary)",
                                                                    border: `1px solid ${status === 'Sì' ? '#10B981' : status === 'No' ? '#EF4444' : status === 'A' ? '#F59E0B' : 'transparent'}`,
                                                                    fontSize: 9,
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 4
                                                                }}>
                                                                    <span style={{ fontWeight: 800 }}>{m.nome}</span>
                                                                    <span style={{ opacity: 0.6 }}>TL</span>
                                                                    <span style={{ fontWeight: 900, marginLeft: 2 }}>
                                                                        {status === 'Sì' ? "✓" : status === 'No' ? "✗" : status === 'A' ? "A" : "—"}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            ))}
                                            {/* Coord Column Data */}
                                            <td style={{ padding: "6px 12px" }}>
                                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderLeft: "2px solid rgba(139, 92, 246, 0.3)", paddingLeft: 8 }}>
                                                    {currentWeekAssignments.coord?.map((m, dIdx) => {
                                                        const status = data[`${turnoCorrente}_${weekNum}_COORD_${dIdx}_${m.id}`];
                                                        return (
                                                            <div key={`coord_${dIdx}`} style={{
                                                                padding: "2px 6px",
                                                                borderRadius: 4,
                                                                background: status === 'Sì' ? "rgba(16, 185, 129, 0.2)" : status === 'No' ? "rgba(239, 68, 68, 0.2)" : status === 'A' ? "rgba(245, 158, 11, 0.2)" : "rgba(139, 92, 246, 0.1)",
                                                                border: `1px solid ${status === 'Sì' ? '#10B981' : status === 'No' ? '#EF4444' : status === 'A' ? '#F59E0B' : '#8B5CF6'}`,
                                                                fontSize: 9,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 4
                                                            }}>
                                                                <span style={{ fontWeight: 800, color: "#8B5CF6" }}>{m.nome}</span>
                                                                <span style={{ fontWeight: 900, marginLeft: 2 }}>
                                                                    {status === 'Sì' ? "✓" : status === 'No' ? "✗" : status === 'A' ? "A" : "—"}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
