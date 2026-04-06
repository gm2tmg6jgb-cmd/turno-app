import React, { useState, useEffect, useMemo } from "react";

const ALL_MACHINES_ORDER = [
  "DRA10060","DRA10061","DRA10062","DRA10063","DRA10064","DRA10065","DRA10066",
  "DRA10067","DRA10068","DRA10069","DRA10070","DRA10071","DRA10072","DRA11042",
  "FRW10193","FRW10217","FRW10076","FRW10078","FRW12464","FRW10074","FRW10075",
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

export default function ProductionReportView({
  macchine = [],
  globalDate,
  turnoCorrente,
  motiviFermo = [],
  tecnologie = [],
}) {
  const [activeTech, setActiveTech] = useState("TUTTO");
  const [loading, setLoading] = useState(true);
  const [anagrafica, setAnagrafica] = useState({});
  const [hoveredCol, setHoveredCol] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTurno, setSelectedTurno] = useState(turnoCorrente || "ALL");
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

  // Sync with global shift if it changes externally
  useEffect(() => {
    if (turnoCorrente) {
      setSelectedTurno(turnoCorrente);
    }
  }, [turnoCorrente]);

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
    if (data) setComponentConfigs(data);
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
    "RG_ECO", // Eco (6)
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
      const date = globalDate || new Date().toISOString().split("T")[0];

      // 1. Fetch production data
      let qProd = supabase.from("conferme_sap").select("*").eq("data", date);
      if (selectedTurno !== "ALL") qProd = qProd.eq("turno_id", selectedTurno);

      // 2. Fetch downtime data
      let qDowntime = supabase
        .from("fermi_macchina")
        .select("*")
        .eq("data", date);
      if (selectedTurno !== "ALL") qDowntime = qDowntime.eq("turno_id", selectedTurno);

      const [resProd, resDowntime] = await Promise.all([qProd, qDowntime]);

      setRawProductionData(resProd.data || []);
      setRawDowntimeData(resDowntime.data || []);
      setLoading(false);
    };

    fetchData();
  }, [globalDate, selectedTurno, anagrafica]);

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
        // FALLBACK: use macchina_id from the row, then fino-based machine lookup
        machineId = rawMachineId ? getPrimaryMachineId(rawMachineId) : null;
        if (!machineId && rowFino && finoToMachineId[rowFino]) {
          machineId = getPrimaryMachineId(finoToMachineId[rowFino]);
        }
        if (!machineId) return;

        // Component from anagrafica
        const info = anagrafica[mat];
        if (info?.componente) {
          const project = info.progetto || (mat.startsWith("M016") ? "DCT Eco" : mat.startsWith("M015") ? "8Fe" : "DCT 300");
          compKey = info.componente;
          if (project === "DCT Eco") compKey += "_ECO";
          else if (project === "8Fe") compKey += "_8FE";
        }
      }

      if (!machineId || !compKey) return;

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
  }, [rawProductionData, rawDowntimeData, activeTech, anagrafica, tecnologie, componentConfigs, macchine, localMachineFinos]);


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
    return components.reduce((sum, comp) => {
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

  const tabStyle = (techId) => ({
    padding: "8px 14px",
    backgroundColor: activeTech === techId ? "#3B82F6" : "#E5E7EB",
    color: activeTech === techId ? "white" : "#111827",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "11px",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  });

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              Report Produzione
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Dati del{" "}
              <strong>{formatItalianDate(globalDate || new Date())}</strong> -
              Turno <strong>{selectedTurno === "ALL" ? "Tutti (Intera Giornata)" : selectedTurno}</strong>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <select
              value={selectedTurno}
              onChange={(e) => setSelectedTurno(e.target.value)}
              style={{
                padding: "10px 16px",
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
            >
              <option value="ALL">Tutto il giorno</option>
              {["A", "B", "C", "D"].map(t => (
                  <option key={t} value={t}>Turno {t}</option>
              ))}
            </select>
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
            TUTTO
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
                  {tec.displayLabel}
                </button>
              ));
          })()}
        </div>
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
                  Fermi (min)
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
                {components.map((comp, idx) => {
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
                        position: "relative",
                      }}
                    >
                      {comp.replace("_ECO", "").replace("_8FE", "")}
                      <span
                        title={isConfigured ? `${componentConfigs.filter(c=>c.componente===comp).length} macchine configurate` : "Clicca per aggiungere"}
                        onClick={() => setEditingComponent({
                          componente: comp,
                          macchina_id: "",
                          progetto: "",
                          codicisText: "",
                          fino: "",
                        })}
                        style={{
                          display: "inline-block",
                          marginLeft: "4px",
                          cursor: "pointer",
                          color: isConfigured ? "#10b981" : "#9ca3af",
                          fontSize: "11px",
                          verticalAlign: "middle",
                        }}
                      >⚙</span>
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
                    }}
                  >
                    <td
                      onClick={() => setEditingMachine({
                        id: machineId,
                        nome: displayLabel,
                        fino: localMachineFinos[machineId] ?? (macchine.find(m => m.id === machineId)?.fino || ""),
                      })}
                      style={{
                        padding: "12px 16px",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                        borderRight: "1px solid var(--border)",
                        position: "sticky",
                        left: 0,
                        backgroundColor: isRowHovered ? "#eef2ff" : "var(--bg-card)",
                        zIndex: 10,
                        whiteSpace: "nowrap",
                        transition: "background-color 0.1s",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        title={localMachineFinos[machineId] ? `Fino: ${localMachineFinos[machineId]}` : "Configura fino"}
                        style={{
                          width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
                          backgroundColor: localMachineFinos[machineId] ? "#10b981" : "#d1d5db",
                          display: "inline-block",
                        }}
                      />
                      {displayLabel}
                    </td>
                    <td
                      onClick={() =>
                        downtime > 0 &&
                        setSelectedMachineDowntime({
                          id: machineId,
                          label: displayLabel,
                          details: detailedDowntime[machineId] || [],
                        })
                      }
                      style={{
                        border: "1px solid var(--border)",
                        padding: "8px",
                        textAlign: "center",
                        backgroundColor: isRowHovered
                          ? "#eef2ff"
                          : downtime > 0
                            ? "rgba(239,68,68,0.1)"
                            : "var(--bg-card)",
                        fontWeight: "700",
                        color:
                          downtime > 0 ? "var(--danger)" : "var(--text-muted)",
                        cursor: downtime > 0 ? "pointer" : "default",
                      }}
                    >
                      {downtime > 0 ? downtime : "—"}
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

                    {components.map((comp, cidx) => {
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
                            if (hasProduction) {
                              const rawDetails = details;
                              const groupedDetails = Object.values(
                                rawDetails.reduce((acc, curr) => {
                                  const mat = curr.materiale || "N/A";
                                  if (!acc[mat]) {
                                    acc[mat] = { ...curr, qta_ottenuta: 0 };
                                  }
                                  acc[mat].qta_ottenuta += curr.qta_ottenuta || 0;
                                  return acc;
                                }, {}),
                              );

                              setSelectedProduction({
                                machineId,
                                label: displayLabel,
                                componentName: comp
                                  .replace("_ECO", "")
                                  .replace("_8FE", ""),
                                details: groupedDetails,
                              });
                            }
                          }}
                          style={{
                            border: "1px solid var(--border)",
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
                            opacity: val ? 1 : 0.2,
                            transition: "background-color 0.1s",
                            cursor: val ? "pointer" : "default",
                          }}
                        >
                          {val || "0"}
                          {hasProduction && (
                            <div style={{ 
                              fontSize: "9px", 
                              color: "var(--text-muted)", 
                              marginTop: "2px", 
                              lineHeight: "1.1",
                              fontWeight: "400",
                              pointerEvents: "none"
                            }}>
                              <div style={{ 
                                whiteSpace: "nowrap", 
                                overflow: "hidden", 
                                textOverflow: "ellipsis", 
                                maxWidth: "70px", 
                                margin: "0 auto" 
                              }}>
                                {mats.join(", ")}
                              </div>
                              {opCodes.length > 0 && (
                                <div style={{ color: "var(--accent)", fontSize: "8px" }}>
                                  op: {opCodes.join("/")}
                                </div>
                              )}
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
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
              width: "550px", // Slightly wider to accommodate "DRA10069 + DRA10070"
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
                Dettaglio Produzione: {selectedProduction.label} -{" "}
                {selectedProduction.componentName}
              </h3>
              <button
                onClick={() => setSelectedProduction(null)}
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
                      Materiale
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
                      Quantità
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProduction.details.length > 0 ? (
                    selectedProduction.details.map((p, i) => (
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
                            {p.materiale || "N/A"}
                          </div>
                          {anagrafica[p.materiale?.toUpperCase()]
                            ?.descrizione && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-muted)",
                                  marginTop: "2px",
                                }}
                              >
                                {
                                  anagrafica[p.materiale?.toUpperCase()]
                                    .descrizione
                                }
                              </div>
                            )}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "12px 0",
                            fontWeight: "700",
                            color: "var(--text-primary)",
                          }}
                        >
                          {p.qta_ottenuta}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
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
                {selectedProduction.details.reduce(
                  (sum, p) => sum + (p.qta_ottenuta || 0),
                  0,
                )}{" "}
                pz
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setSelectedProduction(null)}
                style={{ padding: "8px 24px" }}
              >
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
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000,
      backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-card)", borderRadius: "16px", padding: "28px",
        width: "460px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "4px" }}>
          ⚙ Configura: <span style={{ color: "var(--accent)" }}>{editing.componente}</span>
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
          Associa macchina + fino + codici materiale. La combinazione <strong>fino + materiale</strong> identifica univocamente la macchina.
        </p>

        {/* Existing configs for this component */}
        {existing.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>CONFIGURAZIONI ESISTENTI</label>
            {existing.map(cfg => (
              <div key={cfg.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", backgroundColor: "var(--bg-secondary)", borderRadius: "8px", marginBottom: "6px", fontSize: "13px" }}>
                <span style={{ flex: 1 }}>
                  <strong>{cfg.macchina_id || "—"}</strong>
                  {cfg.fino && <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>op:{cfg.fino}</span>}
                  <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>{(cfg.codici||[]).length} codici</span>
                </span>
                <button
                  onClick={() => onChange({ ...cfg, codicisText: (cfg.codici||[]).join("\n") })}
                  style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: "12px" }}
                >Modifica</button>
                <button
                  onClick={() => onDelete(cfg.id)}
                  style={{ padding: "4px 10px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontSize: "12px" }}
                >✕</button>
              </div>
            ))}
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0" }} />
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>Aggiungi nuova associazione:</p>
          </div>
        )}

        <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>MACCHINA *</label>
        <select
          value={editing.macchina_id || ""}
          onChange={e => onChange({ ...editing, macchina_id: e.target.value })}
          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "16px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "14px" }}
        >
          <option value="">— Seleziona macchina —</option>
          {(macchine || []).map(m => (
            <option key={m.id} value={m.id}>{m.id} {m.nome ? `— ${m.nome}` : ""}</option>
          ))}
        </select>

        <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>FINO (operazione SAP) *</label>
        <input
          type="text"
          value={editing.fino}
          onChange={e => onChange({ ...editing, fino: e.target.value })}
          placeholder="es. 50, TORNS..."
          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "16px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box" }}
        />

        <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>CODICI MATERIALE *</label>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Uno per riga oppure separati da virgola</p>
        <textarea
          value={editing.codicisText}
          onChange={e => onChange({ ...editing, codicisText: e.target.value })}
          rows={5}
          placeholder={"M0170686/S\nM0170687\nM0170688"}
          style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "16px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
        />

        <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>PROGETTO</label>
        <select
          value={editing.progetto}
          onChange={e => onChange({ ...editing, progetto: e.target.value })}
          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "24px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "14px" }}
        >
          <option value="">— Nessuno —</option>
          <option value="DCT 300">DCT 300</option>
          <option value="8Fe">8Fe</option>
          <option value="DCT Eco">DCT Eco</option>
        </select>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid var(--border)", background: "none", cursor: "pointer", fontWeight: "600" }}>Chiudi</button>
          <button onClick={onSave} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#10b981", color: "white", cursor: "pointer", fontWeight: "700" }}>Salva</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── MACHINE FINO MODAL ───────────── */
function MachineFineModal({ editing, onChange, onSave, onClose }) {
  if (!editing) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000,
      backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-card)", borderRadius: "16px", padding: "28px",
        width: "360px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "4px" }}>
          🔩 Macchina: <span style={{ color: "var(--accent)" }}>{editing.nome}</span>
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
          Imposta il codice <strong>fino</strong> SAP per abbinare i record di <code>conferme_sap</code>.
        </p>

        <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>FINO</label>
        <input
          type="text"
          value={editing.fino}
          onChange={e => onChange({ ...editing, fino: e.target.value })}
          placeholder="es. TORNS"
          style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "24px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "15px", fontWeight: "700", boxSizing: "border-box" }}
          autoFocus
        />

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid var(--border)", background: "none", cursor: "pointer", fontWeight: "600" }}>Annulla</button>
          <button onClick={onSave} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", cursor: "pointer", fontWeight: "700" }}>Salva</button>
        </div>
      </div>
    </div>
  );
}
