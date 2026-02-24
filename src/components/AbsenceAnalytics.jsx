import { useMemo } from "react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { MOTIVI_ASSENZA } from "../data/constants";

export default function AbsenceAnalytics({ presenze, dipendenti }) {
    // Calculate 12-month trend
    const trendData = useMemo(() => {
        const now = new Date();
        const months = [];

        // Generate last 12 months
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthYear = date.toLocaleString('it-IT', { month: 'short', year: '2-digit' });

            months.push({
                month: monthYear,
                absences: 0,
                planned: 0,
                unplanned: 0
            });
        }

        // Fill data
        presenze.forEach(p => {
            if (!p.presente && p.data) {
                const date = new Date(p.data);
                const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 +
                    (now.getMonth() - date.getMonth());

                if (monthsDiff >= 0 && monthsDiff < 12) {
                    const monthIndex = 11 - monthsDiff;
                    months[monthIndex].absences++;

                    if (['ferie', 'rol', 'riposo_compensativo'].includes(p.motivo_assenza)) {
                        months[monthIndex].planned++;
                    } else {
                        months[monthIndex].unplanned++;
                    }
                }
            }
        });

        return months;
    }, [presenze]);

    // Calculate distribution by motivo
    const distribution = useMemo(() => {
        const counts = {};

        presenze.forEach(p => {
            if (!p.presente && p.motivo_assenza) {
                counts[p.motivo_assenza] = (counts[p.motivo_assenza] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .map(([motivo, count]) => {
                const info = MOTIVI_ASSENZA.find(m => m.id === motivo);
                return {
                    name: info?.label || motivo,
                    value: count,
                    color: info?.colore || "#6B7280",
                    id: motivo
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [presenze]);

    // Calculate top reasons
    const topReasons = distribution.slice(0, 5);

    // Calculate team stats
    const teamStats = useMemo(() => {
        const teamData = {};

        dipendenti.forEach(d => {
            if (d.reparto_id) {
                if (!teamData[d.reparto_id]) {
                    teamData[d.reparto_id] = {
                        name: d.reparto_id,
                        total: 0,
                        absences: 0,
                        employees: 0
                    };
                }
                teamData[d.reparto_id].employees++;
            }
        });

        presenze.forEach(p => {
            if (!p.presente) {
                const dip = dipendenti.find(d => d.id === p.dipendente_id);
                if (dip && dip.reparto_id && teamData[dip.reparto_id]) {
                    teamData[dip.reparto_id].absences++;
                }
            }
        });

        return Object.values(teamData)
            .map(team => ({
                ...team,
                avgAbsences: (team.absences / team.employees).toFixed(1),
                absenceRate: ((team.absences / (team.employees * 252)) * 100).toFixed(2) // 252 working days/year
            }))
            .sort((a, b) => b.absences - a.absences);
    }, [dipendenti, presenze]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Trend Chart */}
            <div className="card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
                    📈 Trend Assenze (Ultimi 12 Mesi)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="month" stroke="var(--text-secondary)" />
                        <YAxis stroke="var(--text-secondary)" />
                        <Tooltip
                            contentStyle={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                                borderRadius: 6
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="absences"
                            stroke="#3B82F6"
                            name="Totale"
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="unplanned"
                            stroke="#EF4444"
                            name="Non Pianificate"
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Distribution Pie Chart */}
                <div className="card" style={{ padding: 16 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
                        🥧 Distribuzione per Motivo
                    </h3>
                    {distribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={distribution}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name} (${value})`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {distribution.map((entry) => (
                                        <Cell key={`cell-${entry.id}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `${value} assenze`} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
                            Nessun dato disponibile
                        </div>
                    )}
                </div>

                {/* Top Reasons Bar Chart */}
                <div className="card" style={{ padding: 16 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
                        🏆 Motivi Principali
                    </h3>
                    {topReasons.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={topReasons}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis stroke="var(--text-secondary)" />
                                <Tooltip
                                    contentStyle={{
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border)",
                                        borderRadius: 6
                                    }}
                                />
                                <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]}>
                                    {topReasons.map((entry) => (
                                        <Cell key={`cell-${entry.id}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 20px" }}>
                            Nessun dato disponibile
                        </div>
                    )}
                </div>
            </div>

            {/* Team Statistics */}
            <div className="card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
                    👥 Statistiche per Team
                </h3>
                {teamStats.length > 0 ? (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                                <th style={{
                                    padding: "10px 12px",
                                    textAlign: "left",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--text-secondary)"
                                }}>
                                    Team
                                </th>
                                <th style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--text-secondary)"
                                }}>
                                    Dipendenti
                                </th>
                                <th style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--text-secondary)"
                                }}>
                                    Totale Assenze
                                </th>
                                <th style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--text-secondary)"
                                }}>
                                    Media/Dipendente
                                </th>
                                <th style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--text-secondary)"
                                }}>
                                    Tasso Assenza
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {teamStats.map((team) => (
                                <tr key={team.name} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{
                                        padding: "12px 12px",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "var(--text-primary)"
                                    }}>
                                        {team.name}
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        color: "var(--text-primary)"
                                    }}>
                                        {team.employees}
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        color: "var(--text-primary)"
                                    }}>
                                        {team.absences}
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        color: "var(--text-primary)"
                                    }}>
                                        {team.avgAbsences}
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        color: team.absenceRate > 5 ? "#EF4444" : "var(--text-primary)",
                                        fontWeight: team.absenceRate > 5 ? 600 : 400
                                    }}>
                                        {team.absenceRate}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                        Nessun dato disponibile
                    </div>
                )}
            </div>
        </div>
    );
}
