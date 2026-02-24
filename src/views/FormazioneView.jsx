import React, { useMemo } from "react";
import { Icons } from "../components/ui/Icons";
import { LIVELLI_COMPETENZA } from "../data/constants";

export default function FormazioneView({ dipendenti, assegnazioni, macchine, presenze = [], turnoCorrente }) {
    // Filtra i dipendenti che hanno almeno una competenza con valore "0=>2"
    const dipendentiInFormazione = useMemo(() => {
        return dipendenti.filter(d => {
            // Filtra per turno corrente se disponibile
            if (turnoCorrente && d.turno_default !== turnoCorrente) return false;
            const competenze = d.competenze || {};
            return Object.values(competenze).some(val => String(val).includes("=>"));
        });
    }, [dipendenti, turnoCorrente]);

    const getIsPresent = (dipId) => {
        const today = new Date().toISOString().split('T')[0];
        const record = presenze.find(p => p.dipendente_id === dipId && p.data === today);
        return record ? record.presente : true; // Default to true if no record
    };

    const skillInFormazione = LIVELLI_COMPETENZA.find(l => l.value === "0=>2");

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                    Elenco del personale con stato <strong>In formazione</strong>. Monitoraggio delle competenze in fase di crescita.
                </p>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Operatore</th>
                            <th>Reparto</th>
                            <th>Macchine in Formazione</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dipendentiInFormazione.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                                    Nessun operatore attualmente in formazione.
                                </td>
                            </tr>
                        ) : (
                            dipendentiInFormazione.map(d => {
                                const isPresent = getIsPresent(d.id);
                                // Trova tutte le macchine per cui ha competenza 0=>2
                                const macchineFormazione = Object.entries(d.competenze || {})
                                    .filter(([_, val]) => String(val).includes("=>"))
                                    .map(([mId, val]) => ({ mId, m: macchine.find(m => m.id === mId), val }));
                                // NON filtriamo per item.m: mostriamo sempre il mId anche se la macchina non è in DB

                                return (
                                    <tr key={d.id}>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <span style={{ fontWeight: 600, fontSize: 16 }}>{d.cognome} {d.nome}</span>
                                                {d.tipo === 'interinale' && <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 700 }}>INTERINALE</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="tag tag-gray">{d.reparto_id}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                {macchineFormazione.map(({ mId, m, val }) => {
                                                    const skill = LIVELLI_COMPETENZA.find(l => l.value === val);
                                                    return (
                                                        <div key={mId} style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                            background: "var(--bg-tertiary)",
                                                            padding: "4px 10px",
                                                            borderRadius: 8,
                                                            border: "1px solid var(--border)"
                                                        }}>
                                                            <span style={{ fontSize: 13, fontWeight: 500 }}>{mId}</span>
                                                            <span style={{
                                                                color: skill?.color || "#8B5CF6",
                                                                fontSize: 13,
                                                                fontWeight: 700
                                                            }}>
                                                                ({val})
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>

                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="alert alert-info" style={{ marginTop: 24 }}>
                {Icons.info} Gli operatori in formazione vengono assegnati alle macchine per affiancamento. Una volta completata la formazione, il livello può essere aggiornato nella Matrice Competenze.
            </div>
        </div>
    );
}
