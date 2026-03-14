import React, { useState, useEffect } from "react";
import { Icons } from "../components/ui/Icons";
import { supabase } from "../lib/supabase";

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
    
    const tec = tecnologie.find(t => t.id === activeTech);
    if (!tec) return true;
    
    const label = tec.label?.toLowerCase() || "";
    const isSoftView = label.includes("tornitura soft");
    const isHardView = label.includes("tornitura hard");

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
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Visualizzazione sequenziale delle fasi di lavoro per macchina</p>
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
        {tecnologie.map(t => (
          <button key={t.id} onClick={() => setActiveTech(t.id)} style={tabStyle(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
        {(() => {
          // Define twin groups
          const twinGroups = [
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
                  nome: "Gemellari",
                  isTwin: true
                });
                seenInTwin.add(groupKey);
              }
            } else {
              processedMachines.push(m);
            }
          });

          return processedMachines.map((m) => {
            const isFRW = m.id === "FRW10074" || m.id === "FRW10075";
            const isMZA = m.id === "MZA10005";
            const isSingle = m.id === "BOA10094" || m.id === "RAA11009" || m.id === "DRA10116" || m.isTwin;
            const isDouble = m.id === "DRA10109";
            const isSpecial = isFRW || isMZA || isSingle || isDouble;
            let slotCount = 5;
            if (isSingle) slotCount = 1;
            else if (isDouble) slotCount = 2;
            else if (isSpecial) slotCount = 3; 
            
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
                  <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "2px" }}>{m.nome}</div>
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
                    }

                    return (
                      <div key={i} style={{
                        minWidth: "110px",
                        width: "110px",
                        height: "100px",
                        background: (displayQty !== null || isMZA || isSingle || isDouble) ? "linear-gradient(145deg, #10b981, #059669)" : "linear-gradient(145deg, #3c6ef0, #2f5bd6)",
                        color: "white",
                        borderRadius: "15px",
                        textAlign: "center",
                        boxShadow: "0 8px 18px rgba(0,0,0,0.15)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "12px 8px",
                        transition: "transform 0.2s ease",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      >
                        <div style={{ fontSize: "10px", opacity: 0.8, fontWeight: 700, textTransform: "uppercase" }}>Slot {i + 1}</div>
                        
                        {(isFRW || isMZA) ? (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{ fontSize: "20px", fontWeight: "900", lineHeight: 1 }}>{displayQty || 0}</div>
                              <div style={{ fontSize: "11px", fontWeight: "bold", opacity: 0.9 }}>{displayComp}</div>
                            </div>
                            <div style={{ fontSize: "9px", opacity: 0.8, letterSpacing: 0.5, textTransform: "uppercase" }}>{displayProj}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: "24px", opacity: 0.5, margin: "auto" }}>{Icons.plus}</div>
                        )}
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
