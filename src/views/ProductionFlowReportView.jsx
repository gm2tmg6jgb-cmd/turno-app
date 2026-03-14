import React, { useState, useEffect } from "react";
import { Icons } from "../components/ui/Icons";
import { supabase } from "../lib/supabase";
import { formatItalianDate } from "../lib/dateUtils";

export default function ProductionFlowReportView({ macchine = [], tecnologie = [], globalDate, turnoCorrente }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTech, setActiveTech] = useState("TUTTO");
  const [productionData, setProductionData] = useState({});
  const [anagrafica, setAnagrafica] = useState({});
  const [loading, setLoading] = useState(true);
  const [hasSoftProduction, setHasSoftProduction] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const date = globalDate || new Date().toISOString().split("T")[0];
        
        // 1. Fetch anagrafica
        const { data: anaData } = await supabase.from("anagrafica_materiali").select("*");
        const anaMap = {};
        if (anaData) {
          anaData.forEach(item => {
            anaMap[item.codice.toUpperCase()] = item;
          });
          setAnagrafica(anaMap);
        }

        // 2. Fetch production
        let query = supabase.from("conferme_sap").select("*").eq("data", date);
        if (turnoCorrente && turnoCorrente !== "ALL") {
          query = query.eq("turno_id", turnoCorrente);
        }
        
        const { data: prodData, error } = await query;
        if (error) throw error;

        // Group by machine and component
        const grouped = {};
        const softMachines = new Set();
        
        prodData.forEach(row => {
          const mId = row.macchina_id || row.work_center_sap;
          const mat = (row.materiale || "").toUpperCase();
          const info = anaMap[mat];
          const comp = info?.componente;
          
          if (mat.endsWith("/S") && mId) {
            softMachines.add(mId.toUpperCase());
          }
          
          if (mId && comp) {
            if (!grouped[mId]) grouped[mId] = {};
            grouped[mId][comp] = (grouped[mId][comp] || 0) + (row.qta_ottenuta || 0);
          }
        });
        setProductionData(grouped);
        setHasSoftProduction(softMachines);
      } catch (err) {
        console.error("Errore recupero dati SAP:", err);
      } finally {
        setLoading(false);
      }
    };

    if (globalDate) {
      fetchData();
    }
  }, [globalDate, turnoCorrente]);

  const filteredMachines = macchine.filter((m) => {
    const machineId = m.id.toUpperCase();
    const machineName = m.nome?.toUpperCase() || "";
    const query = searchQuery.toUpperCase();

    if (query && !machineId.includes(query) && !machineName.includes(query)) {
      return false;
    }

    if (activeTech === "TUTTO") return true;

    // Custom filtering for new RG/DH technologies (must be BEFORE the !tec check)
    if (activeTech === "rg_loop_grande") {
      const rgIds = ["DRA10058", "DRA10059", "FRW10109", "FRW10073", "FRW10073_13", "EGW11007", "BOA10094", "FRW10189"];
      return rgIds.includes(machineId);
    }
    if (activeTech === "rg_mini_opf") {
      const rgMiniIds = ["DRA11044", "FRW11015", "EGW11006"];
      return rgMiniIds.includes(machineId);
    }
    if (activeTech === "dh") {
      const dhIds = ["DRA11130", "DRA11131", "DRA11132", "DRA11133", "MON12051", "SCA11051", "SCA11151"];
      return dhIds.includes(machineId);
    }
    
    // Support for moving MZA machines to Saldatura Laser
    if (activeTech === "saldatrici" || activeTech === "saldatura_laser") {
      if (machineId === "MZA10005" || machineId === "MZA11006") return true;
    }
    
    const tec = tecnologie.find(t => t.id === activeTech);
    if (!tec) return true;
    
    const label = tec.label?.toLowerCase() || "";
    const isSoftView = label.includes("tornitura soft");
    const isHardView = label.includes("tornitura hard");

    // 4. Exclude specialized machines from standard prefix-based tabs
    const customAssignedMachines = [
      "DRA10058", "DRA10059", "FRW10109", "FRW10073", "FRW10073_13", "EGW11007", "BOA10094", "FRW10189",
      "DRA11044", "FRW11015", "EGW11006",
      "DRA11130", "DRA11131", "DRA11132", "DRA11133",
      "MON12051",
      "SCA11051", "SCA11151",
      "DRA11037", "DRA10115",
      "MZA10005", "MZA11006"
    ];
    if (customAssignedMachines.includes(machineId)) {
      return false; 
    }

    if (machineId.startsWith("DRA")) {
      // 1. Database override takes priority
      if (m.tecnologia_id === "TH" || m.tecnologia_id?.toLowerCase() === "tornitura_hard") {
        return isHardView;
      }
      if (m.tecnologia_id === "TS" || m.tecnologia_id?.toLowerCase() === "tornitura_soft") {
        return isSoftView;
      }

      // 2. Dynamic check based on production today
      const hasSoft = hasSoftProduction.has(machineId);
      const hasAnyProd = productionData[m.id] && Object.keys(productionData[m.id]).length > 0;

      if (isSoftView) {
        // Shown in soft if it has soft production OR if it has NO production and DRA prefix (default)
        return hasSoft || !hasAnyProd;
      }
      if (isHardView) {
        // Shown in hard if it has production but NONE of it is soft
        return hasAnyProd && !hasSoft;
      }
    }



    // Standard prefix filtering for other machines
    if (tec?.prefissi) {
      const prefixes = tec.prefissi.split(",").map(p => p.trim().toUpperCase());
      return prefixes.some(p => machineId.startsWith(p));
    }
    return m.tecnologia_id === activeTech;
  }).sort((a, b) => a.id.localeCompare(b.id));

  const tabStyle = (techId) => ({
    padding: "8px 16px",
    backgroundColor: activeTech === techId ? "var(--accent)" : "var(--bg-tertiary)",
    color: activeTech === techId ? "white" : "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    transition: "all 0.2s",
  });

  return (
    <div className="fade-in" style={{ padding: "24px", height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "8px" }}>Report Flusso di Processo</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            Dati del <strong>{formatItalianDate(globalDate || new Date().toISOString().split("T")[0])}</strong> - 
            Turno <strong>{turnoCorrente === "ALL" ? "Tutti" : turnoCorrente}</strong>
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              {Icons.search}
            </span>
            <input
              type="text"
              placeholder="Cerca macchina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "10px 16px 10px 40px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-primary)",
                width: "240px",
                outline: "none"
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTech("TUTTO")} style={tabStyle("TUTTO")}>Tutte le tecnologie</button>
        {(() => {
          const EXTRA_TECS = [
            { id: "rg_loop_grande", label: "RG Loop Grande" },
            { id: "rg_mini_opf", label: "RG Mini OPF" },
            { id: "dh", label: "DH" }
          ];

          // Combine with existing technologies, avoiding duplicates
          const allTecs = [...tecnologie];
          EXTRA_TECS.forEach(extra => {
            if (!allTecs.some(t => t.id === extra.id)) {
              allTecs.push(extra);
            }
          });

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
            "rectifica denti": "Rettifica Denti",
            "rg loop grande": "RG Loop Grande",
            "rg mini opf": "RG Mini OPF",
            dh: "DH"
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
            "RG Loop Grande",
            "RG Mini OPF",
            "DH"
          ];

          return allTecs
            .filter(t => {
              const label = (t.label || "").toLowerCase();
              return !label.includes("controllo ut") && !label.includes("foratrice");
            })
            .map(t => {
              const originalLabel = (t.label || "").toLowerCase();
              let displayLabel = t.label;
              for (const [key, val] of Object.entries(labelMapping)) {
                if (originalLabel === key || originalLabel.includes(key)) {
                  displayLabel = val;
                  break;
                }
              }
              return { ...t, displayLabel };
            })
            .sort((a, b) => {
              let idxA = desiredOrder.indexOf(a.displayLabel);
              let idxB = desiredOrder.indexOf(b.displayLabel);
              if (idxA === -1) idxA = 999;
              if (idxB === -1) idxB = 999;
              return idxA - idxB;
            })
            .map(t => (
              <button key={t.id} onClick={() => setActiveTech(t.id)} style={tabStyle(t.id)}>
                {t.displayLabel}
              </button>
            ));
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
        {(() => {
          // Define twin groups
          const twinGroups = [
            ["DRA10063", "DRA10064"],
            ["DRA10065", "DRA10066"],
            ["DRA10067", "DRA10068"],
            ["DRA10069", "DRA10070"],
            ["DRA10097", "DRA10098"],
            ["DRA10099", "DRA10100"],
            ["DRA10101", "DRA10107"],
            ["DRA10102", "DRA10108"],
            ["DRA10110", "DRA10111"],
            ["DRA10113", "DRA10114"],
          ];
          
          const processedMachines = [];
          const seenInTwin = new Set();

          // Helper to find which group a machine belongs to
          const getGroup = (id) => twinGroups.find(group => group.includes(id));

          filteredMachines.forEach(m => {
            const group = getGroup(m.id);
            if (group) {
              const groupKey = `TWIN_${group.join("_")}`;
              if (!seenInTwin.has(groupKey)) {
                processedMachines.push({
                  id: group.join(" + "),
                  ids: group,
                  nome: null,
                  isTwin: true
                });
                seenInTwin.add(groupKey);
              }
            } else {
              processedMachines.push(m);
            }
          });

          return processedMachines.map((m) => {
            const mid = m.id.toUpperCase();
            const isFRW = mid === "FRW10074" || mid === "FRW10075";
            const isMZA = mid === "MZA10005";
            const isRAA = mid === "RAA11009";
            const isSingle = mid === "BOA10094" || mid === "RAA11009" || mid === "DRA10116" || mid === "DRA10009";
            const isDouble = mid === "DRA10109";
            const isSpecial = isFRW || isMZA || isRAA || isSingle || isDouble || m.isTwin;
            
            const isRGMin = mid === "DRA11044" || mid === "FRW11015" || mid === "EGW11006";
            
            // Logic to identify if it's a "Tornitura Soft" machine (same as filtering)
            const isSoftMachine = mid.startsWith("DRA") && (
              m.tecnologia_id === "TS" || 
              m.tecnologia_id?.toLowerCase() === "tornitura_soft" ||
              (hasSoftProduction.has(mid) && m.tecnologia_id !== "TH" && m.tecnologia_id?.toLowerCase() !== "tornitura_hard")
            );

            // All boxes must have exactly 4 slots
            const slotCount = 4;
            
            return (
              <div key={m.id} style={{ 
                backgroundColor: "var(--bg-card)", 
                borderRadius: "16px", 
                padding: "24px", 
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                transition: "transform 0.2s ease"
              }}>
                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                  <div style={{ fontWeight: "900", fontSize: "20px", color: "var(--accent)" }}>{m.id}</div>
                  {m.nome && m.nome !== m.id && (
                    <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "2px" }}>{m.nome}</div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-start" }}>
                  {Array.from({ length: slotCount }).map((_, i) => {
                    let displayQty = null;
                    let displayComp = null;
                    let displayProj = null;

                    if (isFRW) {
                      const mProd = productionData[m.id] || {};
                      displayQty = i === 0 ? (mProd["SG5"] || 0) : null;
                      displayComp = "SG5";
                      displayProj = "DCT 300";
                    } else if (isMZA) {
                      displayComp = "CONTROLLO UT";
                      displayProj = "";
                    } else if (isRAA) {
                      const mProd = productionData[m.id] || {};
                      displayQty = i === 0 ? (mProd["PG"] || 0) : null;
                      displayComp = "PG";
                      displayProj = "M0154996/S";
                    } else if (isRGMin) {
                      displayComp = "RG";
                      displayProj = "";
                    }

                    return (
                      <div key={i} style={{
                        minWidth: "110px",
                        width: "110px",
                        height: "100px",
                        background: (displayQty !== null || isMZA || isSingle || isDouble || m.isTwin) ? "linear-gradient(145deg, #10b981, #059669)" : "linear-gradient(145deg, #3c6ef0, #2f5bd6)",
                        color: "white",
                        borderRadius: "15px",
                        textAlign: "center",
                        boxShadow: "0 8px 18px rgba(0,0,0,0.15)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "12px 8px",
                        transition: "transform 0.2s ease",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                          <div style={{ fontSize: "18px", fontWeight: "900", color: "rgba(255,255,255,0.95)" }}>{displayComp || ""}</div>
                          <div style={{ fontSize: "12px", fontWeight: "bold", opacity: 0.85, letterSpacing: "0.5px" }}>{displayProj || ""}</div>
                          <div style={{ fontSize: "26px", fontWeight: "900", lineHeight: 1, marginTop: "4px" }}>
                            {displayQty !== null ? displayQty : (displayComp || displayProj ? 0 : Icons.plus)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
