import { useState, useRef } from "react";
import { formatItalianDate } from "../lib/dateUtils";
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

const COL_DEFS_PROD = [
    { key: "acquisito", label: "Acquisito", patterns: ["acquisito", "data conf", "posting date", "data posting", "data", "data prod"] },
    { key: "work_center", label: "Centro di lavoro", patterns: ["centro di lavoro", "ctrlav", "work center", "workcenter", "centro lav"] },
    { key: "materiale", label: "Materiale", patterns: ["materiale", "matr.", "material", "articolo", "art."] },
    { key: "qta_ottenuta", label: "Quantità ottenuta", patterns: ["quantità ottenuta", "qtà ottenuta", "qta ottenuta", "yield", "qtà conf", "qta conf"] },
    { key: "qta_scarto", label: "Qtà scarto", patterns: ["scarto", "qtà scarto", "qta scarto", "scrap"] },
    { key: "turno", label: "Turno", patterns: ["turno", "shift", "turn"] },
    { key: "ora", label: "Ora Time", patterns: ["time", "ora", "orario", "time of confirmation"] },
];

const COL_DEFS_FERMI = [
    { key: "data_inizio", label: "Data Inizio", patterns: ["in. guasto", "data inizio", "inizio data", "start date", "da data", "acquisito", "data"] },
    { key: "ora_inizio", label: "Ora Inizio", patterns: ["inguasto", "ora inizio", "inizio ora", "start time", "da ora", "ora iniz.", "ora"] },
    { key: "data_fine", label: "Data Fine", patterns: ["data fine", "fine data", "end date", "a data"] },
    { key: "ora_fine", label: "Ora Fine", patterns: ["ora fine", "fine ora", "end time", "a ora", "ora fine"] },
    { key: "durata", label: "Durata (min)", patterns: ["durata", "duration", "durata minuti", "dur. min."] },
    { key: "work_center", label: "Centro di lavoro", patterns: ["attrezz.", "centro di lavoro", "ctrlav", "work center", "workcenter", "centro lav"] },
    { key: "codice_fermo", label: "Codice Fermi", patterns: ["codice", "reason code", "codice fermo", "causale"] },
    { key: "descrizione_fermo", label: "Descrizione", patterns: ["descrizione", "reason description", "descrizione fermo", "testo causale"] },
    { key: "oggetto_tecnico", label: "Definizione oggetto tecnico", patterns: ["definizione oggetto tecnico", "oggetto tecnico", "tech object", "oggetto"] },
    { key: "autore", label: "Autore", patterns: ["autore", "author", "created by", "eseguito da"] },
    { key: "turno", label: "Turno", patterns: ["turno", "shift", "turn"] },
];

function autoDetect(headers, colDefs) {
    const lower = headers.map(h => (h || "").toLowerCase().trim());
    const result = {};
    for (const { key, patterns } of colDefs) {
        let matchIdx = -1;
        for (const p of patterns) {
            matchIdx = lower.findIndex(h => h === p);
            if (matchIdx >= 0) break;
        }
        if (matchIdx === -1) {
            matchIdx = lower.findIndex(h => patterns.some(p => h.includes(p)));
        }
        result[key] = matchIdx >= 0 ? headers[matchIdx] : "";
    }
    return result;
}

