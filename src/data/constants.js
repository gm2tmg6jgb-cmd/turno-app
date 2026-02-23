// Groups (Squadre) - They rotate
export const TURNI = [
    { id: "A", nome: "Turno A", colore: "#F59E0B" },
    { id: "B", nome: "Turno B", colore: "#3B82F6" },
    { id: "C", nome: "Turno C", colore: "#6366F1" },
    { id: "D", nome: "Turno D", colore: "#10B981" },
];

// Time Slots (Orari Fissi)
export const ORARI_TURNI = [
    { id: "M", nome: "Mattina", label: "Mattina", orario: "06:00 – 12:00", order: 0 },
    { id: "P", nome: "Pomeriggio", label: "Pomeriggio", orario: "12:00 – 18:00", order: 1 },
    { id: "S", nome: "Sera", label: "Sera", orario: "18:00 – 24:00", order: 2 },
    { id: "N", nome: "Notte", label: "Notte", orario: "00:00 – 06:00", order: 3 },
];

export const REPARTI = [
    { id: "T11", nome: "Team 11 SOFT", tipo: "produzione", colore: "#3B82F6", capoturno: "Cianci" },
    { id: "T12", nome: "Team 12 HARD", tipo: "produzione", colore: "#3B82F6", capoturno: "Cappelluti" },
    { id: "T13", nome: "Team 13 RG + DH", tipo: "produzione", colore: "#3B82F6", capoturno: "Ferrandes" },
];

export const ZONE = [
    // Team 11
    { id: "Z1", label: "Z1 - Tornitura Soft", reparto: "T11" },
    { id: "Z2", label: "Z2 - Tornitura Soft", reparto: "T11" },
    { id: "Z3", label: "Z3 - Tornitura Soft", reparto: "T11" },
    { id: "Z4", label: "Z4 - Dentatura", reparto: "T11" },
    { id: "Z5", label: "Z5 - Stozzatura/Pressatura", reparto: "T11" },
    { id: "Z6", label: "Z6 - Saldatura", reparto: "T11" },
    { id: "Z7", label: "Z7 - Saldatura", reparto: "T11" },
    { id: "Z8", label: "Z8 - Smussatura", reparto: "T11" },
    { id: "Z9", label: "Z9 - Dentatura", reparto: "T11" },
    { id: "Z10", label: "Z10 - Dentatura", reparto: "T11" },
    { id: "Z11", label: "Z11 - Dentatura", reparto: "T11" },
    { id: "Z12", label: "Z12 - SGS", reparto: "T11" },
    { id: "Z13", label: "Z13 - Brocciatura/SGS", reparto: "T11" },
    { id: "Z14", label: "Z14 - Marcatura", reparto: "T11" },
    // Team 12
    { id: "Z15", label: "Z15 - Tornitura Hard", reparto: "T12" },
    { id: "Z16", label: "Z16 - Tornitura Hard", reparto: "T12" },
    { id: "Z17", label: "Z17 - Tornitura Hard", reparto: "T12" },
    { id: "Z18", label: "Z18 - Tornitura Hard", reparto: "T12" },
    { id: "Z19", label: "Z19 - Rettifica Denti", reparto: "T12" },
    { id: "Z20", label: "Z20 - Rettifica Denti", reparto: "T12" },
    { id: "Z21", label: "Z21 - Rettifica Denti", reparto: "T12" },
    { id: "Z22", label: "Z22 - Torno Rettifica", reparto: "T12" },
    { id: "Z23", label: "Z23 - Torno Rettifica", reparto: "T12" },
    { id: "Z24", label: "Z24 - Torno Rettifica", reparto: "T12" },
    { id: "Z25", label: "Z25 - Torno Rettifica/Lavatrice", reparto: "T12" },
    { id: "Z26", label: "Z26 - UT", reparto: "T12" },
    // Team 13
    { id: "Z27", label: "Z27 - Tornitura/Dentatura RG", reparto: "T13" },
    { id: "Z28", label: "Z28 - Smussatura/Foratura RG", reparto: "T13" },
    { id: "Z29", label: "Z29 - Tornitura/Rettifica RG", reparto: "T13" },
    { id: "Z30", label: "Z30 - Rettifica Denti/Tornitura", reparto: "T13" },
    { id: "Z31", label: "Z31 - Tornitura DH Sinus", reparto: "T13" },
    { id: "Z32", label: "Z32 - Assembly/Laser DH", reparto: "T13" },
    { id: "Z33", label: "Z33 - Marcatura", reparto: "T13" },
    { id: "Z34", label: "Z34 - Misurazioni", reparto: "T13" },
];

