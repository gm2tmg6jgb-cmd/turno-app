import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ── macchine fisse ─────────────────────────────────────── */
const WEISSER_MACCHINE = [
    "DRA10060", "DRA10061", "DRA10062", "DRA10063/64", "DRA10065/66",
    "DRA10067/68", "DRA10069/70", "DRA10071", "DRA10072", "DRA11042",
    "DRA11058", "DRA10059", "DRA11044",
];
// componente → macchina reale
const ECO_MAP = {
    SG2: "SCA11006",
    SGR: "SCA11006",
    SG3: "SCA10078",
    SG4: "SCA10078",
    SG5: "FRW10082",
};
const ECO_MACCHINE = ["SG2", "SG3", "SG4", "SG5", "SGR"];

const PROGETTI_WEISSER = ["", "DCT 300", "8Fe"];
const PROGETTI_DRA44   = ["", "DCT 300", "8Fe", "DCT Eco"];
const COMPONENTI = ["", "SG2", "SG3", "SG4", "SG5", "SGR"];

/* ── formula ────────────────────────────────────────────── */
function calcOre(pezziRack, nRack, tempoCiclo) {
    const p = parseFloat(pezziRack);
    const n = parseFloat(nRack);
    const t = parseFloat(tempoCiclo);
    if (!p || !n || !t || t === 0) return "";
    return ((p * n * t) / 60).toFixed(2);
}

function makeRow(macchina, tipo) {
    return { macchina, tipo, progetto: "", componente: "", nRack: "", pezziRack: "", tempoCiclo: "", note: "" };
}

const ALL_ROWS_INIT = [
    ...WEISSER_MACCHINE.map(m => makeRow(m, "weisser")),
    ...ECO_MACCHINE.map(m => makeRow(m, "eco")),
];

/* ── stili condivisi ────────────────────────────────────── */
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

const SELECT_STYLE = {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    padding: "5px 8px",
    fontSize: 12.5,
    color: "var(--text-primary)",
    fontFamily: "inherit",
    cursor: "pointer",
    appearance: "auto",
};

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

