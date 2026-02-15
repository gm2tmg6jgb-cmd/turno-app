import { useState, useMemo } from "react";
import { REPARTI, TURNI, MOTIVI_ASSENZA } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';

export default function ReportView({ dipendenti, presenze, assegnazioni, macchine, repartoCorrente, turnoCorrente, zones }) {
    const [reportType, setReportType] = useState("turno");

    // Filter by Turno (Consistency with Dashboard)
    const allDip = useMemo(() => {
        return dipendenti.filter(d => !turnoCorrente || d.turno_default === turnoCorrente);
    }, [dipendenti, turnoCorrente]);

    const allPres = useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        return presenze.filter(p => p.data === today && (!turnoCorrente || p.turno_id === turnoCorrente));
    }, [presenze, turnoCorrente]);

    const allAss = useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        return assegnazioni.filter(a => a.data === today && (!turnoCorrente || a.turno_id === turnoCorrente));
    }, [assegnazioni, turnoCorrente]);

    // Trend Data Calculation (Last 14 Days)
    const trendData = useMemo(() => {
        const data = [];
        const today = new Date();
        // Go back 14 days
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });

            const dayPres = presenze.filter(p =>
                p.data === dateStr &&
                (!turnoCorrente || p.turno_id === turnoCorrente)
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
    }, [presenze, turnoCorrente]);

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
        <div className="fade-in">
            <div className="tabs" style={{ display: "inline-flex" }}>
                <button className={`tab ${reportType === "turno" ? "active" : ""}`} onClick={() => setReportType("turno")}>Report Fine Turno</button>
                <button className={`tab ${reportType === "settimanale" ? "active" : ""}`} onClick={() => setReportType("settimanale")}>Analisi Avanzata</button>
            </div>

            {reportType === "turno" && (
                <div>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Report Totale Stabilimento</h2>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    Tutti i Reparti — {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
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
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>FORZA LAVORO</div>
                                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "var(--info)" }}>
                                    {allDip.length}
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
                                            {repZones.map(zone => {
                                                const zoneMachines = macchineDelReparto.filter(m => m.zona === zone.id);
                                                // Find Zone Responsible
                                                const zoneResponsibles = allAss.filter(a => (a.macchina_id === zone.id || a.attivita_id === zone.id));

                                                return (
                                                    <div key={zone.id} style={{ marginBottom: 20, background: "var(--bg-secondary)", borderRadius: 8, padding: 16, border: "1px solid var(--border)" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                            <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                                                                {Icons.grid} {zone.label}
                                                            </div>
                                                            <div>
                                                                <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 8 }}>Operatore Zona:</span>
                                                                {zoneResponsibles.length > 0 ? (
                                                                    zoneResponsibles.map(a => {
                                                                        const d = allDip.find(dd => dd.id === a.dipendente_id);
                                                                        return d ? (
                                                                            <span key={a.id} className="tag tag-blue" style={{ marginRight: 4 }}>
                                                                                {d.cognome} {d.nome.charAt(0)}.
                                                                            </span>
                                                                        ) : null;
                                                                    })
                                                                ) : (
                                                                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Non assegnato</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {zoneMachines.length > 0 ? (
                                                            <table style={{ background: "var(--bg-card)", borderRadius: 6, overflow: "hidden" }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ fontSize: 11, padding: "8px 12px" }}>Macchina</th>
                                                                        <th style={{ fontSize: 11, padding: "8px 12px" }}>ID</th>
                                                                        <th style={{ fontSize: 11, padding: "8px 12px" }}>Operatori</th>
                                                                        <th style={{ fontSize: 11, padding: "8px 12px", width: 80, textAlign: "center" }}>Stato</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {zoneMachines.map(m => {
                                                                        const ops = allAss.filter(a => a.macchina_id === m.id);
                                                                        const names = ops.map(o => {
                                                                            const d = allDip.find(dd => dd.id === o.dipendente_id);
                                                                            return d ? `${d.cognome} ${d.nome.charAt(0)}.` : "";
                                                                        });
                                                                        const ok = ops.length >= (m.personale_minimo || 1);

                                                                        return (
                                                                            <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                                <td style={{ fontWeight: 600 }}>{m.nome}</td>
                                                                                <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{m.id}</td>
                                                                                <td>
                                                                                    {names.length > 0 ? names.join(", ") : <span style={{ color: "var(--text-muted)" }}>—</span>}
                                                                                </td>
                                                                                <td style={{ textAlign: "center" }}>
                                                                                    <span className={`tag ${ok ? "tag-green" : "tag-red"}`} style={{ fontSize: 10 }}>
                                                                                        {ok ? "OK" : "SOTTO"}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        ) : (
                                                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: 8 }}>Nessuna macchina assegnata a questa zona.</div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Machines without Zone */}
                                            {machinesWithoutZone.length > 0 && (
                                                <div style={{ marginBottom: 20, padding: 16 }}>
                                                    <h5 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase" }}>Altre Macchine (No Zona)</h5>
                                                    <table style={{ background: "var(--bg-card)", borderRadius: 6, overflow: "hidden" }}>
                                                        <thead>
                                                            <tr>
                                                                <th style={{ fontSize: 11, padding: "8px 12px" }}>Macchina</th>
                                                                <th style={{ fontSize: 11, padding: "8px 12px" }}>ID</th>
                                                                <th style={{ fontSize: 11, padding: "8px 12px" }}>Operatori</th>
                                                                <th style={{ fontSize: 11, padding: "8px 12px", width: 80, textAlign: "center" }}>Stato</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {machinesWithoutZone.map(m => {
                                                                const ops = allAss.filter(a => a.macchina_id === m.id);
                                                                const names = ops.map(o => {
                                                                    const d = allDip.find(dd => dd.id === o.dipendente_id);
                                                                    return d ? `${d.cognome} ${d.nome.charAt(0)}.` : "";
                                                                });
                                                                const ok = ops.length >= (m.personale_minimo || 1);
                                                                return (
                                                                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                        <td style={{ fontWeight: 600 }}>{m.nome}</td>
                                                                        <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{m.id}</td>
                                                                        <td>
                                                                            {names.length > 0 ? names.join(", ") : <span style={{ color: "var(--text-muted)" }}>—</span>}
                                                                        </td>
                                                                        <td style={{ textAlign: "center" }}>
                                                                            <span className={`tag ${ok ? "tag-green" : "tag-red"}`} style={{ fontSize: 10 }}>
                                                                                {ok ? "OK" : "SOTTO"}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
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
                                        const motivoObj = MOTIVI_ASSENZA.find((m) => m.id === p.motivo_assenza);
                                        return (
                                            <tr key={p.dipendente_id}>
                                                <td style={{ fontWeight: 600 }}>{d?.cognome} {d?.nome}</td>
                                                <td>{REPARTI.find((r) => r.id === d?.reparto_id)?.nome || "—"}</td>
                                                <td>{motivoObj ? `${motivoObj.icona} ${motivoObj.label}` : "—"}</td>
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
                </div>
            )
            }
        </div >
    );
}