function formatDate(val, dateFormat = "DD/MM/YYYY") {
    if (!val) return null;
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof val === "number") {
        try {
            const d = XLSX.SSF.parse_date_code(val);
            if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        } catch { /* ignore */ }
    }
    // Estrai solo la parte data (prima di eventuali spazi – es. "02/03/2026 08:00:00" → "02/03/2026")
    const s = String(val).trim().split(/\s+/)[0];

    // Stringa numerica pura (es. "46056") — numero seriale Excel da formato "Generale"
    if (/^\d{4,6}$/.test(s)) {
        const serial = parseInt(s, 10);
        if (serial >= 36526 && serial <= 73050) { // range ragionevole: 2000-2099
            try {
                const d = XLSX.SSF.parse_date_code(serial);
                if (d && d.y > 2000) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
            } catch { /* ignore */ }
        }
    }

    // Pattern yyyy-mm-dd (ISO) — check prima per non confonderlo con dd/mm/yyyy
    const mIso = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (mIso) {
        return `${mIso[1]}-${mIso[2].padStart(2, "0")}-${mIso[3].padStart(2, "0")}`;
    }

    // Pattern dd.mm.yyyy or dd/mm/yyyy or dd-mm-yyyy
    // Cattura il separatore: punto (.) → sempre DD.MM.YYYY (standard SAP europeo)
    const m = s.match(/^(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})$/);
    if (m) {
        const sep = m[2];
        let part1 = m[1].padStart(2, "0");
        let part2 = m[3].padStart(2, "0");
        let year = m[4];
        if (year.length === 2) year = "20" + year;

        // Punto → sempre DD.MM (SAP europeo non ambiguo)
        // Slash/trattino → usa il formato selezionato dall'utente
        const useDDMM = sep === "." || dateFormat === "DD/MM/YYYY";
        let day = useDDMM ? part1 : part2;
        let month = useDDMM ? part2 : part1;

        // Ultimo tentativo: se il mese risulta impossibile, inverti
        if (parseInt(month) > 12 && parseInt(day) <= 12) {
            [day, month] = [month, day];
        }

        return `${year}-${month}-${day}`;
    }

    return null;
}

