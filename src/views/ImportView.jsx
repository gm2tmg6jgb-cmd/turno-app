import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

/*
  Colonne attese dal file SAP:
  - Acquisito        → data (DATE)
  - Centro di lavoro → macchina_id (FK macchine)
  - Materiale        → materiale (TEXT)
  - Quantità ottenuta→ qta_ottenuta (NUMERIC)
  - Qtà scarto       → qta_scarto (NUMERIC)
  - Turno            → turno_sap (TEXT, mappato a turno_id A/B/C/D)
*/

const COL_DEFS = [
    { key: "acquisito", label: "Acquisito", patterns: ["acquisito", "data conf", "posting date", "data posting", "data"] },
    { key: "work_center", label: "Centro di lavoro", patterns: ["centro di lavoro", "ctrlav", "work center", "workcenter", "centro lav"] },
    { key: "materiale", label: "Materiale", patterns: ["materiale", "matr.", "material", "articolo", "art."] },
    { key: "qta_ottenuta", label: "Quantità ottenuta", patterns: ["quantità ottenuta", "qtà ottenuta", "qta ottenuta", "yield", "qtà conf", "qta conf"] },
    { key: "qta_scarto", label: "Qtà scarto", patterns: ["scarto", "qtà scarto", "qta scarto", "scrap"] },
    { key: "turno", label: "Turno", patterns: ["turno", "shift", "turn"] },
];

function autoDetect(headers) {
    const lower = headers.map(h => (h || "").toLowerCase().trim());
    const result = {};
    for (const { key, patterns } of COL_DEFS) {
        const idx = lower.findIndex(h => patterns.some(p => h.includes(p)));
        result[key] = idx >= 0 ? headers[idx] : "";
    }
    return result;
}

function formatDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === "number") {
        try {
            const d = XLSX.SSF.parse_date_code(val);
            if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        } catch { /* ignore */ }
    }
    const s = String(val).trim();
    // dd.mm.yyyy
    const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    // dd/mm/yyyy
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
    return s.slice(0, 10) || null;
}

function mapTurno(val) {
    const v = String(val || "").trim().toUpperCase();
    if (!v) return null;
    if (["A", "B", "C", "D"].includes(v)) return v;
    if (v === "1" || v.includes("MAT")) return "A";
    if (v === "2" || v.includes("POM")) return "B";
    if (v === "3" || v.includes("SER")) return "C";
    if (v === "4" || v.includes("NOT")) return "D";
    return v; // mantieni originale
}

