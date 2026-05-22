import React, { useState, useEffect, useMemo } from "react";
import Modal from "../components/Modal";

const ALL_MACHINES_ORDER = [
  "DRA10060","DRA10061","DRA10062","DRA10063","DRA10064","DRA10065","DRA10066",
  "DRA10067","DRA10068","DRA10069","DRA10070","DRA10071","DRA10072","DRA11042",
  "FRW10193","FRW10217","FRW10076","FRW10077","FRW10078","FRW12464","FRW10074","FRW10075",
  "FRW10082","FRW10140","FRW10079","FRW11980","FRW10081","FRW11010","FRW11022",
  "FRW11016","FRW11017","EGW11005","EGW11008","EGW11014","EGW11015","EGW11016",
  "SCA11008","SCA11009","SCA11010","SCA10151","SCA11006","MZA11005","MZA11006",
  "MZA11008","MZA10005","STW11002","STW11007","STW19069","STW12177","FRD19013",
  "FRD19060","ORE19068","RAA11009","FRA11023","FRA11025","DRA10110","DRA10111",
  "DRA10116","DRA10106","DRA10102","DRA10108","DRA10099","DRA10100","DRA19009",
  "DRA10097","DRA10098","DRA10101","DRA10107","DRA11016","DRA10113","DRA10114",
  "DRA10109","DRA14530","SLW11011","SLW11012","SLW11046","SLW11126","SLW11044",
  "SLW11009","SLW11010","SLW11017","SLW11014","SLW11027","SLW11026","SLW11028",
  "SLW11013","SLW11048","HNW16040","SLA11083","SLA11084","SLA11085","SLA11086",
  "SLA11087","SLA11088","SLA11089","SLA11090","SLA11091","SLA11092","SLA11108",
  "SLA11109","SLA11110","SCA10078","DRA10058","DRA10059","DRA11044","FRW10189",
  "FRW10073","FRW11015","EGW11006","EGW11007","BOA394","DRA10096","DRA10190",
  "DRA11837","SLW11018","SLW11019","SLW11029","DRA11130","DRA11131","DRA11132",
  "DRA11133","ORE11103","MON12551","SCA11051","ZSA11019","ZSA11022",
];
import { supabase } from "../lib/supabase";
import { formatItalianDate } from "../lib/dateUtils";
import { exportProductionReport } from "../lib/excelExport";

// Helper: Parsare codici che potrebbero venire come array o come stringa raw PostgreSQL
function parseCodicisArray(codici) {
  if (!codici) return [];
  if (Array.isArray(codici)) return codici;
  if (typeof codici === 'string') {
    // Formato raw PostgreSQL: {cod1,cod2} oppure JSON: ["cod1","cod2"]
    if (codici.startsWith('{') && codici.endsWith('}')) {
      // Raw PostgreSQL array format: {item1,item2}
      return codici.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }
    try {
      // Prova a parsare come JSON
      const parsed = JSON.parse(codici);
      return Array.isArray(parsed) ? parsed : [codici];
    } catch {
      return [codici];
    }
  }
  return [];
}