/* ── componente principale ──────────────────────────────── */
export default function Op10View() {
    const today = new Date();
    const ggMese = today.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }).replace(" ", "-");
    const oreNow = today.getHours().toString().padStart(2, "0") + ":00";

    const [giorno, setGiorno] = useState(ggMese);
    const [ore, setOre] = useState(oreNow);
    const [rows, setRows] = useState(() => ALL_ROWS_INIT);
    const [sending, setSending] = useState(false);

    const tableRef = useRef(null);

    const update = (idx, field, val) =>
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

    const handleSendPDF = async () => {
        if (!tableRef.current) return;
        setSending(true);
        try {
            const canvas = await html2canvas(tableRef.current, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;
            let w = pageW - 20;
            let h = w / ratio;
            if (h > pageH - 20) { h = pageH - 20; w = h * ratio; }
            const x = (pageW - w) / 2;
            pdf.addImage(imgData, "PNG", x, 10, w, h);
            const fileName = `asservimento_${giorno.replace("/", "-")}_ore${ore.replace(":", "")}.pdf`;
            pdf.save(fileName);

            // Apri mailto dopo il download
            const subject = `Asservimento ${giorno} — Ore ${ore}`;
            const body = `Situazione Asservimento WEISSER / Pretornito ECO\nData: ${giorno}  Ore: ${ore}\n\nVedi PDF allegato.`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        } finally {
            setSending(false);
        }
    };

    const COLS = 8;

    return (
        <div className="fade-in">
            {/* ── Toolbar ── */}
            <div style={{
                display: "flex", alignItems: "center", gap: 16,
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 16px", marginBottom: 16,
            }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                    Asservimento WEISSER / Pretornito ECO
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        Giorno
                    </label>
                    <input
                        className="input"
                        value={giorno}
                        onChange={e => setGiorno(e.target.value)}
                        placeholder="25-feb"
                        style={{ width: 90, textAlign: "center" }}
                    />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        Ore
                    </label>
                    <input
                        className="input"
                        value={ore}
                        onChange={e => setOre(e.target.value)}
                        placeholder="08:00"
                        style={{ width: 80, textAlign: "center" }}
                    />
                </div>

                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSendPDF}
                    disabled={sending}
                    style={{ whiteSpace: "nowrap" }}
                >
                    {sending ? "Generazione..." : "📧 Invia PDF"}
                </button>
            </div>

            {/* ── Tabella ── */}
            <div ref={tableRef}>
                <table style={tableShadow}>
                    <thead>
                        <tr>
                            <td colSpan={COLS} style={titleStyle}>
                                Situazione Asservimento WEISSER / Pretornito ECO &nbsp;·&nbsp; {giorno} &nbsp;·&nbsp; Ore {ore}
                            </td>
                        </tr>
                        <tr style={{ background: "#e8e8e8" }}>
                            <th style={{ ...TH, textAlign: "left", minWidth: 90 }}>Macchina</th>
                            <th style={{ ...TH, minWidth: 110 }}>Progetto</th>
                            <th style={{ ...TH, minWidth: 100 }}>Componente</th>
                            <th style={{ ...TH, minWidth: 80 }}>N. Rack</th>
                            <th style={{ ...TH, minWidth: 80 }}>Pz / Rack</th>
                            <th style={{ ...TH, minWidth: 90 }}>
                                Ciclo<br />
                                <span style={{ fontWeight: 400, fontSize: 9, textTransform: "none" }}>(min/pz)</span>
                            </th>
                            <th style={{ ...TH, minWidth: 90, background: "#dbe8d0", color: "#2a5e1e" }}>
                                Ore cop.<br />
                                <span style={{ fontWeight: 400, fontSize: 9, textTransform: "none" }}>(auto)</span>
                            </th>
                            <th style={{ ...TH, textAlign: "left", minWidth: 100, borderRight: "none" }}>Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const isFirstEco = row.tipo === "eco" && (idx === 0 || rows[idx - 1].tipo === "weisser");
                            const oreCop = calcOre(row.pezziRack, row.nRack, row.tempoCiclo);
                            const oreNum = parseFloat(oreCop);
                            const alert0 = row.nRack !== "" && parseFloat(row.nRack) === 0;
                            const alertBassa = oreCop !== "" && oreNum > 0 && oreNum < 2;

                            return (
                                <>
                                    {isFirstEco && (
                                        <tr key="sep-eco">
                                            <td colSpan={COLS} style={{
                                                padding: "5px 12px", fontWeight: 700, fontSize: 11,
                                                textTransform: "uppercase", letterSpacing: 0.5,
                                                background: "#c8ddf5", color: "#1a3a5c",
                                                borderTop: "2px solid #888", borderBottom: "2px solid #888",
                                            }}>
                                                Pretornito ECO
                                            </td>
                                        </tr>
                                    )}

                                    <tr key={idx}>
                                        <td style={{ ...TD(), padding: "5px 10px", fontWeight: 600, color: "var(--text-primary)", textAlign: "left", whiteSpace: "nowrap" }}>
                                            {row.tipo === "eco" ? ECO_MAP[row.macchina] || row.macchina : row.macchina}
                                        </td>
                                        <td style={TD()}>
                                            {row.tipo === "eco" ? (
                                                <div style={{ ...INPUT(), padding: "5px 8px", fontWeight: 600 }}>DCT Eco</div>
                                            ) : (
                                                <select style={SELECT_STYLE} value={row.progetto}
                                                    onChange={e => update(idx, "progetto", e.target.value)}>
                                                    {(row.macchina === "DRA11044" ? PROGETTI_DRA44 : PROGETTI_WEISSER)
                                                        .map(p => <option key={p} value={p}>{p || "—"}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td style={TD()}>
                                            {row.tipo === "eco" ? (
                                                <div style={{ ...INPUT(), padding: "5px 8px", fontWeight: 600 }}>{row.macchina}</div>
                                            ) : (
                                                <select style={SELECT_STYLE} value={row.componente}
                                                    onChange={e => update(idx, "componente", e.target.value)}>
                                                    {COMPONENTI.map(c => <option key={c} value={c}>{c || "—"}</option>)}
                                                </select>
                                            )}
                                        </td>
                                        <td style={TD(alert0)}>
                                            <input style={INPUT(alert0)} value={row.nRack} type="number" min="0"
                                                onChange={e => update(idx, "nRack", e.target.value)} placeholder="—" />
                                        </td>
                                        <td style={TD()}>
                                            <input style={INPUT()} value={row.pezziRack} type="number" min="0"
                                                onChange={e => update(idx, "pezziRack", e.target.value)} placeholder="—" />
                                        </td>
                                        <td style={TD()}>
                                            <input style={INPUT()} value={row.tempoCiclo} type="number" min="0" step="0.1"
                                                onChange={e => update(idx, "tempoCiclo", e.target.value)} placeholder="—" />
                                        </td>
                                        <td style={{ ...TD(alertBassa), background: oreCop === "" ? "transparent" : alertBassa ? "#FFD700" : "#edf5e8" }}>
                                            <div style={{ ...INPUT(alertBassa), padding: "5px 8px", fontWeight: 700, color: oreCop === "" ? "var(--text-muted)" : alertBassa ? "#7a4a00" : "#2a5e1e" }}>
                                                {oreCop === "" ? "—" : `${oreCop} h`}
                                            </div>
                                        </td>
                                        <td style={{ ...TD(), borderRight: "none" }}>
                                            <input style={INPUT(false, "left")} value={row.note}
                                                onChange={e => update(idx, "note", e.target.value)} placeholder="—" />
                                        </td>
                                    </tr>
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
