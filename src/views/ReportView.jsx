import { useState, useMemo } from "react";
import { REPARTI, TURNI } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';

export default function ReportView({ dipendenti, presenze, assegnazioni, macchine, repartoCorrente, turnoCorrente, zones, motivi }) {
    const [reportType, setReportType] = useState("turno");

    // Manage Date and Turno Selection explicitly
    const getLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(getLocalDate(new Date()));
    const [selectedTurno, setSelectedTurno] = useState(""); // Default to Daily View (All Shifts) as requested

    // Filter by Turno (Consistency with Dashboard)
    const allDip = useMemo(() => {
        return dipendenti.filter(d => !selectedTurno || d.turno_default === selectedTurno);
    }, [dipendenti, selectedTurno]);

    const allPres = useMemo(() => {
        return presenze.filter(p => p.data === selectedDate && (!selectedTurno || p.turno_id === selectedTurno));
    }, [presenze, selectedDate, selectedTurno]);

    const allAss = useMemo(() => {
        return assegnazioni.filter(a => a.data === selectedDate && (!selectedTurno || a.turno_id === selectedTurno));
    }, [assegnazioni, selectedDate, selectedTurno]);

    // Trend Data Calculation (Last 14 Days from Selected Date)
    const trendData = useMemo(() => {
        const data = [];
        const currentRefDate = new Date(selectedDate);

        // Go back 14 days
        for (let i = 13; i >= 0; i--) {
            const d = new Date(currentRefDate);
            d.setDate(currentRefDate.getDate() - i);
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

    const allMacchine = macchine; // Machines might not strictly belong to a shift, but their operators do.

    const presentiCount = allPres.filter((p) => p.presente).length;
    const assentiCount = allPres.filter((p) => !p.presente).length;

    // Calculate Unplanned Absences (User Request: All EXCEPT Ferie, ROL, Riposo Compensativo)
    const plannedReasons = ['ferie', 'rol', 'riposo_compensativo'];
    const unplannedAbsencesCount = allPres.filter((p) => !p.presente && !plannedReasons.includes(p.motivo_assenza)).length;

    // Data for Presence PieChart
    const presenceData = useMemo(() => [
        { name: 'Presenti', value: presentiCount, color: 'var(--success)' },
        { name: 'Assenze Pianificate', value: assentiCount - unplannedAbsencesCount, color: 'var(--info)' }, // Distinguish planned
        { name: 'Assenze Non Pianificate', value: unplannedAbsencesCount, color: 'var(--warning)' }
    ], [presentiCount, assentiCount, unplannedAbsencesCount]);

    // Data for Machine Coverage BarChart - Show by REPARTO instead of single machine if showing factory-wide?
    // Actually, Bar chart with ALL machines might be too crowded. 
    // Let's show coverage % per Reparto.
    const coverageByReparto = useMemo(() => {
        return REPARTI.map(r => {
            const mRep = allMacchine.filter(m => m.reparto_id === r.id);
            const aRep = allAss.filter(a => mRep.some(m => m.id === a.macchina_id));

            // Percentage of machines covered (at least 1 person or min personnel?)
            // Let's stick to person count for the bar chart as requested before but grouped.
            const totalRequired = mRep.reduce((sum, m) => sum + (m.personale_minimo || 1), 0);
            const totalAssigned = aRep.length;

            return {
                name: r.nome.replace("Team ", "T"),
                richiesti: totalRequired,
                assegnati: totalAssigned
            };
        });
    }, [allMacchine, allAss]);

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>
            {/* Filters Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="tabs" style={{ display: "inline-flex", margin: 0 }}>
                    <button className={`tab ${reportType === "turno" ? "active" : ""}`} onClick={() => setReportType("turno")}>Report Fine Turno</button>
                    <button className={`tab ${reportType === "settimanale" ? "active" : ""}`} onClick={() => setReportType("settimanale")}>Analisi Avanzata</button>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--bg-card)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    {/* Date Picker */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Data:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                                padding: "6px 10px",
                                borderRadius: 6,
                                fontSize: 13,
                                fontFamily: "inherit"
                            }}
                        />
                    </div>

                    <div style={{ width: 1, height: 20, background: "var(--border)" }}></div>

                    {/* Shift Selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Turno:</span>
                        <select
                            value={selectedTurno}
                            onChange={(e) => setSelectedTurno(e.target.value)}
                            style={{
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                                padding: "6px 24px 6px 10px",
                                borderRadius: 6,
                                fontSize: 13,
                                cursor: "pointer"
                            }}
                        >
                            <option value="">Tutti i Turni (Giornaliero)</option>
                            {TURNI.map(t => (
                                <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {reportType === "turno" && (
                <div>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Report {selectedTurno ? `Turno ${TURNI.find(t => t.id === selectedTurno)?.nome}` : "Giornaliero (Tutti i Turni)"}</h2>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    Tutti i Reparti — {new Date(selectedDate).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button className="btn btn-secondary">{Icons.report} Esporta PDF</button>
                                <button className="btn btn-primary">{Icons.send} Invia Direzione</button>
                            </div>
                        </div>

                        <div className="stats-grid" style={{ marginBottom: 0, gridTemplateColumns: "repeat(5, 1fr)" }}>
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>TOT PRESENTI</div>
                                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--success)" }}>{presentiCount}</div>
                            </div>
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>TOT ASSENTI</div>
                                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--danger)" }}>{assentiCount}</div>
                            </div>
                            <div style={{ padding: "12px 16px", background: "rgba(245, 158, 11, 0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                                <div style={{ fontSize: 11, color: "var(--warning)", marginBottom: 4, fontWeight: 600 }}>NON PIANIFICATE</div>
                                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--warning)" }}>{unplannedAbsencesCount}</div>
                            </div>
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>FORZA LAVORO (PRES)</div>
                                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--info)" }}>
                                    {presentiCount} <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>/ {allDip.length}</span>
                                </div>
                            </div>
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>% COPERTURA TOT</div>
                                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--accent)" }}>
                                    {allDip.length > 0 ? Math.round((presentiCount / allDip.length) * 100) : 0}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visual Analysis Section */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
                        <div className="card" style={{ height: 320 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Distribuzione Presenze</h3>
                            <ResponsiveContainer width="100%" height="80%">
                                <PieChart>
                                    <Pie
                                        data={presenceData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {presenceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card" style={{ height: 320 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Copertura per Reparto (Assegnati vs Minimo)</h3>
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={coverageByReparto} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    />
                                    <Bar dataKey="richiesti" fill="var(--bg-tertiary)" radius={[4, 4, 0, 0]} name="Minimo Richiesto" />
                                    <Bar dataKey="assegnati" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Effettivi Assegnati" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="report-section">
                        <h3>Assegnazioni Macchine per Reparto (Raggruppate per Zona)</h3>
                        <div className="table-container">
                            {(() => {
                                // 1. Group by Reparto first, then by Zone
                                const repartiInUse = [...new Set(allMacchine.map(m => m.reparto_id))];

                                return repartiInUse.map(repId => {
                                    const repObj = REPARTI.find(r => r.id === repId);
                                    const macchineDelReparto = allMacchine.filter(m => m.reparto_id === repId);

                                    // Group by Zone - ONLY those defined in 'zones' prop
                                    const repZones = zones.filter(z => (z.repart_id || z.reparto) === repId);

                                    // Find machines that match these zones
                                    const validZoneIds = repZones.map(z => z.id);
                                    const machinesInZones = macchineDelReparto.filter(m => validZoneIds.includes(m.zona));
                                    const machinesWithoutZone = macchineDelReparto.filter(m => !m.zona || !validZoneIds.includes(m.zona));

                                    return (
                                        <div key={repId} style={{ marginBottom: 32 }}>
                                            <h4 style={{ borderBottom: "2px solid var(--border)", paddingBottom: 8, marginBottom: 16, color: "var(--text-primary)" }}>
                                                {repObj?.nome || repId}
                                            </h4>

                                            {/* ZONES */}
                                            {/* Single Table per Reparto */}
                                            <table style={{ background: "var(--bg-card)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: "8px 12px", width: "40%", textAlign: "left" }}>Macchina / Zona</th>
                                                        <th style={{ padding: "8px 12px", width: "40%", textAlign: "left" }}>Operatore</th>
                                                        <th style={{ padding: "8px 12px", width: "20%", textAlign: "center" }}>Stato</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {zones
                                                        .filter(z => (z.repart_id || z.reparto) === repId)
                                                        .map(zone => {
                                                            const zoneMachines = macchineDelReparto.filter(m => m.zona === zone.id);
                                                            // Find Zone Responsible
                                                            const zoneResponsibles = allAss.filter(a => (a.macchina_id === zone.id || a.attivita_id === zone.id));
                                                            const zoneOpName = zoneResponsibles.map(z => {
                                                                const d = allDip.find(dd => dd.id === z.dipendente_id);
                                                                return d ? `${d.cognome} ${d.nome}` : "";
                                                            }).filter(Boolean).join(", ");

                                                            const isZoneCovered = zoneResponsibles.length > 0;

                                                            return (
                                                                <>
                                                                    {/* ZONE HEADER ROW */}
                                                                    <tr key={`zone-${zone.id}`} style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                                                                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)" }}>
                                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                                {Icons.grid} {zone.label}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--primary)" }}>
                                                                            {zoneOpName || <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 13, fontStyle: "italic" }}>— Nessun Responsabile —</span>}
                                                                        </td>
                                                                        <td style={{ textAlign: "center" }}>
                                                                            {/* Optional: Zone Status if needed, currently empty as per request */}
                                                                        </td>
                                                                    </tr>

                                                                    {/* MACHINE ROWS */}
                                                                    {zoneMachines.map(m => {
                                                                        const machineOps = allAss.filter(a => a.macchina_id === m.id);
                                                                        const specificNames = machineOps.map(o => {
                                                                            const d = allDip.find(dd => dd.id === o.dipendente_id);
                                                                            return d ? `${d.cognome} ${d.nome.charAt(0)}.` : null;
                                                                        }).filter(Boolean);

                                                                        // Logic: Machine is OK if it has specific op OR if zone is covered
                                                                        const ok = machineOps.length > 0 || isZoneCovered;

                                                                        return (
                                                                            <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                                <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)" }}>
                                                                                    {m.nome}
                                                                                </td>
                                                                                <td style={{ padding: "8px 12px" }}>
                                                                                    {specificNames.length > 0 ? (
                                                                                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{specificNames.join(", ")}</span>
                                                                                    ) : (
                                                                                        <span style={{ color: "var(--text-lighter)", fontSize: 18, lineHeight: 0 }}>&middot;</span>
                                                                                    )}
                                                                                </td>
                                                                                <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                                    <span className={`tag ${ok ? "tag-green" : "tag-red"}`} style={{ padding: "2px 8px", fontSize: 11, minWidth: 50, display: "inline-block", textAlign: "center" }}>
                                                                                        {ok ? "OK" : "SOTTO"}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    {zoneMachines.length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={3} style={{ padding: "8px 12px 8px 32px", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                                                                                Nessuna macchina in questa zona
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </>
                                                            );
                                                        })}

                                                    {/* Machines without Zone */}
                                                    {machinesWithoutZone.length > 0 && (
                                                        <>
                                                            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                                                                <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                                                    Altre Macchine
                                                                </td>
                                                            </tr>
                                                            {machinesWithoutZone.map(m => {
                                                                const machineOps = allAss.filter(a => a.macchina_id === m.id);
                                                                const specificNames = machineOps.map(o => {
                                                                    const d = allDip.find(dd => dd.id === o.dipendente_id);
                                                                    return d ? `${d.cognome} ${d.nome.charAt(0)}.` : null;
                                                                }).filter(Boolean);
                                                                const ok = machineOps.length >= (m.personale_minimo || 1);

                                                                return (
                                                                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                        <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)" }}>
                                                                            {m.nome}
                                                                        </td>
                                                                        <td style={{ padding: "8px 12px" }}>
                                                                            {specificNames.length > 0 ? (
                                                                                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{specificNames.join(", ")}</span>
                                                                            ) : (
                                                                                <span style={{ color: "var(--text-muted)" }}>—</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                            <span className={`tag ${ok ? "tag-green" : "tag-red"}`} style={{ padding: "2px 8px", fontSize: 11, minWidth: 50, display: "inline-block", textAlign: "center" }}>
                                                                                {ok ? "OK" : "SOTTO"}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    <div className="report-section">
                        <h3>Dettaglio Assenze Odierne (Tutti i Team)</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Dipendente</th>
                                        <th>Team</th>
                                        <th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allPres.filter((p) => !p.presente).map((p) => {
                                        const d = allDip.find((dd) => dd.id === p.dipendente_id);
                                        const motivoObj = motivi.find((m) => m.id === p.motivo_assenza);
                                        return (
                                            <tr key={p.dipendente_id}>
                                                <td style={{ fontWeight: 600 }}>{d?.cognome} {d?.nome}</td>
                                                <td>{REPARTI.find((r) => r.id === d?.reparto_id)?.nome || "—"}</td>
                                                <td>
                                                    {motivoObj ? (
                                                        <span style={{
                                                            display: "inline-flex", alignItems: "center", gap: 6,
                                                            fontSize: 13, fontWeight: 500
                                                        }}>
                                                            <span style={{ width: 10, height: 10, borderRadius: 2, background: motivoObj.colore }}></span>
                                                            {motivoObj.label}
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {allPres.filter((p) => !p.presente).length === 0 && (
                                        <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Nessuna assenza registrata</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {reportType === "settimanale" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div className="card">
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Analisi Trend Assenze (Ultimi 14 gg)</h3>
                        <div style={{ height: 400, width: '100%' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                                Monitoraggio dell'andamento delle assenze totali e impreviste (Tutto eccetto Ferie/ROL).
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

                    {/* LIMITAZIONI & PRESCRIZIONI TABLE */}
                    <div className="card">
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Personale con Limitazioni / Prescrizioni</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "left" }}>Dipendente</th>
                                        <th style={{ textAlign: "center" }}>Turno</th>
                                        <th style={{ textAlign: "left" }}>Limitazioni / Note</th>
                                        <th style={{ textAlign: "center" }}>Team</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dipendenti
                                        .filter(d => d.l104 && d.l104.trim() !== "")
                                        .sort((a, b) => (a.turno_default || "D").localeCompare(b.turno_default || "D"))
                                        .map((d) => (
                                            <tr key={d.id}>
                                                <td style={{ fontWeight: 600, background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                                    {d.cognome} {d.nome}
                                                    {d.tipo === 'interinale' && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}> (Int.)</span>}
                                                </td>
                                                <td style={{ textAlign: "center", color: "var(--text-primary)", background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                                    {d.turno_default || d.turno || "D"}
                                                </td>
                                                <td style={{ color: "var(--text-primary)", background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                                    {d.l104.split(',').map((tag, idx) => (
                                                        <span key={idx}>
                                                            {tag.trim()}{idx < d.l104.split(',').length - 1 ? ", " : ""}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td style={{ textAlign: "center", color: "var(--text-muted)", background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                                    {REPARTI.find(r => r.id === d.reparto_id)?.nome || d.reparto_id}
                                                </td>
                                            </tr>
                                        ))}
                                    {dipendenti.filter(d => d.l104 && d.l104.trim() !== "").length === 0 && (
                                        <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Nessuna limitazione registrata.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

