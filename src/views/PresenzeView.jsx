import { useState } from "react";
import { MOTIVI_ASSENZA } from "../data/constants";
import { Modal } from "../components/ui/Modal";

export default function PresenzeView({ dipendenti, presenze, setPresenze, repartoCorrente, turnoCorrente, showToast }) {
    const [showModal, setShowModal] = useState(null);
    const [motivo, setMotivo] = useState("");
    const today = new Date().toISOString().split("T")[0];

    const dipRep = dipendenti.filter((d) => d.reparto === repartoCorrente);

    const togglePresenza = (dipId) => {
        const p = presenze.find((pp) => pp.dipendenteId === dipId && pp.data === today && pp.turno === turnoCorrente);
        if (p && p.presente) {
            setShowModal(dipId);
        } else if (p && !p.presente) {
            setPresenze(presenze.map((pp) =>
                pp.dipendenteId === dipId && pp.data === today ? { ...pp, presente: true, motivoAssenza: null } : pp
            ));
            showToast("Presenza registrata", "success");
        }
    };

    const confermaAssenza = () => {
        if (!motivo) return;
        setPresenze(presenze.map((pp) =>
            pp.dipendenteId === showModal && pp.data === today
                ? { ...pp, presente: false, motivoAssenza: motivo }
                : pp
        ));
        showToast("Assenza registrata", "warning");
        setShowModal(null);
        setMotivo("");
    };

    return (
        <div className="fade-in">
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Dipendente</th>
                            <th>Turno</th>
                            <th>Tipo</th>
                            <th>Stato</th>
                            <th>Motivo Assenza</th>
                            <th>L104</th>
                            <th style={{ textAlign: "center" }}>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dipRep.map((d) => {
                            const p = presenze.find((pp) => pp.dipendenteId === d.id && pp.data === today);
                            const motivoObj = p && !p.presente ? MOTIVI_ASSENZA.find((m) => m.id === p.motivoAssenza) : null;
                            return (
                                <tr key={d.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{d.cognome} {d.nome}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.ruolo}</div>
                                    </td>
                                    <td><span className="tag tag-blue">Turno {d.turno || "D"}</span></td>
                                    <td>
                                        <span className={`tag ${d.tipo === "interinale" ? "tag-orange" : "tag-blue"}`}>
                                            {d.tipo === "interinale" ? `INT — ${d.agenzia}` : "Indeterminato"}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`tag ${p?.presente ? "tag-green" : "tag-red"}`}>
                                            {p?.presente ? "✓ Presente" : "✗ Assente"}
                                        </span>
                                    </td>
                                    <td>
                                        {motivoObj ? (
                                            <span>{motivoObj.icona} {motivoObj.label}</span>
                                        ) : (
                                            <span style={{ color: "var(--text-muted)" }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {d.l104 ? (
                                            <span className="tag tag-purple" style={{ fontSize: 10 }}>{d.l104}</span>
                                        ) : (
                                            <span style={{ color: "var(--text-muted)" }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        <button
                                            className={`btn btn-sm ${p?.presente ? "btn-danger" : "btn-primary"}`}
                                            onClick={() => togglePresenza(d.id)}
                                        >
                                            {p?.presente ? "Segna Assente" : "Segna Presente"}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <Modal
                    title="Registra Assenza"
                    onClose={() => { setShowModal(null); setMotivo(""); }}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => { setShowModal(null); setMotivo(""); }}>Annulla</button>
                            <button className="btn btn-primary" onClick={confermaAssenza}>Conferma</button>
                        </>
                    }
                >
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                        Seleziona il motivo dell'assenza per{" "}
                        <strong>{dipendenti.find((d) => d.id === showModal)?.cognome} {dipendenti.find((d) => d.id === showModal)?.nome}</strong>
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {MOTIVI_ASSENZA.map((m) => (
                            <button
                                key={m.id}
                                className={`btn ${motivo === m.id ? "btn-primary" : "btn-secondary"}`}
                                onClick={() => setMotivo(m.id)}
                                style={{ justifyContent: "flex-start" }}
                            >
                                {m.icona} {m.label}
                            </button>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
}
