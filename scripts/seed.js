import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) env[key.trim()] = value.trim();
        });
        return env;
    } catch (e) {
        console.error("❌ Could not read .env file");
        return {};
    }
};

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- DATA CONSTANTS (Copied from src/data/constants.js) ---
const REPARTI = [
    { id: "T11", nome: "Team 11 SOFT", tipo: "produzione", colore: "#3B82F6", capoturno: "Cianci" },
    { id: "T12", nome: "Team 12 HARD", tipo: "produzione", colore: "#3B82F6", capoturno: "Cappelluti" },
    { id: "T13", nome: "Team 13 RG + DH", tipo: "produzione", colore: "#3B82F6", capoturno: "Ferrandes" },
];

const TURNI = [
    { id: "A", nome: "Mattina", orario: "06:00 – 12:00", colore: "#F59E0B" },
    { id: "B", nome: "Pomeriggio", orario: "12:00 – 18:00", colore: "#3B82F6" },
    { id: "C", nome: "Sera", orario: "18:00 – 24:00", colore: "#6366F1" },
    { id: "D", nome: "Notte", orario: "00:00 – 06:00", colore: "#10B981" },
];

const ZONE = [
    { id: "Z1", label: "Z1 - Tornitura Soft", reparto_id: "T11" },
    { id: "Z2", label: "Z2 - Tornitura Soft", reparto_id: "T11" },
    { id: "Z3", label: "Z3 - Tornitura Soft", reparto_id: "T11" },
    { id: "Z4", label: "Z4 - Dentatura", reparto_id: "T11" },
    { id: "Z5", label: "Z5 - Stozzatura/Pressatura", reparto_id: "T11" },
    { id: "Z6", label: "Z6 - Saldatura", reparto_id: "T11" },
    { id: "Z7", label: "Z7 - Saldatura", reparto_id: "T11" },
    { id: "Z8", label: "Z8 - Smussatura", reparto_id: "T11" },
    { id: "Z9", label: "Z9 - Dentatura", reparto_id: "T11" },
    { id: "Z10", label: "Z10 - Dentatura", reparto_id: "T11" },
    { id: "Z11", label: "Z11 - Dentatura", reparto_id: "T11" },
    { id: "Z12", label: "Z12 - SGS", reparto_id: "T11" },
    { id: "Z13", label: "Z13 - Brocciatura/SGS", reparto_id: "T11" },
    { id: "Z14", label: "Z14 - Marcatura", reparto_id: "T11" },
    { id: "Z15", label: "Z15 - Tornitura Hard", reparto_id: "T12" },
    { id: "Z16", label: "Z16 - Tornitura Hard", reparto_id: "T12" },
    { id: "Z17", label: "Z17 - Tornitura Hard", reparto_id: "T12" },
    { id: "Z18", label: "Z18 - Tornitura Hard", reparto_id: "T12" },
    { id: "Z19", label: "Z19 - Rettifica Denti", reparto_id: "T12" },
    { id: "Z20", label: "Z20 - Rettifica Denti", reparto_id: "T12" },
    { id: "Z21", label: "Z21 - Rettifica Denti", reparto_id: "T12" },
    { id: "Z22", label: "Z22 - Torno Rettifica", reparto_id: "T12" },
    { id: "Z23", label: "Z23 - Torno Rettifica", reparto_id: "T12" },
    { id: "Z24", label: "Z24 - Torno Rettifica", reparto_id: "T12" },
    { id: "Z25", label: "Z25 - Torno Rettifica/Lavatrice", reparto_id: "T12" },
    { id: "Z26", label: "Z26 - UT", reparto_id: "T12" },
    { id: "Z27", label: "Z27 - Tornitura/Dentatura RG", reparto_id: "T13" },
    { id: "Z28", label: "Z28 - Smussatura/Foratura RG", reparto_id: "T13" },
    { id: "Z29", label: "Z29 - Tornitura/Rettifica RG", reparto_id: "T13" },
    { id: "Z30", label: "Z30 - Rettifica Denti/Tornitura", reparto_id: "T13" },
    { id: "Z31", label: "Z31 - Tornitura DH Sinus", reparto_id: "T13" },
    { id: "Z32", label: "Z32 - Assembly/Laser DH", reparto_id: "T13" },
    { id: "Z33", label: "Z33 - Marcatura", reparto_id: "T13" },
    { id: "Z34", label: "Z34 - Misurazioni", reparto_id: "T13" },
];