export const MACCHINE = [
    // Team 11 - SOFT
    { id: "DRA10061", nome: "DRA10061", reparto: "T11", zona: "Z1", personaleMinimo: 1 },
    { id: "DRA10062", nome: "DRA10062", reparto: "T11", zona: "Z1", personaleMinimo: 1 },
    { id: "DRA10063", nome: "DRA10063", reparto: "T11", zona: "Z1", personaleMinimo: 1 },
    { id: "DRA10065", nome: "DRA10065", reparto: "T11", zona: "Z2", personaleMinimo: 1 },
    { id: "DRA10069", nome: "DRA10069", reparto: "T11", zona: "Z2", personaleMinimo: 1 },
    { id: "DRA10067", nome: "DRA10067", reparto: "T11", zona: "Z3", personaleMinimo: 1 },
    { id: "DRA10071", nome: "DRA10071", reparto: "T11", zona: "Z3", personaleMinimo: 1 },
    { id: "DRA10060", nome: "DRA10060", reparto: "T11", zona: "Z3", personaleMinimo: 1 },
    { id: "FRW11042", nome: "FRW11042", reparto: "T11", zona: "Z4", personaleMinimo: 1 },
    { id: "DRA10072", nome: "DRA10072", reparto: "T11", zona: "Z4", personaleMinimo: 1 },
    { id: "FRW11060", nome: "FRW11060", reparto: "T11", zona: "Z4", personaleMinimo: 1 },
    { id: "STW11002", nome: "STW11002", reparto: "T11", zona: "Z5", personaleMinimo: 1 },
    { id: "FRA11025", nome: "FRA11025", reparto: "T11", zona: "Z5", personaleMinimo: 1 },
    { id: "SCA10191", nome: "SCA10191", reparto: "T11", zona: "Z6", personaleMinimo: 1 },
    { id: "SCA11006", nome: "SCA11006", reparto: "T11", zona: "Z6", personaleMinimo: 1 },
    { id: "FRW10074", nome: "FRW10074", reparto: "T11", zona: "Z6", personaleMinimo: 1 },
    { id: "SCA11008", nome: "SCA11008", reparto: "T11", zona: "Z7", personaleMinimo: 1 },
    { id: "SDA11010", nome: "SDA11010", reparto: "T11", zona: "Z7", personaleMinimo: 1 },
    { id: "EGW11006", nome: "EGW11006", reparto: "T11", zona: "Z8", personaleMinimo: 1 },
    { id: "FRW10103", nome: "FRW10103", reparto: "T11", zona: "Z9", personaleMinimo: 1 },
    { id: "FRW11013", nome: "FRW11013", reparto: "T11", zona: "Z9", personaleMinimo: 1 },
    { id: "FRW11032", nome: "FRW11032", reparto: "T11", zona: "Z9", personaleMinimo: 1 },
    { id: "FRW10079", nome: "FRW10079", reparto: "T11", zona: "Z9", personaleMinimo: 1 },
    { id: "FRW11016", nome: "FRW11016", reparto: "T11", zona: "Z10", personaleMinimo: 1 },
    { id: "FRW11017", nome: "FRW11017", reparto: "T11", zona: "Z10", personaleMinimo: 1 },
    { id: "FRW10052", nome: "FRW10052", reparto: "T11", zona: "Z11", personaleMinimo: 1 },
    { id: "FRW10051", nome: "FRW10051", reparto: "T11", zona: "Z11", personaleMinimo: 1 },
    { id: "FRW10073", nome: "FRW10073", reparto: "T11", zona: "Z11", personaleMinimo: 1 },
    { id: "FRW10077", nome: "FRW10077", reparto: "T11", zona: "Z11", personaleMinimo: 1 }, // Rossa
    { id: "STW10089", nome: "STW10089", reparto: "T11", zona: "Z12", personaleMinimo: 1 },
    { id: "FRD10060", nome: "FRD10060", reparto: "T11", zona: "Z12", personaleMinimo: 1 },
    { id: "STW12177", nome: "STW12177", reparto: "T11", zona: "Z13", personaleMinimo: 1 },
    { id: "FRD10013", nome: "FRD10013", reparto: "T11", zona: "Z13", personaleMinimo: 1 },
    { id: "ZBA11019", nome: "Marcatrice", reparto: "T11", zona: "Z14", personaleMinimo: 1 },

    // Team 12 - HARD
    { id: "DRA10102", nome: "DRA10102-108", reparto: "T12", zona: "Z15", personaleMinimo: 1 },
    { id: "DRA10099", nome: "DRA10099-105", reparto: "T12", zona: "Z16", personaleMinimo: 1 },
    { id: "DRA10097", nome: "DRA10097-08", reparto: "T12", zona: "Z16", personaleMinimo: 1 },
    { id: "DRA10101", nome: "DRA10101-107", reparto: "T12", zona: "Z17", personaleMinimo: 1 },
    { id: "DRA10113", nome: "DRA10113-114", reparto: "T12", zona: "Z17", personaleMinimo: 1 },
    { id: "DRA10110", nome: "DRA10110-111", reparto: "T12", zona: "Z17", personaleMinimo: 1 },
    { id: "DRA10115", nome: "DRA10115", reparto: "T12", zona: "Z18", personaleMinimo: 1 },
    { id: "DRA10119", nome: "DRA10119", reparto: "T12", zona: "Z18", personaleMinimo: 1 }, // Gialla
    { id: "SLW11048", nome: "SLW11048", reparto: "T12", zona: "Z19", personaleMinimo: 1 }, // Gialla
    { id: "SLW11044", nome: "SLW11044", reparto: "T12", zona: "Z19", personaleMinimo: 1 },
    { id: "SLW11009", nome: "SLW11009", reparto: "T12", zona: "Z19", personaleMinimo: 1 },
    { id: "SLW11014", nome: "SLW11014", reparto: "T12", zona: "Z19", personaleMinimo: 1 },
    { id: "SLW11017", nome: "SLW11017", reparto: "T12", zona: "Z20", personaleMinimo: 1 },
    { id: "SLW11027", nome: "SLW11027", reparto: "T12", zona: "Z20", personaleMinimo: 1 },
    { id: "SLW11011", nome: "SLW11011", reparto: "T12", zona: "Z20", personaleMinimo: 1 },
    { id: "SLW11012", nome: "SLW11012", reparto: "T12", zona: "Z21", personaleMinimo: 1 },
    { id: "SLW11015", nome: "SLW11015", reparto: "T12", zona: "Z21", personaleMinimo: 1 },
    { id: "SLA11064", nome: "SLA11064", reparto: "T12", zona: "Z22", personaleMinimo: 1 },
    { id: "SLA11063", nome: "SLA11063", reparto: "T12", zona: "Z22", personaleMinimo: 1 },
    { id: "SLA11065", nome: "SLA11065", reparto: "T12", zona: "Z22", personaleMinimo: 1 },
    { id: "SLA11108", nome: "SLA11108", reparto: "T12", zona: "Z22", personaleMinimo: 1 },
    { id: "SLA11118", nome: "SLA11118", reparto: "T12", zona: "Z23", personaleMinimo: 1 },
    { id: "SLA11057", nome: "SLA11057", reparto: "T12", zona: "Z23", personaleMinimo: 1 },
    { id: "SLA11059", nome: "SLA11059", reparto: "T12", zona: "Z23", personaleMinimo: 1 },
    { id: "SLA11109", nome: "SLA11109", reparto: "T12", zona: "Z24", personaleMinimo: 1 },
    { id: "SLA11050", nome: "SLA11050", reparto: "T12", zona: "Z24", personaleMinimo: 1 },
    { id: "SLA11092", nome: "SLA11092", reparto: "T12", zona: "Z25", personaleMinimo: 1 },
    { id: "SLA11091", nome: "SLA11091", reparto: "T12", zona: "Z25", personaleMinimo: 1 },
    { id: "MZA11006", nome: "MZA11006", reparto: "T12", zona: "Z26", personaleMinimo: 1 },

    // Team 13 - RG + DH
    { id: "DRA10058", nome: "DRA10058", reparto: "T13", zona: "Z27", personaleMinimo: 1 },
    { id: "DRA10059", nome: "DRA10059", reparto: "T13", zona: "Z27", personaleMinimo: 1 },
    { id: "FRW10109", nome: "FRW10109", reparto: "T13", zona: "Z27", personaleMinimo: 1 },
    { id: "FRW10073_13", nome: "FRW10073 (T13)", reparto: "T13", zona: "Z27", personaleMinimo: 1 },
    { id: "EGW11007", nome: "EGW11007", reparto: "T13", zona: "Z27", personaleMinimo: 1 },
    { id: "BOA10094", nome: "BOA10094", reparto: "T13", zona: "Z27", personaleMinimo: 1 },
    { id: "DRA4FRW15", nome: "Mini DPF", reparto: "T13", zona: "Z28", personaleMinimo: 1 },
    { id: "DRA10100", nome: "DRA10100", reparto: "T13", zona: "Z29", personaleMinimo: 1 },
    { id: "DRA11037", nome: "DRA11037", reparto: "T13", zona: "Z29", personaleMinimo: 1 },
    { id: "SLW11045", nome: "SLW11045", reparto: "T13", zona: "Z30", personaleMinimo: 1 }, // Ex T12 in T13 area
    { id: "DRA10096", nome: "DRA10096", reparto: "T13", zona: "Z30", personaleMinimo: 1 },
    { id: "SLW11125", nome: "SLW11125", reparto: "T13", zona: "Z30", personaleMinimo: 1 },
    { id: "DRA11130", nome: "DRA11130", reparto: "T13", zona: "Z31", personaleMinimo: 1 },
    { id: "DRA11131", nome: "DRA11131", reparto: "T13", zona: "Z31", personaleMinimo: 1 },
    { id: "DRA11132", nome: "DRA11132", reparto: "T13", zona: "Z31", personaleMinimo: 1 },
    { id: "MON12051", nome: "MON12051", reparto: "T13", zona: "Z32", personaleMinimo: 1 },
    { id: "SCA11051", nome: "SCA11051", reparto: "T13", zona: "Z32", personaleMinimo: 1 },
    { id: "ZBA11022", nome: "Marcatrice", reparto: "T13", zona: "Z33", personaleMinimo: 1 },
    { id: "MISURE", nome: "Misurazioni", reparto: "T13", zona: "Z34", personaleMinimo: 1 },
];

