import { MACCHINE } from './constants';

export const generateDipendenti = () => [

    // Team 11 - SOFT (Cianci)
    { id: "D002", nome: "Gianluca", cognome: "Andronico", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D003", nome: "Angelo", cognome: "Bavaro", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D004", nome: "Francesco", cognome: "Buttiglione", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D007", nome: "Gaetano", cognome: "Catalano", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D009", nome: "Piero", cognome: "Cianci", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "capoturno", l104: "" },
    { id: "D011", nome: "Angelo", cognome: "De Florio", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D016", nome: "Gabriele", cognome: "Giachetti", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D018", nome: "Elisabetta", cognome: "Giovannielli", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D021", nome: "Gabriele Cosimo", cognome: "Maglie", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D022", nome: "Davide", cognome: "Marinotti", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "no+no t..." },
    { id: "D023", nome: "Emanuele", cognome: "Marrone", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D024", nome: "Isidoro", cognome: "Mezzina", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D030", nome: "Dino", cognome: "Passaquindici", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "SI + NO ..." },
    { id: "D032", nome: "Piero", cognome: "Rotondi", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D033", nome: "Alessandro", cognome: "Sibillano", turno: "D", reparto: "T11", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },

    // Team 12 - HARD (Cappelluti)
    { id: "D005", nome: "Francesco", cognome: "Cappelluti", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "capoturno", l104: "" },
    { id: "D006", nome: "Vincenzo", cognome: "Carapezza", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "no + solo..." },
    { id: "D008", nome: "Saverio", cognome: "Catalano", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D010", nome: "Giuseppe", cognome: "Cimmarusti", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D012", nome: "Marco", cognome: "Del Console", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D013", nome: "Michele", cognome: "Di Marzo", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D017", nome: "Gianpaolo", cognome: "Giorgio", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D019", nome: "Mimmo", cognome: "Giuliano", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D0191", nome: "Andrea", cognome: "Grandolfo", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D026", nome: "Paolo", cognome: "Morgese", turno: "D", reparto: "T13", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "104 x 2" },
    { id: "D027", nome: "Rocco Enrico", cognome: "Mundo", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D029", nome: "Alessandro", cognome: "Parisi", turno: "B", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "SI + ESE..." },
    { id: "D031", nome: "Agata Antonia", cognome: "Petroni", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D034", nome: "Stefano", cognome: "Spadavecchia", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
    { id: "D036", nome: "Rosa", cognome: "Viele", turno: "D", reparto: "T12", tipo: "indeterminato", competenze: [], ruolo: "operatore", l104: "" },
];

export const generateAssegnazioni = (dipendenti) => {
    const assegnazioni = [];
    const presenze = [];
    const today = new Date().toISOString().split("T")[0];

    dipendenti.forEach((d) => {
        presenze.push({
            dipendenteId: d.id,
            data: today,
            turno: d.turno || "D",
            presente: true,
            motivoAssenza: null,
        });

        // Initialize competencies if empty (for mock realism)
        if (!d.competenze || Object.keys(d.competenze).length === 0) {
            d.competenze = MACCHINE.slice(0, 15).reduce((acc, m) => {
                if (Math.random() > 0.6) {
                    acc[m.id] = Math.floor(Math.random() * 7); // 0-6 range
                }
                return acc;
            }, {});
        }

        if (d.ruolo === "operatore") {
            // Assign to a random machine in their reparto
            const macchineReparto = MACCHINE.filter((m) => m.reparto === d.reparto);
            if (macchineReparto.length > 0) {
                const macchina = macchineReparto[Math.floor(Math.random() * macchineReparto.length)];
                assegnazioni.push({
                    id: `ASS-${d.id}`,
                    dipendenteId: d.id,
                    macchinaId: macchina.id,
                    data: today,
                    turno: d.turno || "D",
                    note: "",
                });
            }
        }
    });

    return { assegnazioni, presenze };
};
