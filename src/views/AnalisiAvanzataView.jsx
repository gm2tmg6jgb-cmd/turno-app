import React, { useState, useMemo } from "react";
import {
    ResponsiveContainer, Tooltip,
    XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { getSlotForGroup } from '../lib/shiftRotation';
import { getLocalDate } from '../lib/dateUtils';

export default function AnalisiAvanzataView({ dipendenti, presenze, motivi, globalDate, turnoCorrente }) {
    const selectedDate = globalDate || getLocalDate(new Date());
    const selectedTurno = turnoCorrente || "";
    const [absencesViewMode, setAbsencesViewMode] = useState("aggregate");

    // Trend Data Calculation (Next 14 Days from Selected Date)
    const trendData = useMemo(() => {
        const data = [];
        const currentRefDate = new Date(selectedDate);

        // Go forward 14 days
        for (let i = 0; i < 14; i++) {
            const d = new Date(currentRefDate);
            d.setDate(currentRefDate.getDate() + i);
            const dateStr = getLocalDate(d); // Use helper to ensure "YYYY-MM-DD"
            const label = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });

            const dayPres = presenze.filter(p =>
                p.data === dateStr &&
                (!selectedTurno || p.turno_id === selectedTurno)
            );

            const assenti = dayPres.filter(p => !p.presente).length;
            // Unplanned = All EXCEPT ferie, rol, riposo_compensativo
            const imprevisti = dayPres.filter(p => !p.presente && !['ferie', 'rol', 'riposo_compensativo'].includes(p.motivo_assenza)).length;

            data.push({
                name: label,
                Assenze: assenti,
                Imprevisti: imprevisti
            });
        }
        return data;
    }, [presenze, selectedDate, selectedTurno]);

    // Anomalous Absences Detection (First/Last Night, Last Evening) from start of year
    const anomalousAbsences = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(`${currentYear}-01-01T00:00:00Z`);

        return presenze.filter(p =>
            !p.presente &&
            p.motivo_assenza !== 'riposo_compensativo' &&
            new Date(p.data) >= startOfYear
        ).map(p => {
            const dip = dipendenti.find(dip => dip.id === p.dipendente_id);
            if (!dip) return null;

            const group = dip.turno_default || "D";

            return {
                ...p,
                dipendente: dip,
                group: group
            };
        }).filter(Boolean);
    }, [presenze, dipendenti]);

    const resolvedAnomalies = useMemo(() => {
        try {
            const rawAnomalies = anomalousAbsences.map(p => {
                const dateStr = p.data;
                const d = new Date(dateStr);
                const slotObj = getSlotForGroup(p.group, dateStr);
                if (!slotObj) return null;

                const prevD = new Date(d); prevD.setDate(d.getDate() - 1);
                const nextD = new Date(d); nextD.setDate(d.getDate() + 1);

                const getIso = (dateObj) => {
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                };

                const prevSlot = getSlotForGroup(p.group, getIso(prevD));
                const nextSlot = getSlotForGroup(p.group, getIso(nextD));

                let isAnomalous = false;
                let anomalyType = "";

                if (slotObj.id === "N") {
                    if (prevSlot?.id !== "N") { isAnomalous = true; anomalyType = "Prima Notte"; }
                    else if (nextSlot?.id !== "N") { isAnomalous = true; anomalyType = "Ultima Notte"; }
                } else if (slotObj.id === "S" && d.getDay() === 6) {
                    isAnomalous = true; anomalyType = "Sabato 18-24";
                }

                if (isAnomalous) {
                    return { ...p, slot: slotObj, type: anomalyType };
                }
                return null;
            }).filter(Boolean);

            // Group consecutive absences
            const groups = [];
            let currentGroup = null;

            const sorted = [...rawAnomalies].sort((a, b) => {
                if (a.dipendente_id !== b.dipendente_id) return a.dipendente_id.localeCompare(b.dipendente_id);
                return new Date(a.data) - new Date(b.data);
            });

            sorted.forEach(item => {
                if (!currentGroup) {
                    currentGroup = { ...item, dates: [item.data] };
                    return;
                }
                const lastDate = new Date(currentGroup.dates[currentGroup.dates.length - 1]);
                const nextDate = new Date(item.data);
                const diffDays = Math.round((nextDate - lastDate) / (1000 * 60 * 60 * 24));

                if (item.dipendente_id === currentGroup.dipendente_id && item.motivo_assenza === currentGroup.motivo_assenza && item.type === currentGroup.type && diffDays === 1) {
                    currentGroup.dates.push(item.data);
                } else {
                    groups.push(currentGroup);
                    currentGroup = { ...item, dates: [item.data] };
                }
            });
            if (currentGroup) groups.push(currentGroup);

            return groups.map(g => {
                const first = new Date(g.dates[0]).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
                if (g.dates.length === 1) return { ...g, dateFormatted: first };
                const last = new Date(g.dates[g.dates.length - 1]).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
                return { ...g, dateFormatted: `${first} - ${last}` };
            }).sort((a, b) => new Date(b.dates[0]) - new Date(a.dates[0]));
        } catch (e) {
            console.error(e);
            return [];
        }
    }, [anomalousAbsences]);

    // Planned Strategic Absences (Saturday Evening, Saturday Night, Monday)
    const plannedAnomalies = useMemo(() => {
        try {
            const plannedReasons = ['ferie', 'rol', 'riposo_compensativo'];

            const rawPlanned = anomalousAbsences.filter(p => plannedReasons.includes(p.motivo_assenza)).map(p => {
                const dateStr = p.data;
                const [year, month, day] = dateStr.split('-');
                const d = new Date(year, month - 1, day);
                const dayOfWeek = d.getDay();

                const slotObj = getSlotForGroup(p.group, dateStr);
                if (!slotObj) return null;

                let isStrategic = false;
                let strategyType = "";

                const ITALIAN_HOLIDAYS = [
                    "01-01", "01-06", "04-25", "05-01", "06-02", "08-15",
                    "11-01", "12-08", "12-25", "12-26"
                ];
                const isHoliday = (dateObj) => {
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(dateObj.getDate()).padStart(2, '0');
                    return ITALIAN_HOLIDAYS.includes(`${m}-${dayStr}`);
                };

                let isPonte = false;
                let ponteName = "";
                
                if (dayOfWeek === 1) { // Monday
                    const nextDate = new Date(d); nextDate.setDate(d.getDate() + 1);
                    if (isHoliday(nextDate)) { isPonte = true; ponteName = "Ponte (Lunedì pre-festivo)"; }
                } else if (dayOfWeek === 5) { // Friday
                    const prevDate = new Date(d); prevDate.setDate(d.getDate() - 1);
                    if (isHoliday(prevDate)) { isPonte = true; ponteName = "Ponte (Venerdì post-festivo)"; }
                }

                if (isPonte) {
                    isStrategic = true; strategyType = ponteName;
                } else if (dayOfWeek === 6 && slotObj.id === "S") {
                    isStrategic = true; strategyType = "Sabato Sera";
                } else if (dayOfWeek === 6 && slotObj.id === "N") {
                    isStrategic = true; strategyType = "Sabato Notte";
                } else if (dayOfWeek === 1) {
                    isStrategic = true; strategyType = `Lunedì (${slotObj.nome})`;
                }

                if (isStrategic) {
                    return { ...p, slot: slotObj, type: strategyType };
                }
                return null;
            }).filter(Boolean);

            // Group consecutive absences
            const groups = [];
            let currentGroup = null;

            const sorted = [...rawPlanned].sort((a, b) => {
                if (a.dipendente_id !== b.dipendente_id) return a.dipendente_id.localeCompare(b.dipendente_id);
                return new Date(a.data) - new Date(b.data);
            });

            sorted.forEach(item => {
                if (!currentGroup) {
                    currentGroup = { ...item, dates: [item.data] };
                    return;
                }
                const lastDate = new Date(currentGroup.dates[currentGroup.dates.length - 1]);
                const nextDate = new Date(item.data);
                const diffDays = Math.round((nextDate - lastDate) / (1000 * 60 * 60 * 24));

                if (item.dipendente_id === currentGroup.dipendente_id && item.motivo_assenza === currentGroup.motivo_assenza && item.type === currentGroup.type && diffDays === 1) {
                    currentGroup.dates.push(item.data);
                } else {
                    groups.push(currentGroup);
                    currentGroup = { ...item, dates: [item.data] };
                }
            });
            if (currentGroup) groups.push(currentGroup);

            return groups.map(g => {
                const first = new Date(g.dates[0]).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
                if (g.dates.length === 1) return { ...g, dateFormatted: first };
                const last = new Date(g.dates[g.dates.length - 1]).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
                return { ...g, dateFormatted: `${first} - ${last}` };
            }).sort((a, b) => new Date(b.dates[0]) - new Date(a.dates[0]));
        } catch (e) {
            console.error(e);
            return [];
        }
    }, [anomalousAbsences]);

    const aggregatedAbsenceData = useMemo(() => {
        const map = {};

        // Merge both types
        const allOutliers = [
            ...resolvedAnomalies.map(a => ({ ...a, category: 'Anomala' })),
            ...plannedAnomalies.map(a => ({ ...a, category: 'Strategica' }))
        ];

        allOutliers.forEach(a => {
            const id = a.dipendente_id;
            if (!map[id]) {
                map[id] = {
                    dip: a.dipendente,
                    anomalies: 0,
                    strategic: 0,
                    total: 0,
                    patterns: new Set()
                };
            }
            if (a.category === 'Anomala') map[id].anomalies++;
            else map[id].strategic++;

            map[id].total++;
            map[id].patterns.add(a.type);
        });

        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [resolvedAnomalies, plannedAnomalies]);


    return (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
            <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Analisi Trend Assenze (Prossimi 14 gg)</h3>
                <div style={{ height: 400, width: '100%' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                        Previsione dell'andamento delle assenze totali e impreviste a partire da oggi (per tutto lo stabilimento).
                    </p>
                    <ResponsiveContainer width="100%" height={340}>
                        <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorAssenze" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorImprevisti" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                            <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                            />
                            <Area type="monotone" dataKey="Assenze" stroke="var(--danger)" fillOpacity={1} fill="url(#colorAssenze)" />
                            <Area type="monotone" dataKey="Imprevisti" stroke="var(--warning)" fillOpacity={1} fill="url(#colorImprevisti)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Analisi Percorsi Assenze (Anomale e Strategiche)</h3>
                        <div style={{ display: "flex", background: "var(--bg-secondary)", padding: 4, borderRadius: 8, gap: 4 }}>
                            <button
                                onClick={() => setAbsencesViewMode("detail")}
                                style={{
                                    padding: "4px 12px", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer",
                                    background: absencesViewMode === "detail" ? "var(--bg-card)" : "transparent",
                                    boxShadow: absencesViewMode === "detail" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                                    fontWeight: absencesViewMode === "detail" ? 600 : 400,
                                    color: "var(--text-primary)"
                                }}
                            >
                                Dettaglio Log
                            </button>
                            <button
                                onClick={() => setAbsencesViewMode("aggregate")}
                                style={{
                                    padding: "4px 12px", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer",
                                    background: absencesViewMode === "aggregate" ? "var(--bg-card)" : "transparent",
                                    boxShadow: absencesViewMode === "aggregate" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                                    fontWeight: absencesViewMode === "aggregate" ? 600 : 400,
                                    color: "var(--text-primary)"
                                }}
                            >
                                Agglomerato (Per Dipendente)
                            </button>
                        </div>
                    </div>
                    <span className="tag tag-red" style={{ fontSize: 11, fontWeight: 700 }}>{resolvedAnomalies.length + plannedAnomalies.length} Segnalazioni Totali</span>
                </div>

                {absencesViewMode === "aggregate" ? (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Dipendente</th>
                                    <th style={{ textAlign: "center" }}>Pattern Rilevati</th>
                                    <th style={{ textAlign: "center" }}>Anomale</th>
                                    <th style={{ textAlign: "center" }}>Strategiche</th>
                                    <th style={{ textAlign: "center" }}>Punteggio Totale</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregatedAbsenceData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 600, fontSize: 15 }}>{item.dip?.cognome} {item.dip?.nome?.charAt(0) ?? ""}.</td>
                                        <td style={{ textAlign: "center", fontSize: 12 }}>
                                            {Array.from(item.patterns).map((p, pidx) => (
                                                <span key={pidx} style={{
                                                    display: "inline-block",
                                                    background: "var(--bg-secondary)",
                                                    padding: "2px 6px",
                                                    borderRadius: 4,
                                                    margin: "2px",
                                                    fontSize: 10,
                                                    color: "var(--text-secondary)"
                                                }}>
                                                    {p}
                                                </span>
                                            ))}
                                        </td>
                                        <td style={{ textAlign: "center", color: "var(--danger)", fontWeight: 700 }}>{item.anomalies || "—"}</td>
                                        <td style={{ textAlign: "center", color: "var(--primary)", fontWeight: 700 }}>{item.strategic || "—"}</td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{
                                                background: item.total > 3 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                                color: item.total > 3 ? "var(--danger)" : "var(--success)",
                                                padding: "4px 12px",
                                                borderRadius: 12,
                                                fontWeight: 800,
                                                fontSize: 14
                                            }}>
                                                {item.total}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <>
                        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                            Dettaglio delle assenze che avvengono in momenti critici (es. cambi turno notte o weekend lavorativi), calcolato su tutti i dati presenti nel sistema.
                        </p>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "left" }}>Data Assenza</th>
                                        <th style={{ textAlign: "left" }}>Dipendente</th>
                                        <th style={{ textAlign: "center" }}>Turno</th>
                                        <th style={{ textAlign: "left" }}>Motivo</th>
                                        <th style={{ textAlign: "center" }}>Anomalia Rilevata</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resolvedAnomalies.map((a, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{a.dateFormatted}</td>
                                            <td style={{ fontWeight: 600, fontSize: 15 }}>{a.dipendente?.cognome} {a.dipendente?.nome?.charAt(0) ?? ""}.</td>
                                            <td style={{ textAlign: "center", color: "var(--text-primary)" }}>{a.dates.length > 1 ? "Vari" : a.group}</td>
                                            <td style={{ color: "var(--text-muted)" }}>
                                                {motivi.find(m => m.id === a.motivo_assenza)?.label || a.motivo_assenza || "Assenza"}
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                <span style={{
                                                    background: "rgba(220, 38, 38, 0.1)",
                                                    color: "var(--danger)",
                                                    padding: "4px 10px",
                                                    borderRadius: 12,
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    display: "inline-block"
                                                }}>
                                                    ⚠️ {a.type}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {absencesViewMode === "detail" && (
                <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Assenze Pianificate Strategiche (Sab/Lun)</h3>
                        <span className="tag tag-blue" style={{ fontSize: 11, fontWeight: 700 }}>{plannedAnomalies.length} Segnalazioni</span>
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                        Questo pannello evidenzia le assenze pianificate (Ferie, ROL, Riposo Compensativo) strategiche che cadono di Sabato Sera, Sabato Notte o Lunedì, dall'inizio dell'anno.
                    </p>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: "left" }}>Data Assenza</th>
                                    <th style={{ textAlign: "left" }}>Dipendente</th>
                                    <th style={{ textAlign: "center" }}>Turno Assegnato</th>
                                    <th style={{ textAlign: "left" }}>Motivo Pianificato</th>
                                    <th style={{ textAlign: "center" }}>Giornata Strategica</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plannedAnomalies.map((a, idx) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{a.dateFormatted}</td>
                                        <td style={{ fontWeight: 600, fontSize: 15 }}>{a.dipendente?.cognome} {a.dipendente?.nome?.charAt(0) ?? ""}.</td>
                                        <td style={{ textAlign: "center", color: "var(--text-primary)" }}>{a.dates.length > 1 ? "Vari" : a.group}</td>
                                        <td style={{ color: "var(--text-muted)" }}>
                                            {motivi.find(m => m.id === a.motivo_assenza)?.label || a.motivo_assenza || "Assenza"}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{
                                                background: "rgba(59, 130, 246, 0.1)",
                                                color: "var(--primary)",
                                                padding: "4px 10px",
                                                borderRadius: 12,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                display: "inline-block"
                                            }}>
                                                🎯 {a.type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