const MACCHINE = [
    { id: "DRA10061", nome: "DRA10061", reparto_id: "T11", zona_id: "Z1", personale_minimo: 1 },
    { id: "DRA10062", nome: "DRA10062", reparto_id: "T11", zona_id: "Z1", personale_minimo: 1 },
    { id: "DRA10063", nome: "DRA10063", reparto_id: "T11", zona_id: "Z1", personale_minimo: 1 },
    { id: "DRA10065", nome: "DRA10065", reparto_id: "T11", zona_id: "Z2", personale_minimo: 1 },
    { id: "DRA10069", nome: "DRA10069", reparto_id: "T11", zona_id: "Z2", personale_minimo: 1 },
    { id: "DRA10067", nome: "DRA10067", reparto_id: "T11", zona_id: "Z3", personale_minimo: 1 },
    { id: "DRA10071", nome: "DRA10071", reparto_id: "T11", zona_id: "Z3", personale_minimo: 1 },
    { id: "DRA10060", nome: "DRA10060", reparto_id: "T11", zona_id: "Z3", personale_minimo: 1 },
    { id: "FRW11042", nome: "FRW11042", reparto_id: "T11", zona_id: "Z4", personale_minimo: 1 },
    { id: "DRA10072", nome: "DRA10072", reparto_id: "T11", zona_id: "Z4", personale_minimo: 1 },
    { id: "FRW11060", nome: "FRW11060", reparto_id: "T11", zona_id: "Z4", personale_minimo: 1 },
    { id: "STW11002", nome: "STW11002", reparto_id: "T11", zona_id: "Z5", personale_minimo: 1 },
    { id: "FRA11025", nome: "FRA11025", reparto_id: "T11", zona_id: "Z5", personale_minimo: 1 },
    { id: "SCA10191", nome: "SCA10191", reparto_id: "T11", zona_id: "Z6", personale_minimo: 1 },
    { id: "SCA11006", nome: "SCA11006", reparto_id: "T11", zona_id: "Z6", personale_minimo: 1 },
    { id: "FRW10074", nome: "FRW10074", reparto_id: "T11", zona_id: "Z6", personale_minimo: 1 },
    { id: "SCA11008", nome: "SCA11008", reparto_id: "T11", zona_id: "Z7", personale_minimo: 1 },
    { id: "SDA11010", nome: "SDA11010", reparto_id: "T11", zona_id: "Z7", personale_minimo: 1 },
    { id: "EGW11006", nome: "EGW11006", reparto_id: "T11", zona_id: "Z8", personale_minimo: 1 },
    { id: "FRW10103", nome: "FRW10103", reparto_id: "T11", zona_id: "Z9", personale_minimo: 1 },
    { id: "FRW11013", nome: "FRW11013", reparto_id: "T11", zona_id: "Z9", personale_minimo: 1 },
    { id: "FRW11032", nome: "FRW11032", reparto_id: "T11", zona_id: "Z9", personale_minimo: 1 },
    { id: "FRW10079", nome: "FRW10079", reparto_id: "T11", zona_id: "Z9", personale_minimo: 1 },
    { id: "FRW11016", nome: "FRW11016", reparto_id: "T11", zona_id: "Z10", personale_minimo: 1 },
    { id: "FRW11017", nome: "FRW11017", reparto_id: "T11", zona_id: "Z10", personale_minimo: 1 },
    { id: "FRW10052", nome: "FRW10052", reparto_id: "T11", zona_id: "Z11", personale_minimo: 1 },
    { id: "FRW10051", nome: "FRW10051", reparto_id: "T11", zona_id: "Z11", personale_minimo: 1 },
    { id: "FRW10073", nome: "FRW10073", reparto_id: "T11", zona_id: "Z11", personale_minimo: 1 },
    { id: "FRW10077", nome: "FRW10077", reparto_id: "T11", zona_id: "Z11", personale_minimo: 1 },
    { id: "STW10089", nome: "STW10089", reparto_id: "T11", zona_id: "Z12", personale_minimo: 1 },
    { id: "FRD10060", nome: "FRD10060", reparto_id: "T11", zona_id: "Z12", personale_minimo: 1 },
    { id: "STW12177", nome: "STW12177", reparto_id: "T11", zona_id: "Z13", personale_minimo: 1 },
    { id: "FRD10013", nome: "FRD10013", reparto_id: "T11", zona_id: "Z13", personale_minimo: 1 },
    { id: "ZBA11019", nome: "Marcatrice", reparto_id: "T11", zona_id: "Z14", personale_minimo: 1 },
    { id: "DRA10102", nome: "DRA10102-108", reparto_id: "T12", zona_id: "Z15", personale_minimo: 1 },
    { id: "DRA10099", nome: "DRA10099-105", reparto_id: "T12", zona_id: "Z16", personale_minimo: 1 },
    { id: "DRA10097", nome: "DRA10097-08", reparto_id: "T12", zona_id: "Z16", personale_minimo: 1 },
    { id: "DRA10101", nome: "DRA10101-107", reparto_id: "T12", zona_id: "Z17", personale_minimo: 1 },
    { id: "DRA10113", nome: "DRA10113-114", reparto_id: "T12", zona_id: "Z17", personale_minimo: 1 },
    { id: "DRA10110", nome: "DRA10110-111", reparto_id: "T12", zona_id: "Z17", personale_minimo: 1 },
    { id: "DRA10115", nome: "DRA10115", reparto_id: "T12", zona_id: "Z18", personale_minimo: 1 },
    { id: "DRA10119", nome: "DRA10119", reparto_id: "T12", zona_id: "Z18", personale_minimo: 1 },
    { id: "SLW11048", nome: "SLW11048", reparto_id: "T12", zona_id: "Z19", personale_minimo: 1 },
    { id: "SLW11044", nome: "SLW11044", reparto_id: "T12", zona_id: "Z19", personale_minimo: 1 },
    { id: "SLW11009", nome: "SLW11009", reparto_id: "T12", zona_id: "Z19", personale_minimo: 1 },
    { id: "SLW11014", nome: "SLW11014", reparto_id: "T12", zona_id: "Z19", personale_minimo: 1 },
    { id: "SLW11017", nome: "SLW11017", reparto_id: "T12", zona_id: "Z20", personale_minimo: 1 },
    { id: "SLW11027", nome: "SLW11027", reparto_id: "T12", zona_id: "Z20", personale_minimo: 1 },
    { id: "SLW11011", nome: "SLW11011", reparto_id: "T12", zona_id: "Z20", personale_minimo: 1 },
    { id: "SLW11012", nome: "SLW11012", reparto_id: "T12", zona_id: "Z21", personale_minimo: 1 },
    { id: "SLW11015", nome: "SLW11015", reparto_id: "T12", zona_id: "Z21", personale_minimo: 1 },
    { id: "SLA11064", nome: "SLA11064", reparto_id: "T12", zona_id: "Z22", personale_minimo: 1 },
    { id: "SLA11063", nome: "SLA11063", reparto_id: "T12", zona_id: "Z22", personale_minimo: 1 },
    { id: "SLA11065", nome: "SLA11065", reparto_id: "T12", zona_id: "Z22", personale_minimo: 1 },
    { id: "SLA11108", nome: "SLA11108", reparto_id: "T12", zona_id: "Z22", personale_minimo: 1 },
    { id: "SLA11118", nome: "SLA11118", reparto_id: "T12", zona_id: "Z23", personale_minimo: 1 },
    { id: "SLA11057", nome: "SLA11057", reparto_id: "T12", zona_id: "Z23", personale_minimo: 1 },
    { id: "SLA11059", nome: "SLA11059", reparto_id: "T12", zona_id: "Z23", personale_minimo: 1 },
    { id: "SLA11109", nome: "SLA11109", reparto_id: "T12", zona_id: "Z24", personale_minimo: 1 },
    { id: "SLA11050", nome: "SLA11050", reparto_id: "T12", zona_id: "Z24", personale_minimo: 1 },
    { id: "SLA11092", nome: "SLA11092", reparto_id: "T12", zona_id: "Z25", personale_minimo: 1 },
    { id: "SLA11091", nome: "SLA11091", reparto_id: "T12", zona_id: "Z25", personale_minimo: 1 },
    { id: "MZA11006", nome: "MZA11006", reparto_id: "T12", zona_id: "Z26", personale_minimo: 1 },
    { id: "DRA10058", nome: "DRA10058", reparto_id: "T13", zona_id: "Z27", personale_minimo: 1 },
    { id: "DRA10059", nome: "DRA10059", reparto_id: "T13", zona_id: "Z27", personale_minimo: 1 },
    { id: "FRW10109", nome: "FRW10109", reparto_id: "T13", zona_id: "Z27", personale_minimo: 1 },
    { id: "FRW10073_13", nome: "FRW10073 (T13)", reparto_id: "T13", zona_id: "Z27", personale_minimo: 1 },
    { id: "EGW11007", nome: "EGW11007", reparto_id: "T13", zona_id: "Z27", personale_minimo: 1 },
    { id: "BOA10094", nome: "BOA10094", reparto_id: "T13", zona_id: "Z27", personale_minimo: 1 },
    { id: "DRA4FRW15", nome: "Mini DPF", reparto_id: "T13", zona_id: "Z28", personale_minimo: 1 },
    { id: "DRA10100", nome: "DRA10100", reparto_id: "T13", zona_id: "Z29", personale_minimo: 1 },
    { id: "DRA11037", nome: "DRA11037", reparto_id: "T13", zona_id: "Z29", personale_minimo: 1 },
    { id: "SLW11045", nome: "SLW11045", reparto_id: "T13", zona_id: "Z30", personale_minimo: 1 },
    { id: "DRA10096", nome: "DRA10096", reparto_id: "T13", zona_id: "Z30", personale_minimo: 1 },
    { id: "SLW11125", nome: "SLW11125", reparto_id: "T13", zona_id: "Z30", personale_minimo: 1 },
    { id: "DRA11130", nome: "DRA11130", reparto_id: "T13", zona_id: "Z31", personale_minimo: 1 },
    { id: "DRA11131", nome: "DRA11131", reparto_id: "T13", zona_id: "Z31", personale_minimo: 1 },
    { id: "DRA11132", nome: "DRA11132", reparto_id: "T13", zona_id: "Z31", personale_minimo: 1 },
    { id: "MON12051", nome: "MON12051", reparto_id: "T13", zona_id: "Z32", personale_minimo: 1 },
    { id: "SCA11051", nome: "SCA11051", reparto_id: "T13", zona_id: "Z32", personale_minimo: 1 },
    { id: "ZBA11022", nome: "Marcatrice", reparto_id: "T13", zona_id: "Z33", personale_minimo: 1 },
    { id: "MISURE", nome: "Misurazioni", reparto_id: "T13", zona_id: "Z34", personale_minimo: 1 },
];

