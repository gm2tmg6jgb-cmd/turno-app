import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { LIVELLI_COMPETENZA, ATTIVITA } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";
import { getLocalDate } from "../lib/dateUtils";

export default function AssegnazioniView({
    dipendenti, presenze, assegnazioni, setAssegnazioni,
    macchine, attivita, setAttivita,
    repartoCorrente, turnoCorrente, showToast, zones
}) {
    const [showModal, setShowModal] = useState(null); // { id, type: 'machine' | 'activity' }
    const [selectedDip, setSelectedDip] = useState("");
    const [newActivityName, setNewActivityName] = useState("");

    const today = getLocalDate(new Date());

    // --- PRESENCE LOGIC HELPER ---
    // Align with DashboardView: If record missing for today -> Default PRESENT (unless Sunday)
    const getIsPresent = (dipId) => {
        const record = presRep.find(p => p.dipendente_id === dipId);
        if (record) return record.presente;

        // No record? Default logic
        const d = new Date();
        const isSunday = d.getDay() === 0;
        return !isSunday;
    };

    // --- AUTO-COPY & DEDUPLICATE LOGIC ---
    useEffect(() => {
        const manageAssignments = async () => {
            if (!turnoCorrente || !dipendenti.length) return; // Wait for basic data

            // 1. DEDUPLICATE (Cleanup existing mess)
            const { data: todaysAss, error: fetchErr } = await supabase
                .from('assegnazioni')
                .select('*')
                .eq('data', today)
                .eq('turno_id', turnoCorrente);

            if (todaysAss && todaysAss.length > 0) {
                const seen = new Set();
                const duplicates = [];
                todaysAss.forEach(a => {
                    const key = `${a.dipendente_id}-${a.macchina_id || 'NULL'}-${a.attivita_id || 'NULL'}`;
                    if (seen.has(key)) {
                        duplicates.push(a.id);
                    } else {
                        seen.add(key);
                    }
                });

                if (duplicates.length > 0) {
                    console.log("🧹 Auto-cleaning duplicates:", duplicates);
                    await supabase.from('assegnazioni').delete().in('id', duplicates);
                    // Update local state by filtering
                    setAssegnazioni(prev => prev.filter(a => !duplicates.includes(a.id)));
                }
                return; // If we had assignments (even with duplicates), we DON'T copy from yesterday.
            }

            // 2. COPY FROM PREVIOUS DAY (Only if DB was empty for today)
            console.log("🔍 No assignments found today. Checking previous days...");

            // Find last Day with assignments for this Turno
            const { data: lastAssStub, error } = await supabase
                .from('assegnazioni')
                .select('data')
                .eq('turno_id', turnoCorrente)
                .lt('data', today)
                .order('data', { ascending: false })
                .limit(1);

            if (error || !lastAssStub || lastAssStub.length === 0) {
                console.log("ℹ️ No previous assignments found to copy.");
                return;
            }

            const lastDate = lastAssStub[0].data;
            console.log(`📅 Found previous assignments from ${lastDate}. Copying...`);

            // Fetch FULL previous assignments
            const { data: previousAssignments } = await supabase
                .from('assegnazioni')
                .select('*')
                .eq('data', lastDate)
                .eq('turno_id', turnoCorrente);

            if (!previousAssignments || previousAssignments.length === 0) return;

            // Filter to only employees present today

            const presentIds = new Set(
                dipendenti
                    .filter(d => {
                        const rec = presenze.find(p => p.dipendente_id === d.id && p.data === today);
                        if (rec) return rec.presente;
                        return new Date().getDay() !== 0; // default present unless Sunday
                    })
                    .map(d => d.id)
            );

            // Prepare new assignments
            const newAssignments = previousAssignments
                .filter(a => presentIds.has(a.dipendente_id))
                .map(a => ({
                    dipendente_id: a.dipendente_id,
                    macchina_id: a.macchina_id,
                    attivita_id: a.attivita_id,
                    data: today,
                    turno_id: turnoCorrente,
                    note: a.note
                }));

            if (newAssignments.length === 0) return;

            const { data: inserted, error: insertError } = await supabase
                .from('assegnazioni')
                .insert(newAssignments)
                .select();

            if (insertError) {
                console.error("Error copying assignments:", insertError);
            } else {
                console.log(`✅ Copied ${inserted.length} assignments.`);
                const localNew = inserted.map(savedAss => ({
                    ...savedAss,
                    macchina_id: savedAss.macchina_id || savedAss.attivita_id,
                    isActivity: !!savedAss.attivita_id
                }));
                setAssegnazioni(prev => [...prev, ...localNew]);
                showToast(`Piano copiato dal ${lastDate}`, "success");
            }
        };

        const timer = setTimeout(manageAssignments, 1500); // Slight delay to let props settle
        return () => clearTimeout(timer);

    }, [turnoCorrente, today, dipendenti.length, presenze]); // Re-run if shift or presences change

    // --- FILTER LOGIC ---
    const dipRep = dipendenti.filter((d) =>
        (!repartoCorrente || d.reparto_id === repartoCorrente) &&
        d.turno_default === turnoCorrente
    );
    // Presenze check needs to be broad 
    const presRep = presenze.filter((p) => p.data === today);

    const macchineReparto = repartoCorrente ? macchine.filter((m) => m.reparto_id === repartoCorrente) : macchine;
    const assRep = assegnazioni.filter((a) => dipRep.some((d) => d.id === a.dipendente_id) && a.data === today);


    const addAssegnazione = async (targetId, dipendenteId, type) => {
        if (!dipendenteId) return;

        const exists = assegnazioni.find((a) => a.macchina_id === targetId && a.dipendente_id === dipendenteId && a.data === today);
        if (exists) return;

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

        if (typeof levelVal === 'string' && levelVal.includes('=>')) {
            return { value: levelVal, label: 'In Formazione', color: '#8B5CF6' };
        }
        return LIVELLI_COMPETENZA.find(l => l.value === levelVal) || LIVELLI_COMPETENZA.find(l => l.value === 0);
    };

    return (
        <div className="fade-in" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>
                {/* DEBUG PANEL - REMOVE LATER */}


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
                                                                        // Check Presence
                                                                        const isPresent = getIsPresent(a.dipendente_id);

                                                                        const skill = getSelectedDipSkill(a.dipendente_id, zoneId);

                                                                        return d ? (
                                                                            // Increased fontSize to 15px to match Report legibility
                                                                            <span key={a.id} className="operator-chip"
                                                                                style={{
                                                                                    background: isPresent ? "var(--bg-card)" : "rgba(220, 38, 38, 0.1)",
                                                                                    border: isPresent ? "1px solid var(--info)" : "1px solid var(--danger)",
                                                                                    fontSize: 15,
                                                                                    textDecoration: isPresent ? "none" : "line-through",
                                                                                    color: isPresent ? "inherit" : "var(--danger)",
                                                                                    display: "inline-flex",
                                                                                    alignItems: "center",
                                                                                    gap: 6
                                                                                }}>
                                                                                <span style={{ fontWeight: 500 }}>{d.cognome} {d.nome.charAt(0)}. </span>
                                                                                {skill && (skill.value !== 0 || String(skill.value).includes('=>')) && (
                                                                                    <span style={{ color: skill.color, fontWeight: 700, fontSize: 20 }}>
                                                                                        {String(skill.value).includes('=>') ? skill.value : `Liv. ${skill.value}`}
                                                                                    </span>
                                                                                )}
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

                                                        // Filter effective ops (PRESENT ones)
                                                        const effectiveOps = ops.filter(a => getIsPresent(a.dipendente_id));

                                                        const isUnder = effectiveOps.length < (m.personale_minimo || 1);
                                                        const isEmpty = ops.length === 0;

                                                        // Check zone coverage (Assigned AND Present)
                                                        const isZoneCovered = zoneAss.some(a => getIsPresent(a.dipendente_id));

                                                        const isOk = !isUnder || isZoneCovered;

                                                        return (
                                                            <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                                    {m.nome}
                                                                </td>
                                                                <td style={{ padding: "8px 12px" }}>
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                                        {ops.map(o => {
                                                                            const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                            // Check Presence
                                                                            const isPresent = getIsPresent(o.dipendente_id);

                                                                            const skill = getSelectedDipSkill(o.dipendente_id, m.id);

                                                                            return d ? (
                                                                                <span key={o.id} className={`operator-chip ${d.tipo === "interinale" ? "interinale" : ""} `}
                                                                                    style={{
                                                                                        fontSize: 15,
                                                                                        textDecoration: isPresent ? "none" : "line-through",
                                                                                        color: isPresent ? "inherit" : "var(--danger)",
                                                                                        background: isPresent ? "" : "rgba(220, 38, 38, 0.1)",
                                                                                        border: isPresent ? "" : "1px solid var(--danger)",
                                                                                        display: "inline-flex",
                                                                                        alignItems: "center",
                                                                                        gap: 6
                                                                                    }}>
                                                                                    <span style={{ fontWeight: 500 }}>{d.cognome} {d.nome.charAt(0)}. </span>
                                                                                    {skill && (
                                                                                        String(skill.value).includes('=>') ? (
                                                                                            <span style={{ color: "#8B5CF6", fontWeight: 700, fontSize: 13 }}>{skill.value}</span>
                                                                                        ) : skill.value === 0 ? (
                                                                                            <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: 11 }}>Nessuna form.</span>
                                                                                        ) : (
                                                                                            <span style={{ color: skill.color, fontWeight: 700, fontSize: 13 }}>Liv. {skill.value}</span>
                                                                                        )
                                                                                    )}
                                                                                    {d.tipo === "interinale" && <span style={{ fontSize: 10, color: "var(--warning)" }}>INT</span>}
                                                                                    <span className="remove" onClick={() => removeAssegnazione(o.id)}>✕</span>
                                                                                </span>
                                                                            ) : null;
                                                                        })}
                                                                        {/* If no specific ops, show Zone Responsibles skills */}
                                                                        {ops.length === 0 && zoneAss.map(za => {
                                                                            const zd = dipendenti.find(dd => dd.id === za.dipendente_id);
                                                                            const zSkill = getSelectedDipSkill(za.dipendente_id, m.id);
                                                                            if (!zd) return null;
                                                                            return (
                                                                                <React.Fragment key={`zop-${za.id}`}>
                                                                                    {/* Removed name, show only badge */}
                                                                                    {zSkill && (
                                                                                        String(zSkill.value).includes('=>') ? (
                                                                                            <span style={{ color: "#8B5CF6", fontWeight: 700, fontSize: 13 }}>{zSkill.value}</span>
                                                                                        ) : zSkill.value === 0 ? (
                                                                                            <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: 11 }}>Nessuna form.</span>
                                                                                        ) : (
                                                                                            <span style={{ color: zSkill.color, fontWeight: 700, fontSize: 13 }}>Liv. {zSkill.value}</span>
                                                                                        )
                                                                                    )}
                                                                                </React.Fragment>
                                                                            );
                                                                        })}

                                                                        {/* Removed the + button for zone machines as requested */}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                    <span className={`tag ${!isUnder ? "tag-green" : "tag-red"}`} style={{ padding: "2px 8px", minWidth: 50, textAlign: "center", display: "inline-block" }}>
                                                                        {!isUnder ? "OK" : (ops.length > 0 && effectiveOps.length === 0 ? "SCOPERTA" : "SOTTO")}
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
                                                    // Filter effective
                                                    const effectiveOps = ops.filter(a => getIsPresent(a.dipendente_id));
                                                    const isUnder = effectiveOps.length < (m.personale_minimo || 1);
                                                    const hasAssignedButAbsent = ops.length > 0 && effectiveOps.length === 0;

                                                    return (
                                                        <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                                {m.nome}
                                                            </td>
                                                            <td style={{ padding: "8px 12px" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                                    {ops.map(o => {
                                                                        const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                        // Check Presence
                                                                        const isPresent = getIsPresent(o.dipendente_id);

                                                                        const skill = getSelectedDipSkill(o.dipendente_id, m.id);

                                                                        return d ? (
                                                                            <span key={o.id} className={`operator-chip ${d.tipo === "interinale" ? "interinale" : ""} `}
                                                                                style={{
                                                                                    textDecoration: isPresent ? "none" : "line-through",
                                                                                    color: isPresent ? "inherit" : "var(--danger)",
                                                                                    background: isPresent ? "" : "rgba(220, 38, 38, 0.1)",
                                                                                    border: isPresent ? "" : "1px solid var(--danger)",
                                                                                    display: "inline-flex",
                                                                                    alignItems: "center",
                                                                                    gap: 6
                                                                                }}>
                                                                                <span style={{ fontWeight: 500 }}>{d.cognome} {d.nome.charAt(0)}. </span>
                                                                                {skill && (skill.value !== 0 || String(skill.value).includes('=>')) && (
                                                                                    <span style={{ color: skill.color, fontWeight: 700, fontSize: 20 }}>
                                                                                        {String(skill.value).includes('=>') ? skill.value : `Liv. ${skill.value}`}
                                                                                    </span>
                                                                                )}
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
                                                                    {!isUnder ? "OK" : (hasAssignedButAbsent ? "SCOPERTA" : "SOTTO")}
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
                                        const isPresent = getIsPresent(o.dipendente_id);

                                        if (!d) return null;
                                        return (
                                            <span key={o.id} className="operator-chip"
                                                style={{
                                                    textDecoration: isPresent ? "none" : "line-through",
                                                    color: isPresent ? "inherit" : "var(--danger)"
                                                }}>
                                                <span style={{ fontWeight: 500 }}>{d.cognome} {d.nome.charAt(0)}. </span>
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
                                const isPresente = getIsPresent(d.id);
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
            )}
        </div>
    );
}
