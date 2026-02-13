import { useState } from "react";
import { REPARTI } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";

export default function ZoneView({ zones, setZones, macchine, setMacchine }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [newZone, setNewZone] = useState({ id: "", label: "", reparto: "T11" });

    // State for machine management inside modal
    const [newMac, setNewMac] = useState({ id: "", nome: "", personaleMinimo: 1 });

    const filteredZones = zones.filter(z =>
        z.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        z.reparto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSaveZone = () => {
        if (!newZone.id || !newZone.label) return;

        if (isEditing) {
            setZones(zones.map(z => z.id === newZone.id ? newZone : z));
        } else {
            if (zones.some(z => z.id === newZone.id)) {
                alert("ID Zona già esistente!");
                return;
            }
            setZones([...zones, newZone]);
        }
        setShowModal(false);
        resetForm();
    };

    const handleDeleteZone = (id) => {
        if (window.confirm("Eliminare questa zona? Le macchine associate verranno mantenute ma non avranno più una zona.")) {
            setZones(zones.filter(z => z.id !== id));
        }
    };

    const resetForm = () => {
        setNewZone({ id: "", label: "", reparto: "T11" });
        setIsEditing(false);
    };

    const openEdit = (zone) => {
        setNewZone({ ...zone });
        setIsEditing(true);
        setShowModal(true);
    };

    const deleteMachine = (macId) => {
        if (window.confirm("Eliminare definitivamente questa macchina?")) {
            setMacchine(macchine.filter(m => m.id !== macId));
        }
    };

    const addMachineToZone = () => {
        if (!newMac.id || !newMac.nome) return;
        if (macchine.some(m => m.id === newMac.id)) {
            alert("ID Macchina già esistente!");
            return;
        }

        const machine = {
            ...newMac,
            zona: newZone.id,
            reparto: newZone.reparto
        };

        setMacchine([...macchine, machine]);
        setNewMac({ id: "", nome: "", personaleMinimo: 1 });
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
                            <th style={{ textAlign: "left", padding: "12px 16px" }}>ID Zona</th>
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
                                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>{z.id}</td>
                                    <td style={{ padding: "12px 16px", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                                        {z.label.split(" - ")[1] || z.label}
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <span className={`tag tag-${z.reparto === 'T11' ? 'blue' : (z.reparto === 'T12' ? 'red' : 'purple')}`}>
                                            {z.reparto}
                                        </span>
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
                        <div className="form-group">
                            <label className="form-label">ID Zona</label>
                            <input className="input" value={newZone.id} onChange={(e) => setNewZone({ ...newZone, id: e.target.value })} disabled={isEditing} placeholder="Es: Z35" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Reparto</label>
                            <select className="select-input" value={newZone.reparto} onChange={(e) => setNewZone({ ...newZone, reparto: e.target.value })}>
                                {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: "span 2" }}>
                            <label className="form-label">Descrizione Completa</label>
                            <input className="input" value={newZone.label} onChange={(e) => setNewZone({ ...newZone, label: e.target.value })} placeholder="Es: Z35 - Nuova Area" />
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
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <input
                                        className="input"
                                        style={{ fontSize: 12 }}
                                        placeholder="ID (es. FRW123)"
                                        value={newMac.id}
                                        onChange={(e) => setNewMac({ ...newMac, id: e.target.value })}
                                    />
                                    <input
                                        className="input"
                                        style={{ fontSize: 12 }}
                                        placeholder="Nome Visualizzato"
                                        value={newMac.nome}
                                        onChange={(e) => setNewMac({ ...newMac, nome: e.target.value })}
                                    />
                                    <div style={{ gridColumn: "span 2", display: "flex", gap: 8, alignItems: "center" }}>
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
