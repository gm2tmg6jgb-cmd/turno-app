import { useState, useCallback, useRef } from "react";
import { MACCHINE, REPARTI, LIVELLI_COMPETENZA } from "../data/constants";
import { supabase } from "../lib/supabase";

export default function SkillsView({ dipendenti, setDipendenti, macchine, showToast, turnoCorrente }) {
    const fileInputRef = useRef(null);
    const [repartoCorrente, setRepartoCorrente] = useState("T11");

    // Filter by both reparto and turnoCorrente if provided
    const filteredDipendenti = dipendenti
        .filter(d =>
            d.reparto_id === repartoCorrente &&
            (!turnoCorrente || d.turno === turnoCorrente || d.turno_default === turnoCorrente)
        )
        .sort((a, b) => (a.cognome || "").localeCompare(b.cognome || "") || (a.nome || "").localeCompare(b.nome || ""));
    const macchineReparto = macchine
        .filter(m => m.reparto_id === repartoCorrente)
        .sort((a, b) => a.nome.localeCompare(b.nome));
    const reparto = REPARTI.find(r => r.id === repartoCorrente);

    // Dipendenti senza competenze: tutti i valori delle macchine del reparto sono 0 o assenti
    const dipendentiSenzaCompetenze = filteredDipendenti.filter(d => {
        if (macchineReparto.length === 0) return false;
        return macchineReparto.every(m => {
            const val = d.competenze?.[m.id];
            return !val || val === 0;
        });
    });

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

    const handleCsvUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) {
                showToast("File CSV non valido o vuoto", "error");
                return;
            }

            // Detect separator
            const headerLine = lines[0];
            const separator = headerLine.includes(";") ? ";" : ",";
            const headers = headerLine.split(separator).map(h => h.trim());

            // Find key column "Dipendente" or similar (3rd column in the provided sample)
            let nameColIndex = headers.findIndex(h => h.toLowerCase().includes("dipendente"));
            if (nameColIndex === -1) nameColIndex = 2; // Fallback to 3rd column (index 2)

            // Map headers to machine IDs
            const machineMap = {};
            headers.forEach((header, index) => {
                // Normalize header for comparison (remove manufacturer names or spaces if needed)
                const normalizedHeader = header.replace(/\s/g, '').toLowerCase();

                const machine = macchine.find(m => {
                    const normalizedId = m.id.replace(/\s/g, '').toLowerCase();
                    const normalizedName = m.nome.replace(/\s/g, '').toLowerCase();
                    return normalizedHeader.includes(normalizedId) ||
                        normalizedHeader.includes(normalizedName);
                });
                if (machine) machineMap[index] = machine.id;
            });

            const updates = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(separator).map(v => v.trim());
                if (values.length <= nameColIndex) continue;

                const nominativo = values[nameColIndex];
                if (!nominativo || nominativo === "") continue;

                const dipendente = dipendenti.find(d => {
                    const fullName = `${d.cognome} ${d.nome}`.toLowerCase();
                    const inverseName = `${d.nome} ${d.cognome}`.toLowerCase();
                    const csvNameLower = nominativo.toLowerCase();
                    // Basic match or check if names are contained (more robust for middle initials)
                    return fullName === csvNameLower ||
                        inverseName === csvNameLower ||
                        csvNameLower.includes(d.cognome.toLowerCase()) && csvNameLower.includes(d.nome.toLowerCase());
                });

                if (dipendente) {
                    const newCompetenze = { ...(dipendente.competenze || {}) };
                    let changed = false;

                    Object.keys(machineMap).forEach(index => {
                        const machineId = machineMap[index];
                        let rawVal = values[index]?.trim() || "";

                        if (rawVal.includes("=>")) {
                            // Qualsiasi valore X=>Y viene salvato integralmente come formazione
                            newCompetenze[machineId] = rawVal;
                            changed = true;
                        } else {
                            const val = parseInt(rawVal);
                            if (!isNaN(val) && val >= 0 && val <= 6) {
                                newCompetenze[machineId] = val;
                                changed = true;
                            }
                        }
                    });

                    if (changed) {
                        updates.push({ id: dipendente.id, competenze: newCompetenze });
                    }
                }
            }

            if (updates.length === 0) {
                showToast("Nessun dato valido trovato per l'importazione", "warning");
                return;
            }

            showToast(`Inizio importazione di ${updates.length} dipendenti...`, "info");

            // Batch update (Supabase allows multiple updates if we have the IDs)
            // But JSONB update per row is safer one by one or via a RPC if available.
            // Since we don't have an RPC, we do it in a loop with Promise.all for speed if not too many
            try {
                const results = await Promise.all(updates.map(upd =>
                    supabase.from('dipendenti').update({ competenze: upd.competenze }).eq('id', upd.id)
                ));

                const errors = results.filter(r => r.error);
                if (errors.length > 0) {
                    showToast(`Errore durante l'importazione di ${errors.length} record`, "error");
                } else {
                    // Update local state
                    setDipendenti(prev => prev.map(d => {
                        const update = updates.find(u => u.id === d.id);
                        return update ? { ...d, competenze: update.competenze } : d;
                    }));
                    showToast(`Importazione completata con successo (${updates.length} dipendenti)`, "success");
                }
            } catch (err) {
                console.error("CSV Import Error:", err);
                showToast("Errore critico durante l'importazione", "error");
            }

            // Reset input
            event.target.value = "";
        };
        reader.readAsText(file);
    };

    return (
        <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div className="form-group" style={{ marginBottom: 0, display: "flex", alignItems: "flex-end", gap: 12 }}>
                    <div>
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

                    <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={handleCsvUpload}
                    />

                    <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current.click()}
                        style={{ height: 42, display: "flex", alignItems: "center", gap: 8 }}
                    >
                        <span>📄</span> Importa CSV
                    </button>
                </div>

                <div style={{ display: "flex", gap: "8px 16px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {LIVELLI_COMPETENZA.filter(l => typeof l.value === 'number').map(l => (
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

            {/* ALERT: Dipendenti senza competenze */}
            {dipendentiSenzaCompetenze.length > 0 && (
                <div style={{
                    marginBottom: 16,
                    padding: "12px 16px",
                    background: "rgba(249, 115, 22, 0.08)",
                    border: "1px solid rgba(249, 115, 22, 0.35)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12
                }}>
                    <span style={{ fontSize: 20 }}>⚠️</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--warning)", marginBottom: 4 }}>
                            {dipendentiSenzaCompetenze.length} {dipendentiSenzaCompetenze.length === 1 ? 'dipendente' : 'dipendenti'} senza competenze assegnate
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                            Questi operatori non hanno ancora competenze registrate per nessuna macchina del reparto. Verifica se manca la formazione o la pianificazione delle competenze.
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {dipendentiSenzaCompetenze.map(d => (
                                <span key={d.id} style={{
                                    background: "rgba(249, 115, 22, 0.12)",
                                    border: "1px solid rgba(249, 115, 22, 0.3)",
                                    borderRadius: 6,
                                    padding: "2px 10px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "var(--text-primary)"
                                }}>
                                    {d.cognome} {(d.nome || "").charAt(0)}.
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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
                                    <th key={m.id} style={{ padding: "12px 8px", textAlign: "center", minWidth: 60, borderRight: "1px solid var(--border-light)" }}>
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
                                    padding: "4px 8px",
                                    minWidth: 180,
                                    maxWidth: 180,
                                    fontWeight: 500,
                                    fontSize: 15,
                                    whiteSpace: "nowrap",
                                    position: "sticky",
                                    left: 0,
                                    background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "var(--bg-card)",
                                    zIndex: 2,
                                    borderRight: "1px solid var(--border-light)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis"
                                }}>
                                    {d.cognome} {(d.nome || "").charAt(0)}.
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
                                        <td key={m.id} style={{ textAlign: "center", padding: "4px 2px", borderRight: "1px solid var(--border-light)" }}>
                                            <div style={{
                                                color: skillLevel === 0 ? "var(--text-muted)" : (String(skillLevel).includes('=>') ? "#8B5CF6" : skill.color),
                                                fontWeight: 700,
                                                fontSize: 13,
                                                width: 44,
                                                margin: "0 auto",
                                                textAlign: "center"
                                            }}>
                                                {String(skillLevel).includes('=>') ? '⇒' : (skillLevel === 0 ? '—' : skillLevel)}
                                            </div>
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