export const MOTIVI_ASSENZA = [
    { id: "ferie", label: "Ferie", sigla: "F", colore: "#10B981", icona: "🏖️" },
    { id: "malattia", label: "Malattia", sigla: "M", colore: "#EF4444", icona: "🤒" },
    { id: "permesso", label: "Permesso", sigla: "P", colore: "#F59E0B", icona: "📋" },
    { id: "rol", label: "ROL", sigla: "R", colore: "#8B5CF6", icona: "🕐" },
    { id: "infortunio", label: "Infortunio", sigla: "I", colore: "#DC2626", icona: "🏥" },
    { id: "congedo", label: "Congedo Parentale", sigla: "CP", colore: "#EC4899", icona: "👶" },
    { id: "l104", label: "Legge 104", sigla: "104", colore: "#6366F1", icona: "📑" },
    { id: "formazione", label: "Formazione", sigla: "FO", colore: "#3B82F6", icona: "📚" },
    { id: "altro", label: "Altro", sigla: "A", colore: "#6B7280", icona: "📌" },
];

export const LIVELLI_COMPETENZA = [
    { value: 0, label: "Non formato", color: "#374151", icon: "❌" },
    { value: 1, label: "Addestramento", color: "#94A3B8", icon: "🐣" },
    { value: 2, label: "Base", color: "#F59E0B", icon: "⭐" },
    { value: 3, label: "Intermedio", color: "#3B82F6", icon: "⭐⭐" },
    { value: 4, label: "Autonomo", color: "#8B5CF6", icon: "💎" },
    { value: 5, label: "Avanzato", color: "#10B981", icon: "👑" },
    { value: 6, label: "Esperto/Formatore", color: "#EF4444", icon: "🔥" },
];
export const ATTIVITA = [
    { id: "A1", nome: "Formazione", icona: "📚", color: "#3B82F6" },
    { id: "A2", nome: "Misurazioni", icona: "📏", color: "#10B981" },
    { id: "A3", nome: "Attività Manuale", icona: "🔧", color: "#F59E0B" },
    { id: "A4", nome: "Pulizia/5S", icona: "🧹", color: "#6366F1" },
    { id: "A5", nome: "Altro", icona: "📌", color: "#6B7280" },
];

