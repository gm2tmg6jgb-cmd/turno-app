import { useState, useMemo } from "react";
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

    const dipRep = repartoCorrente ? dipendenti.filter((d) => d.reparto_id === repartoCorrente) : dipendenti;
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
            // Must be present TODAY
            const isPresente = presRep.some((p) => p.dipendente_id === d.id);
            // Must be 'operatore'
            return isPresente && d.ruolo === "operatore";
        });
    };

    const getSelectedDipSkill = (dipId, machineId) => {
        const dip = dipendenti.find(d => d.id === dipId);
        if (!dip) return null;
        const levelVal = dip.competenze?.[machineId] || 0;
        return LIVELLI_COMPETENZA.find(l => l.value === levelVal);
    };

    return (
        <div className="fade-in">
            <div className="alert alert-info" style={{ marginBottom: 20 }}>
                <span style={{ flexShrink: 0 }}>{Icons.clock}</span>
                Assegna gli operatori presenti alle macchine o alle attività extra. Gli operatori già assegnati non compaiono nell'elenco.
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-secondary)" }}>MACCHINE DI PRODUZIONE</h3>
            <div style={{ marginBottom: 40 }}>
                {(() => {
                    // 1. Group Data by Zone
                    // Fetch Zones from props or use a unique list from machines if props not available.
                    // Ideally pass 'zones' prop to AssegnazioniView, but for now derive or use empty.
                    // We need to fetch zones in App.jsx and pass them here.
                    // fallback: unique zone IDs from machines.
                    const zoneIds = [...new Set(macchineReparto.map(m => m.zona).filter(Boolean))];
                    const machinesWithoutZone = macchineReparto.filter(m => !m.zona);

                    // We need labels for zones. 
                    // Since 'zones' prop is not currently passed to AssegnazioniView, we might show ID.
                    // TODO: Update App.jsx to pass 'zones' to AssegnazioniView for better labels.

                    return (
                        <>
                            {zoneIds.map(zoneId => {
                                const zoneMachines = macchineReparto.filter(m => m.zona === zoneId);
                                const zoneLabel = zones?.find(z => z.id === zoneId)?.label || `Zona ${zoneId}`;

                                // Check if anyone is assigned directly to the ZONE (Jolly/Leader)
                                const zoneAss = assRep.filter(a => a.macchina_id === zoneId || a.attivita_id === zoneId);

                                return (
                                    <div key={zoneId} className="zone-section" style={{ marginBottom: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                                                {Icons.grid} {zoneLabel}
                                            </h4>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal({ id: zoneId, type: 'activity', name: `${zoneLabel} (Supervisione)` })}>
                                                {Icons.plus} Assegna Responsabile
                                            </button>
                                        </div>

                                        {/* Zone Leader / Assignments */}
                                        {zoneAss.length > 0 && (
                                            <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", padding: "8px", background: "rgba(59, 130, 246, 0.1)", borderRadius: 6 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--info)", alignSelf: "center" }}>Responsabili:</span>
                                                {zoneAss.map(a => {
                                                    const d = dipendenti.find(dd => dd.id === a.dipendente_id);
                                                    return d ? (
                                                        <span key={a.id} className="operator-chip" style={{ background: "var(--bg-card)", border: "1px solid var(--info)" }}>
                                                            {d.cognome} {d.nome.charAt(0)}.
                                                            <span className="remove" onClick={() => removeAssegnazione(a.id)}>✕</span>
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}

                                        <div className="machine-grid">
                                            {zoneMachines.map((m) => {
                                                const ops = assRep.filter((a) => a.macchina_id === m.id);
                                                const isUnder = ops.length < (m.personale_minimo || 1);
                                                const isEmpty = ops.length === 0;

                                                return (
                                                    <div key={m.id} className={`machine-card ${isUnder ? (isEmpty ? "danger" : "warning") : ""} `}>
                                                        <div className="machine-card-header">
                                                            <div>
                                                                <div className="machine-card-name">{m.nome}</div>
                                                                <div className="machine-card-id">{m.id}</div>
                                                            </div>
                                                            <span className={`tag ${isUnder ? "tag-red" : "tag-green"} `}>
                                                                {ops.length}/{m.personale_minimo || 1}
                                                            </span>
                                                        </div>

                                                        <div className="machine-card-operators">
                                                            {ops.map((o) => {
                                                                const d = dipendenti.find((dd) => dd.id === o.dipendente_id);
                                                                if (!d) return null;
                                                                return (
                                                                    <span key={o.id} className={`operator-chip ${d.tipo === "interinale" ? "interinale" : ""} `}>
                                                                        {d.cognome} {d.nome.charAt(0)}.
                                                                        {d.tipo === "interinale" && <span style={{ fontSize: 9, color: "var(--warning)" }}>INT</span>}
                                                                        <span className="remove" onClick={() => removeAssegnazione(o.id)}>✕</span>
                                                                    </span>
                                                                );
                                                            })}
                                                            <button className="add-operator-btn" onClick={() => setShowModal({ id: m.id, type: 'machine', name: m.nome })}>
                                                                {Icons.plus} Aggiungi
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Machines without Zone */}
                            {machinesWithoutZone.length > 0 && (
                                <div className="zone-section" style={{ marginBottom: 24 }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-secondary)" }}>MACCHINE NON ASSEGNATE A ZONE</h4>
                                    <div className="machine-grid">
                                        {machinesWithoutZone.map((m) => {
                                            const ops = assRep.filter((a) => a.macchina_id === m.id);
                                            const isUnder = ops.length < (m.personale_minimo || 1);
                                            const isEmpty = ops.length === 0;

                                            return (
                                                <div key={m.id} className={`machine-card ${isUnder ? (isEmpty ? "danger" : "warning") : ""} `}>
                                                    <div className="machine-card-header">
                                                        <div>
                                                            <div className="machine-card-name">{m.nome}</div>
                                                            <div className="machine-card-id">{m.id}</div>
                                                        </div>
                                                        <span className={`tag ${isUnder ? "tag-red" : "tag-green"} `}>
                                                            {ops.length}/{m.personale_minimo || 1}
                                                        </span>
                                                    </div>

                                                    <div className="machine-card-operators">
                                                        {ops.map((o) => {
                                                            const d = dipendenti.find((dd) => dd.id === o.dipendente_id);
                                                            if (!d) return null;
                                                            return (
                                                                <span key={o.id} className={`operator-chip ${d.tipo === "interinale" ? "interinale" : ""} `}>
                                                                    {d.cognome} {d.nome.charAt(0)}.
                                                                    {d.tipo === "interinale" && <span style={{ fontSize: 9, color: "var(--warning)" }}>INT</span>}
                                                                    <span className="remove" onClick={() => removeAssegnazione(o.id)}>✕</span>
                                                                </span>
                                                            );
                                                        })}
                                                        <button className="add-operator-btn" onClick={() => setShowModal({ id: m.id, type: 'machine', name: m.nome })}>
                                                            {Icons.plus} Aggiungi
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    );
                })()}
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
                                const isAssigned = assRep.some(a => a.dipendente_id === d.id);
                                return (
                                    <option key={d.id} value={d.id}>
                                        {d.cognome} {d.nome} {d.tipo === "interinale" ? "(INT)" : ""} {isAssigned ? "(Già Assegnato)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
                            Vengono mostrati tutti gli operatori presenti. Quelli già assegnati sono contrassegnati.
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
                            {Icons.info} Tutti gli operatori presenti sono già stati assegnati.
                        </div>
                    )}
                </Modal>
            )
            }
        </div >
    );
}
