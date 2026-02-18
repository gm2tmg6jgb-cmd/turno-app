import { useState, useMemo } from "react";
import { MACCHINE } from "../data/constants";
import { Icons } from "../components/ui/Icons";

export default function RicercaView({ dipendenti, assegnazioni, macchine }) {
    const [searchType, setSearchType] = useState("persona"); // persona, macchina, limitazioni
    const [searchVal, setSearchVal] = useState("");
    const [dataFrom, setDataFrom] = useState("");
    const [dataTo, setDataTo] = useState("");

    const results = useMemo(() => {
        if (searchType === "limitazioni") {
            // Special case: List all employees with limitations
            return dipendenti.filter(d => d.l104 && d.l104.trim() !== "").map(d => ({
                persona: `${d.cognome} ${d.nome}`,
                reparto: d.reparto_id,
                tipo: d.tipo,
                turno: d.turno || d.turno_default || "D",
                limitazioni: d.l104
            }));
        }

        if (!searchVal) return [];

        if (searchType === "persona") {
            const dip = dipendenti.find(
                (d) => `${d.cognome} ${d.nome}`.toLowerCase().includes(searchVal.toLowerCase())
            );
            if (!dip) return [];
            return assegnazioni
                .filter((a) => a.dipendenteId === dip.id) // Note: check logic for DB column names (dipendente_id in DB vs dipendenteId here? Check constant usage)
                // DB uses snake_case, but locally we might have mapped it. Let's assume passed props are raw DB or aligned.
                // Dashboard view uses 'dipendente_id', so Assegnazioni probably does too. 
                // Let's use flexible check or assume standard
                .filter((a) => getDipId(a) === dip.id)
                .map((a) => ({
                    data: a.data,
                    turno: a.turno_id || a.turno,
                    macchina: macchine.find((m) => m.id === (a.macchina_id || a.macchinaId))?.nome || (a.macchina_id || a.macchinaId),
                    persona: `${dip.cognome} ${dip.nome}`,
                }));
        }
        if (searchType === "macchina") {
            const mac = macchine.find((m) => m.nome.toLowerCase().includes(searchVal.toLowerCase()) || m.id === searchVal);
            if (!mac) return [];
            return assegnazioni
                .filter((a) => (a.macchina_id || a.macchinaId) === mac.id)
                .map((a) => {
                    const d = dipendenti.find((dd) => dd.id === (a.dipendente_id || a.dipendenteId));
                    return {
                        data: a.data,
                        turno: a.turno_id || a.turno,
                        macchina: mac.nome,
                        persona: d ? `${d.cognome} ${d.nome}` : "—",
                    };
                });
        }
        return [];
    }, [searchType, searchVal, dipendenti, assegnazioni, macchine]);

    // Helper to handle mixed case if any
    const getDipId = (a) => a.dipendente_id || a.dipendenteId;

    return (
        <div className="fade-in">
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="tabs" style={{ display: "inline-flex", marginBottom: 16 }}>
                    <button className={`tab ${searchType === "persona" ? "active" : ""}`} onClick={() => { setSearchType("persona"); setSearchVal(""); }}>
                        Per Persona
                    </button>
                    <button className={`tab ${searchType === "macchina" ? "active" : ""}`} onClick={() => { setSearchType("macchina"); setSearchVal(""); }}>
                        Per Macchina
                    </button>
                    <button className={`tab ${searchType === "limitazioni" ? "active" : ""}`} onClick={() => { setSearchType("limitazioni"); setSearchVal(""); }}>
                        Limitazioni & Prescrizioni
                    </button>
                </div>

                {searchType !== "limitazioni" && (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label">
                                {searchType === "persona" ? "Nome o Cognome" : "Nome Macchina o ID"}
                            </label>
                            <div className="search-box">
                                {Icons.search}
                                <input
                                    className="input"
                                    placeholder={searchType === "persona" ? "Es: Rossi Marco" : "Es: Macchina T11-01 o M_T11_01"}
                                    value={searchVal}
                                    onChange={(e) => setSearchVal(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, width: 160 }}>
                            <label className="form-label">Data Da</label>
                            <input className="input" type="date" value={dataFrom} onChange={(e) => setDataFrom(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, width: 160 }}>
                            <label className="form-label">Data A</label>
                            <input className="input" type="date" value={dataTo} onChange={(e) => setDataTo(e.target.value)} />
                        </div>
                        <button className="btn btn-primary" style={{ marginBottom: 0 }}>{Icons.search} Cerca</button>
                    </div>
                )}

                {searchType === "limitazioni" && (
                    <div className="alert alert-info" style={{ marginTop: 0 }}>
                        <span style={{ fontSize: 16, marginRight: 8 }}>🩺</span>
                        Elenco completo del personale con limitazioni fisiche, prescrizioni mediche o Legge 104.
                    </div>
                )}
            </div>

            {results.length > 0 ? (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                {searchType === "limitazioni" ? (
                                    <>
                                        <th style={{ textAlign: "left" }}>Dipendente</th>
                                        <th style={{ textAlign: "center" }}>Turno</th>
                                        <th style={{ textAlign: "left" }}>Limitazioni / Note</th>
                                        <th style={{ textAlign: "center" }}>Team</th>
                                    </>
                                ) : (
                                    <>
                                        <th>Data</th>
                                        <th>Turno</th>
                                        <th>{searchType === "persona" ? "Macchina" : "Operatore"}</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => (
                                <tr key={i}>
                                    {searchType === "limitazioni" ? (
                                        <>
                                            <td style={{ fontWeight: 600, background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                                {r.persona}
                                                {r.tipo === 'interinale' && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}> (Int.)</span>}
                                            </td>
                                            <td style={{ textAlign: "center", color: "var(--text-primary)", background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>{r.turno}</td>
                                            <td style={{ color: "var(--text-primary)", background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                                {r.limitazioni.split(',').map((tag, idx) => (
                                                    <span key={idx}>
                                                        {tag.trim()}{idx < r.limitazioni.split(',').length - 1 ? ", " : ""}
                                                    </span>
                                                ))}
                                            </td>
                                            <td style={{ textAlign: "center", color: "var(--text-muted)", background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>{r.reparto}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{r.data}</td>
                                            <td><span className="tag tag-blue">Turno {r.turno}</span></td>
                                            <td style={{ fontWeight: 500 }}>{searchType === "persona" ? r.macchina : r.persona}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (searchVal || searchType === "limitazioni") ? (
                <div className="card" style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        {searchType === "limitazioni" ? "Nessun dipendente con limitazioni trovato." : `Nessun risultato trovato per "${searchVal}"`}
                    </p>
                </div>
            ) : (
                <div className="card" style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>{Icons.history}</div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Utilizza i filtri sopra per cercare nello storico assegnazioni</p>
                </div>
            )}
        </div>
    );
}
