import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const COL_DEFS = [
    { key: "acquisito", patterns: ["acquisito", "data conf", "posting date", "data posting", "data", "data prod"] },
    { key: "work_center", patterns: ["centro di lavoro", "ctrlav", "work center", "workcenter", "centro lav"] },
    { key: "materiale", patterns: ["materiale", "matr.", "material", "articolo", "art."] },
    { key: "qta_ottenuta", patterns: ["quantità ottenuta", "qtà ottenuta", "qta ottenuta", "yield", "qtà conf", "qta conf"] },
    { key: "qta_scarto", patterns: ["scarto", "qtà scarto", "qta scarto", "scrap"] },
    { key: "turno", patterns: ["turno", "shift", "turn"] },
    { key: "ora", patterns: ["time", "ora", "orario", "time of confirmation"] },
    { key: "fino", patterns: ["fino"] },
];

function formatDate(val) {
    if (!val) return null;
    const s = String(val).trim().split(/\s+/)[0];
    const mIso = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (mIso) return `${mIso[1]}-${mIso[2].padStart(2, "0")}-${mIso[3].padStart(2, "0")}`;

    const m = s.match(/^(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})$/);
    if (m) {
        let day = m[1].padStart(2, "0");
        let month = m[3].padStart(2, "0");
        let year = m[4];
        if (year.length === 2) year = "20" + year;
        
        // Handle European non-ambiguous cases with dots
        if (parseInt(month) > 12 && parseInt(day) <= 12) {
            [day, month] = [month, day];
        }
        return `${year}-${month}-${day}`;
    }
    return null;
}

function mapTurno(val) {
    const v = String(val || "").trim().toUpperCase();
    if (!v) return null;
    if (["A", "B", "C", "D"].includes(v)) return v;
    if (v === "1" || v.includes("MAT")) return "A";
    if (v === "2" || v.includes("POM")) return "B";
    if (v === "3" || v.includes("SER")) return "C";
    if (v === "4" || v.includes("NOT")) return "D";
    return v;
}

async function main() {
    const filePath = "/Users/angelofato/Documents/turno-app copia/CONFERMESAP (4).xls";
    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        process.exit(1);
    }

    const buffer = fs.readFileSync(filePath);
    const text = new TextDecoder("utf-16le").decode(buffer);
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const json = lines
        .map(line => line.split("\t").map(v => v.replace(/^"|"$/g, "").trim()))
        .filter(row => row.some(v => v !== ""));

    // Find header row (same logic as ImportView.jsx)
    const ALL_PATTERNS = COL_DEFS.flatMap(c => c.patterns);
    let hdrRowIdx = 0;
    let bestScore = 0;
    for (let i = 0; i < Math.min(20, json.length); i++) {
        const row = json[i].map(h => String(h || "").toLowerCase().trim());
        const score = row.filter(h => ALL_PATTERNS.some(p => h.includes(p))).length;
        if (score > bestScore) { bestScore = score; hdrRowIdx = i; }
    }

    const headers = json[hdrRowIdx];
    const rows = json.slice(hdrRowIdx + 1);

    // Auto-detect columns
    const mapping = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());
    for (const { key, patterns } of COL_DEFS) {
        let matchIdx = -1;
        for (const p of patterns) {
            matchIdx = lowerHeaders.findIndex(h => h === p);
            if (matchIdx >= 0) break;
        }
        if (matchIdx === -1) {
            matchIdx = lowerHeaders.findIndex(h => patterns.some(p => h.includes(p)));
        }
        mapping[key] = matchIdx;
    }

    if (mapping.work_center === -1) {
        console.error("Column 'Centro di lavoro' not found!");
        process.exit(1);
    }

    // Load machines to get IDs
    const { data: macchine } = await supabase.from('macchine').select('id, codice_sap');
    const macchineMap = {};
    macchine.forEach(m => {
        if (m.codice_sap) macchineMap[m.codice_sap.toUpperCase()] = m.id;
        macchineMap[m.id.toUpperCase()] = m.id;
    });

    const parsedRows = rows.map(row => {
        const wc = row[mapping.work_center]?.toUpperCase();
        if (!wc) return null;

        const rowData = {
            work_center_sap: wc,
            macchina_id: macchineMap[wc] || null,
            data: formatDate(row[mapping.acquisito]),
            materiale: row[mapping.materiale] || null,
            qta_ottenuta: parseFloat(row[mapping.qta_ottenuta]) || 0,
            qta_scarto: parseFloat(row[mapping.qta_scarto]) || 0,
            turno_id: mapTurno(row[mapping.turno]),
            fino: mapping.fino >= 0 ? (String(row[mapping.fino] || "").trim() || null) : null,
            data_import: new Date().toISOString()
        };
        return rowData;
    }).filter(r => r !== null && r.data);

    if (parsedRows.length === 0) {
        console.log("No valid rows to import.");
        return;
    }

    const dates = [...new Set(parsedRows.map(r => r.data))].sort();
    const start = dates[0];
    const end = dates[dates.length - 1];

    console.log(`Found ${parsedRows.length} rows from ${start} to ${end}.`);

    // Delete existing records for the range to avoid duplicates
    console.log(`Deleting existing records for range ${start} to ${end}...`);
    const { error: delErr } = await supabase
        .from("conferme_sap")
        .delete()
        .gte("data", start)
        .lte("data", end);

    if (delErr) {
        console.error("Error deleting old records:", delErr);
        process.exit(1);
    }

    // Insert in chunks
    const CHUNK_SIZE = 500;
    for (let i = 0; i < parsedRows.length; i += CHUNK_SIZE) {
        const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
        const { error: insErr } = await supabase.from("conferme_sap").insert(chunk);
        if (insErr) {
            console.error(`Error inserting chunk ${i}:`, insErr);
            process.exit(1);
        }
        console.log(`Imported ${i + chunk.length}/${parsedRows.length} rows...`);
    }

    console.log("Import completed successfully.");
}

main().catch(console.error);
