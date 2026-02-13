import { useState } from "react";
import { REPARTI, TURNI, MACCHINE } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";

export default function AnagraficaView({ dipendenti, setDipendenti, macchine, showToast }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterReparto, setFilterReparto] = useState("all");
    const [filterTipo, setFilterTipo] = useState("all");
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentDipId, setCurrentDipId] = useState(null);
    const [newDip, setNewDip] = useState({
        nome: "", cognome: "", turno: "D", reparto: "T11", tipo: "indeterminato",
        competenze: {}, ruolo: "operatore", agenzia: "", scadenza: "", l104: "",
    });

    const filtered = dipendenti.filter((d) => {
        const matchSearch = `${d.nome} ${d.cognome}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchReparto = filterReparto === "all" || d.reparto_id === filterReparto;
        const matchTipo = filterTipo === "all" || d.tipo === filterTipo;
        return matchSearch && matchReparto && matchTipo;
    }).sort((a, b) => a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome));

    const handleSave = () => {
        if (!newDip.nome || !newDip.cognome) return;

        if (isEditing) {
            setDipendenti(dipendenti.map(d => d.id === currentDipId ? { ...newDip, id: currentDipId } : d));
            showToast("Dipendente modificato", "success");
        } else {
            const dip = {
                ...newDip,
                id: `D${Date.now()}`,
            };
            setDipendenti([...dipendenti, dip]);
            showToast("Dipendente aggiunto", "success");
        }
        setShowModal(false);
        resetForm();
    };

    const resetForm = () => {
        setNewDip({ nome: "", cognome: "", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", agenzia: "", scadenza: "", l104: "" });
        setIsEditing(false);
        setCurrentDipId(null);
    };

    const openEdit = (dip) => {
        setNewDip({ ...dip });
        setCurrentDipId(dip.id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = (id) => {
        if (window.confirm("Sei sicuro di voler eliminare questo dipendente?")) {
            setDipendenti(dipendenti.filter(d => d.id !== id));
            showToast("Dipendente eliminato", "warning");
        }
    };

    return (
        <div className="fade-in">
            <div className="filters-bar">
                <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
                    {Icons.search}
                    <input className="input" placeholder="Cerca per nome o cognome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="select-input" style={{ width: 180 }} value={filterReparto} onChange={(e) => setFilterReparto(e.target.value)}>
                    <option value="all">Tutti i reparti</option>
                    {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
                <select className="select-input" style={{ width: 160 }} value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                    <option value="all">Tutti i tipi</option>
                    <option value="indeterminato">Indeterminato</option>
                    <option value="interinale">Interinale</option>
                </select>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>{Icons.plus} Nuovo</button>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Cognome e Nome</th>
                            <th>Turno</th>
                            <th>Team</th>
                            <th>Ruolo</th>
                            <th>Tipo Contratto</th>
                            <th>L104</th>
                            <th>Competenze Macchine</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((d) => {
                            const rep = REPARTI.find((r) => r.id === d.reparto_id);
                            return (
                                <tr key={d.id}>
                                    <td style={{ fontWeight: 600 }}>{d.cognome} {d.nome}</td>
                                    <td><span className="tag tag-blue">Turno {d.turno || "D"}</span></td>
                                    <td>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: rep?.colore }} />
                                            {rep?.nome}
                                        </span>
                                    </td>
                                    <td style={{ textTransform: "capitalize" }}>{d.ruolo}</td>
                                    <td>
                                        <span className={`tag ${d.tipo === "interinale" ? "tag-orange" : "tag-blue"}`}>
                                            {d.tipo === "interinale" ? `INT — ${d.agenzia}` : "Indeterminato"}
                                        </span>
                                        {d.scadenza && (
                                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                                                Scade: {d.scadenza}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {d.l104 ? (
                                            <span className="tag tag-purple">{d.l104}</span>
                                        ) : (
                                            <span style={{ color: "var(--text-muted)" }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                            {d.competenze && Object.keys(d.competenze).length > 0 ? Object.keys(d.competenze).map((c) => {
                                                const mac = macchine.find((m) => m.id === c);
                                                return (
                                                    <span key={c} style={{
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: "50%",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        background: d.competenze[c] > 0 ? "var(--accent)" : "var(--bg-tertiary)",
                                                        color: d.competenze[c] > 0 ? "white" : "var(--text-muted)",
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        border: "1px solid var(--border)"
                                                    }} title={mac?.nome || c}>
                                                        {d.competenze[c]}
                                                    </span>
                                                );
                                            }) : (
                                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Da assegnare</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="btn-action edit" onClick={() => openEdit(d)} title="Modifica">{Icons.edit}</button>
                                            <button className="btn-action delete" onClick={() => handleDelete(d.id)} title="Elimina">{Icons.trash}</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                {filtered.length} dipendenti trovati
            </div>

            {
                showModal && (
                    <Modal
                        title="Nuovo Dipendente"
                        onClose={() => setShowModal(false)}
                        footer={
                            <>
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
                                <button className="btn btn-primary" onClick={handleSave}>Salva</button>
                            </>
                        }
                    >
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Nome</label>
                                <input className="input" value={newDip.nome} onChange={(e) => setNewDip({ ...newDip, nome: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cognome</label>
                                <input className="input" value={newDip.cognome} onChange={(e) => setNewDip({ ...newDip, cognome: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Turno</label>
                                <select className="select-input" value={newDip.turno} onChange={(e) => setNewDip({ ...newDip, turno: e.target.value })}>
                                    {TURNI.map((t) => <option key={t.id} value={t.id}>{t.id} — {t.nome}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Team</label>
                                <select className="select-input" value={newDip.reparto_id} onChange={(e) => setNewDip({ ...newDip, reparto_id: e.target.value })}>
                                    {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo Contratto</label>
                                <select className="select-input" value={newDip.tipo} onChange={(e) => setNewDip({ ...newDip, tipo: e.target.value })}>
                                    <option value="indeterminato">Indeterminato</option>
                                    <option value="interinale">Interinale</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ruolo</label>
                                <select className="select-input" value={newDip.ruolo} onChange={(e) => setNewDip({ ...newDip, ruolo: e.target.value })}>
                                    <option value="operatore">Operatore</option>
                                    <option value="capoturno">Capoturno</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: "span 2" }}>
                                <label className="form-label">L104</label>
                                <input className="input" placeholder="Es: SI + ESE, 104 x 2, ecc." value={newDip.l104} onChange={(e) => setNewDip({ ...newDip, l104: e.target.value })} />
                            </div>
                        </div>
                        {newDip.tipo === "interinale" && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                                <div className="form-group">
                                    <label className="form-label">Agenzia</label>
                                    <input className="input" value={newDip.agenzia} onChange={(e) => setNewDip({ ...newDip, agenzia: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Scadenza Contratto</label>
                                    <input className="input" type="date" value={newDip.scadenza} onChange={(e) => setNewDip({ ...newDip, scadenza: e.target.value })} />
                                </div>
                            </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                                Le competenze si gestiscono dalla pagina "Matrice Competenze".
                            </div>
                        </div>
                    </Modal>
                )
            }
        </div >
    );
}
