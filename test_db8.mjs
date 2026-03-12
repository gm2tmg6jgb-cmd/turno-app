import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: anagraficaItems } = await supabase.from('anagrafica_materiali').select('*');
    const anagrafica = {};
    anagraficaItems.forEach(item => {
        anagrafica[item.codice.toUpperCase()] = item;
    });

    const { data: prod, error } = await supabase.from('conferme_sap').select('*').order('data', { ascending: false }).limit(2000);

    if (error) {
        console.error(error);
        return;
    }

    const testMap = [];
    prod.forEach(row => {
        const rawMachineId = row.macchina_id || row.work_center_sap;

        if (rawMachineId === "FRW10079" || rawMachineId === "FRW10193") {
            const info = anagrafica[row.materiale?.toUpperCase()];
            const project = info?.progetto || (row.materiale?.startsWith("M016") ? "DCT Eco" : row.materiale?.startsWith("M015") ? "8Fe" : "DCT 300");
            const compName = info?.componente;
            let key = compName;
            if (project === "DCT Eco") key += "_ECO";
            else if (project === "8Fe") key += "_8FE";

            let targetMachineId = getPrimaryMachineId(rawMachineId); // using raw

            if (rawMachineId === "FRW10193" && (key === "SG3_8FE" || key === "SG4_8FE")) {
                targetMachineId = "FRW10079";
            }

            testMap.push({
                origMachine: rawMachineId,
                mappedMachine: targetMachineId,
                materiale: row.materiale,
                compName: compName,
                project: project,
                finalKey: key
            });
        }
    });

    const unique = [];
    const seen = new Set();
    testMap.forEach(t => {
        const id = t.origMachine + "-" + t.mappedMachine + "-" + t.materiale;
        if (!seen.has(id)) {
            seen.add(id);
            unique.push(t);
        }
    });
    console.table(unique);
}

const TWIN_MACHINES = {
    DRA10063: ["DRA10063", "DRA10064"],
    DRA10065: ["DRA10065", "DRA10066"],
    DRA10067: ["DRA10067", "DRA10068"],
    DRA10069: ["DRA10069", "DRA10070"],
    DRA10097: ["DRA10097", "DRA10098"],
    DRA10099: ["DRA10099", "DRA10100"],
    DRA10101: ["DRA10101", "DRA10107"],
    DRA10102: ["DRA10102", "DRA10108"],
    DRA10110: ["DRA10110", "DRA10111"],
    DRA10113: ["DRA10113", "DRA10114"],
};

function getPrimaryMachineId(machineId) {
    for (const [primary, group] of Object.entries(TWIN_MACHINES)) {
        if (group.includes(machineId)) {
            return primary;
        }
    }
    return machineId;
}

main();
