import React, { useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { LIVELLI_COMPETENZA, ATTIVITA } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";

export default function AssegnazioniView({
    dipendenti, presenze, assegnazioni, setAssegnazioni,
    macchine, attivita, setAttivita,
    repartoCorrente, turnoCorrente, showToast, zones
}) {
    const [showModal, setShowModal] = useState(null); // { id, type: 'machine' | 'activity' }
    const [selectedDip, setSelectedDip] = useState("");
    const [newActivityName, setNewActivityName] = useState("");
    const today = new Date().toISOString().split("T")[0];

    const dipRep = dipendenti.filter((d) =>
        (!repartoCorrente || d.reparto_id === repartoCorrente) &&
        d.turno_default === turnoCorrente // Strict Shift Filter
    );
    const presRep = presenze.filter((p) => dipRep.some((d) => d.id === p.dipendente_id) && p.presente && p.data === today);
    const macchineReparto = repartoCorrente ? macchine.filter((m) => m.reparto_id === repartoCorrente) : macchine;
    const assRep = assegnazioni.filter((a) => dipRep.some((d) => d.id === a.dipendente_id) && a.data === today);

    const addAssegnazione = async (targetId, dipendenteId, type) => {
        if (!dipendenteId) return;

        const exists = assegnazioni.find((a) => a.macchina_id === targetId && a.dipendente_id === dipendenteId && a.data === today);
        if (exists) return;

        const newAss = {
            dipendente_id: dipendenteId,
            macchina_id: targetId,
            isActivity: type === 'activity', // Note: DB doesn't have isActivity, but we might need to handle 'attivita_id' if implemented. 
            // For now, let's assume 'macchina_id' stores ID for both machines and activities as per current logic, 
            // BUT check schema: 'assegnazioni' has 'macchina_id' AND 'attivita_id'. 
            // Current app logic uses 'macchina_id' for both. We should fix this alignment.
            // Let's check logic: if type === 'activity', we should set attivita_id, else macchina_id.
            data: today,
            turno_id: turnoCorrente,
            note: "",
        };

        // Fix for DB Schema: Separate columns
        const dbPayload = {
            dipendente_id: dipendenteId,
            data: today,
            turno_id: turnoCorrente,
            macchina_id: type === 'machine' ? targetId : null,
            attivita_id: type === 'activity' ? targetId : null,
            note: ""
        };

        try {
            const { data, error } = await supabase.from('assegnazioni').insert(dbPayload).select();
            if (error) throw error;

            console.log("✅ Assignment saved:", data);
            // We need to match local state structure. 
            // Local state currently uses 'macchina_id' for everything in filtering logic.
            // To keep frontend logic simple without full refactor, we map back DB result to frontend structure OR adjust frontend to use attivita_id.
            // Let's adjust frontend state to reflect 'macchina_id' as the common ID for display if that's how it's built, 
            // OR better: use the returned 'data' which has correct columns, and ensure filtering handles it.

            // Actually, let's keep local state as returned from DB, but we need to ensure filters works.
            // The filters use: `a.macchina_id === m.id` (machines) and `a.macchina_id === a.id` (activities).
            // If we switch to real columns, activity filter needs `a.attivita_id === a.id`.

            // Let's normalize for local state to keep UI working without deep refactor for now:
            const savedAss = data[0];
            const localAss = {
                ...savedAss,
                macchina_id: savedAss.macchina_id || savedAss.attivita_id, // Polyfill for UI
                isActivity: !!savedAss.attivita_id
            };

            setAssegnazioni([...assegnazioni, localAss]);
            showToast("Operatore assegnato", "success");
            setShowModal(null);
            setSelectedDip("");
        } catch (error) {
            console.error("❌ Error saving assignment:", error);
            showToast("Errore salvataggio: " + error.message, "error");
        }
    };

    const addCustomActivity = () => {
        // ... (Local only for now, 'attivita' table changes not requested yet but advised)
        if (!newActivityName.trim()) return;
        const newAct = {
            id: `ACT-${Date.now()}`,
            nome: newActivityName.trim(),
            icona: "📌",
            color: "var(--accent)"
        };
        setAttivita([...attivita, newAct]);
        setNewActivityName("");
        showToast("Attività aggiunta", "success");
    };

    const removeAssegnazione = async (assId) => {
        try {
            const { error } = await supabase.from('assegnazioni').delete().eq('id', assId);
            if (error) throw error;

            setAssegnazioni(assegnazioni.filter((a) => a.id !== assId));
            showToast("Assegnazione rimossa", "warning");
        } catch (error) {
            console.error("❌ Error removing assignment:", error);
            showToast("Errore rimozione: " + error.message, "error");
        }
    };

    const getAvailableOps = () => {
        return dipRep.filter((d) => {
            // User request: Show ALL operators, even if absent or already assigned.
            return d.ruolo === "operatore";
        });
    };

    const getSelectedDipSkill = (dipId, machineId) => {
        const dip = dipendenti.find(d => d.id === dipId);
        if (!dip) return null;
        const levelVal = dip.competenze?.[machineId] || 0;
        return LIVELLI_COMPETENZA.find(l => l.value === levelVal);
    };

    return (
        <div className="fade-in" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>
                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                    <span style={{ flexShrink: 0 }}>{Icons.clock}</span>
                    Assegna gli operatori presenti alle macchine o alle attività extra. Gli operatori già assegnati non compaiono nell'elenco.
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-secondary)" }}>MACCHINE DI PRODUZIONE</h3>
                <div className="card" style={{ padding: 0, marginBottom: 20 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                                <th style={{ padding: "10px 12px", textAlign: "left", width: "35%", fontSize: 13, color: "var(--text-secondary)" }}>MACCHINA / ZONA</th>
                                <th style={{ padding: "10px 12px", textAlign: "left", width: "45%", fontSize: 13, color: "var(--text-secondary)" }}>OPERATORI ASSEGNATI</th>
                                <th style={{ padding: "10px 12px", textAlign: "center", width: "20%", fontSize: 13, color: "var(--text-secondary)" }}>STATO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const zoneIds = [...new Set(macchineReparto.map(m => m.zona).filter(Boolean))];
                                const machinesWithoutZone = macchineReparto.filter(m => !m.zona);

                                return (
                                    <>
                                        {zoneIds.map(zoneId => {
                                            const zoneMachines = macchineReparto.filter(m => m.zona === zoneId);
                                            const zoneLabel = zones?.find(z => z.id === zoneId)?.label || `Zona ${zoneId}`;
                                            const zoneAss = assRep.filter(a => a.macchina_id === zoneId || a.attivita_id === zoneId);

                                            return (
                                                <React.Fragment key={zoneId}>
                                                    {/* ZONE HEADER ROW */}
                                                    <tr key={`zone-${zoneId}`} style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                                                        <td style={{ padding: "10px 12px" }}>
                                                            {/* Removed fontSize: 14 to match Report (inherit/16px) */}
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--text-primary)" }}>
                                                                {Icons.grid} {zoneLabel}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "10px 12px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                                {zoneAss.length > 0 ? (
                                                                    zoneAss.map(a => {
                                                                        const d = dipendenti.find(dd => dd.id === a.dipendente_id);
                                                                        return d ? (
                                                                            // Increased fontSize to 15px to match Report legibility
                                                                            <span key={a.id} className="operator-chip" style={{ background: "var(--bg-card)", border: "1px solid var(--info)", fontSize: 15 }}>
                                                                                {d.cognome} {d.nome.charAt(0)}.
                                                                                <span className="remove" onClick={() => removeAssegnazione(a.id)}>✕</span>
                                                                            </span>
                                                                        ) : null;
                                                                    })
                                                                ) : (
                                                                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessun responsabile zona</span>
                                                                )}
                                                                <button
                                                                    className="btn-icon-small"
                                                                    onClick={() => setShowModal({ id: zoneId, type: 'activity', name: `${zoneLabel}` })}
                                                                    title="Assegna Responsabile Zona"
                                                                    style={{ marginLeft: 8, background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", border: "none", borderRadius: 4, width: 24, height: 24, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                                                >
                                                                    {Icons.plus}
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>
                                                            {/* Zone status if needed */}
                                                        </td>
                                                    </tr>

                                                    {/* MACHINE ROWS */}
                                                    {zoneMachines.map(m => {
                                                        const ops = assRep.filter(a => a.macchina_id === m.id);
                                                        const isUnder = ops.length < (m.personale_minimo || 1);
                                                        const isEmpty = ops.length === 0;

                                                        const isZoneCovered = zoneAss.length > 0;
                                                        const isOk = !isUnder || isZoneCovered;

                                                        return (
                                                            <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                                    {m.nome}
                                                                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Min: {m.personale_minimo || 1}</div>
                                                                </td>
                                                                <td style={{ padding: "8px 12px" }}>
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                                        {ops.map(o => {
                                                                            const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                            return d ? (
                                                                                // Increased fontSize to 15px (inline style added/class modified)
                                                                                <span key={o.id} className={`operator-chip ${d.tipo === "interinale" ? "interinale" : ""} `} style={{ fontSize: 15 }}>
                                                                                    {d.cognome} {d.nome.charAt(0)}.
                                                                                    {d.tipo === "interinale" && <span style={{ fontSize: 10, color: "var(--warning)" }}>INT</span>}
                                                                                    <span className="remove" onClick={() => removeAssegnazione(o.id)}>✕</span>
                                                                                </span>
                                                                            ) : null;
                                                                        })}
                                                                        <button
                                                                            className="btn-icon-small"
                                                                            onClick={() => setShowModal({ id: m.id, type: 'machine', name: m.nome })}
                                                                            title="Assegna Operatore"
                                                                            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 4, width: 24, height: 24, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}
                                                                        >
                                                                            {Icons.plus}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                    <span className={`tag ${!isUnder ? "tag-green" : "tag-red"}`} style={{ padding: "2px 8px", minWidth: 50, textAlign: "center", display: "inline-block" }}>
                                                                        {!isUnder ? "OK" : "SOTTO"}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Machines without Zone */}
                                        {machinesWithoutZone.length > 0 && (
                                            <>
                                                <tr style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                                                    <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                                        ALTRE MACCHINE
                                                    </td>
                                                </tr>
                                                {machinesWithoutZone.map(m => {
                                                    const ops = assRep.filter(a => a.macchina_id === m.id);
                                                    const isUnder = ops.length < (m.personale_minimo || 1);
                                                    return (
                                                        <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                                {m.nome}
                                                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Min: {m.personale_minimo || 1}</div>
                                                            </td>
                                                            <td style={{ padding: "8px 12px" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                                    {ops.map(o => {
                                                                        const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                        return d ? (
                                                                            <span key={o.id} className={`operator-chip ${d.tipo === "interinale" ? "interinale" : ""} `}>
                                                                                {d.cognome} {d.nome.charAt(0)}.
                                                                                {d.tipo === "interinale" && <span style={{ fontSize: 9, color: "var(--warning)" }}>INT</span>}
                                                                                <span className="remove" onClick={() => removeAssegnazione(o.id)}>✕</span>
                                                                            </span>
                                                                        ) : null;
                                                                    })}
                                                                    <button
                                                                        className="btn-icon-small"
                                                                        onClick={() => setShowModal({ id: m.id, type: 'machine', name: m.nome })}
                                                                        title="Assegna Operatore"
                                                                        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 4, width: 24, height: 24, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}
                                                                    >
                                                                        {Icons.plus}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: "center", padding: "8px 16px" }}>
                                                                <span className={`tag ${!isUnder ? "tag-green" : "tag-red"}`} style={{ padding: "2px 8px", minWidth: 50, textAlign: "center", display: "inline-block" }}>
                                                                    {!isUnder ? "OK" : "SOTTO"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-secondary)" }}>ATTIVITÀ EXTRA</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            className="input"
                            placeholder="Nuova attività..."
                            style={{ width: 180, height: 32, fontSize: 12 }}
                            value={newActivityName}
                            onChange={(e) => setNewActivityName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addCustomActivity()}
                        />
                        <button className="btn btn-primary" style={{ height: 32, padding: "0 12px", fontSize: 12 }} onClick={addCustomActivity}>
                            {Icons.plus} Aggiungi Tipo
                        </button>
                    </div>
                </div>

                <div className="machine-grid">
                    {attivita.map((a) => {
                        const ops = assRep.filter((ass) => ass.macchina_id === a.id); // For activities we reuse macchina_id logic
                        return (
                            <div key={a.id} className="machine-card" style={{ borderLeft: `1px solid var(--border)` }}>
                                <div className="machine-card-header">
                                    <div>
                                        <div className="machine-card-name">{a.icona} {a.nome}</div>
                                        <div className="machine-card-id">Supporto</div>
                                    </div>
                                    <span className="tag tag-blue">{ops.length}</span>
                                </div>
                                <div className="machine-card-operators">
                                    {ops.map((o) => {
                                        const d = dipendenti.find((dd) => dd.id === o.dipendente_id);
                                        if (!d) return null;
                                        return (
                                            <span key={o.id} className="operator-chip">
                                                {d.cognome} {d.nome.charAt(0)}.
                                                <span className="remove" onClick={() => removeAssegnazione(o.id)}>✕</span>
                                            </span>
                                        );
                                    })}
                                    <button className="add-operator-btn" onClick={() => setShowModal({ id: a.id, type: 'activity', name: a.nome })}>
                                        {Icons.plus} Assegna
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {showModal && (
                    <Modal
                        title={`Assegna Operatore — ${showModal.name} `}
                        onClose={() => { setShowModal(null); setSelectedDip(""); }}
                        footer={
                            <>
                                <button className="btn btn-secondary" onClick={() => { setShowModal(null); setSelectedDip(""); }}>Annulla</button>
                                <button className="btn btn-primary" onClick={() => addAssegnazione(showModal.id, selectedDip, showModal.type)}>Conferma</button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Operatore disponibile</label>
                            <select className="select-input" value={selectedDip} onChange={(e) => setSelectedDip(e.target.value)}>
                                <option value="">Seleziona operatore...</option>
                                {getAvailableOps().map((d) => {
                                    const isPresente = presRep.some((p) => p.dipendente_id === d.id);
                                    const isAssigned = assRep.some(a => a.dipendente_id === d.id);
                                    return (
                                        <option key={d.id} value={d.id}>
                                            {d.cognome} {d.nome} {d.tipo === "interinale" ? "(INT)" : ""}
                                            {!isPresente ? " (Assente)" : ""}
                                            {isAssigned ? " (Già Assegnato)" : ""}
                                        </option>
                                    );
                                })}
                            </select>
                            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
                                Puoi assegnare anche operatori assenti o già impegnati.
                            </p>
                        </div>

                        {selectedDip && showModal.type === 'machine' && (() => {
                            const skill = getSelectedDipSkill(selectedDip, showModal.id);
                            if (skill && skill.value < 2) {
                                return (
                                    <div className="alert alert-danger" style={{ marginTop: 12 }}>
                                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                                            {Icons.alert} Attenzione: Competenza {skill.label}
                                        </div>
                                        <div style={{ fontSize: 12, marginTop: 4 }}>
                                            L'operatore selezionato non è pienamente autonomo su questa macchina.
                                        </div>
                                    </div>
                                );
                            } else if (skill && skill.value >= 2) {
                                return (
                                    <div className="alert alert-success" style={{ marginTop: 12, padding: "8px 12px" }}>
                                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                            {Icons.check} Competenza: {skill.label}
                                        </div>
                                    </div>
                                );
                            }
                        })()}

                        {getAvailableOps().length === 0 && (
                            <div className="alert alert-warning" style={{ marginTop: 12 }}>
                                {Icons.info} Nessun operatore disponibile nel reparto.
                            </div>
                        )}
                    </Modal>
                )
                }
            </div>
        </div>
    );
}