const ATTIVITA = [
    { id: "A1", nome: "Formazione", icona: "📚", color: "#3B82F6" },
    { id: "A2", nome: "Misurazioni", icona: "📏", color: "#10B981" },
    { id: "A3", nome: "Attività Manuale", icona: "🔧", color: "#F59E0B" },
    { id: "A4", nome: "Pulizia/5S", icona: "🧹", color: "#6366F1" },
    { id: "A5", nome: "Altro", icona: "📌", color: "#6B7280" },
];

// --- MOCK DATA (Copied from src/data/mockData.js) ---
const DIPENDENTI = [
    { id: "D001", nome: "Michele", cognome: "Addabbo", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D014", nome: "Fabio", cognome: "Ferrandes", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "capoturno", l104: "" },
    { id: "D015", nome: "Nicola", cognome: "Fortunato", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D020", nome: "Nicholas Vincenzo", cognome: "Laghezza", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D025", nome: "Alessio", cognome: "Montrone", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D028", nome: "Flavio", cognome: "Nanocchio", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D035", nome: "Vincenzo", cognome: "Tesoriere", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D002", nome: "Gianluca", cognome: "Andronico", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D003", nome: "Angelo", cognome: "Bavaro", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D004", nome: "Francesco", cognome: "Buttiglione", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D007", nome: "Gaetano", cognome: "Catalano", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D009", nome: "Piero", cognome: "Cianci", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "capoturno", l104: "" },
    { id: "D011", nome: "Angelo", cognome: "De Florio", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D016", nome: "Gabriele", cognome: "Giachetti", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D018", nome: "Elisabetta", cognome: "Giovannielli", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D021", nome: "Gabriele Cosimo", cognome: "Maglie", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D022", nome: "Davide", cognome: "Marinotti", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "no+no t..." },
    { id: "D023", nome: "Emanuele", cognome: "Marrone", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D024", nome: "Isidoro", cognome: "Mezzina", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D030", nome: "Dino", cognome: "Passaquindici", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "SI + NO ..." },
    { id: "D032", nome: "Piero", cognome: "Rotondi", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D033", nome: "Alessandro", cognome: "Sibillano", turno_default: "D", reparto_id: "T11", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D005", nome: "Francesco", cognome: "Cappelluti", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "capoturno", l104: "" },
    { id: "D006", nome: "Vincenzo", cognome: "Carapezza", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "no + solo..." },
    { id: "D008", nome: "Saverio", cognome: "Catalano", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D010", nome: "Giuseppe", cognome: "Cimmarusti", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D012", nome: "Marco", cognome: "Del Console", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D013", nome: "Michele", cognome: "Di Marzo", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D017", nome: "Gianpaolo", cognome: "Giorgio", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D019", nome: "Mimmo", cognome: "Giuliano", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D0191", nome: "Andrea", cognome: "Grandolfo", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D026", nome: "Paolo", cognome: "Morgese", turno_default: "D", reparto_id: "T13", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "104 x 2" },
    { id: "D027", nome: "Rocco Enrico", cognome: "Mundo", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D029", nome: "Alessandro", cognome: "Parisi", turno_default: "B", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "SI + ESE..." },
    { id: "D031", nome: "Agata Antonia", cognome: "Petroni", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D034", nome: "Stefano", cognome: "Spadavecchia", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
    { id: "D036", nome: "Rosa", cognome: "Viele", turno_default: "D", reparto_id: "T12", tipo: "indeterminato", competenze: {}, ruolo: "operatore", l104: "" },
];

async function seed() {
    console.log("🌱 Starting Seed...");

    // 1. Reparti
    console.log("... Seeding Reparti");
    await supabase.from('reparti').upsert(REPARTI);

    // 2. Turni
    console.log("... Seeding Turni");
    await supabase.from('turni').upsert(TURNI);

    // 3. Zone
    console.log("... Seeding Zone");
    await supabase.from('zone').upsert(ZONE);

    // 4. Attività
    console.log("... Seeding Attività");
    await supabase.from('attivita').upsert(ATTIVITA);

    // 5. Macchine
    console.log("... Seeding Macchine");
    await supabase.from('macchine').upsert(MACCHINE);

    // 6. Dipendenti
    console.log("... Seeding Dipendenti");
    await supabase.from('dipendenti').upsert(DIPENDENTI);

    console.log("🏁 Seed complete!");
}

seed().catch(e => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
});