function formatTime(val) {
    if (!val) return null;
    if (typeof val === "number") {
        // Excel stores time as a fraction of a day
        const totalSeconds = Math.round(val * 24 * 3600);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    const s = String(val).trim();
    // Match hh:mm or hh:mm:ss
    const m = s.match(/^(\d{1,2})[:.](\d{1,2})([:.](\d{1,2}))?$/);
    if (m) {
        const h = m[1].padStart(2, "0");
        const min = m[2].padStart(2, "0");
        const sec = (m[4] || "00").padStart(2, "0");
        return `${h}:${min}:${sec}`;
    }
    return s.length >= 5 ? s.slice(0, 8) : null;
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

export default function ImportView({ showToast, macchine = [], setCurrentView }) {
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [hdrIndexMap, setHdrIndexMap] = useState({}); // header name → indice originale nella riga
    const [rawRows, setRawRows] = useState([]);
    const [mapping, setMapping] = useState({});
    const [importType, setImportType] = useState("produzione"); // produzione | fermi
    const [step, setStep] = useState("upload"); 
    const [result, setResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [duplicateMode, setDuplicateMode] = useState(null); // 'ask' | 'replace' | 'append'
    const [existingCount, setExistingCount] = useState(0);
    const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
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

                let json;
                if (isUtf16LE || isUtf16BE) {
                    // CSV UTF-16 (SAP): parsing manuale — evita che XLSX auto-converta
                    // "04.03.2026" come MM/DD e produca una Date sbagliata (Aprile 3).
                    // SAP esporta tipicamente con tab come separatore.
                    const text = new TextDecoder(isUtf16BE ? "utf-16be" : "utf-16le").decode(buffer);
                    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
                    json = lines
                        .map(line => line.split("\t").map(v => v.replace(/^"|"$/g, "")))
                        .filter(row => row.some(v => v.trim() !== ""));
                } else {
                    // Formato binario standard (.xls BIFF8, .xlsx, CSV UTF-8)
                    let bstr = "";
                    for (let i = 0; i < bytes.length; i++) bstr += String.fromCharCode(bytes[i]);
                    const wb = XLSX.read(bstr, { type: "binary", cellDates: false });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                }
                if (json.length < 2) { showToast("File vuoto o troppo corto", "error"); return; }

                // Trova la riga intestazioni: scansiona le prime 50 righe
                // e cerca quella che contiene più parole chiave note
                const ALL_PATTERNS = [...COL_DEFS_PROD, ...COL_DEFS_FERMI].flatMap(c => c.patterns);
                let hdrRowIdx = 0;
                let bestScore = 0;
                for (let i = 0; i < Math.min(50, json.length); i++) {
                    const row = json[i].map(h => String(h || "").toLowerCase().trim());
                    const score = row.filter(h => ALL_PATTERNS.some(p => h.includes(p))).length;
                    // Se troviamo un match perfetto o molto alto (almeno 3 colonne), usalo
                    if (score > bestScore) { 
                        bestScore = score; 
                        hdrRowIdx = i; 
                    }
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
                
                // Auto-detect + Sticky Mapping (localStorage)
                const colDefs = importType === "produzione" ? COL_DEFS_PROD : COL_DEFS_FERMI;
                const autoMapping = autoDetect(hdrs, colDefs);
                
                // Load sticky mapping from localStorage
                const storageKey = `sap_mapping_${importType}`;
                const stickyMapping = JSON.parse(localStorage.getItem(storageKey) || "{}");
                
                // Merge: autoMapping values take precedence ONLY IF found, otherwise sticky
                const finalMapping = { ...autoMapping };
                Object.keys(autoMapping).forEach(key => {
                    if (!finalMapping[key] && stickyMapping[key] && hdrs.includes(stickyMapping[key])) {
                        finalMapping[key] = stickyMapping[key];
                    }
                });

                setMapping(finalMapping);
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
            
            if (importType === "produzione") {
                return {
                    work_center_sap: wc,
                    macchina_id: mac?.id || null,
                    macchina_nome: mac?.nome || mac?.id || null,
                    matched: !!mac,
                    data: formatDate(get(row, mapping.acquisito), dateFormat),
                    materiale: String(get(row, mapping.materiale) || "").trim() || null,
                    qta_ottenuta: parseFloat(get(row, mapping.qta_ottenuta)) || null,
                    qta_scarto: parseFloat(get(row, mapping.qta_scarto)) || null,
                    turno_id: mapTurno(get(row, mapping.turno)),
                    ora: formatTime(get(row, mapping.ora)),
                };
            } else {
                return {
                    work_center_sap: wc,
                    macchina_id: mac?.id || null,
                    macchina_nome: mac?.nome || mac?.id || null,
                    matched: !!mac,
                    data_inizio: formatDate(get(row, mapping.data_inizio), dateFormat),
                    ora_inizio: formatTime(get(row, mapping.ora_inizio)),
                    data_fine: formatDate(get(row, mapping.data_fine), dateFormat),
                    ora_fine: formatTime(get(row, mapping.ora_fine)),
                    durata_minuti: parseInt(get(row, mapping.durata)) || 0,
                    codice_fermo: String(get(row, mapping.codice_fermo) || "").trim(),
                    descrizione_fermo: String(get(row, mapping.descrizione_fermo) || "").trim(),
                    oggetto_tecnico: String(get(row, mapping.oggetto_tecnico) || "").trim(),
                    autore: String(get(row, mapping.autore) || "").trim(),
                    turno_id: mapTurno(get(row, mapping.turno)),
                };
            }
        }).filter(r => r.work_center_sap);

        const matched = parsed.filter(r => r.matched).length;
        const wcsUnmatched = [...new Set(parsed.filter(r => !r.matched).map(r => r.work_center_sap))];

        // Date Check
        const today = new Date().toISOString().slice(0, 10);
        const dateKey = importType === "produzione" ? "data" : "data_inizio";
        const hasFutureDates = parsed.some(r => r[dateKey] && r[dateKey] > today);
        const distinctDates = [...new Set(parsed.map(r => r[dateKey]).filter(Boolean))].sort();

        setResult({
            rows: parsed,
            matched,
            unmatched: wcsUnmatched,
            hasFutureDates,
            dateRange: { start: distinctDates[0], end: distinctDates[distinctDates.length - 1] }
        });

        // Save mapping to localStorage for sticky behavior
        localStorage.setItem(`sap_mapping_${importType}`, JSON.stringify(mapping));

        setStep("preview");
    };

    /* ── salva ── */
    const handleImport = async (mode = null) => {
        const dateKey = importType === "produzione" ? "data" : "data_inizio";
        const distinctDates = [...new Set(result.rows.map(r => r[dateKey]).filter(Boolean))].sort();
        if (distinctDates.length === 0) {
            showToast("Nessuna data valida trovata nelle righe", "error");
            return;
        }

        const tableName = importType === "produzione" ? "conferme_sap" : "fermi_sap";
        const start = distinctDates[0];
        const end = distinctDates[distinctDates.length - 1];

        if (!mode) {
            setSaving(true);
            const { count, error: countErr } = await supabase
                .from(tableName)
                .select("*", { count: "exact", head: true })
                .gte(dateKey, start)
                .lte(dateKey, end);

            setSaving(false);
            if (!countErr && count > 0) {
                setExistingCount(count);
                setDuplicateMode("ask");
                return;
            }
            mode = "append";
        }

        
        setSaving(true);
        try {
            if (mode === "replace") {
                const { error: delErr } = await supabase
                    .from(tableName)
                    .delete()
                    .gte(dateKey, start)
                    .lte(dateKey, end);
                if (delErr) throw delErr;
            }

            const toSave = result.rows.map(item => {
                const r = { ...item };
                delete r.matched;
                delete r.macchina_nome;
                if (importType === "produzione") delete r.ora;
                return {
                    ...r,
                    data_import: new Date().toISOString(),
                };
            });

            if (!toSave.length) {
                showToast("Nessuna riga da importare", "error");
                setSaving(false);
                return;
            }

            const CHUNK_SIZE = 500;
            for (let i = 0; i < toSave.length; i += CHUNK_SIZE) {
                const chunk = toSave.slice(i, i + CHUNK_SIZE);
                const { error: insErr } = await supabase.from(tableName).insert(chunk);
                if (insErr) throw insErr;
            }

            showToast(`${toSave.length} righe importate (${mode === "replace" ? "Sostituito" : "Aggiunto"})`, "success");
            setStep("done");
            setDuplicateMode(null);
        } catch (err) {
            console.error("Errore import:", err);
            // Estrai campi noti di Supabase error, opzionale stringify
            const msg = err.message || err.details || err.hint || JSON.stringify(err);
            showToast("Errore import: " + msg, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleClearHistory = async () => {
        const tableName = importType === "produzione" ? "conferme_sap" : "fermi_sap";
        const label = importType === "produzione" ? "storico PRODUZIONE" : "storico FERMI";
        
        if (!window.confirm(`Sei SICURO di voler cancellare TUTTO lo ${label} SAP? Questa operazione non è reversibile.`)) return;

        setSaving(true);
        const { error } = await supabase.from(tableName).delete().neq("work_center_sap", "FORCE_DELETE_ALL_XYZ"); 
        setSaving(false);

        if (error) {
            showToast("Errore durante la pulizia: " + error.message, "error");
        } else {
            showToast("Storico svuotato con successo", "success");
        }
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
                        <div className="card-title">📊 Import Dati SAP</div>
                    </div>
                    
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        <button 
                            className={`btn ${importType === 'produzione' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setImportType('produzione')}
                            style={{ flex: 1 }}
                        >
                            📦 Conferme Produzione
                        </button>
                        <button 
                            className={`btn ${importType === 'fermi' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setImportType('fermi')}
                            style={{ flex: 1 }}
                        >
                            🚫 Fermi Macchina
                        </button>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                        {importType === 'produzione' ? (
                            <>Importa le conferme di produzione. Colonne: <strong>Acquisito · Centro · Materiale · Quantità · Scarto</strong></>
                        ) : (
                            <>Importa i fermi macchina. Colonne: <strong>Inizio · Fine · Durata · Centro · Codice/Descrizione</strong></>
                        )}
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

                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-light)", textAlign: "center" }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--danger)", opacity: 0.7 }}
                            onClick={(e) => { e.stopPropagation(); handleClearHistory(); }}
                            disabled={saving}
                        >
                            🗑️ Pulisci TUTTO lo storico SAP
                        </button>
                    </div>
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
                    <div style={{ marginBottom: 20, padding: 10, background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 13, border: "1px solid var(--border-light)" }}>
                        <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>Formato Data nel file SAP:</div>
                        <select className="select-input" value={dateFormat} onChange={e => setDateFormat(e.target.value)} style={{ width: 300 }}>
                            <option value="DD/MM/YYYY">GG/MM/AAAA (es. 02/03/2026 = 2 Marzo)</option>
                            <option value="MM/DD/YYYY">MM/GG/AAAA (es. 03/02/2026 = 2 Marzo)</option>
                        </select>
                        {mapping.acquisito && rawRows.length > 0 && (() => {
                            const sampleRaws = rawRows.slice(0, 3).map(r => r[hdrIndexMap[mapping.acquisito]]).filter(v => v !== undefined && v !== "");
                            const sampleParsed = sampleRaws.map(v => formatDate(v, dateFormat));
                            return sampleRaws.length > 0 ? (
                                <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)" }}>
                                    <span style={{ fontWeight: 700 }}>Valori grezzi rilevati → interpretati:</span>
                                    <div style={{ fontFamily: "monospace", marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                                        {sampleRaws.map((raw, i) => (
                                            <span key={i} style={{ color: sampleParsed[i] ? "var(--success)" : "var(--danger)" }}>
                                                "{String(raw)}" → {sampleParsed[i] ? sampleParsed[i] : "❌ non riconosciuto"}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null;
                        })()}
                    </div>

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
                        {(importType === 'produzione' ? COL_DEFS_PROD : COL_DEFS_FERMI).map(({ key, label }) => {
                            const isRequired = key === "work_center" || key === "acquisito" || key === "data_inizio";
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
                                        {headers.map((h, i) => <option key={`${h}-${i}`} value={h}>{h}</option>)}
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

                    {/* Avviso Date Future */}
                    {result.hasFutureDates && (
                        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
                            <strong style={{ color: "var(--warning)" }}>⚠️ Rilevate date nel futuro:</strong>
                            <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>
                                Le date nel file vanno dal <b>{result.dateRange.start}</b> al <b>{result.dateRange.end}</b>.
                                Controlla che il formato della data sia corretto (es. Gennaio vs Luglio).
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
                                        {importType === "produzione" ? (
                                            ["Data", "Ora", "Centro SAP", "Macchina", "Materiale", "Qtà Ott.", "Qtà Scarto", "Turno"].map(h => (
                                                <th key={h} style={{ padding: "8px 12px", textAlign: h.includes("Qtà") ? "right" : "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                                            ))
                                        ) : (
                                            ["Inizio", "Fine", "Durata", "Autore", "Centro SAP", "Oggetto Tecnico", "Descrizione"].map(h => (
                                                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                                            ))
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.slice(0, 100).map((r, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", opacity: r.matched ? 1 : 0.45 }}>
                                            {importType === "produzione" ? (
                                                <>
                                                    <td style={{ padding: "7px 12px", fontSize: 12, fontFamily: "monospace", whiteSpace: "nowrap" }}>{formatItalianDate(r.data)}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)" }}>{r.ora || "—"}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{r.work_center_sap}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12 }}>
                                                        {r.matched ? <span style={{ color: "var(--success)", fontWeight: 600 }}>{r.macchina_nome}</span> : <span style={{ color: "var(--danger)", fontSize: 11 }}>Non trovata</span>}
                                                    </td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12 }}>{r.materiale || "—"}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12, textAlign: "right", fontWeight: r.qta_ottenuta ? 600 : 400 }}>{r.qta_ottenuta != null ? r.qta_ottenuta.toLocaleString("it-IT") : "—"}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12, textAlign: "right", color: r.qta_scarto > 0 ? "var(--danger)" : "inherit" }}>{r.qta_scarto != null && r.qta_scarto > 0 ? r.qta_scarto.toLocaleString("it-IT") : "—"}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ padding: "7px 12px", fontSize: 11, whiteSpace: "nowrap" }}>{formatItalianDate(r.data_inizio)} {r.ora_inizio}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 11, whiteSpace: "nowrap" }}>{formatItalianDate(r.data_fine)} {r.ora_fine}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12, fontWeight: 700 }}>{r.durata_minuti}m</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12 }}>{r.autore || "—"}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{r.work_center_sap}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12 }}>{r.oggetto_tecnico || "—"}</td>
                                                    <td style={{ padding: "7px 12px", fontSize: 12 }}>{r.descrizione_fermo}</td>
                                                </>
                                            )}
                                            {importType === "produzione" && (
                                                <td style={{ padding: "7px 12px", fontSize: 12, textAlign: "center" }}>
                                                    {r.turno_id ? <span className="tag tag-sm tag-blue">{r.turno_id}</span> : "—"}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {duplicateMode === "ask" && (
                        <div style={{ marginTop: 20, padding: 20, background: "rgba(217, 119, 6, 0.1)", border: "1px solid #D97706", borderRadius: 12, width: "100%" }}>
                            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                                <div style={{ fontSize: 32 }}>⚠️</div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, color: "#D97706", fontWeight: 800 }}>Dati già presenti</h4>
                                    <p style={{ margin: "4px 0", fontSize: 13, color: "var(--text-primary)" }}>
                                        Esistono già <strong>{existingCount}</strong> record nel database per il periodo
                                        <strong> {result.dateRange.start.split("-").reverse().join("/")}</strong> —
                                        <strong> {result.dateRange.end.split("-").reverse().join("/")}</strong>.
                                    </p>
                                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#EF4444", fontWeight: 600 }}>
                                        Se reimporti lo stesso file, scegli SEMPRE "Sostituisci" — "Aggiungi" crea duplicati che gonfiano le somme.
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end" }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ background: "#16A34A", borderColor: "#16A34A" }}
                                    onClick={() => handleImport("replace")}
                                    disabled={saving}
                                >
                                    ✓ Sostituisci (Consigliato)
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    style={{ color: "#EF4444", borderColor: "#EF4444" }}
                                    onClick={() => handleImport("append")}
                                    disabled={saving}
                                >
                                    Aggiungi (Rischio duplicati)
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 24 }}>
                        {!duplicateMode && (
                            <button className="btn btn-primary" onClick={() => handleImport()} disabled={saving || result.rows.length === 0}>
                                {saving ? "Controllo duplicati..." : `Invia ${result.rows.length} righe`}
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={reset}>Annulla</button>
                        {result.matched < result.rows.length && (
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {result.rows.length - result.matched} centri non ancora collegati a macchine.
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
                     <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                        <strong>{result?.rows?.length}</strong> righe salvate nella tabella <code>{importType === "produzione" ? "conferme_sap" : "fermi_sap"}</code>
                    </div>
                    {result?.dateRange?.start && (
                        <div style={{ fontSize: 13, marginBottom: 24, padding: "10px 20px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, display: "inline-block" }}>
                            📅 Date importate: <strong>{result.dateRange.start.split("-").reverse().join("/")}</strong>
                            {result.dateRange.start !== result.dateRange.end && <> — <strong>{result.dateRange.end.split("-").reverse().join("/")}</strong></>}
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                In Storico usa il filtro data o clicca "Tutti i dati" per visualizzarle
                            </div>
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <button className="btn btn-primary" onClick={() => setCurrentView?.(importType === "produzione" ? "sapData" : "sapFermi")}>
                            Vai allo Storico SAP →
                        </button>
                        <button className="btn btn-secondary" onClick={reset}>Importa un altro file</button>
                    </div>
                </div>
            )}
        </div>
    );
}
