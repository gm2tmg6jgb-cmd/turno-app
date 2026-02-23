import { useState, useCallback } from "react";
import { MACCHINE, REPARTI, LIVELLI_COMPETENZA } from "../data/constants";
import { supabase } from "../lib/supabase";

export default function SkillsView({ dipendenti, setDipendenti, macchine, showToast }) {
    const [repartoCorrente, setRepartoCorrente] = useState("T11");

    const filteredDipendenti = dipendenti.filter(d => d.reparto === repartoCorrente);
    const macchineReparto = macchine.filter(m => m.reparto === repartoCorrente);
    const reparto = REPARTI.find(r => r.id === repartoCorrente);

    const toggleSkill = async (dipId, macchineId) => {
        // Find current val from local state
        const dip = dipendenti.find(d => d.id === dipId);
        if (!dip) return;

        const currentLevel = dip.competenze?.[macchineId] || 0;
        const nextLevel = (currentLevel + 1) % 7;

        const newCompetenze = {
            ...dip.competenze,
            [macchineId]: nextLevel
        };

        // Optimistic Update
        setDipendenti(prev => prev.map(d => {
            if (d.id !== dipId) return d;
            return {
                ...d,
                competenze: newCompetenze
            };
        }));

        // DB Update
        try {
            const { error } = await supabase
                .from('dipendenti')
                .update({ competenze: newCompetenze })
                .eq('id', dipId);

            if (error) {
                // Revert logic could go here
                throw error;
            }
        } catch (error) {
            console.error("Error updating skill:", error);
            showToast("Errore aggiornamento competenza", "error");
        }
    };

    const getSkillInfo = (level) => {
        return LIVELLI_COMPETENZA.find(l => l.value === (level || 0)) || LIVELLI_COMPETENZA[0];
    };

    // Calculate coverage stats
    const getMachineCoverage = (machineId) => {
        const skills = filteredDipendenti.map(d => d.competenze?.[machineId] || 0);
        // Level 4+ considered "Autonomous/Skilled"
        const esperti = skills.filter(s => s >= 5).length;
        const autonomi = skills.filter(s => s === 4).length;
        const intermedi = skills.filter(s => s === 3 || s === 2).length;

        let statusColor = "var(--text-muted)";
        if (esperti + autonomi === 0) statusColor = "var(--danger)";
        else if (esperti + autonomi < 2) statusColor = "var(--warning)";
        else statusColor = "var(--success)";

        return { esperti, autonomi, intermedi, statusColor };
    };

    return (
        <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Seleziona Team</label>
                    <select
                        className="select-input"
                        value={repartoCorrente}
                        onChange={(e) => setRepartoCorrente(e.target.value)}
                        style={{ width: 200 }}
                    >
                        {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                </div>

                <div style={{ display: "flex", gap: "8px 16px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {LIVELLI_COMPETENZA.map(l => (
                        <div key={l.value} style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "transparent",
                            color: l.value === 0 ? "var(--text-muted)" : l.color,
                            fontSize: 14,
                            fontWeight: 700,
                            border: "none"
                        }} title={l.label}>
                            {l.value}
                        </div>
                    ))}
                </div>
            </div>

            <div className="table-container">
                <table style={{ fontSize: 13 }}>
                    <thead>
                        <tr>
                            <th style={{ padding: "12px 16px", width: 200, position: "sticky", left: 0, background: "var(--bg-tertiary)", zIndex: 2 }}>
                                Dipendente
                            </th>
                            {macchineReparto.map(m => {
                                const stats = getMachineCoverage(m.id);
                                return (
                                    <th key={m.id} style={{ padding: "12px 8px", textAlign: "center", minWidth: 60 }}>
                                        <div style={{ marginBottom: 4 }}>{m.nome.replace("Macchina ", "")}</div>
                                        <div style={{ fontSize: 10, fontWeight: 400, color: stats.statusColor }}>
                                            {stats.esperti} | {stats.autonomi} | {stats.intermedi}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDipendenti.map(d => (
                            <tr key={d.id}>
                                <td style={{
                                    padding: "12px 16px",
                                    fontWeight: 500,
                                    position: "sticky",
                                    left: 0,
                                    background: "var(--bg-card)",
                                    zIndex: 1,
                                    borderRight: "1px solid var(--border)"
                                }}>
                                    {d.cognome} {d.nome}
                                    {d.ruolo === 'capoturno' && (
                                        <span style={{
                                            marginLeft: 8,
                                            fontSize: 10,
                                            background: "rgba(59,130,246,0.1)",
                                            color: "#3B82F6",
                                            padding: "2px 6px",
                                            borderRadius: 4
                                        }}>CT</span>
                                    )}
                                </td>
                                {macchineReparto.map(m => {
                                    const skillLevel = d.competenze?.[m.id] || 0;
                                    const skill = getSkillInfo(skillLevel);

                                    return (
                                        <td key={m.id} style={{ textAlign: "center", padding: 6 }}>
                                            <button
                                                onClick={() => toggleSkill(d.id, m.id)}
                                                style={{
                                                    background: "transparent",
                                                    color: skillLevel === 0 ? "var(--text-muted)" : skill.color,
                                                    border: "none",
                                                    borderRadius: 4,
                                                    width: 32,
                                                    height: 32,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    margin: "0 auto",
                                                    transition: "all 0.1s"
                                                }}
                                                className="hover-scale"
                                            >
                                                {skillLevel}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div >

            <div style={{ marginTop: 24, padding: 16, background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Legenda Copertura Macchine</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }}></div>
                        Ottima: almeno 2 Esperti/Autonomi
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)" }}></div>
                        A rischio: meno di 2 Esperti/Autonomi
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)" }}></div>
                        Critica: Nessun Esperto/Autonomo
                    </div>
                </div>
            </div>
        </div >
    );
}
