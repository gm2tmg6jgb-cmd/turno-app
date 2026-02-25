import { useState } from "react";

/* ── default rows ───────────────────────────────────────── */
const DEFAULT_WEISSER = [
    "DRA80", "DRA61", "DRA62", "DRA83/84", "DRA95/96",
    "DRA87/88", "DRA9970", "DRA71", "DRA72", "DRA42",
    "DRA56", "DRA29", "DRA44",
];

const DEFAULT_ECO = ["SG2", "SG3", "SG4", "SG5", "SGR"];

function makeWeisserRow(nome) {
    return { macchina: nome, progetto: "", componente: "", racks: "", copertura: "", note: "" };
}
function makeEcoRow(nome) {
    return { macchina: nome, racks: "", note: "" };
}

/* ── shared styles ──────────────────────────────────────── */
const TH = {
    padding: "7px 8px",
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    borderRight: "1px solid #aaa",
    borderBottom: "2px solid #888",
    background: "#e8e8e8",
    color: "#333",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    whiteSpace: "nowrap",
};

const TD = (alert = false) => ({
    padding: 0,
    borderRight: "1px solid #ccc",
    borderBottom: "1px solid #ccc",
    background: alert ? "#FFD700" : "transparent",
    verticalAlign: "middle",
});

const INPUT = (alert = false, align = "center") => ({
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    padding: "5px 8px",
    fontSize: 12.5,
    color: alert ? "#000" : "var(--text-primary)",
    textAlign: align,
    fontFamily: "inherit",
    boxSizing: "border-box",
});

/* ── header row (Giorno / Ore) ──────────────────────────── */
function HeaderRow({ giorno, setGiorno, ore, setOre }) {
    return (
        <tr style={{ borderBottom: "1px solid #ccc", background: "var(--bg-secondary)" }}>
            <td style={{ padding: "5px 8px", fontWeight: 700, fontSize: 12, borderRight: "1px solid #ccc", whiteSpace: "nowrap" }}>
                Giorno
            </td>
            <td colSpan={2} style={{ padding: 0, borderRight: "1px solid #ccc" }}>
                <input style={INPUT()} value={giorno}
                    onChange={e => setGiorno(e.target.value)} placeholder="25-feb" />
            </td>
            <td style={{ padding: "5px 8px", fontWeight: 700, fontSize: 12, borderRight: "1px solid #ccc", whiteSpace: "nowrap" }}>
                Ore
            </td>
            <td colSpan={2} style={{ padding: 0, borderRight: "1px solid #ccc" }}>
                <input style={INPUT()} value={ore}
                    onChange={e => setOre(e.target.value)} placeholder="08:30" />
            </td>
        </tr>
    );
}

