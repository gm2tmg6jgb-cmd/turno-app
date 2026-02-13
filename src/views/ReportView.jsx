import { useState, useMemo } from "react";
import { REPARTI, TURNI, MOTIVI_ASSENZA } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

export default function ReportView({ dipendenti, presenze, assegnazioni, macchine, repartoCorrente, turnoCorrente }) {
    const [reportType, setReportType] = useState("turno");
    const allDip = dipendenti;
    const allPres = presenze.filter(p => p.data === new Date().toISOString().split("T")[0]); // Only today's presence for report
    const allAss = assegnazioni.filter(a => a.data === new Date().toISOString().split("T")[0]);
    const allMacchine = macchine;

    const presentiCount = allPres.filter((p) => p.presente).length;
    const assentiCount = allPres.filter((p) => !p.presente).length;

    // Calculate Unplanned Absences (Malattia, Infortunio)
    const unplannedReasons = ['malattia', 'infortunio'];
    const unplannedAbsencesCount = allPres.filter((p) => !p.presente && unplannedReasons.includes(p.motivo_assenza)).length;

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
                        <h3>Assegnazioni Macchine per Reparto</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Reparto</th>
                                        <th>Macchina</th>
                                        <th>ID</th>
                                        <th>Operatori Assegnati</th>
                                        <th>Stato</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allMacchine.map((m) => {
                                        const ops = allAss.filter((a) => a.macchina_id === m.id);
                                        const names = ops.map((o) => {
                                            const d = allDip.find((dd) => dd.id === o.dipendente_id);
                                            return d ? `${d.cognome} ${d.nome.charAt(0)}.` : "";
                                        });
                                        const ok = ops.length >= (m.personale_minimo || 1);
                                        const rep = REPARTI.find(r => r.id === m.reparto_id);
                                        return (
                                            <tr key={m.id}>
                                                <td style={{ fontWeight: 600, fontSize: 11, color: "var(--text-secondary)" }}>{rep?.nome}</td>
                                                <td style={{ fontWeight: 600 }}>{m.nome}</td>
                                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.7 }}>{m.id}</td>
                                                <td>{names.length > 0 ? names.join(", ") : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                                                <td><span className={`tag ${ok ? "tag-green" : "tag-red"}`}>{ok ? "OK" : "SOTTO"}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Analisi Avanzata Reparto</h3>
                        <div style={{ height: 400, width: '100%' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                                Trend di saturazione macchine e saturazione competenze nel reparto {reparto?.nome}.
                            </p>
                            {/* Placeholder for more complex analytics */}
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, background: 'var(--bg-tertiary)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 40, marginBottom: 8 }}>🔮</div>
                                    <div style={{ fontWeight: 600 }}>Analisi Predittiva in arrivo</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Basata sullo storico delle assenze e delle competenze disponibili.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
