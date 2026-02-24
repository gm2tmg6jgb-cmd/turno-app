import { useState, useMemo } from "react";
import { LIVELLI_COMPETENZA } from "../data/constants";
import { Icons } from "./ui/Icons";

export default function SkillCoverageAnalytics({
    dipendenti, macchine, zones, repartoCorrente
}) {
    const [sortBy, setSortBy] = useState("risk");
    const [filterCriticalOnly, setFilterCriticalOnly] = useState(false);
    const [searchMachine, setSearchMachine] = useState("");

    // Calculate skill coverage for each machine
    const machineRisks = useMemo(() => {
        return macchine
            .filter(m => !repartoCorrente || m.reparto_id === repartoCorrente)
            .map(machine => {
                // Find all employees with skills for this machine
                const experts = dipendenti.filter(d =>
                    d.competenze?.[machine.id] >= 5 // levels 5-6
                );
                const autonomous = dipendenti.filter(d =>
                    d.competenze?.[machine.id] === 4
                );
                const skilled = dipendenti.filter(d =>
                    d.competenze?.[machine.id] >= 2
                );

                // Determine risk level
                let riskLevel = "green"; // 2+ experts
                let riskScore = 0;

                if (experts.length === 0) {
                    riskLevel = "red";
                    riskScore = 3;
                } else if (experts.length === 1) {
                    riskLevel = "yellow";
                    riskScore = 2;
                } else {
                    riskScore = 1;
                }

                // Get zone label
                const zone = zones?.find(z => z.id === machine.zona);
                const zoneLabel = zone?.label || machine.zona || "-";

                // Top expert
                const topExpert = experts.length > 0
                    ? experts.reduce((a, b) => {
                        const aLevel = a.competenze?.[machine.id] || 0;
                        const bLevel = b.competenze?.[machine.id] || 0;
                        return bLevel > aLevel ? b : a;
                    })
                    : null;

                // Percentage calculation (any skilled operator)
                const coveragePercent = skilled.length > 0 ? 100 : 0;

                return {
                    id: machine.id,
                    nome: machine.nome,
                    reparto: machine.reparto_id,
                    zona: zoneLabel,
                    riskLevel,
                    riskScore,
                    experts: experts.length,
                    autonomous: autonomous.length,
                    skilled: skilled.length,
                    coverage: coveragePercent,
                    topExpert: topExpert
                        ? `${topExpert.cognome} ${topExpert.nome}`
                        : "—"
                };
            })
            .filter(m => {
                if (filterCriticalOnly && m.riskLevel === "green") return false;
                if (searchMachine && !m.nome.toLowerCase().includes(searchMachine.toLowerCase())) return false;
                return true;
            })
            .sort((a, b) => {
                if (sortBy === "risk") {
                    return b.riskScore - a.riskScore; // Critical first
                } else if (sortBy === "name") {
                    return a.nome.localeCompare(b.nome);
                } else if (sortBy === "experts") {
                    return a.experts - b.experts; // Fewest first
                }
                return 0;
            });
    }, [dipendenti, macchine, zones, repartoCorrente, sortBy, filterCriticalOnly, searchMachine]);

    // Team risk summary
    const teamRisks = useMemo(() => {
        const teamMap = {};

        dipendenti.forEach(d => {
            if (d.reparto_id) {
                if (!teamMap[d.reparto_id]) {
                    teamMap[d.reparto_id] = { critical: 0, atRisk: 0, safe: 0 };
                }
            }
        });

        machineRisks.forEach(m => {
            if (teamMap[m.reparto]) {
                if (m.riskLevel === "red") teamMap[m.reparto].critical++;
                else if (m.riskLevel === "yellow") teamMap[m.reparto].atRisk++;
                else teamMap[m.reparto].safe++;
            }
        });

        return Object.entries(teamMap)
            .map(([team, counts]) => {
                const total = counts.critical + counts.atRisk + counts.safe;
                const riskPercent = total > 0
                    ? ((counts.critical + counts.atRisk) / total * 100).toFixed(0)
                    : 0;

                return {
                    team,
                    ...counts,
                    total,
                    riskPercent
                };
            })
            .sort((a, b) => parseInt(b.riskPercent) - parseInt(a.riskPercent));
    }, [machineRisks]);

    // Get risk color
    const getRiskColor = (level) => {
        switch (level) {
            case "red": return "#EF4444";
            case "yellow": return "#F59E0B";
            case "green": return "#10B981";
            default: return "#6B7280";
        }
    };

    const getRiskIcon = (level) => {
        switch (level) {
            case "red": return "🔴";
            case "yellow": return "🟡";
            case "green": return "🟢";
            default: return "⚪";
        }
    };

    const getRiskLabel = (level) => {
        switch (level) {
            case "red": return "Critica";
            case "yellow": return "A Rischio";
            case "green": return "Sicura";
            default: return "Sconosciuto";
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Team Risk Summary */}
            <div className="card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
                    👥 Riepilogo Rischi per Team
                </h3>
                {teamRisks.length > 0 ? (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Team
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Critiche
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    A Rischio
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Sicure
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    % Rischio
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {teamRisks.map((team) => (
                                <tr key={team.team} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "12px 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                                        {team.team}
                                    </td>
                                    <td style={{ padding: "12px 12px", textAlign: "center", fontSize: 14, color: "#EF4444", fontWeight: 600 }}>
                                        {team.critical}
                                    </td>
                                    <td style={{ padding: "12px 12px", textAlign: "center", fontSize: 14, color: "#F59E0B", fontWeight: 600 }}>
                                        {team.atRisk}
                                    </td>
                                    <td style={{ padding: "12px 12px", textAlign: "center", fontSize: 14, color: "#10B981", fontWeight: 600 }}>
                                        {team.safe}
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        color: parseInt(team.riskPercent) > 50 ? "#EF4444" : "#F59E0B",
                                        fontWeight: 600
                                    }}>
                                        {team.riskPercent}%
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

            {/* Filters */}
            <div className="card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700 }}>
                    🔍 Filtri e Ordinamento
                </h3>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 12
                }}>
                    <div>
                        <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                            Ordinamento
                        </label>
                        <select
                            className="select-input"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="risk">Rischio (Alto → Basso)</option>
                            <option value="experts">Esperti (Pochi → Molti)</option>
                            <option value="name">Nome (A-Z)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                            Ricerca Macchina
                        </label>
                        <input
                            type="text"
                            className="select-input"
                            placeholder="Cerca per nome..."
                            value={searchMachine}
                            onChange={(e) => setSearchMachine(e.target.value)}
                        />
                    </div>

                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <label style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 500
                        }}>
                            <input
                                type="checkbox"
                                checked={filterCriticalOnly}
                                onChange={(e) => setFilterCriticalOnly(e.target.checked)}
                            />
                            Solo Critiche/Rischio
                        </label>
                    </div>
                </div>
            </div>

            {/* Machine Risk Table */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <h3 style={{ padding: "16px 16px 0", marginBottom: 12, marginTop: 0, fontSize: 14, fontWeight: 700 }}>
                    ⚙️ Analisi Copertura Macchine ({machineRisks.length})
                </h3>

                {machineRisks.length > 0 ? (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Rischio
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Macchina / Zona
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Esperti
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Autonomi
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Totale Competente
                                </th>
                                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    Top Esperto
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {machineRisks.map((machine) => (
                                <tr key={machine.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 18,
                                        color: getRiskColor(machine.riskLevel),
                                        fontWeight: 700
                                    }}>
                                        {getRiskIcon(machine.riskLevel)}
                                    </td>
                                    <td style={{ padding: "12px 12px", fontSize: 14, color: "var(--text-primary)" }}>
                                        <div style={{ fontWeight: 600, marginBottom: 2 }}>
                                            {machine.nome}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                            {machine.zona}
                                        </div>
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: machine.experts > 0 ? "#10B981" : "#EF4444"
                                    }}>
                                        {machine.experts}
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "var(--text-primary)"
                                    }}>
                                        {machine.autonomous}
                                    </td>
                                    <td style={{
                                        padding: "12px 12px",
                                        textAlign: "center",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "var(--text-primary)"
                                    }}>
                                        {machine.skilled}
                                    </td>
                                    <td style={{ padding: "12px 12px", fontSize: 13, color: "var(--text-primary)" }}>
                                        {machine.topExpert}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div style={{ padding: "16px 12px", color: "var(--text-muted)", textAlign: "center", fontSize: 14 }}>
                        Nessuna macchina trovata con i filtri selezionati
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                    📋 Legenda
                </h3>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>🟢</span>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>Sicura</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>2+ esperti</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>🟡</span>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>A Rischio</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>1 esperto</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>🔴</span>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>Critica</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>0 esperti</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
