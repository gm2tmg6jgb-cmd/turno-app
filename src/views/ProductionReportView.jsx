import React, { useState, useEffect, useMemo } from "react";
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
  const [matrice, setMatrice] = useState({});
  const [downtimeMap, setDowntimeMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [anagrafica, setAnagrafica] = useState({});
  const [hoveredCol, setHoveredCol] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailedDowntime, setDetailedDowntime] = useState({});
  const [selectedMachineDowntime, setSelectedMachineDowntime] = useState(null);
  const [detailedProduction, setDetailedProduction] = useState({});
  const [selectedProduction, setSelectedProduction] = useState(null);

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
      if (turnoCorrente) qProd = qProd.eq("turno_id", turnoCorrente);

      // 2. Fetch downtime data
      let qDowntime = supabase
        .from("fermi_macchina")
        .select("*")
        .eq("data", date);
      if (turnoCorrente) qDowntime = qDowntime.eq("turno_id", turnoCorrente);

      const [resProd, resDowntime] = await Promise.all([qProd, qDowntime]);

      // Process production data into matrix
      const newMatrice = {};
      const newDetailedProduction = {};
      if (resProd.data) {
        resProd.data.forEach((row) => {
          const machineId = row.macchina_id || row.work_center_sap;
          if (!machineId) return;

          const info = anagrafica[row.materiale?.toUpperCase()];
          const project =
            info?.progetto ||
            (row.materiale?.startsWith("M016")
              ? "DCT Eco"
              : row.materiale?.startsWith("M015")
                ? "8Fe"
                : "DCT 300");
          const compName = info?.componente;

          if (compName) {
            let key = compName;
            // Handle naming collisions with suffixes
            if (project === "DCT Eco") key += "_ECO";
            else if (project === "8Fe") key += "_8FE";

            if (!newMatrice[machineId]) newMatrice[machineId] = {};
            newMatrice[machineId][key] =
              (newMatrice[machineId][key] || 0) + (row.qta_ottenuta || 0);

            if (!newDetailedProduction[machineId])
              newDetailedProduction[machineId] = {};
            if (!newDetailedProduction[machineId][key])
              newDetailedProduction[machineId][key] = [];
            newDetailedProduction[machineId][key].push(row);
          }
        });
      }
      setMatrice(newMatrice);
      setDetailedProduction(newDetailedProduction);

      // Process downtime data
      const newDowntimeMap = {};
      const newDetailedDowntime = {};
      if (resDowntime.data) {
        resDowntime.data.forEach((row) => {
          const mId = row.macchina_id;
          if (!mId) return;
          newDowntimeMap[mId] =
            (newDowntimeMap[mId] || 0) + (row.durata_minuti || 0);

          if (!newDetailedDowntime[mId]) newDetailedDowntime[mId] = [];
          newDetailedDowntime[mId].push(row);
        });
      }
      setDowntimeMap(newDowntimeMap);
      setDetailedDowntime(newDetailedDowntime);
      setLoading(false);
    };

    if (Object.keys(anagrafica).length > 0) {
      fetchData();
    } else if (loading) {
      // If anagrafica is empty but we haven't loaded it yet, don't stop loading
    }
  }, [globalDate, turnoCorrente, anagrafica]);

  const all_machines_order = [
    "DRA10060",
    "DRA10061",
    "DRA10062",
    "DRA10063",
    "DRA10064",
    "DRA10065",
    "DRA10066",
    "DRA10067",
    "DRA10068",
    "DRA10069",
    "DRA10070",
    "DRA10071",
    "DRA10072",
    "DRA11042",
    "FRW10193",
    "FRW10217",
    "FRW10076",
    "FRW10078",
    "FRW12464",
    "FRW10074",
    "FRW10075",
    "FRW10082",
    "FRW10140",
    "FRW10079",
    "FRW11980",
    "FRW10081",
    "FRW11010",
    "FRW11022",
    "FRW11016",
    "FRW11017",
    "EGW11005",
    "EGW11008",
    "EGW11014",
    "EGW11015",
    "EGW11016",
    "SCA11008",
    "SCA11009",
    "SCA11010",
    "SCA10151",
    "SCA11006",
    "MZA11005",
    "MZA11006",
    "MZA11008",
    "MZA10005",
    "STW11002",
    "STW11007",
    "STW19069",
    "STW12177",
    "FRD19013",
    "FRD19060",
    "ORE19068",
    "RAA11009",
    "FRA11023",
    "FRA11025",
    "DRA10110",
    "DRA10111",
    "DRA10116",
    "DRA10106",
    "DRA10102",
    "DRA10108",
    "DRA10099",
    "DRA10100",
    "DRA19009",
    "DRA10097",
    "DRA10098",
    "DRA10101",
    "DRA10107",
    "DRA11016",
    "DRA10113",
    "DRA10114",
    "DRA10109",
    "SLW11011",
    "SLW11012",
    "SLW11046",
    "SLW11126",
    "SLW11044",
    "SLW11009",
    "SLW11010",
    "SLW11017",
    "SLW11014",
    "SLW11027",
    "SLW11026",
    "SLW11028",
    "SLW11013",
    "SLW11048",
    "HNW16040",
    "SLA11083",
    "SLA11084",
    "SLA11085",
    "SLA11086",
    "SLA11087",
    "SLA11088",
    "SLA11089",
    "SLA11090",
    "SLA11091",
    "SLA11092",
    "SLA11108",
    "SLA11109",
    "SLA11110",
    "SCA10078",
    "DRA10058",
    "DRA10059",
    "DRA11044",
    "FRW10189",
    "FRW10073",
    "FRW11015",
    "EGW11006",
    "EGW11007",
    "BOA394",
    "DRA10096",
    "DRA10190",
    "DRA11837",
    "SLW11018",
    "SLW11019",
    "SLW11029",
    "DRA11130",
    "DRA11131",
    "DRA11132",
    "DRA11133",
    "ORE11103",
    "MON12551",
    "SCA11051",
  ];

  const activeTechMachines = useMemo(() => {
    const softList = [
      "DRA10060",
      "DRA10061",
      "DRA10062",
      "DRA10063",
      "DRA10064",
      "DRA10065",
      "DRA10066",
      "DRA10067",
      "DRA10068",
      "DRA10069",
      "DRA10070",
      "DRA10071",
      "DRA10072",
      "DRA11042",
    ];
    const hardList = [
      "DRA10110",
      "DRA10111",
      "DRA10116",
      "DRA10106",
      "DRA10102",
      "DRA10108",
      "DRA10099",
      "DRA10100",
      "DRA19009",
      "DRA10097",
      "DRA10098",
      "DRA10101",
      "DRA10107",
      "DRA11016",
      "DRA10113",
      "DRA10114",
      "DRA10109",
    ];

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

        if (!activeTech || activeTech === "TUTTO") return true;
        const tec = tecnologie.find(
          (t) =>
            t.id === activeTech ||
            t.label === activeTech ||
            t.codice === activeTech,
        );
        if (!tec) return true;

        const label = tec.label?.toLowerCase() || "";

        // Specific logic for Tornitura Soft/Hard to resolve overlap
        if (label.includes("tornitura soft")) {
          return softList.includes(machineId);
        }
        if (label.includes("tornitura hard")) {
          return hardList.includes(machineId);
        }
        if (label.includes("controllo ut")) {
          return machineId === "MZA10005";
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
        const idxA = all_machines_order.indexOf(a);
        const idxB = all_machines_order.indexOf(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
  }, [macchine, activeTech, tecnologie, all_machines_order, searchQuery]);

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
    const shiftStr = turnoCorrente || "N/A";
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

      // Only include machines with activity to keep email concise
      if (productionTotal > 0 || downtimeTotal > 0) {
        hasData = true;
        emailBody += `${machineLabel}\n`;
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

  const tabStyle = (techId, label) => ({
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
              Turno <strong>{turnoCorrente || "N/A"}</strong>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
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
                  return (
                    <th
                      key={idx}
                      onMouseEnter={() => setHoveredCol(comp)}
                      onMouseLeave={() => setHoveredCol(null)}
                      style={{
                        border: "1px solid var(--border)",
                        padding: "8px",
                        textAlign: "center",
                        backgroundColor: isColHovered
                          ? "#eef2ff"
                          : "var(--bg-secondary)",
                        fontWeight: "600",
                        fontSize: "13px",
                        minWidth: "70px",
                        color: "var(--text-primary)",
                        fontFamily: "inherit",
                        transition: "background-color 0.1s",
                      }}
                    >
                      {comp.replace("_ECO", "").replace("_8FE", "")}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeTechMachines.map((machineId, ridx) => {
                const mObj = macchine.find((m) => m.id === machineId);
                const machineLabel = mObj?.nome || machineId;
                const downtime = downtimeMap[machineId] || 0;
                const isRowHovered = hoveredRow === machineId;
                return (
                  <tr
                    key={ridx}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: isRowHovered ? "#eef2ff" : "transparent",
                    }}
                    onMouseEnter={() => setHoveredRow(machineId)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td
                      style={{
                        border: "1px solid var(--border)",
                        padding: "8px",
                        textAlign: "center",
                        backgroundColor: isRowHovered
                          ? "#eef2ff"
                          : "var(--bg-card)",
                        fontWeight: "600",
                        minWidth: "100px",
                        position: "sticky",
                        left: 0,
                        zIndex: 5,
                      }}
                    >
                      {machineLabel}
                    </td>
                    <td
                      onClick={() =>
                        downtime > 0 &&
                        setSelectedMachineDowntime({
                          id: machineId,
                          label: machineLabel,
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
                      const val = matrice[machineId]
                        ? matrice[machineId][comp]
                        : "";
                      const isColHovered = hoveredCol === comp;
                      return (
                        <td
                          key={cidx}
                          onMouseEnter={() => setHoveredCol(comp)}
                          onMouseLeave={() => setHoveredCol(null)}
                          onClick={() => {
                            if (val) {
                              const rawDetails =
                                detailedProduction[machineId]?.[comp] || [];
                              const groupedDetails = Object.values(
                                rawDetails.reduce((acc, curr) => {
                                  const mat = curr.materiale || "N/A";
                                  if (!acc[mat]) {
                                    acc[mat] = { ...curr, qta_ottenuta: 0 };
                                  }
                                  acc[mat].qta_ottenuta +=
                                    curr.qta_ottenuta || 0;
                                  return acc;
                                }, {}),
                              );

                              setSelectedProduction({
                                machineId,
                                machineLabel,
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
                      Causale
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
                            {motiviFermo.find((m) => m.id === f.causale_id)
                              ?.nome ||
                              f.causale_id ||
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
                Dettaglio Produzione: {selectedProduction.machineLabel} -{" "}
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
    </div>
  );
}