export default function ImportView({ showToast, macchine = [] }) {
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [hdrIndexMap, setHdrIndexMap] = useState({}); // header name → indice originale nella riga
    const [rawRows, setRawRows] = useState([]);
    const [mapping, setMapping] = useState({});
    const [step, setStep] = useState("upload"); // upload | map | preview | done
    const [result, setResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const inputRef = useRef();

    /* ── parse ── */
    const handleFile = (file) => {
        if (!file) return;
        if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
            showToast("Formato non supportato. Usa .xlsx, .xls o .csv", "error");
            return;
        }
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const buffer = e.target.result;
                const bytes = new Uint8Array(buffer);

                // Detect UTF-16 BOM — SAP spesso esporta .xls come CSV UTF-16
                const isUtf16LE = bytes[0] === 0xFF && bytes[1] === 0xFE;
                const isUtf16BE = bytes[0] === 0xFE && bytes[1] === 0xFF;

                let wb;
                if (isUtf16LE || isUtf16BE) {
                    // CSV UTF-16: decodifica e passa a xlsx come stringa
                    const text = new TextDecoder(isUtf16BE ? "utf-16be" : "utf-16le").decode(buffer);
                    wb = XLSX.read(text, { type: "string" });
                } else {
                    // Formato binario standard (.xls BIFF8, .xlsx, CSV UTF-8)
                    let bstr = "";
                    for (let i = 0; i < bytes.length; i++) bstr += String.fromCharCode(bytes[i]);
                    wb = XLSX.read(bstr, { type: "binary", cellDates: false });
                }

                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                if (json.length < 2) { showToast("File vuoto o troppo corto", "error"); return; }

                // Trova la riga intestazioni: scansiona le prime 20 righe
                // e cerca quella che contiene almeno 2 parole chiave note
                const ALL_PATTERNS = COL_DEFS.flatMap(c => c.patterns);
                let hdrRowIdx = 0;
                let bestScore = 0;
                for (let i = 0; i < Math.min(20, json.length); i++) {
                    const row = json[i].map(h => String(h || "").toLowerCase().trim());
                    const score = row.filter(h => ALL_PATTERNS.some(p => h.includes(p))).length;
                    if (score > bestScore) { bestScore = score; hdrRowIdx = i; }
                }

                // Mappa nome-colonna → indice originale (preserva colonne vuote)
                const allHdrs = json[hdrRowIdx].map(h => String(h || "").trim());
                const hdrIndexMap = {};
                allHdrs.forEach((h, i) => { if (h) hdrIndexMap[h] = i; });

                const hdrs = allHdrs.filter(Boolean);
                const rows = json.slice(hdrRowIdx + 1).filter(r => r.some(c => c !== ""));
                setHeaders(hdrs);
                setHdrIndexMap(hdrIndexMap);
                setRawRows(rows);
                setMapping(autoDetect(hdrs));
                setStep("map");
                showToast(`File letto: ${rows.length} righe`, "success");
            } catch (err) {
                console.error("Errore lettura file:", err);
                showToast("Errore lettura file: " + err.message, "error");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    /* ── preview ── */
    const handlePreview = () => {
        if (!mapping.work_center) {
            showToast("La colonna 'Centro di lavoro' è obbligatoria", "error");
            return;
        }
        const macchineMap = {};
        for (const m of macchine) {
            // Indice primario: Codice SAP (se presente)
            if (m.codice_sap) macchineMap[m.codice_sap.toUpperCase()] = m;
            // Fallback: ID Macchina (solo se non già preso da un Codice SAP)
            if (!macchineMap[m.id.toUpperCase()]) macchineMap[m.id.toUpperCase()] = m;
        }

        // Usa hdrIndexMap per indici originali (evita disallineamento con colonne vuote)
        const get = (row, col) => col ? row[hdrIndexMap[col]] ?? "" : "";

        const parsed = rawRows.map(row => {
            const wc = String(get(row, mapping.work_center) || "").trim().toUpperCase();
            const mac = macchineMap[wc] || null;
            return {
                work_center_sap: wc,
                macchina_id: mac?.id || null,
                macchina_nome: mac?.nome || mac?.id || null,
                matched: !!mac,
                data: formatDate(get(row, mapping.acquisito)),
                materiale: String(get(row, mapping.materiale) || "").trim() || null,
                qta_ottenuta: parseFloat(get(row, mapping.qta_ottenuta)) || null,
                qta_scarto: parseFloat(get(row, mapping.qta_scarto)) || null,
                turno_id: mapTurno(get(row, mapping.turno)),
            };
        }).filter(r => r.work_center_sap); // salta righe senza WC

        const matched = parsed.filter(r => r.matched).length;
        const wcsUnmatched = [...new Set(parsed.filter(r => !r.matched).map(r => r.work_center_sap))];
        setResult({ rows: parsed, matched, unmatched: wcsUnmatched });
        setStep("preview");
    };

    /* ── salva ── */
    const handleImport = async () => {
        const toSave = result.rows.map(({ matched, macchina_nome, ...r }) => ({
            ...r,
            data_import: new Date().toISOString(),
        }));

        if (!toSave.length) { showToast("Nessuna riga da importare", "error"); return; }
        setSaving(true);
        const { error } = await supabase.from("conferme_sap").insert(toSave);
        setSaving(false);
        if (error) {
            if (error.code === "42P01") {
                showToast("Tabella 'conferme_sap' non trovata — esegui il setup SQL prima", "error");
            } else {
                showToast("Errore import: " + error.message, "error");
            }
            return;
        }
        showToast(`${toSave.length} righe importate`, "success");
        setStep("done");
    };

    const reset = () => {
        setStep("upload"); setFileName(null); setHeaders([]);
        setHdrIndexMap({}); setRawRows([]); setMapping({}); setResult(null);
    };

    /* ══════════════════════════════════════════════════════ */
    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>

            {/* SQL setup note */}
            <details style={{ marginBottom: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px" }}>
                <summary style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
                    ℹ️ Setup Supabase (solo al primo utilizzo)
                </summary>
                <pre style={{ fontSize: 11, marginTop: 10, background: "var(--bg-tertiary)", padding: 12, borderRadius: 6, overflowX: "auto", color: "var(--text-secondary)" }}>{`CREATE TABLE conferme_sap (
    id              BIGSERIAL PRIMARY KEY,
    macchina_id     TEXT REFERENCES macchine(id) ON DELETE SET NULL,
    work_center_sap TEXT,
    data            DATE,
    materiale       TEXT,
    qta_ottenuta    NUMERIC,
    qta_scarto      NUMERIC,
    turno_id        TEXT,
    data_import     TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
            </details>

            {/* ── UPLOAD ── */}
            {step === "upload" && (
                <div className="card">
                    <div className="card-header" style={{ marginBottom: 12 }}>
                        <div className="card-title">📊 Import Conferme SAP</div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                        Importa le conferme di produzione SAP. Colonne riconosciute automaticamente:
                        <strong> Acquisito · Centro di lavoro · Materiale · Quantità ottenuta · Qtà scarto · Turno</strong>
                    </p>
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                        onClick={() => inputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-light)"}`,
                            borderRadius: "var(--radius-lg)",
                            padding: "48px 20px",
                            textAlign: "center",
                            background: dragOver ? "rgba(99,102,241,0.05)" : "var(--bg-tertiary)",
                            cursor: "pointer",
                            transition: "var(--transition)",
                        }}
                    >
                        <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            Trascina il file Excel o clicca per selezionare
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            .xlsx · .xls · .csv
                        </div>
                    </div>
                    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                        onChange={e => handleFile(e.target.files[0])} />
                </div>
            )}

            {/* ── MAPPING ── */}
            {step === "map" && (
                <div className="card">
                    <div className="card-header" style={{ marginBottom: 4 }}>
                        <div className="card-title">Verifica colonne</div>
                        <button className="btn btn-secondary btn-sm" onClick={reset}>← Nuovo file</button>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                        <strong>{fileName}</strong> — {rawRows.length} righe. Correggi se qualche colonna non è stata rilevata correttamente.
                    </p>

                    {/* Debug: mostra codici SAP caricati */}
                    <div style={{ marginBottom: 20, padding: 10, background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 11, border: "1px solid var(--border-light)" }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, textTransform: "uppercase", color: "var(--text-secondary)" }}>Codici SAP configurati nell'anagrafica:</div>
                        <div style={{ color: "var(--accent)", fontFamily: "monospace", display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {macchine.filter(m => m.codice_sap).length > 0 ? (
                                macchine.filter(m => m.codice_sap).map(m => (
                                    <span key={m.id} title={m.nome}>{m.codice_sap}</span>
                                ))
                            ) : (
                                <span style={{ color: "var(--danger)", fontStyle: "italic" }}>Nessun codice SAP configurato nelle macchine!</span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
                        {COL_DEFS.map(({ key, label }) => {
                            const isRequired = key === "work_center";
                            const found = !!mapping[key];
                            return (
                                <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {label}
                                        {isRequired && <span style={{ color: "var(--danger)", fontSize: 10 }}>*</span>}
                                        <span style={{ marginLeft: "auto", fontSize: 10, color: found ? "var(--success)" : "var(--text-muted)" }}>
                                            {found ? "✓ rilevata" : "non trovata"}
                                        </span>
                                    </label>
                                    <select
                                        className="select-input"
                                        value={mapping[key] || ""}
                                        onChange={e => setMapping(p => ({ ...p, [key]: e.target.value }))}
                                        style={{ borderColor: isRequired && !mapping[key] ? "var(--danger)" : undefined }}
                                    >
                                        <option value="">— Non mappata —</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            );
                        })}
                    </div>

                    <button className="btn btn-primary" onClick={handlePreview}>
                        Genera Anteprima →
                    </button>
                </div>
            )}

            {/* ── PREVIEW ── */}
            {step === "preview" && result && (
                <>
                    {/* Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                        {[
                            { label: "Righe abbinate", val: result.matched, color: "var(--success)" },
                            { label: "Non abbinate", val: result.rows.length - result.matched, color: result.rows.length - result.matched > 0 ? "var(--danger)" : "var(--text-muted)" },
                            { label: "Totale righe", val: result.rows.length, color: "inherit" },
                        ].map(({ label, val, color }) => (
                            <div key={label} className="card" style={{ padding: "12px 16px", textAlign: "center" }}>
                                <div style={{ fontSize: 26, fontWeight: 700, color }}>{val}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Work center non abbinati */}
                    {result.unmatched.length > 0 && (
                        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
                            <strong style={{ color: "var(--danger)" }}>Work Center non trovati:</strong>
                            <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                {result.unmatched.join(" · ")}
                            </span>
                            <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                                → Aggiungili o correggi l'ID in Anagrafica Macchine.
                            </span>
                        </div>
                    )}

                    {/* Tabella anteprima */}
                    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>Anteprima (prime 100 righe)</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => setStep("map")}>← Modifica mapping</button>
                        </div>
                        <div className="table-container" style={{ maxHeight: 420, overflowY: "auto" }}>
                            <table style={{ width: "100%" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-tertiary)" }}>
                                        {["Data", "Centro SAP", "Macchina", "Materiale", "Qtà Ott.", "Qtà Scarto", "Turno"].map(h => (
                                            <th key={h} style={{ padding: "8px 12px", textAlign: h === "Qtà Ott." || h === "Qtà Scarto" ? "right" : "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.slice(0, 100).map((r, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", opacity: r.matched ? 1 : 0.45 }}>
                                            <td style={{ padding: "7px 12px", fontSize: 12, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.data || "—"}</td>
                                            <td style={{ padding: "7px 12px", fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{r.work_center_sap}</td>
                                            <td style={{ padding: "7px 12px", fontSize: 12 }}>
                                                {r.matched
                                                    ? <span style={{ color: "var(--success)", fontWeight: 600 }}>{r.macchina_nome}</span>
                                                    : <span style={{ color: "var(--danger)", fontSize: 11 }}>Non trovata</span>}
                                            </td>
                                            <td style={{ padding: "7px 12px", fontSize: 12 }}>{r.materiale || "—"}</td>
                                            <td style={{ padding: "7px 12px", fontSize: 12, textAlign: "right", fontWeight: r.qta_ottenuta ? 600 : 400 }}>
                                                {r.qta_ottenuta != null ? r.qta_ottenuta.toLocaleString("it-IT") : "—"}
                                            </td>
                                            <td style={{ padding: "7px 12px", fontSize: 12, textAlign: "right", color: r.qta_scarto > 0 ? "var(--danger)" : "inherit" }}>
                                                {r.qta_scarto != null && r.qta_scarto > 0 ? r.qta_scarto.toLocaleString("it-IT") : "—"}
                                            </td>
                                            <td style={{ padding: "7px 12px", fontSize: 12, textAlign: "center" }}>
                                                {r.turno_id
                                                    ? <span style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, padding: "1px 8px", fontWeight: 700, fontSize: 11 }}>{r.turno_id}</span>
                                                    : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <button className="btn btn-primary" onClick={handleImport} disabled={saving || result.rows.length === 0}>
                            {saving ? "Importazione…" : `Importa ${result.rows.length} righe`}
                        </button>
                        <button className="btn btn-secondary" onClick={reset}>Annulla</button>
                        {result.matched < result.rows.length && (
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {result.rows.length - result.matched} centri non ancora collegati a macchine — verranno importati comunque con <code>macchina_id</code> vuoto.
                            </span>
                        )}
                    </div>
                </>
            )}

            {/* ── DONE ── */}
            {step === "done" && (
                <div className="card" style={{ textAlign: "center", padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Import completato</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
                        {result?.rows?.length} righe salvate nella tabella <code>conferme_sap</code>
                    </div>
                    <button className="btn btn-primary" onClick={reset}>Importa un altro file</button>
                </div>
            )}
        </div>
    );
}