export const LIMITAZIONI = [
    { id: "L104", label: "Legge 104", color: "#8B5CF6" },
    { id: "NO_NOTTE", label: "No Turno Notturno", color: "#EF4444" },
    { id: "NO_SOLLEVAMENTO", label: "No Sollevamento Pesi", color: "#F59E0B" },
    { id: "NO_CHIMICO", label: "Rischio Chimico", color: "#10B981" },
    { id: "PART_TIME", label: "Part Time", color: "#3B82F6" },
    { id: "LIMITATO", label: "Limitazioni Generiche", color: "#6B7280" }
];

export const MOTIVI_FERMO = [
    { id: "guasto_meccanico", label: "Guasto Meccanico", colore: "#EF4444", icona: "🔧" },
    { id: "guasto_elettrico", label: "Guasto Elettrico", colore: "#F59E0B", icona: "⚡" },
    { id: "mancanza_materiale", label: "Mancanza Materiale", colore: "#3B82F6", icona: "📦" },
    { id: "attrezzaggio", label: "Attrezzaggio", colore: "#6366F1", icona: "⚙️" },
    { id: "manutenzione", label: "Manutenzione", colore: "#10B981", icona: "🧹" },
    { id: "pausa", label: "Pausa / Riunione", colore: "#6B7280", icona: "☕" },
    { id: "altro", label: "Altro", colore: "#9CA3AF", icona: "📝" },
];