export default function ProductionReportView({
  macchine = [],
  globalDate,
  turnoCorrente,
  motiviFermo = [],
  tecnologie = [],
  assegnazioni = [],
  dipendenti = [],
}) {
  const [activeTech, setActiveTech] = useState("TUTTO");
  const [loading, setLoading] = useState(true);
  const [anagrafica, setAnagrafica] = useState({});
  const [hoveredCol, setHoveredCol] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportDate, setReportDate] = useState(globalDate || new Date().toISOString().split("T")[0]);
  const [selectedTurno, setSelectedTurno] = useState("ALL");
  const [viewMode, setViewMode] = useState("day"); // "day" o "week"
  const [showFermiView, setShowFermiView] = useState(false);
  const [selectedMachineDowntime, setSelectedMachineDowntime] = useState(null);
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [rawProductionData, setRawProductionData] = useState([]);
  const [rawDowntimeData, setRawDowntimeData] = useState([]);
  // Component configs: array of { id, componente, macchina_id, progetto, codici[], fino }
  const [componentConfigs, setComponentConfigs] = useState([]);
  // Component config modal
  const [editingComponent, setEditingComponent] = useState(null);
  // Machine fino modal (kept as optional fallback)
  const [editingMachine, setEditingMachine] = useState(null);
  // Local overrides for machine fino
  const [localMachineFinos, setLocalMachineFinos] = useState({});
  // Assignments for current date
  const [todayAssignments, setTodayAssignments] = useState([]);
  // Config mode for configuring cells
  const [isConfigMode, setIsConfigMode] = useState(false);
  // Modal inserimento fermo
  const [fermoModal, setFermoModal] = useState(null); // { machineId, machineLabel }
  const [fermoForm, setFermoForm] = useState({ motivo: "", durata: "", note: "" });
  const [savingFermo, setSavingFermo] = useState(false);

  // Note: selectedTurno defaults to ALL and is not auto-synced with turnoCorrente

  // Sync machine finos from prop
  useEffect(() => {
    const initial = {};
    macchine.forEach(m => { if (m.fino) initial[m.id] = m.fino; });
    setLocalMachineFinos(initial);
  }, [macchine]);

  // Fetch component configs (array, supports multiple per componente)
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("componente_report_config").select("*");
      if (!error && data) setComponentConfigs(data);
    };
    load();
  }, []);

  const reloadComponentConfigs = async () => {
    const { data } = await supabase.from("componente_report_config").select("*");
    if (data) {
      // Parsare i codici in caso vengano come stringa raw PostgreSQL
      const parsedData = data.map(cfg => ({
        ...cfg,
        codici: parseCodicisArray(cfg.codici)
      }));
      // DEBUG: Verifica il parsing
      parsedData.forEach(cfg => {
        if (Array.isArray(cfg.codici) && cfg.codici.length > 1) {
          console.log(`[INFO] ${cfg.componente} parsed ${cfg.codici.length} codici:`, cfg.codici);
        }
      });
      setComponentConfigs(parsedData);
    }
  };

  const handleSaveComponentConfig = async () => {
    if (!editingComponent) return;
    const codes = editingComponent.codicisText
      .split(/[,\n]+/)
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);
    const payload = {
      componente: editingComponent.componente,
      macchina_id: editingComponent.macchina_id || null,
      progetto: editingComponent.progetto || null,
      codici: codes,
      fino: editingComponent.fino || null,
    };
    let error;
    if (editingComponent.id) {
      // Update existing row
      ({ error } = await supabase.from("componente_report_config").update(payload).eq("id", editingComponent.id));
    } else {
      // Insert new row
      ({ error } = await supabase.from("componente_report_config").insert([payload]));
    }
    if (!error) {
      await reloadComponentConfigs();
      setEditingComponent(null);
    } else {
      alert("Errore salvataggio: " + error.message);
    }
  };

  const handleDeleteComponentConfig = async (id) => {
    if (!window.confirm("Eliminare questa configurazione?")) return;
    const { error } = await supabase.from("componente_report_config").delete().eq("id", id);
    if (!error) await reloadComponentConfigs();
    else alert("Errore eliminazione: " + error.message);
  };

  const handleSaveMachineFino = async () => {
    if (!editingMachine) return;
    const { error } = await supabase
      .from("macchine")
      .update({ fino: editingMachine.fino || null })
      .eq("id", editingMachine.id);
    if (!error) {
      setLocalMachineFinos(prev => ({ ...prev, [editingMachine.id]: editingMachine.fino }));
      setEditingMachine(null);
    } else {
      alert("Errore salvataggio fino: " + error.message);
    }
  };

  const components = [
    "SG1",
    "DG-REV",
    "DG",
    "SG3",
    "SG4",
    "SG5",
    "SG6",
    "SG7",
    "RW",
    "RG", // DCT 300 (9)
    "SG2",
    "SG3_8FE",
    "SG4_8FE",
    "SG5_8FE",
    "SG6_8FE",
    "SG7_8FE",
    "SG8",
    "SGR",
    "PG",
    "FG5/7",
    "RG_8FE",
    "DH Machine",
    "DH Assembly",
    "DH Welding", // 8Fe (14)
    "SG2_ECO",
    "SG3_ECO",
    "SG4_ECO",
    "SG5_ECO",
    "SGR_ECO",
    "RG_ECO", // DCT ECO (6)
  ];

  // Configuration for Twin Machines (macchine gemellari)
  // Primary Machine -> Array of all machines in the group
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
    ZSA11019: ["ZSA11019", "ZSA11022"],
  };

  // Helper to find the primary machine ID for a given machine ID
  const getPrimaryMachineId = (machineId) => {
    for (const [primary, group] of Object.entries(TWIN_MACHINES)) {
      if (group.includes(machineId)) {
        return primary;
      }
    }
    return machineId; // Return itself if not part of a twin group
  };

  // Helper: Get week dates (Monday to Sunday)
  const getWeekDates = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const formatDate = (dateObj) => dateObj.toISOString().split('T')[0];
    return {
      start: formatDate(monday),
      end: formatDate(sunday),
      dates: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return formatDate(d);
      })
    };
  };

  // Fetch anagrafica once
  useEffect(() => {
    const fetchAnagrafica = async () => {
      const { data, error } = await supabase
        .from("anagrafica_materiali")
        .select("*");
      if (!error && data) {
        const map = {};
        data.forEach((item) => {
          map[item.codice.toUpperCase()] = item;
        });
        setAnagrafica(map);
      }
    };
    fetchAnagrafica();
  }, []);

  // Fetch data when date or shift changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      if (viewMode === "day") {
        // 1. Fetch production data
        let qProd = supabase.from("conferme_sap").select("*").eq("data", reportDate);
        if (selectedTurno !== "ALL") qProd = qProd.eq("turno_id", selectedTurno);

        // 2. Fetch downtime data
        let qDowntime = supabase
          .from("fermi_macchina")
          .select("*")
          .eq("data", reportDate);
        if (selectedTurno !== "ALL") qDowntime = qDowntime.eq("turno_id", selectedTurno);

        const [resProd, resDowntime] = await Promise.all([qProd, qDowntime]);

        setRawProductionData(resProd.data || []);
        setRawDowntimeData(resDowntime.data || []);

        // Filter assignments for this date and shift
        const filtered = assegnazioni.filter(a => {
          if (a.data !== reportDate) return false;
          if (selectedTurno !== "ALL" && a.turno_id !== selectedTurno) return false;
          return true;
        });
        setTodayAssignments(filtered);
      } else {
        // Week mode: fetch data for all days of the week
        const week = getWeekDates(reportDate);

        // Helper: fetch all pages (Supabase default limit 1000 rows)
        const fetchAllPages = async (buildQuery) => {
          const PAGE_SIZE = 1000;
          let allData = [];
          let offset = 0;
          while (true) {
            const { data, error } = await buildQuery(offset, PAGE_SIZE);
            if (error || !data) break;
            allData = allData.concat(data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
          return allData;
        };

        // Fetch production data for the week (paginated)
        const prodData = await fetchAllPages((offset, limit) => {
          let q = supabase.from("conferme_sap").select("*")
            .gte("data", week.start)
            .lte("data", week.end)
            .range(offset, offset + limit - 1);
          if (selectedTurno !== "ALL") q = q.eq("turno_id", selectedTurno);
          return q;
        });

        // Fetch downtime data for the week (paginated)
        const downtimeData = await fetchAllPages((offset, limit) => {
          let q = supabase.from("fermi_macchina").select("*")
            .gte("data", week.start)
            .lte("data", week.end)
            .range(offset, offset + limit - 1);
          if (selectedTurno !== "ALL") q = q.eq("turno_id", selectedTurno);
          return q;
        });

        setRawProductionData(prodData);
        setRawDowntimeData(downtimeData);

        // Filter assignments for the week and shift
        const filtered = assegnazioni.filter(a => {
          if (a.data < week.start || a.data > week.end) return false;
          if (selectedTurno !== "ALL" && a.turno_id !== selectedTurno) return false;
          return true;
        });
        setTodayAssignments(filtered);
      }

      setLoading(false);
    };

    fetchData();
  }, [reportDate, selectedTurno, viewMode, anagrafica, assegnazioni]);

  const saveFermo = async () => {
    if (!fermoForm.motivo) return;
    setSavingFermo(true);
    // Durata è opzionale: se non inserita, salvare 0
    const durataValue = fermoForm.durata && !isNaN(parseInt(fermoForm.durata))
      ? parseInt(fermoForm.durata)
      : 0;
    const turnoId = selectedTurno !== "ALL" ? selectedTurno : (turnoCorrente?.id || null);
    const { error } = await supabase.from("fermi_macchina").insert({
      data: reportDate,
      turno_id: turnoId,
      macchina_id: fermoModal.machineId,
      motivo: fermoForm.motivo,
      durata_minuti: durataValue,
      note: fermoForm.note || null,
    });
    if (error) {
      console.error("Errore salvataggio fermo:", error);
      setSavingFermo(false);
      return;
    }
    if (true) {
      // Ricarica i fermi
      let q = supabase.from("fermi_macchina").select("*").eq("data", reportDate);
      if (selectedTurno !== "ALL") q = q.eq("turno_id", selectedTurno);
      const { data } = await q;
      setRawDowntimeData(data || []);
      setFermoModal(null);
      setFermoForm({ motivo: "", durata: "", note: "" });
    }
    setSavingFermo(false);
  };

  const deleteFermo = async (fermoId) => {
    const { error } = await supabase.from("fermi_macchina").delete().eq("id", fermoId);
    if (!error) {
      // Ricarica i fermi
      let q = supabase.from("fermi_macchina").select("*").eq("data", reportDate);
      if (selectedTurno !== "ALL") q = q.eq("turno_id", selectedTurno);
      const { data } = await q;
      setRawDowntimeData(data || []);
      setSelectedMachineDowntime(null);
    }
  };

  // Dynamic Matrix Calculation based on activeTech and raw data
  const { matrice, detailedProduction, downtimeMap, detailedDowntime } = useMemo(() => {
    const newMatrice = {};
    const newDetailedProduction = {};
    const newDowntimeMap = {};
    const newDetailedDowntime = {};

    const currentTec = tecnologie.find(t => t.id === activeTech || t.label === activeTech);
    const label = currentTec?.label?.toLowerCase() || "";
    const isSoftView = label.includes("tornitura soft");
    const isHardView = label.includes("tornitura hard");

    // Build compound key (fino::mat) → config (machine + component)
    // Primary match: (fino + materiale) uniquely identifies machine + component
    const compoundLookup = {}; // "FINO::MAT" → config
    const matOnlyLookup = {};  // "::MAT" → config (configs without fino)
    componentConfigs.forEach(cfg => {
      if (!cfg.macchina_id) return;
      (cfg.codici || []).forEach(code => {
        const mat = code.toUpperCase();
        if (cfg.fino) {
          compoundLookup[`${cfg.fino.toUpperCase()}::${mat}`] = cfg;
        } else {
          matOnlyLookup[`::${mat}`] = cfg;
        }
      });
    });

    // Build fino → machineId fallback (for records with macchina_id or machine fino set)
    const finoToMachineId = {};
    macchine.forEach(m => {
      const fino = (localMachineFinos[m.id] ?? m.fino);
      if (fino) finoToMachineId[fino.trim().toUpperCase()] = m.id;
    });

    // Process Production
    rawProductionData.forEach((row) => {
      const rawMachineId = row.macchina_id;
      const rowFino = row.fino ? String(row.fino).trim().toUpperCase() : "";
      const mat = String(row.materiale || "").toUpperCase();
      const isSoftMat = mat.endsWith("/S");

      let machineId = null;
      let compKey = null;

      // PRIMARY: compound key match (fino+mat) → gives both machine AND component directly
      const cfgMatch = compoundLookup[`${rowFino}::${mat}`] || matOnlyLookup[`::${mat}`];
      if (cfgMatch) {
        machineId = getPrimaryMachineId(cfgMatch.macchina_id);
        compKey = cfgMatch.componente;
      } else {
        // No manual config found — always skip (never show unconfigurated data)
        return;
      }

      if (!machineId || !compKey) return;

      // Filter components not in the allowed list
      if (!components.includes(compKey)) return;

      // Apply dynamic DRA splitting logic
      if (activeTech !== "TUTTO" && machineId.startsWith("DRA")) {
        if (isSoftView && !isSoftMat) return;
        if (isHardView && isSoftMat) return;
      }

      let targetMachineId = machineId;
      if (rawMachineId === "FRW10193" && (compKey === "SG3_8FE" || compKey === "SG4_8FE")) {
        targetMachineId = "FRW10079";
      }

      if (!newMatrice[targetMachineId]) newMatrice[targetMachineId] = {};
      newMatrice[targetMachineId][compKey] = (newMatrice[targetMachineId][compKey] || 0) + (row.qta_ottenuta || 0);

      if (!newDetailedProduction[targetMachineId]) newDetailedProduction[targetMachineId] = {};
      if (!newDetailedProduction[targetMachineId][compKey]) newDetailedProduction[targetMachineId][compKey] = [];
      newDetailedProduction[targetMachineId][compKey].push({ ...row, _original_machine: rawMachineId || machineId });
    });

    // Process Downtime
    rawDowntimeData.forEach((row) => {
      const rawMachineId = row.macchina_id;
      if (!rawMachineId) return;
      const mId = getPrimaryMachineId(rawMachineId);
      newDowntimeMap[mId] = (newDowntimeMap[mId] || 0) + (row.durata_minuti || 0);
      if (!newDetailedDowntime[mId]) newDetailedDowntime[mId] = [];
      newDetailedDowntime[mId].push({ ...row, _original_machine: rawMachineId });
    });

    return { matrice: newMatrice, detailedProduction: newDetailedProduction, downtimeMap: newDowntimeMap, detailedDowntime: newDetailedDowntime };
  }, [rawProductionData, rawDowntimeData, activeTech, anagrafica, tecnologie, componentConfigs, macchine, localMachineFinos, isConfigMode]);


  const downtimeByTech = useMemo(() => {
    const result = { TUTTO: 0 };
    tecnologie.forEach(t => {
      result[t.id] = 0;
    });

    macchine.forEach((m) => {
      const machineId = m.id.toUpperCase();
      const fermiCount = (detailedDowntime[machineId] || []).length;
      if (fermiCount === 0) return;

      result.TUTTO += fermiCount;

      const machineHasTech = tecnologie.filter(tec => {
        const label = tec.label?.toLowerCase() || "";
        if (label.includes("tornitura soft")) {
          if (machineId.startsWith("DRA")) {
            if (m.tecnologia_id === "tornitura_hard") return false;
            if (m.tecnologia_id === "tornitura_soft") return true;
            const hasSoftData = Object.keys(detailedProduction[machineId] || {}).length > 0;
            if (hasSoftData) return true;
            if (!m.tecnologia_id && tec.prefissi && tec.prefissi.split(',').map(p => p.trim()).includes("DRA")) return true;
            return false;
          }
        }
        return m.tecnologia_id === tec.id || m.tecnologia_id === label || m.zona === tec.label;
      });

      machineHasTech.forEach(tec => {
        result[tec.id] = (result[tec.id] || 0) + fermiCount;
      });
    });

    return result;
  }, [detailedDowntime, detailedProduction, macchine, tecnologie]);

  // Filter components based on active technology
  // Mostra sempre tutti i componenti: il filtraggio delle macchine è già fatto da activeTechMachines
  const displayedComponents = useMemo(() => {
    return components;
  }, [components]);

  const activeTechMachines = useMemo(() => {
    return macchine
      .filter((m) => {
        const machineId = m.id.toUpperCase();
        const machineName = m.nome?.toUpperCase() || "";
        const query = searchQuery.toUpperCase();

        // Search filter (applies to all tabs)
        if (
          query &&
          !machineId.includes(query) &&
          !machineName.includes(query)
        ) {
          return false;
        }

        // Exclude secondary machines of a twin group from being rendered as their own row
        const isSecondaryTwin = Object.entries(TWIN_MACHINES).some(
          ([primary, group]) =>
            primary !== machineId && group.includes(machineId),
        );
        if (isSecondaryTwin) return false;

        if (!activeTech || activeTech === "TUTTO") return true;

        const tec = tecnologie.find(
          (t) =>
            t.id === activeTech ||
            t.label === activeTech ||
            t.codice === activeTech,
        );
        if (!tec) return true;

        const label = tec.label?.toLowerCase() || "";

        if (label.includes("tornitura soft")) {
          if (machineId.startsWith("DRA")) {
            // Explicit DB assignment takes priority
            if (m.tecnologia_id === "tornitura_hard") return false;
            if (m.tecnologia_id === "tornitura_soft") return true;

            // No assignment: use dynamic data (machine produced /S materials today)
            const hasSoftData = Object.keys(detailedProduction[machineId] || {}).length > 0;
            if (hasSoftData) return true;

            // SPECIAL CASE: no tecnologia_id set, default to Soft for DRA prefix
            if (!m.tecnologia_id && tec.prefissi && tec.prefissi.split(',').map(p => p.trim()).includes("DRA")) return true;

            return false;
          }
        }
        if (label.includes("tornitura hard")) {
          if (machineId.startsWith("DRA")) {
            // Explicit DB assignment takes priority
            if (m.tecnologia_id === "tornitura_soft") return false;
            if (m.tecnologia_id === "tornitura_hard") return true;

            // No assignment: use dynamic data (has production but none is soft)
            const hasDataRow = Object.keys(matrice[machineId] || {}).length > 0;
            const hasSoftData = Object.keys(detailedProduction[machineId] || {}).length > 0;
            if (hasDataRow && !hasSoftData) return true;

            return false;
          }
        }
        if (label.includes("controllo ut")) {
          return machineId === "MZA10005";
        }

        // Exclude MZA10005 from DMC since its prefix matches but it moved to Controllo UT
        if (machineId === "MZA10005" && label.includes("dmc")) {
          return false;
        }

        if (tec.prefissi) {
          const prefixes = tec.prefissi
            .split(",")
            .map((p) => p.trim().toUpperCase());
          return prefixes.some((p) => machineId.startsWith(p));
        }
        return m.tecnologia_id === tec.id;
      })
      .map((m) => m.id)
      .sort((a, b) => {
        const idxA = ALL_MACHINES_ORDER.indexOf(a);
        const idxB = ALL_MACHINES_ORDER.indexOf(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
  }, [macchine, activeTech, tecnologie, ALL_MACHINES_ORDER, searchQuery, detailedProduction, matrice]);

  const getBackgroundColor = (value) => {
    if (value === "" || value === 0 || value === undefined) return "white";
    if (value > 100) return "#D1FAE5";
    if (value > 50) return "#FEF3C7";
    return "#FEE2E2";
  };

  const getRowSum = (machine) => {
    if (!matrice[machine]) return 0;
    return displayedComponents.reduce((sum, comp) => {
      const val = matrice[machine][comp];
      return sum + (val ? Number(val) : 0);
    }, 0);
  };

  const handleSendEmail = () => {
    const dateStr = formatItalianDate(globalDate || new Date());
    const shiftStr = selectedTurno === "ALL" ? "Tutto il giorno" : selectedTurno;
    const tabName =
      tecnologie.find((t) => t.id === activeTech)?.label || activeTech;

    let emailBody = `Report Produzione - ${dateStr} - Turno ${shiftStr}\n`;
    emailBody += `Filtro: ${tabName}\n\n`;
    emailBody += `Dettaglio Macchine Attive:\n`;
    emailBody += `----------------------------------------\n`;

    let hasData = false;

    activeTechMachines.forEach((machineId) => {
      const mObj = macchine.find((m) => m.id === machineId);
      const machineLabel = mObj?.nome || machineId;
      const productionTotal = getRowSum(machineId);
      const downtimeTotal = downtimeMap[machineId] || 0;

      // Determine if this is a twin group to adjust the label
      let displayLabel = machineLabel;
      if (TWIN_MACHINES[machineId]) {
        displayLabel = TWIN_MACHINES[machineId].join(" + ");
      }

      // Only include machines with activity to keep email concise
      if (productionTotal > 0 || downtimeTotal > 0) {
        hasData = true;
        emailBody += `${displayLabel}\n`;
        emailBody += `- Produzione: ${productionTotal} pz\n`;
        emailBody += `- Fermi: ${downtimeTotal} min\n`;

        // Optional: Include specific active components if needed,
        // but keeping it to totals for now to manage mailto limits.
        emailBody += `\n`;
      }
    });

    if (!hasData) {
      emailBody += `Nessuna attività registrata per i filtri selezionati.\n`;
    }

    emailBody += `----------------------------------------\n`;
    emailBody += `Generato da TurnoApp`;

    const subject = encodeURIComponent(
      `Report Produzione - ${dateStr} - Turno ${shiftStr}`,
    );
    const body = encodeURIComponent(emailBody);

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleExportExcel = () => {
    const data = {
      reportDate: new Date(reportDate),
      selectedTurno,
      activeTech,
      matrice,
      detailedDowntime,
      activeTechMachines,
      components: displayedComponents,
      technologies: tecnologie,
      macchine,
    };
    exportProductionReport(data);
  };

  const tabStyle = (techId) => ({
    padding: "8px 14px",
    backgroundColor: activeTech === techId ? "#3B82F6" : "#E5E7EB",
    color: activeTech === techId ? "white" : "#111827",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
    minHeight: "46px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  });

  // ── Analisi fermi ──────────────────────────────────────────────
  const fermiAnalisi = useMemo(() => {
    if (!rawDowntimeData.length) return { byMotivo: [], byMacchina: [], byTurno: [], byData: [], byMachinaTurno: {}, topMacchina: null, topMotivo: null, total: 0, totalMin: 0 };

    const byMotivo = {};
    const byMacchina = {};
    const byTurno = {};

    const byData = {};
    const byMachinaTurno = {};

    rawDowntimeData.forEach(f => {
      const motivo = f.motivo || "N/D";
      const mac = getPrimaryMachineId(f.macchina_id || "—");
      const turno = f.turno_id || "—";
      const durata = f.durata_minuti || 0;
      const data = f.data || "N/D";

      if (!byMotivo[motivo]) byMotivo[motivo] = { motivo, count: 0, totalMin: 0 };
      byMotivo[motivo].count++;
      byMotivo[motivo].totalMin += durata;

      if (!byMacchina[mac]) byMacchina[mac] = { mac, count: 0, totalMin: 0 };
      byMacchina[mac].count++;
      byMacchina[mac].totalMin += durata;

      if (!byTurno[turno]) byTurno[turno] = { turno, count: 0, totalMin: 0 };
      byTurno[turno].count++;
      byTurno[turno].totalMin += durata;

      if (!byData[data]) byData[data] = { data, count: 0, totalMin: 0 };
      byData[data].count++;
      byData[data].totalMin += durata;

      const key = `${mac}_${turno}`;
      byMachinaTurno[key] = (byMachinaTurno[key] || 0) + 1;
    });

    const byMotivoArr = Object.values(byMotivo).sort((a, b) => b.count - a.count);
    const byMacchinaArr = Object.values(byMacchina).sort((a, b) => b.count - a.count);

    return {
      rows: [...rawDowntimeData].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)),
      byMotivo: byMotivoArr,
      byMacchina: byMacchinaArr,
      byTurno: Object.values(byTurno).sort((a, b) => (["A","B","C","D"].indexOf(a.turno) - ["A","B","C","D"].indexOf(b.turno))),
      byData: Object.values(byData).sort((a, b) => a.data.localeCompare(b.data)),
      byMachinaTurno,
      topMacchina: [...byMacchinaArr].sort((a, b) => b.totalMin - a.totalMin)[0] || null,
      topMotivo: byMotivoArr[0] || null,
      total: rawDowntimeData.length,
      totalMin: rawDowntimeData.reduce((s, f) => s + (f.durata_minuti || 0), 0),
    };
  }, [rawDowntimeData]);

  // Vista Analisi Fermi (schermo intero)
  if (showFermiView) {
    const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B7280", borderBottom: "2px solid #E5E7EB", whiteSpace: "nowrap", backgroundColor: "#F9FAFB" };
    const tdStyle = { padding: "10px 14px", borderBottom: "1px solid #F3F4F6", fontSize: "13px", color: "#374151" };
    const cardStyle = { background: "white", borderRadius: "12px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };

    const dateRange = viewMode === "week"
      ? `${formatItalianDate(getWeekDates(reportDate).start)} – ${formatItalianDate(getWeekDates(reportDate).end)}`
      : formatItalianDate(reportDate);
    const turnoLabel = selectedTurno === "ALL" ? "Tutti i turni" : `Turno ${selectedTurno}`;

    return (
      <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", backgroundColor: "var(--bg-secondary)", padding: "32px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <button onClick={() => setShowFermiView(false)} style={{ border: "1px solid var(--border)", background: "white", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                ← Report Produzione
              </button>
            </div>
            <h1 style={{ fontSize: "32px", fontWeight: "bold", color: "var(--text-primary)", margin: 0 }}>Analisi Fermi</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "6px 0 16px" }}>{dateRange} · {turnoLabel}</p>
            {/* Filtri */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
              {/* Data */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Data</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-light)", backgroundColor: "white", fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", outline: "none", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                />
              </div>
              {/* Vista */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vista</span>
                <div style={{ display: "flex", borderRadius: "8px", border: "1px solid var(--border-light)", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  {[{ value: "day", label: "Giorno" }, { value: "week", label: "Settimana" }].map(({ value, label }) => (
                    <button key={value} onClick={() => setViewMode(value)} style={{ padding: "8px 14px", fontSize: "14px", fontWeight: "600", border: "none", borderRight: value === "day" ? "1px solid var(--border-light)" : "none", cursor: "pointer", backgroundColor: viewMode === value ? "var(--accent)" : "var(--bg-secondary)", color: viewMode === value ? "white" : "var(--text-muted)", transition: "all 0.15s" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Turno */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Turno</span>
                <div style={{ display: "flex", borderRadius: "8px", border: "1px solid var(--border-light)", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  {[{ value: "ALL", label: "Tutti" }, ...["A", "B", "C", "D"].map(t => ({ value: t, label: t }))].map(({ value, label }, idx, arr) => (
                    <button key={value} onClick={() => setSelectedTurno(value)} style={{ padding: "8px 12px", fontSize: "14px", fontWeight: "600", border: "none", borderRight: idx < arr.length - 1 ? "1px solid var(--border-light)" : "none", cursor: "pointer", backgroundColor: selectedTurno === value ? "var(--accent)" : "var(--bg-secondary)", color: selectedTurno === value ? "white" : "var(--text-muted)", transition: "all 0.15s" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* KPI cards */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {[
              { label: "Fermi totali", value: fermiAnalisi.total, color: "#EF4444" },
              { label: "Minuti totali", value: fermiAnalisi.totalMin, color: "#F97316" },
              { label: "Media durata", value: fermiAnalisi.total ? Math.round(fermiAnalisi.totalMin / fermiAnalisi.total) + " min" : "—", color: "#8B5CF6" },
            ].map(k => (
              <div key={k.label} style={{ ...cardStyle, minWidth: "140px", textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: "800", color: k.color }}>{k.value}</div>
                <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px", fontWeight: "600" }}>{k.label}</div>
              </div>
            ))}
            {fermiAnalisi.topMacchina && (
              <div style={{ ...cardStyle, minWidth: "160px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "#0EA5E9" }}>{fermiAnalisi.topMacchina.mac}</div>
                <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>{fermiAnalisi.topMacchina.totalMin} min fermi</div>
                <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px", fontWeight: "600" }}>Macchina critica</div>
              </div>
            )}
            {fermiAnalisi.topMotivo && (
              <div style={{ ...cardStyle, minWidth: "160px", textAlign: "center" }}>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#EF4444", lineHeight: 1.2 }}>{fermiAnalisi.topMotivo.motivo}</div>
                <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>{fermiAnalisi.topMotivo.count} occorrenze</div>
                <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px", fontWeight: "600" }}>Motivo più frequente</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Tabella fermi dettagliata */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px", color: "var(--text-primary)" }}>📋 Dettaglio Fermi</h2>
            {fermiAnalisi.rows?.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Data", "Turno", "Macchina", "Motivo", "Durata (min)", "Note"].map(c => <th key={c} style={thStyle}>{c}</th>)}
                  </tr></thead>
                  <tbody>
                    {fermiAnalisi.rows.map((f, i) => {
                      const mac = macchine.find(m => m.id === getPrimaryMachineId(f.macchina_id));
                      return (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                          <td style={tdStyle}>{f.data ? formatItalianDate(f.data) : "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "12px", backgroundColor: "#EFF6FF", color: "#1D4ED8", fontWeight: "700", fontSize: "12px" }}>{f.turno_id || "—"}</span>
                          </td>
                          <td style={{ ...tdStyle, fontWeight: "600", color: "#111827" }}>{mac?.nome || f.macchina_id || "—"}</td>
                          <td style={{ ...tdStyle, fontWeight: "600", color: "#EF4444" }}>{f.motivo || "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: "700" }}>{f.durata_minuti > 0 ? f.durata_minuti : "—"}</td>
                          <td style={{ ...tdStyle, color: "#6B7280", fontStyle: f.note ? "normal" : "italic" }}>{f.note || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>Nessun fermo registrato per il periodo selezionato.</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
            {/* Top Motivi */}
            {(() => {
              const maxCount = fermiAnalisi.byMotivo[0]?.count || 1;
              return (
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px", color: "var(--text-primary)" }}>🔴 Top Motivi</h2>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={thStyle}>Motivo</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>N°</th>
                      <th style={{ ...thStyle, width: "90px" }}></th>
                    </tr></thead>
                    <tbody>
                      {fermiAnalisi.byMotivo.map((m, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                          <td style={{ ...tdStyle, fontWeight: "600", color: "#EF4444" }}>{m.motivo}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: "700" }}>{m.count}</td>
                          <td style={{ ...tdStyle }}>
                            <div style={{ height: 8, borderRadius: 4, backgroundColor: "#FEE2E2" }}>
                              <div style={{ width: `${Math.round((m.count / maxCount) * 100)}%`, height: "100%", borderRadius: 4, backgroundColor: "#EF4444" }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!fermiAnalisi.byMotivo.length && <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9CA3AF", fontStyle: "italic" }}>—</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Fermi per Macchina */}
            {(() => {
              const maxMin = (fermiAnalisi.topMacchina?.totalMin) || 1;
              return (
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px", color: "var(--text-primary)" }}>🔧 Fermi per Macchina</h2>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={thStyle}>Macchina</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Min</th>
                      <th style={{ ...thStyle, width: "90px" }}></th>
                    </tr></thead>
                    <tbody>
                      {fermiAnalisi.byMacchina.map((m, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                          <td style={{ ...tdStyle, fontWeight: "600" }}>{m.mac}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: "700", color: "#F97316" }}>{m.totalMin || "—"}</td>
                          <td style={{ ...tdStyle }}>
                            <div style={{ height: 8, borderRadius: 4, backgroundColor: "#FEF3C7" }}>
                              <div style={{ width: `${Math.round(((m.totalMin || 0) / maxMin) * 100)}%`, height: "100%", borderRadius: 4, backgroundColor: "#F97316" }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!fermiAnalisi.byMacchina.length && <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#9CA3AF", fontStyle: "italic" }}>—</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Fermi per Turno */}
            {(() => {
              const maxMin = Math.max(...["A","B","C","D"].map(t => fermiAnalisi.byTurno?.find(r => r.turno === t)?.totalMin || 0), 1);
              return (
                <div style={cardStyle}>
                  <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px", color: "var(--text-primary)" }}>⏱ Minuti per Turno</h2>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={thStyle}>Turno</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>N°</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Min</th>
                      <th style={{ ...thStyle, width: "90px" }}></th>
                    </tr></thead>
                    <tbody>
                      {["A","B","C","D"].map(t => {
                        const d = fermiAnalisi.byTurno?.find(r => r.turno === t) || { count: 0, totalMin: 0 };
                        return (
                          <tr key={t}>
                            <td style={{ ...tdStyle, fontWeight: "700" }}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "12px", backgroundColor: "#EFF6FF", color: "#1D4ED8", fontSize: "12px" }}>Turno {t}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: "700", color: d.count > 0 ? "#EF4444" : "#9CA3AF" }}>{d.count || "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "right", color: d.totalMin > 0 ? "#374151" : "#9CA3AF" }}>{d.totalMin || "—"}</td>
                            <td style={{ ...tdStyle }}>
                              <div style={{ height: 8, borderRadius: 4, backgroundColor: "#EDE9FE" }}>
                                <div style={{ width: `${Math.round(((d.totalMin || 0) / maxMin) * 100)}%`, height: "100%", borderRadius: 4, backgroundColor: "#8B5CF6" }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Andamento giornaliero — solo vista settimana */}
          {viewMode === "week" && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px", color: "var(--text-primary)" }}>📅 Andamento Settimanale</h2>
              <div style={{ display: "flex", gap: "12px" }}>
                {getWeekDates(reportDate).dates.map(dateStr => {
                  const d = fermiAnalisi.byData?.find(x => x.data === dateStr) || { count: 0, totalMin: 0 };
                  return (
                    <div key={dateStr} style={{ flex: 1, textAlign: "center", padding: "12px 8px", borderRadius: "10px", backgroundColor: d.count === 0 ? "#F0FDF4" : d.count < 3 ? "#FEF9C3" : "#FEE2E2", border: `1px solid ${d.count === 0 ? "#BBF7D0" : d.count < 3 ? "#FDE68A" : "#FECACA"}` }}>
                      <div style={{ fontSize: "11px", color: "#6B7280", fontWeight: "600", marginBottom: "6px" }}>{formatItalianDate(dateStr)}</div>
                      <div style={{ fontSize: "28px", fontWeight: "800", color: d.count === 0 ? "#16A34A" : d.count < 3 ? "#D97706" : "#DC2626" }}>{d.count}</div>
                      <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>{d.totalMin > 0 ? `${d.totalMin} min` : "nessun fermo"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Heatmap Macchina × Turno */}
          {fermiAnalisi.byMacchina?.length > 0 && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px", color: "var(--text-primary)" }}>🔥 Heatmap Macchina × Turno</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, minWidth: "120px" }}>Macchina</th>
                      {["A","B","C","D"].map(t => (
                        <th key={t} style={{ ...thStyle, textAlign: "center", width: "100px" }}>Turno {t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fermiAnalisi.byMacchina.map((m, i) => (
                      <tr key={m.mac} style={{ backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                        <td style={{ ...tdStyle, fontWeight: "600" }}>{m.mac}</td>
                        {["A","B","C","D"].map(t => {
                          const cnt = fermiAnalisi.byMachinaTurno[`${m.mac}_${t}`] || 0;
                          const bg = cnt === 0 ? "transparent" : cnt <= 2 ? "#FEF9C3" : cnt <= 4 ? "#FED7AA" : "#FEE2E2";
                          const color = cnt === 0 ? "#D1D5DB" : cnt <= 2 ? "#D97706" : cnt <= 4 ? "#EA580C" : "#DC2626";
                          return (
                            <td key={t} style={{ ...tdStyle, textAlign: "center", backgroundColor: bg, fontWeight: cnt > 0 ? "800" : "400", color, fontSize: "15px" }}>
                              {cnt > 0 ? cnt : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div
      className="fade-in"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--bg-secondary)",
        padding: "32px",
      }}
    >
      <div style={{ marginBottom: "16px", padding: "0 4px" }}>
        {/* Titoli */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "bold", color: "var(--text-primary)", margin: 0 }}>
            Report Produzione
          </h1>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            {viewMode === "day" ? (
              <>Dati del <strong>{formatItalianDate(reportDate)}</strong> - Turno <strong>{selectedTurno === "ALL" ? "Tutti (Intera Giornata)" : selectedTurno}</strong></>
            ) : (
              <>Dati dal <strong>{formatItalianDate(getWeekDates(reportDate).start)}</strong> al <strong>{formatItalianDate(getWeekDates(reportDate).end)}</strong> — Turno <strong>{selectedTurno === "ALL" ? "Tutti" : selectedTurno}</strong></>
            )}
          </h2>
        </div>

        {/* Filtri */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
            {/* Data */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Data</span>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-light)",
                  backgroundColor: "white",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  outline: "none",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              />
            </div>
            {/* Vista */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vista</span>
              <div style={{ display: "flex", borderRadius: "8px", border: "1px solid var(--border-light)", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                {[{ value: "day", label: "Giorno" }, { value: "week", label: "Settimana" }].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setViewMode(value)}
                    style={{
                      padding: "8px 14px",
                      fontSize: "14px",
                      fontWeight: "600",
                      border: "none",
                      borderRight: value === "day" ? "1px solid var(--border-light)" : "none",
                      cursor: "pointer",
                      backgroundColor: viewMode === value ? "var(--accent)" : "var(--bg-secondary)",
                      color: viewMode === value ? "white" : "var(--text-muted)",
                      boxShadow: viewMode === value ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Turno */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Turno</span>
              <div style={{ display: "flex", borderRadius: "8px", border: "1px solid var(--border-light)", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                {[{ value: "ALL", label: "Tutti" }, ...["A", "B", "C", "D"].map(t => ({ value: t, label: t }))].map(({ value, label }, idx, arr) => (
                  <button
                    key={value}
                    onClick={() => setSelectedTurno(value)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "14px",
                      fontWeight: "600",
                      border: "none",
                      borderRight: idx < arr.length - 1 ? "1px solid var(--border-light)" : "none",
                      cursor: "pointer",
                      backgroundColor: selectedTurno === value ? "var(--accent)" : "var(--bg-secondary)",
                      color: selectedTurno === value ? "white" : "var(--text-muted)",
                      boxShadow: selectedTurno === value ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Cerca macchina (ID o nome)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "10px 16px",
                  paddingLeft: "36px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-light)",
                  backgroundColor: "white",
                  fontSize: "14px",
                  width: "280px",
                  outline: "none",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              />
              <svg
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  color: "var(--text-muted)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => setIsConfigMode(!isConfigMode)}
              className="btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                borderRadius: "8px",
                fontWeight: "600",
                background: isConfigMode ? "var(--accent)" : "var(--bg-tertiary)",
                color: isConfigMode ? "white" : "var(--text-secondary)",
                border: "1px solid var(--border)",
                boxShadow: isConfigMode ? "0 0 10px var(--accent)" : "none",
              }}
              title="Configura le celle da visualizzare"
            >
              {isConfigMode ? "✓ Fine Config" : "⚙ Configura Celle"}
            </button>

            <button
              onClick={() => setShowFermiView(true)}
              className="btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                borderRadius: "8px",
                fontWeight: "600",
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              title="Analisi fermi macchina"
            >
              📋 Analisi Fermi
            </button>

            <button
              onClick={handleExportExcel}
              className="btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                borderRadius: "8px",
                fontWeight: "600",
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              title="Esporta il report in formato Excel"
            >
              📊 Esporta Excel
            </button>

            <button
              onClick={handleSendEmail}
              className="btn btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px",
                fontWeight: "600",
              }}
            >
              <svg
                style={{ width: "16px", height: "16px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Invia tramite Mail
            </button>
            {loading && (
              <div
                style={{
                  color: "var(--accent)",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                Caricamento dati...
              </div>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          <button
            key="TUTTO"
            onClick={() => setActiveTech("TUTTO")}
            style={tabStyle("TUTTO")}
          >
            <div>TUTTO</div>
            {downtimeByTech.TUTTO > 0 && (
              <div style={{ fontSize: "11px", opacity: 0.7 }}>
                {downtimeByTech.TUTTO} fermi
              </div>
            )}
          </button>
          {(() => {
            const labelMapping = {
              "tornitura soft": "Tornitura Soft",
              "marcatura laser dmc": "DMC",
              "saldatura laser": "Saldatura Laser",
              stozzatura: "Stozzatura",
              milling: "Fresatura",
              brocciatura: "Brocciatura",
              dentatura: "Dentatura",
              sbavatura: "Sbavatura",
              "tornitura hard": "Tornitura Hard",
              levigatura: "Levigatura",
              "tornitura rettifica cono": "Rettifica Cono",
              "rettifica denti": "Rettifica Denti",
            };

            const desiredOrder = [
              "Tornitura Soft",
              "DMC",
              "Saldatura Laser",
              "Stozzatura",
              "Fresatura",
              "Brocciatura",
              "Dentatura",
              "Sbavatura",
              "Tornitura Hard",
              "Levigatura",
              "Rettifica Cono",
              "Rettifica Denti",
            ];

            // Prepare the list with mapped labels
            const mappedTec = tecnologie.map((t) => {
              const originalLabel = t.label.toLowerCase();
              let displayLabel = t.label;
              for (const [key, val] of Object.entries(labelMapping)) {
                if (originalLabel === key || originalLabel.includes(key)) {
                  displayLabel = val;
                  break;
                }
              }
              return { ...t, displayLabel };
            });

            return mappedTec
              .sort((a, b) => {
                let idxA = desiredOrder.indexOf(a.displayLabel);
                let idxB = desiredOrder.indexOf(b.displayLabel);
                if (idxA === -1) idxA = 999;
                if (idxB === -1) idxB = 999;
                return idxA - idxB;
              })
              .map((tec) => (
                <button
                  key={tec.id}
                  onClick={() => setActiveTech(tec.id)}
                  style={tabStyle(tec.id)}
                >
                  <div>{tec.displayLabel}</div>
                  {downtimeByTech[tec.id] > 0 && (
                    <div style={{ fontSize: "11px", opacity: 0.7 }}>
                      {downtimeByTech[tec.id]} fermi
                    </div>
                  )}
                </button>
              ));
          })()}
        </div>

      <div
        style={{
          flex: 1,
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ overflow: "auto", flex: 1 }}>
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: "11px",
              width: "100%",
            }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 100 }}>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th
                  colSpan={3}
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px",
                    textAlign: "center",
                    backgroundColor: "var(--bg-secondary)",
                    fontWeight: "bold",
                  }}
                ></th>
                <th
                  colSpan={9}
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px",
                    textAlign: "center",
                    backgroundColor: "#EFF6FF",
                    fontWeight: "bold",
                    fontSize: "13px",
                    color: "#3B82F6",
                  }}
                >
                  DCT 300
                </th>
                <th
                  colSpan={14}
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px",
                    textAlign: "center",
                    backgroundColor: "#F3E8FF",
                    fontWeight: "bold",
                    fontSize: "13px",
                    color: "#A855F7",
                  }}
                >
                  8Fe
                </th>
                <th
                  colSpan={6}
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px",
                    textAlign: "center",
                    backgroundColor: "#CCFBF1",
                    fontWeight: "bold",
                    fontSize: "13px",
                    color: "#10B981",
                  }}
                >
                  DCT ECO
                </th>
              </tr>

              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px",
                    textAlign: "center",
                    backgroundColor: "var(--bg-secondary)",
                    fontWeight: "bold",
                    minWidth: "100px",
                    position: "sticky",
                    left: 0,
                    zIndex: 110,
                  }}
                >
                  Macchina
                </th>
                <th
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px",
                    textAlign: "center",
                    backgroundColor: "var(--bg-secondary)",
                    fontWeight: "bold",
                    minWidth: "70px",
                    color: "var(--danger)",
                  }}
                >
                  Fermi
                </th>
                <th
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px",
                    textAlign: "center",
                    backgroundColor: "var(--bg-secondary)",
                    fontWeight: "bold",
                    minWidth: "70px",
                  }}
                >
                  Totale
                </th>
                {displayedComponents.map((comp, idx) => {
                  const isColHovered = hoveredCol === comp;
                  const isConfigured = componentConfigs.some(c => c.componente === comp);
                  return (
                    <th
                      key={idx}
                      onMouseEnter={() => setHoveredCol(comp)}
                      onMouseLeave={() => setHoveredCol(null)}
                      style={{
                        border: "1px solid var(--border)",
                        padding: "8px",
                        textAlign: "center",
                        backgroundColor: isColHovered ? "#eef2ff" : "var(--bg-secondary)",
                        fontWeight: "600",
                        fontSize: "13px",
                        minWidth: "70px",
                        color: "var(--text-primary)",
                        fontFamily: "inherit",
                        transition: "background-color 0.1s",
                        cursor: "default",
                      }}
                    >
                      {comp.replace("_ECO", "").replace("_8FE", "")}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeTechMachines.map((machineId) => {
                const mObj = macchine.find((m) => m.id === machineId);
                const originalName = mObj?.nome || machineId;

                // Determine if this is a twin group to adjust the label appropriately
                let displayLabel = originalName;
                if (TWIN_MACHINES[machineId]) {
                  displayLabel = TWIN_MACHINES[machineId].join(" + ");
                }

                const downtime = downtimeMap[machineId] || 0;
                const fermiCount = (detailedDowntime[machineId] || []).length;
                const isRowHovered = hoveredRow === machineId;

                return (
                  <tr
                    key={machineId}
                    onMouseEnter={() => setHoveredRow(machineId)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: "1px solid var(--border-light)",
                      backgroundColor: isRowHovered ? "#eef2ff" : "transparent",
                      transition: "background-color 0.1s",
                      height: "50px",
                      minHeight: "50px",
                    }}
                  >
                    <td
                      style={{
                        padding: "0 16px",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                        borderRight: "1px solid var(--border)",
                        position: "sticky",
                        left: 0,
                        backgroundColor: isRowHovered ? "#eef2ff" : "var(--bg-card)",
                        zIndex: 10,
                        whiteSpace: "nowrap",
                        transition: "background-color 0.1s",
                        cursor: "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: "6px",
                        height: "50px",
                        minHeight: "50px",
                      }}
                    >
                      {displayLabel}
                    </td>
                    <td
                      onClick={() => {
                        if (fermiCount > 0) {
                          setSelectedMachineDowntime({ id: machineId, label: displayLabel, details: detailedDowntime[machineId] || [] });
                        } else {
                          setFermoModal({ machineId, machineLabel: displayLabel });
                          setFermoForm({ motivo: "", durata: "", note: "" });
                        }
                      }}
                      style={{
                        border: "1px solid var(--border)",
                        padding: "4px 8px",
                        textAlign: "center",
                        backgroundColor: isRowHovered
                          ? "#eef2ff"
                          : fermiCount > 0
                            ? "#EF4444"
                            : "var(--bg-card)",
                        cursor: "pointer",
                      }}
                    >
                      {fermiCount > 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <span
                            style={{
                              fontWeight: "700",
                              color: "white",
                              fontSize: 13,
                            }}
                          >
                            {fermiCount}
                          </span>
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        border: "1px solid var(--border)",
                        padding: "8px",
                        textAlign: "center",
                        backgroundColor: isRowHovered
                          ? "#eef2ff"
                          : "var(--bg-secondary)",
                        fontWeight: "700",
                        minWidth: "80px",
                      }}
                    >
                      {getRowSum(machineId)}
                    </td>

                    {displayedComponents.map((comp, cidx) => {
                      const machineData = matrice[machineId] || {};
                      const val = machineData[comp] || 0;
                      const hasProduction = Number(val) > 0;
                      const isColHovered = hoveredCol === comp;

                      const details = (detailedProduction[machineId] && detailedProduction[machineId][comp]) || [];
                      const mats = Array.from(new Set(details.map(d => d?.materiale).filter(Boolean)));
                      const opCodes = Array.from(new Set(details.map(d => d?.fino).filter(Boolean)));

                      return (
                        <td
                          key={cidx}
                          onMouseEnter={() => setHoveredCol(comp)}
                          onMouseLeave={() => setHoveredCol(null)}
                          onClick={() => {
                            if (isConfigMode) {
                              // Config mode: apre config per questa cella (macchina + componente)
                              const existing = componentConfigs.find(
                                c => c.componente === comp && c.macchina_id === machineId
                              );
                              if (existing) {
                                setEditingComponent({ ...existing, codicisText: parseCodicisArray(existing.codici).join("\n") });
                              } else {
                                setEditingComponent({ componente: comp, macchina_id: machineId, progetto: "", codicisText: "", fino: "" });
                              }
                            } else {
                              // Modalità normale: mostra dettaglio righe individuali
                              const sortedDetails = [...details].sort((a, b) => {
                                if (a.data < b.data) return -1;
                                if (a.data > b.data) return 1;
                                const turniOrd = ["A","B","C","D"];
                                return turniOrd.indexOf(a.turno_id) - turniOrd.indexOf(b.turno_id);
                              });
                              setSelectedProduction({
                                machineId,
                                label: displayLabel,
                                componentName: comp.replace("_ECO", "").replace("_8FE", ""),
                                details: sortedDetails,
                              });
                            }
                          }}
                          style={{
                            border: isConfigMode ? "2px dashed var(--accent)" : "1px solid var(--border)",
                            padding: "8px",
                            textAlign: "center",
                            backgroundColor:
                              isRowHovered || isColHovered
                                ? "#eef2ff"
                                : getBackgroundColor(val),
                            color: "#111827",
                            fontWeight: "600",
                            fontSize: "12px",
                            minWidth: "80px",
                            opacity: isConfigMode ? 1 : (val ? 1 : 0.2),
                            transition: "background-color 0.1s",
                            cursor: "pointer",
                            position: "relative",
                          }}
                        >
                          {val || "0"}
                          {hasProduction && (
                            <div style={{
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              marginTop: "3px",
                              lineHeight: "1.2",
                              fontWeight: "500",
                              pointerEvents: "none"
                            }}>
                              {(() => {
                                const totalScarti = details.reduce((sum, d) => sum + (d.qta_scarto || 0), 0);
                                return totalScarti > 0 ? (
                                  <div style={{ color: "var(--danger)" }}>
                                    {totalScarti} scarti
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Inserimento Fermo */}
      {fermoModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Inserisci Fermo</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
              {fermoModal.machineLabel} · {reportDate}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Motivo *</label>
                <select
                  value={fermoForm.motivo}
                  onChange={e => setFermoForm(f => ({ ...f, motivo: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
                >
                  <option value="">— Seleziona motivo —</option>
                  {motiviFermo.map(m => (
                    <option key={m.id} value={m.label}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Durata (minuti)</label>
                <input
                  type="number"
                  min="0"
                  value={fermoForm.durata}
                  onChange={e => setFermoForm(f => ({ ...f, durata: e.target.value }))}
                  placeholder="es. 30 (opzionale)"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Note</label>
                <textarea
                  value={fermoForm.note}
                  onChange={e => setFermoForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Descrizione opzionale..."
                  rows={2}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, resize: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setFermoModal(null); setFermoForm({ motivo: "", durata: "", note: "" }); }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
              >Annulla</button>
              <button
                onClick={saveFermo}
                disabled={savingFermo || !fermoForm.motivo || selectedTurno === "ALL"}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: savingFermo || !fermoForm.motivo || selectedTurno === "ALL" ? "var(--text-muted)" : "var(--danger)", color: "white", fontWeight: 700, cursor: savingFermo || !fermoForm.motivo || selectedTurno === "ALL" ? "default" : "pointer", fontSize: 13 }}
              >{savingFermo ? "Salvo…" : "Salva fermo"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dettagli Fermi */}
      {selectedMachineDowntime && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedMachineDowntime(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              width: "500px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>
                Dettaglio Fermi: {selectedMachineDowntime.label}
              </h3>
              <button
                onClick={() => setSelectedMachineDowntime(null)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: "var(--text-muted)",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "20px", overflowY: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 0",
                        color: "var(--text-muted)",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Motivo
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "12px 0",
                        color: "var(--text-muted)",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Durata (min)
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "12px 0",
                        color: "var(--text-muted)",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        width: "50px",
                      }}
                    >
                      Azione
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMachineDowntime.details.length > 0 ? (
                    selectedMachineDowntime.details.map((f, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid var(--border-light)",
                        }}
                      >
                        <td style={{ padding: "12px 0" }}>
                          <div
                            style={{
                              fontWeight: "600",
                              color: "var(--text-primary)",
                            }}
                          >
                            {motiviFermo.find(
                              (m) => String(m.id) === String(f.motivo),
                            )?.label ||
                              f.motivo ||
                              "N/A"}
                          </div>
                          {f.note && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--text-muted)",
                                marginTop: "2px",
                              }}
                            >
                              {f.note}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "12px 0",
                            fontWeight: "700",
                            color: "var(--danger)",
                          }}
                        >
                          {f.durata_minuti}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "12px 0",
                          }}
                        >
                          <button
                            onClick={() => deleteFermo(f.id)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "var(--danger)",
                              cursor: "pointer",
                              fontSize: "16px",
                              padding: "4px 8px",
                              fontWeight: "bold",
                            }}
                            title="Elimina fermo"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: "20px 0",
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        Nessun dettaglio disponibile.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div
              style={{
                padding: "20px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "16px" }}>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontWeight: "normal",
                    fontSize: "14px",
                  }}
                >
                  Totale:{" "}
                </span>
                {selectedMachineDowntime.details.reduce(
                  (sum, f) => sum + f.durata_minuti,
                  0,
                )}{" "}
                min
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setSelectedMachineDowntime(null)}
                style={{ padding: "8px 24px" }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dettagli Produzione */}
      {selectedProduction && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedProduction(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              width: "820px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>
                  {selectedProduction.label} — {selectedProduction.componentName}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  {selectedProduction.details.length} righe · Totale: <strong>{selectedProduction.details.reduce((s, p) => s + (p.qta_ottenuta || 0), 0)} pz</strong>
                  {selectedProduction.details.some(p => p.qta_scarto > 0) && (
                    <span style={{ color: "#EF4444", marginLeft: "12px" }}>
                      Scarti: <strong>{selectedProduction.details.reduce((s, p) => s + (p.qta_scarto || 0), 0)} pz</strong>
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelectedProduction(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "20px", color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Tabella */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead style={{ position: "sticky", top: 0, backgroundColor: "#F9FAFB", zIndex: 1 }}>
                  <tr>
                    {["Data", "Materiale", "OP", "Turno", "Macchina", "Q.TÀ", "Scarti"].map(col => (
                      <th key={col} style={{ padding: "10px 16px", textAlign: col === "Q.TÀ" || col === "Scarti" ? "right" : "left", color: "#6B7280", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap" }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedProduction.details.length > 0 ? (
                    selectedProduction.details.map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                        <td style={{ padding: "10px 16px", color: "#374151", whiteSpace: "nowrap" }}>{p.data ? formatItalianDate(p.data) : "—"}</td>
                        <td style={{ padding: "10px 16px", fontWeight: "600", color: "#F97316", whiteSpace: "nowrap" }}>{p.materiale || "N/A"}</td>
                        <td style={{ padding: "10px 16px", color: "#374151", whiteSpace: "nowrap" }}>{p.fino || "—"}</td>
                        <td style={{ padding: "10px 16px", textAlign: "center" }}>
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "12px", backgroundColor: "#EFF6FF", color: "#1D4ED8", fontWeight: "700", fontSize: "12px" }}>
                            {p.turno_id || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontWeight: "600", color: "#111827", whiteSpace: "nowrap" }}>{p._original_machine || p.macchina_id || "—"}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: "700", color: "#1D4ED8", fontSize: "14px" }}>{p.qta_ottenuta || 0}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: "700", color: p.qta_scarto > 0 ? "#EF4444" : "#9CA3AF", fontSize: "14px" }}>
                          {p.qta_scarto > 0 ? p.qta_scarto : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Nessun dettaglio disponibile.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", backgroundColor: "var(--bg-secondary)" }}>
              <button className="btn btn-primary" onClick={() => setSelectedProduction(null)} style={{ padding: "8px 24px" }}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Component Config Modal */}
      <ComponentConfigModal
        editing={editingComponent}
        onChange={setEditingComponent}
        onSave={handleSaveComponentConfig}
        onClose={() => setEditingComponent(null)}
        onDelete={handleDeleteComponentConfig}
        existingConfigs={componentConfigs}
        macchine={macchine}
      />

      {/* Machine Fino Modal */}
      <MachineFineModal
        editing={editingMachine}
        onChange={setEditingMachine}
        onSave={handleSaveMachineFino}
        onClose={() => setEditingMachine(null)}
      />
    </div>
  );
}

/* ───────────── COMPONENT CONFIG MODAL ───────────── */
function ComponentConfigModal({ editing, onChange, onSave, onClose, onDelete, existingConfigs, macchine }) {
  if (!editing) return null;
  const existing = (existingConfigs || []).filter(c => c.componente === editing.componente);
  return (
    <Modal
      title={<>⚙️ Configura: <span style={{ color: "var(--accent)" }}>{editing.componente}</span></>}
      subtitle="Associa macchina + fino + codici materiale. La combinazione fino + materiale identifica univocamente la macchina."
      onClose={onClose}
      width={480}
    >
      {/* Configurazioni esistenti */}
      {existing.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <label className="form-label">Configurazioni Esistenti</label>
          {existing.map(cfg => (
            <div key={cfg.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", backgroundColor: "var(--bg-secondary)", borderRadius: "8px", marginBottom: "6px", fontSize: "13px" }}>
              <span style={{ flex: 1 }}>
                <strong>{cfg.macchina_id || "—"}</strong>
                {cfg.fino && <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>op:{cfg.fino}</span>}
                <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>{parseCodicisArray(cfg.codici).length} codici</span>
              </span>
              <button
                onClick={() => onChange({ ...cfg, codicisText: parseCodicisArray(cfg.codici).join("\n") })}
                className="btn btn-secondary btn-sm"
              >Modifica</button>
              <button
                onClick={() => onDelete(cfg.id)}
                className="btn btn-sm"
                style={{ background: "var(--danger-muted)", color: "var(--danger)", border: "1px solid var(--danger)" }}
              >✕</button>
            </div>
          ))}
          <hr className="modal-divider" />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>Aggiungi nuova associazione:</p>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Macchina *</label>
        <select
          value={editing.macchina_id || ""}
          onChange={e => onChange({ ...editing, macchina_id: e.target.value })}
          className="input"
        >
          <option value="">— Seleziona macchina —</option>
          {(() => {
            const sorted = [...(macchine || [])].sort((a, b) => {
              const idxA = ALL_MACHINES_ORDER.indexOf(a.id);
              const idxB = ALL_MACHINES_ORDER.indexOf(b.id);
              return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            });
            return sorted.map(m => (
              <option key={m.id} value={m.id}>{m.id} {m.nome ? `— ${m.nome}` : ""}</option>
            ));
          })()}
        </select>
      </div>

      <div className="form-group" style={{ marginTop: 14 }}>
        <label className="form-label">Fino (operazione SAP) *</label>
        <input
          type="text"
          value={editing.fino}
          onChange={e => onChange({ ...editing, fino: e.target.value })}
          placeholder="es. 50, TORNS..."
          className="input"
        />
      </div>

      <div className="form-group" style={{ marginTop: 14 }}>
        <label className="form-label">Codici Materiale *</label>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Uno per riga oppure separati da virgola</p>
        <textarea
          value={editing.codicisText}
          onChange={e => onChange({ ...editing, codicisText: e.target.value })}
          rows={5}
          placeholder={"M0170686/S\nM0170687\nM0170688"}
          className="input"
          style={{ fontFamily: "monospace", resize: "vertical" }}
        />
      </div>

      <div className="form-group" style={{ marginTop: 14 }}>
        <label className="form-label">Progetto</label>
        <select
          value={editing.progetto}
          onChange={e => onChange({ ...editing, progetto: e.target.value })}
          className="input"
        >
          <option value="">— Nessuno —</option>
          <option value="DCT 300">DCT 300</option>
          <option value="8Fe">8Fe</option>
          <option value="DCT Eco">DCT Eco</option>
        </select>
      </div>

      <div className="modal-footer">
        <button onClick={onClose} className="btn btn-secondary">Chiudi</button>
        <button onClick={onSave} className="btn btn-primary">Salva</button>
      </div>
    </Modal>
  );
}

/* ───────────── MACHINE FINO MODAL ───────────── */
function MachineFineModal({ editing, onChange, onSave, onClose }) {
  if (!editing) return null;
  return (
    <Modal
      title={<>🔩 Macchina: <span style={{ color: "var(--accent)" }}>{editing.nome}</span></>}
      subtitle={<>Imposta il codice <strong>fino</strong> SAP per abbinare i record di conferme_sap.</>}
      onClose={onClose}
      width={380}
    >
      <div className="form-group">
        <label className="form-label">Fino</label>
        <input
          type="text"
          value={editing.fino}
          onChange={e => onChange({ ...editing, fino: e.target.value })}
          placeholder="es. TORNS"
          className="input"
          style={{ fontSize: "15px", fontWeight: "700" }}
          autoFocus
        />
      </div>
      <div className="modal-footer">
        <button onClick={onClose} className="btn btn-secondary">Annulla</button>
        <button onClick={onSave} className="btn btn-primary">Salva</button>
      </div>
    </Modal>
  );
}