/* ── main component ─────────────────────────────────────── */
export default function Op10View() {
    const today = new Date();
    const ggMese = today.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }).replace(" ", "-");
    const oreNow = today.getHours().toString().padStart(2, "0") + ":00";

    /* WEISSER state */
    const [wGiorno, setWGiorno] = useState(ggMese);
    const [wOre, setWOre] = useState(oreNow);
    const [wRows, setWRows] = useState(() => DEFAULT_WEISSER.map(makeWeisserRow));

    /* ECO state */
    const [eGiorno, setEGiorno] = useState(ggMese);
    const [eOre, setEOre] = useState(oreNow);
    const [eRows, setERows] = useState(() => DEFAULT_ECO.map(makeEcoRow));

    const updateW = (idx, field, val) =>
        setWRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
    const updateE = (idx, field, val) =>
        setERows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

    const addWRow = () => setWRows(prev => [...prev, makeWeisserRow("")]);
    const addERow = () => setERows(prev => [...prev, makeEcoRow("")]);
    const remW = idx => setWRows(prev => prev.filter((_, i) => i !== idx));
    const remE = idx => setERows(prev => prev.filter((_, i) => i !== idx));

    const tableShadow = {
        border: "2px solid #888",
        borderCollapse: "collapse",
        width: "100%",
        background: "var(--bg-card)",
        fontSize: 13,
    };

    const titleStyle = {
        textAlign: "center",
        padding: "8px 12px",
        fontWeight: 700,
        fontSize: 13,
        borderBottom: "2px solid #888",
        background: "#d4d4d4",
        color: "#111",
        letterSpacing: 0.3,
    };

    const btnStyle = {
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        cursor: "pointer",
        fontSize: 16,
        padding: "3px 6px",
    };

    return (
        <div className="fade-in" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* ── LEFT: WEISSER ── */}
            <div style={{ flex: "0 0 auto", minWidth: 620 }}>
                <table style={tableShadow}>
                    <thead>
                        {/* Title row */}
                        <tr>
                            <td colSpan={7} style={titleStyle}>
                                Situazione Asservimento WEISSER
                            </td>
                        </tr>
                        {/* Giorno / Ore */}
                        <HeaderRow giorno={wGiorno} setGiorno={setWGiorno} ore={wOre} setOre={setWOre} />
                        {/* Column headers */}
                        <tr style={{ background: "#e8e8e8" }}>
                            <th style={{ ...TH, textAlign: "left" }}>Weisser</th>
                            <th style={TH}>
                                Progetto in lavorazione<br />
                                <span style={{ fontWeight: 400, fontSize: 9, textTransform: "none" }}>(DCT300, DCTeco o 8Fe)</span>
                            </th>
                            <th style={TH}>Componente in lavorazione</th>
                            <th style={TH}>N. di racks presenti in buffer</th>
                            <th style={TH}>Ore di copertura</th>
                            <th style={{ ...TH, textAlign: "left" }}>Note</th>
                            <th style={{ ...TH, borderRight: "none", width: 28 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {wRows.map((row, idx) => {
                            const rN = parseFloat(row.racks);
                            const cN = parseFloat(row.copertura);
                            const rA = row.racks !== "" && !isNaN(rN) && rN === 0;
                            const cA = row.copertura !== "" && !isNaN(cN) && cN === 0;
                            return (
                                <tr key={idx}>
                                    <td style={TD()}>
                                        <input style={INPUT(false, "left")} value={row.macchina}
                                            onChange={e => updateW(idx, "macchina", e.target.value)} placeholder="DRA…" />
                                    </td>
                                    <td style={TD()}>
                                        <input style={INPUT()} value={row.progetto}
                                            onChange={e => updateW(idx, "progetto", e.target.value)} placeholder="—" />
                                    </td>
                                    <td style={TD()}>
                                        <input style={INPUT()} value={row.componente}
                                            onChange={e => updateW(idx, "componente", e.target.value)} placeholder="—" />
                                    </td>
                                    <td style={TD(rA)}>
                                        <input style={INPUT(rA)} value={row.racks} type="number" min="0"
                                            onChange={e => updateW(idx, "racks", e.target.value)} placeholder="—" />
                                    </td>
                                    <td style={TD(cA)}>
                                        <input style={INPUT(cA)} value={row.copertura} type="number" min="0"
                                            onChange={e => updateW(idx, "copertura", e.target.value)} placeholder="—" />
                                    </td>
                                    <td style={TD()}>
                                        <input style={INPUT(false, "left")} value={row.note}
                                            onChange={e => updateW(idx, "note", e.target.value)} placeholder="—" />
                                    </td>
                                    <td style={{ ...TD(), borderRight: "none", textAlign: "center" }}>
                                        <button style={btnStyle} onClick={() => remW(idx)}>×</button>
                                    </td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td colSpan={7} style={{ borderTop: "1px solid #ccc", padding: "4px 8px" }}>
                                <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 10px" }} onClick={addWRow}>+ Riga</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── RIGHT: PRETORNITO ECO ── */}
            <div style={{ flex: "0 0 auto", minWidth: 300 }}>
                <table style={tableShadow}>
                    <thead>
                        {/* Title row */}
                        <tr>
                            <td colSpan={4} style={titleStyle}>
                                Situazione Asservimento Pretornito Eco
                            </td>
                        </tr>
                        {/* Giorno / Ore */}
                        <tr style={{ borderBottom: "1px solid #ccc", background: "var(--bg-secondary)" }}>
                            <td style={{ padding: "5px 8px", fontWeight: 700, fontSize: 12, borderRight: "1px solid #ccc", whiteSpace: "nowrap" }}>Giorno</td>
                            <td style={{ padding: 0, borderRight: "1px solid #ccc" }}>
                                <input style={INPUT()} value={eGiorno} onChange={e => setEGiorno(e.target.value)} placeholder="25-feb" />
                            </td>
                            <td style={{ padding: "5px 8px", fontWeight: 700, fontSize: 12, borderRight: "1px solid #ccc", whiteSpace: "nowrap" }}>Ore</td>
                            <td style={{ padding: 0 }}>
                                <input style={INPUT()} value={eOre} onChange={e => setEOre(e.target.value)} placeholder="08:30" />
                            </td>
                        </tr>
                        {/* Column headers */}
                        <tr style={{ background: "#e8e8e8" }}>
                            <th style={{ ...TH, textAlign: "left" }}></th>
                            <th style={TH}>N. di racks presenti in buffer</th>
                            <th style={{ ...TH, textAlign: "left" }}>Note</th>
                            <th style={{ ...TH, borderRight: "none", width: 28 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {eRows.map((row, idx) => {
                            const rN = parseFloat(row.racks);
                            const rA = row.racks !== "" && !isNaN(rN) && rN === 0;
                            return (
                                <tr key={idx}>
                                    <td style={TD()}>
                                        <input style={INPUT(false, "left")} value={row.macchina}
                                            onChange={e => updateE(idx, "macchina", e.target.value)} placeholder="SG…" />
                                    </td>
                                    <td style={TD(rA)}>
                                        <input style={INPUT(rA)} value={row.racks} type="number" min="0"
                                            onChange={e => updateE(idx, "racks", e.target.value)} placeholder="—" />
                                    </td>
                                    <td style={TD()}>
                                        <input style={INPUT(false, "left")} value={row.note}
                                            onChange={e => updateE(idx, "note", e.target.value)} placeholder="—" />
                                    </td>
                                    <td style={{ ...TD(), borderRight: "none", textAlign: "center" }}>
                                        <button style={btnStyle} onClick={() => remE(idx)}>×</button>
                                    </td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td colSpan={4} style={{ borderTop: "1px solid #ccc", padding: "4px 8px" }}>
                                <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 10px" }} onClick={addERow}>+ Riga</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>
    );
}
