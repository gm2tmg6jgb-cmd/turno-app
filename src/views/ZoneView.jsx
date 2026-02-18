import { useState } from "react";
import { supabase } from "../lib/supabase";
import { REPARTI } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";

export default function ZoneView({ zones, setZones, macchine, setMacchine }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [newZone, setNewZone] = useState({ id: "", label: "", reparto: "T11", max_machines: 0 });

    // State for machine management inside modal
    const [newMac, setNewMac] = useState({ id: "", nome: "", personaleMinimo: 1 });

    const filteredZones = zones.filter(z =>
        (z.label || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (z.reparto || z.repart_id || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
        return (a.label || "").localeCompare(b.label || "", undefined, { numeric: true, sensitivity: 'base' });
    });

    const handleSaveZone = async () => {
        if (!newZone.label) return;

        try {
            // Auto-generate ID if creating
            let zoneId = newZone.id;
            if (!isEditing) {
                // Generate simple slug: ZONE_LABEL
                const slug = newZone.label.trim().replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
                zoneId = `Z_${slug}_${Date.now().toString().slice(-4)}`; // Add timestamp suffix to ensure uniqueness
            }

            const payload = {
                id: zoneId,
                label: newZone.label,
                repart_id: newZone.reparto, // Map to DB column 'repart_id' (typo in DB)
                max_machines: parseInt(newZone.max_machines) || null
            };

            const { data, error } = await supabase
                .from('zone')
                .upsert(payload)
                .select();

            if (error) throw error;

            // Normalize back to UI model if needed, or just use what DB returns
            // best to allow both during transition/typo handling
            const savedZone = { ...data[0], reparto: data[0].repart_id || data[0].reparto };

            if (isEditing) {
                setZones(zones.map(z => z.id === zoneId ? { ...z, ...payload } : z));
            } else {
                setZones([...zones, { ...payload }]);
            }
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error("Error saving zone:", error);
            alert("Errore salvataggio zona: " + error.message);
        }
    };

    const handleDeleteZone = async (id) => {
        if (window.confirm("Eliminare questa zona? Le macchine associate verranno mantenute ma non avranno più una zona.")) {
            try {
                const { error } = await supabase.from('zone').delete().eq('id', id);
                if (error) throw error;
                setZones(zones.filter(z => z.id !== id));
            } catch (error) {
                console.error("Error deleting zone:", error);
                alert("Errore eliminazione zona: " + error.message);
            }
        }
    };

    const resetForm = () => {
        setNewZone({ id: "", label: "", reparto: "T11", max_machines: 0 });
        setIsEditing(false);
    };

    const openEdit = (zone) => {
        // Map DB fields to Form State
        setNewZone({
            ...zone,
            reparto: zone.repart_id || zone.reparto || "T11"
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const deleteMachine = async (macId) => {
        if (window.confirm("Rimuovere questa macchina dalla zona? (La macchina rimarrà nel database, ma senza zona)")) {
            try {
                const { error } = await supabase
                    .from('macchine')
                    .update({ zona: null })
                    .eq('id', macId);

                if (error) throw error;

                setMacchine(macchine.map(m => m.id === macId ? { ...m, zona: null } : m));
            } catch (error) {
                console.error("Error removing machine from zone:", error);
                alert("Errore aggiornamento macchina: " + error.message);
            }
        }
    };

    const addMachineToZone = async () => {
        if (!newMac.id) return; // Only verify ID presence

        // Check Max Machines Limit
        const currentMachinesCount = macchine.filter(m => m.zona === newZone.id).length;
        const maxLimit = parseInt(newZone.max_machines) || 0;

        if (maxLimit > 0 && currentMachinesCount >= maxLimit) {
            alert(`Impossibile aggiungere macchina: Limite di ${maxLimit} macchine raggiunto per questa zona.`);
            return;
        }

        const machineData = {
            id: newMac.id,
            nome: newMac.id, // Use ID as Name
            zona: newZone.id,
            reparto_id: newZone.reparto, // Align with DB column
            personale_minimo: newMac.personaleMinimo
        };

        try {
            // Check if machine exists
            const existing = macchine.find(m => m.id === newMac.id);

            let result;
            if (existing) {
                // Update existing machine
                const { data, error } = await supabase
                    .from('macchine')
                    .update({ zona: newZone.id })
                    .eq('id', newMac.id)
                    .select();
                if (error) throw error;
                result = data[0];

                // Update local state
                setMacchine(macchine.map(m => m.id === newMac.id ? { ...m, ...result } : m));
            } else {
                // Insert new machine
                const { data, error } = await supabase
                    .from('macchine')
                    .insert(machineData)
                    .select();
                if (error) throw error;
                result = data[0];

                // Update local state
                setMacchine([...macchine, result]);
            }

            setNewMac({ id: "", nome: "", personaleMinimo: 1 });
        } catch (error) {
            console.error("Error saving machine:", error);
            alert("Errore salvataggio macchina: " + error.message);
        }
    };

    return (
        <div className="fade-in">
            <div className="main-header-actions" style={{ marginBottom: 20, justifyContent: "space-between", display: "flex" }}>
                <input
                    type="text"
                    placeholder="Cerca zona o team..."
                    className="input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: 300, fontSize: 15 }}
                />
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    {Icons.plus} Nuova Zona
                </button>
            </div>

            <div className="table-container">
                <table style={{ fontSize: 15 }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: "left", padding: "12px 16px" }}>Descrizione</th>
                            <th style={{ textAlign: "left", padding: "12px 16px" }}>Reparto</th>
                            <th style={{ textAlign: "left", padding: "12px 16px" }}>Macchine Incluse</th>
                            <th style={{ textAlign: "left", padding: "12px 16px" }}>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredZones.map(z => {
                            const macchineZona = macchine.filter(m => m.zona === z.id);

                            return (
                                <tr key={z.id}>
                                    <td style={{ padding: "12px 16px", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                                        {z.label}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        {z.repart_id || z.reparto}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {macchineZona.map(m => (
                                                <span key={m.id} style={{
                                                    marginRight: 6,
                                                    color: "var(--text-primary)",
                                                    fontSize: 15,
                                                    fontWeight: 400
                                                }}>
                                                    {m.nome}
                                                </span>
                                            ))}
                                            {macchineZona.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>}
                                        </div>
                                        {z.max_machines > 0 && (
                                            <div style={{ fontSize: 10, color: macchineZona.length >= z.max_machines ? "var(--danger)" : "var(--success)", marginTop: 4 }}>
                                                {macchineZona.length} / {z.max_machines} slots utilizzati
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="btn-action edit" onClick={() => openEdit(z)} title="Modifica">{Icons.edit}</button>
                                            <button className="btn-action delete" onClick={() => handleDeleteZone(z.id)} title="Elimina">{Icons.trash}</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <Modal
                    title={isEditing ? `Modifica Zona ${newZone.id}` : "Nuova Zona"}
                    onClose={() => setShowModal(false)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
                            <button className="btn btn-primary" onClick={handleSaveZone}>Salva Zona</button>
                        </>
                    }
                >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div className="form-group" style={{ gridColumn: "span 2" }}>
                            <label className="form-label">Descrizione Completa</label>
                            <input className="input" value={newZone.label} onChange={(e) => setNewZone({ ...newZone, label: e.target.value })} placeholder="Es: Nuova Area Produzione" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Reparto</label>
                            <select className="select-input" value={newZone.reparto} onChange={(e) => setNewZone({ ...newZone, reparto: e.target.value })}>
                                {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Max Macchine (0 = Illimitato)</label>
                            <input
                                type="number"
                                className="input"
                                value={newZone.max_machines || ""}
                                onChange={(e) => setNewZone({ ...newZone, max_machines: e.target.value })}
                                placeholder="Es: 5"
                            />
                        </div>
                    </div>

                    {isEditing && (
                        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                            <h4 style={{ marginBottom: 12, fontSize: 14 }}>Gestione Macchine in questa Zona</h4>

                            {/* Machine List */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                {macchine.filter(m => m.zona === newZone.id).map(m => (
                                    <div key={m.id} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "8px 12px",
                                        background: "var(--bg-tertiary)",
                                        borderRadius: 6
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ID: {m.id} • Min: {m.personaleMinimo}</div>
                                        </div>
                                        <button className="btn-action delete" style={{ width: 28, height: 28 }} onClick={() => deleteMachine(m.id)}>
                                            {Icons.trash}
                                        </button>
                                    </div>
                                ))}
                                {macchine.filter(m => m.zona === newZone.id).length === 0 && (
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>Nessuna macchina in questa zona</div>
                                )}
                            </div>

                            {/* Add New Machine Form */}
                            <div style={{
                                padding: 12,
                                background: "var(--bg-secondary)",
                                borderRadius: 8,
                                border: "1px dashed var(--border)"
                            }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>+ Aggiungi Macchina</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                                    <input
                                        className="input"
                                        style={{ fontSize: 12 }}
                                        placeholder="Nome Macchina / ID (es. FRW123)"
                                        value={newMac.id}
                                        onChange={(e) => setNewMac({ ...newMac, id: e.target.value.toUpperCase() })} // Auto-uppercase for consistency
                                    />
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>Pers. Minimo:</div>
                                        <input
                                            type="number"
                                            className="input"
                                            style={{ width: 60, fontSize: 12 }}
                                            value={newMac.personaleMinimo}
                                            onChange={(e) => setNewMac({ ...newMac, personaleMinimo: parseInt(e.target.value) || 1 })}
                                        />
                                        <button className="btn btn-primary btn-sm" onClick={addMachineToZone}>Aggiungi</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}
