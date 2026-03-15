import React, { useState, useEffect } from "react";
import { Icons } from "../components/ui/Icons";
import { supabase } from "../lib/supabase";
import { Modal } from "../components/ui/Modal";
import { formatItalianDate } from "../lib/dateUtils";
import { TURNI } from "../data/constants";

export default function ProductionFlowReportView({ macchine = [], tecnologie = [], motiviFermo = [], globalDate, setGlobalDate, turnoCorrente, setTurnoCorrente }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTech, setActiveTech] = useState("TUTTO");
  const [productionData, setProductionData] = useState({});
  const [fermiData, setFermiData] = useState({});
  const [anagrafica, setAnagrafica] = useState({});
  const [loading, setLoading] = useState(true);
  const [hasSoftProduction, setHasSoftProduction] = useState(new Set());

  // Fermi Entry State
  const [showFermiModal, setShowFermiModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [fermiForm, setFermiForm] = useState({ motivo: "", durata: "", note: "", is_automazione: false, target_macchina_id: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Production Detail Modal State
  const [showProdModal, setShowProdModal] = useState(false);
  const [prodModalData, setProdModalData] = useState(null); // { machineId, comp, proj, materials, totalQty }

  // Slot Config State
  const [slotConfigs, setSlotConfigs] = useState({});
  const [prodByMaterial, setProdByMaterial] = useState({});
  const [isSlotEditMode, setIsSlotEditMode] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotModalData, setSlotModalData] = useState({ machineId: "", slotIndex: 0, componente: "", progetto: "", codiceMateriale: "", sapWorkCenter: "" });
  const [isSavingSlot, setIsSavingSlot] = useState(false);

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
        const prodByMat = {}; // Direct index: { work_center: { material_code: qty } }
        const softMachines = new Set();

        prodData.forEach(row => {
          const mId = (row.macchina_id || row.work_center_sap || "").toUpperCase();
          const mat = (row.materiale || "").toUpperCase();
          const qty = row.qta_ottenuta || 0;
          const info = anaMap[mat];
          const comp = info?.componente?.toUpperCase();

          if (mat.endsWith("/S") && mId) {
            softMachines.add(mId);
          }

          // Direct index by material code (no anagrafica dependency)
          if (mId && mat) {
            if (!prodByMat[mId]) prodByMat[mId] = {};
            prodByMat[mId][mat] = (prodByMat[mId][mat] || 0) + qty;
          }

          const addToGroup = (map, key) => {
            if (!key || !comp) return;
            if (!map[key]) map[key] = {};
            if (!map[key][comp]) map[key][comp] = { total: 0, materials: [] };
            map[key][comp].total += qty;
            const existingMat = map[key][comp].materials.find(m => m.code === mat);
            if (existingMat) {
              existingMat.qty += qty;
            } else {
              map[key][comp].materials.push({
                code: mat,
                qty,
                progetto: info?.progetto || "",
                sapCode: row.work_center_sap || row.macchina_id || ""
              });
            }
          };

          addToGroup(grouped, mId);
          // Also index by work_center_sap so slot configs can always find data
          // regardless of whether macchina_id was matched at import time
          const wc = (row.work_center_sap || "").toUpperCase();
          if (wc && wc !== mId) {
            if (!prodByMat[wc]) prodByMat[wc] = {};
            prodByMat[wc][mat] = (prodByMat[wc][mat] || 0) + qty;
            addToGroup(grouped, wc);
          }
        });
        setProductionData(grouped);
        setProdByMaterial(prodByMat);
        setHasSoftProduction(softMachines);

        // 3. Fetch Fermi (downtimes)
        let fermiQuery = supabase.from("fermi_macchina").select("macchina_id, durata_minuti, motivo, is_automazione").eq("data", date);
        if (turnoCorrente && turnoCorrente !== "ALL") {
          fermiQuery = fermiQuery.eq("turno_id", turnoCorrente);
        }
        const { data: fData } = await fermiQuery;
        const fMap = {};
        if (fData) {
          fData.forEach(row => {
            const mId = row.macchina_id.toUpperCase();
            if (!fMap[mId]) fMap[mId] = { minutes: 0, entries: [] };
            fMap[mId].minutes += (row.durata_minuti || 0);
            if (row.motivo) {
              fMap[mId].entries.push({ 
                motivo: row.motivo, 
                durata: row.durata_minuti, 
                is_automazione: row.is_automazione,
                macchina_id: row.macchina_id
              });
            }
          });
        }
        setFermiData(fMap);

        // 4. Fetch slot configs
        const { data: scData } = await supabase.from("slot_config").select("*");
        const scMap = {};
        if (scData) {
          scData.forEach(row => {
            const mId = row.macchina_id.toUpperCase();
            if (!scMap[mId]) scMap[mId] = {};
            scMap[mId][row.slot_index] = {
              componente: row.componente,
              progetto: row.progetto,
              sap_work_center: row.sap_work_center,
              codice_materiale: row.codice_materiale,
            };
          });
        }
        setSlotConfigs(scMap);
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
  }).sort((a, b) => {
    // Sort by downtime minutes (highest first)
    const getMinutes = (mObj) => {
      const idsToSum = mObj.ids || [mObj.id];
      let total = 0;
      idsToSum.forEach(id => {
        total += (fermiData[id.toUpperCase()]?.minutes || 0);
      });
      return total;
    };

    const minutesA = getMinutes(a);
    const minutesB = getMinutes(b);

    if (minutesB !== minutesA) {
      return minutesB - minutesA;
    }
    
    // Fallback to alphabetical
    return a.id.localeCompare(b.id);
  });

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

  const handleOpenFermiModal = (machine) => {
    setSelectedMachine(machine);
    setFermiForm({ 
      motivo: "", 
      durata: "", 
      note: "", 
      is_automazione: false,
      target_macchina_id: (machine.ids && machine.ids.length > 0) ? machine.ids[0] : machine.id
    });
    setShowFermiModal(true);
  };

  const handleSaveFermoDirect = async () => {
    if (!selectedMachine || !fermiForm.motivo || !fermiForm.durata) {
      alert("Compila motivo e durata!");
      return;
    }

    setIsSaving(true);
    try {
      const date = globalDate || new Date().toISOString().split("T")[0];
      const payload = {
        data: date,
        turno_id: (turnoCorrente && turnoCorrente !== "ALL") ? turnoCorrente : null,
        macchina_id: fermiForm.target_macchina_id || (selectedMachine.ids ? selectedMachine.ids[0] : selectedMachine.id),
        motivo: fermiForm.motivo,
        durata_minuti: parseInt(fermiForm.durata),
        note: fermiForm.note || null,
        is_automazione: fermiForm.is_automazione || false,
      };

      const { error } = await supabase.from("fermi_macchina").insert([payload]);
      if (error) throw error;

      // Refresh data
      // I don't want to refetch everything, let's just update local state for faster feedback
      const mId = payload.macchina_id.toUpperCase();
      setFermiData(prev => {
        const current = prev[mId] || { minutes: 0, entries: [] };
        const safeEntries = Array.isArray(current.entries) ? current.entries : [];
        return {
          ...prev,
          [mId]: {
            minutes: (current.minutes || 0) + payload.durata_minuti,
            entries: [...safeEntries, { 
              motivo: payload.motivo, 
              durata: payload.durata_minuti,
              is_automazione: payload.is_automazione,
              macchina_id: payload.macchina_id
            }]
          }
        };
      });

      setShowFermiModal(false);
    } catch (err) {
      console.error("Errore salvataggio fermo:", err);
      alert("Errore durante il salvataggio!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSlot = async () => {
    const { machineId, slotIndex, componente, progetto, codiceMateriale, sapWorkCenter } = slotModalData;
    if (!componente) {
      alert("Il campo Componente è obbligatorio.");
      return;
    }
    setIsSavingSlot(true);
    try {
      const payload = {
        macchina_id: machineId,
        slot_index: slotIndex,
        componente: componente || null,
        progetto: progetto || null,
        codice_materiale: codiceMateriale || null,
        sap_work_center: sapWorkCenter || null,
      };
      const { error } = await supabase.from("slot_config").upsert(payload, { onConflict: "macchina_id,slot_index" });
      if (error) throw error;
      setSlotConfigs(prev => ({
        ...prev,
        [machineId.toUpperCase()]: {
          ...(prev[machineId.toUpperCase()] || {}),
          [slotIndex]: {
            componente: componente || null,
            progetto: progetto || null,
            codice_materiale: codiceMateriale || null,
            sap_work_center: sapWorkCenter || null,
          }
        }
      }));
      setShowSlotModal(false);
    } catch (err) {
      console.error("Errore salvataggio slot:", err);
      alert("Errore durante il salvataggio: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleDeleteSlot = async () => {
    const { machineId, slotIndex } = slotModalData;
    setIsSavingSlot(true);
    try {
      const { error } = await supabase.from("slot_config")
        .delete()
        .eq("macchina_id", machineId)
        .eq("slot_index", slotIndex);
      if (error) throw error;
      setSlotConfigs(prev => {
        const updated = { ...prev };
        if (updated[machineId.toUpperCase()]) {
          const slots = { ...updated[machineId.toUpperCase()] };
          delete slots[slotIndex];
          updated[machineId.toUpperCase()] = slots;
        }
        return updated;
      });
      setShowSlotModal(false);
    } catch (err) {
      console.error("Errore eliminazione slot:", err);
      alert("Errore durante l'eliminazione!");
    } finally {
      setIsSavingSlot(false);
    }
  };

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
        
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          {/* Date picker */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Data</label>
            <input
              type="date"
              value={globalDate || ""}
              onChange={(e) => setGlobalDate?.(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-primary)",
                fontWeight: "700",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            />
          </div>

          {/* Turno selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Turno</label>
            <select
              value={turnoCorrente || "ALL"}
              onChange={(e) => setTurnoCorrente?.(e.target.value)}
              style={{
                padding: "9px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-primary)",
                fontWeight: "700",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="ALL">Tutti i turni</option>
              {TURNI.map(t => (
                <option key={t.id} value={t.id}>Turno {t.id} — {t.coordinatore}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Cerca</label>
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
                  width: "200px",
                  outline: "none",
                  fontSize: "14px"
                }}
              />
            </div>
          </div>

          {/* Configura Slot */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", fontWeight: "700", color: "transparent", letterSpacing: "0.5px" }}>_</label>
            <button
              onClick={() => setIsSlotEditMode(prev => !prev)}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: `1px solid ${isSlotEditMode ? "var(--accent)" : "var(--border)"}`,
                backgroundColor: isSlotEditMode ? "var(--accent)" : "var(--bg-card)",
                color: isSlotEditMode ? "white" : "var(--text-secondary)",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              {isSlotEditMode ? "✓ Esci da Configura" : "⚙ Configura Slot"}
            </button>
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
            const isFRW = mid === "FRW10075"; // FRW10075 → SG5 / DCT300
            const isFRW74 = mid === "FRW10074"; // FRW10074 → SAP FRW14410
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

            // Always render exactly 4 slots. "Hidden" slot indices are invisible
            // placeholders that still occupy their fixed space in the row.
            const SLOT_COUNT = 4;
            const FERMI_IDX = SLOT_COUNT - 1;
            // Slots hidden per machine: index → invisible placeholder
            const hiddenSlots = new Set(mid === "RAA11009" ? [1, 2] : []);

            // Compute header total for slot-configured machines
            const machineSlotConfs = slotConfigs[mid] || {};
            let headerTotal = 0;
            Object.values(machineSlotConfs).forEach(sc => {
              const rf = sc.sap_work_center?.toUpperCase() || mid;
              if (sc.codice_materiale) {
                headerTotal += prodByMaterial[rf]?.[sc.codice_materiale.toUpperCase()] || 0;
              } else if (sc.componente) {
                headerTotal += productionData[rf]?.[sc.componente]?.total || 0;
              }
            });

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
                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: "900", fontSize: "20px", color: "var(--accent)" }}>{m.id}</div>
                    {m.nome && m.nome !== m.id && (
                      <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "2px" }}>{m.nome}</div>
                    )}
                  </div>
                  {headerTotal > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.5px" }}>TOT. PEZZI</div>
                      <div style={{ fontSize: "24px", fontWeight: "900", color: "#10b981" }}>{headerTotal}</div>
                    </div>
                  )}
                </div>
 
                <div style={{ 
                  display: "flex", 
                  gap: "12px", 
                  justifyContent: "start",
                  flexWrap: "nowrap",
                  width: "100%"
                }}>
                  {Array.from({ length: SLOT_COUNT }).map((_, i) => {
                    const mProd = productionData[m.id] || {};
                    const prodComponents = Object.keys(mProd);
                    
                    // Hidden slots: invisible placeholder that still holds its space
                    if (hiddenSlots.has(i)) {
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", visibility: "hidden", pointerEvents: "none" }}>
                          <div style={{ height: "14px" }} />
                          <div style={{ height: "100px" }} />
                        </div>
                      );
                    }

                    let productionInfo = null;
                    let displayComp = null;
                    let displayProj = null;

                    if (i < FERMI_IDX) {
                      // Slot config override (takes priority over all hardcoded logic)
                      const slotConf = slotConfigs[mid]?.[i];
                      const machineHasAnyConfig = !!slotConfigs[mid];
                      if (slotConf) {
                        displayComp = slotConf.componente || null;
                        const readFrom = slotConf.sap_work_center?.toUpperCase() || mid;
                        if (slotConf.codice_materiale) {
                          // Lookup diretto per codice materiale — non dipende da anagrafica_materiali
                          const matFilter = slotConf.codice_materiale.toUpperCase();
                          const qty = prodByMaterial[readFrom]?.[matFilter] || 0;
                          displayProj = slotConf.progetto || anagrafica[matFilter]?.progetto || null;
                          productionInfo = {
                            total: qty,
                            materials: qty > 0 ? [{ code: matFilter, qty, progetto: displayProj || "", sapCode: readFrom }] : []
                          };
                        } else {
                          // Lookup per componente (comportamento classico)
                          const sourceProd = productionData[readFrom] || {};
                          if (displayComp && sourceProd[displayComp]) {
                            productionInfo = sourceProd[displayComp];
                            displayProj = slotConf.progetto || productionInfo?.materials?.[0]?.progetto || null;
                          }
                        }
                      } else if (machineHasAnyConfig) {
                        // Macchina con config: slot non configurato → vuoto, nessun fallback
                      } else if (isFRW) {
                        // FRW10075 — static SG5 / DCT300
                        productionInfo = mProd["SG5"];
                        displayComp = "SG5";
                        displayProj = "DCT 300";
                      } else if (isFRW74) {
                        // FRW10074 produces under SAP code FRW14410
                        const frw74Prod = productionData["FRW14410"] || {};
                        const frw74Components = Object.keys(frw74Prod);
                        if (frw74Components[i]) {
                          displayComp = frw74Components[i];
                          productionInfo = frw74Prod[displayComp];
                          if (productionInfo?.materials?.length > 0) {
                            displayProj = productionInfo.materials[0].progetto;
                          }
                        }
                      } else if (isMZA) {
                        displayComp = i === 0 ? "CONTROLLO UT" : null;
                      } else if (isRAA) {
                        productionInfo = i === 0 ? mProd["PG"] : null;
                        displayComp = i === 0 ? "PG" : null;
                        displayProj = i === 0 ? "M0154996/S" : null;
                      } else if (isRGMin) {
                        displayComp = i === 0 ? "RG" : null;
                      } else if (mid === "DRA10060") {
                        const compMap = ["SG2", "SGR"];
                        const projMap = ["M0153389/S", "M0153391/S"];
                        // SGR is produced on SAP work center DRA14100
                        const prodSources = [mProd, productionData["DRA14100"] || {}];
                        displayComp = compMap[i] || null;
                        if (displayComp) {
                          productionInfo = prodSources[i][displayComp];
                          // Use static project as fallback if no production data
                          displayProj = productionInfo?.materials?.[0]?.progetto || projMap[i] || "";
                        }
                      } else {
                        // Dynamic logic for all other machines (including DRA)
                        if (prodComponents[i]) {
                          displayComp = prodComponents[i];
                          productionInfo = mProd[displayComp];
                          if (productionInfo?.materials?.length > 0) {
                            displayProj = productionInfo.materials[0].progetto;
                          }
                        }
                      }
                    }

                    // Last slot — FERMI (Downtimes)
                    if (i === FERMI_IDX) {
                      const idsToSum = m.ids || [m.id];
                      let minutes = 0;
                      let entries = [];
                      idsToSum.forEach(id => {
                        const fermi = fermiData[id.toUpperCase()];
                        if (fermi) {
                          minutes += (fermi.minutes || 0);
                          if (Array.isArray(fermi.entries)) {
                            entries = [...entries, ...fermi.entries];
                          }
                        }
                      });

                      const isCritical = minutes > 60;

                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ height: "14px" }} />
                        <div style={{
                          height: "100px",
                          backgroundColor: minutes > 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                          color: "var(--text-primary)",
                          borderRadius: "16px",
                          textAlign: "left",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          border: minutes > 0 
                            ? `1px solid ${isCritical ? "#ef4444" : "#f59e0b"}` 
                            : "1px dashed var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          padding: "10px 14px",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                          overflow: "hidden",
                          position: "relative"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.05)";
                          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.backgroundColor = minutes > 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)";
                        }}
                        onClick={() => handleOpenFermiModal(m)}
                        >
                          {minutes > 0 ? (
                            <>
                              <div style={{ 
                                position: "absolute", 
                                top: "0", 
                                right: "0", 
                                padding: "4px 8px", 
                                background: isCritical ? "#ef4444" : "#f59e0b",
                                color: "white",
                                fontSize: "9px",
                                fontWeight: "900",
                                borderBottomLeftRadius: "8px",
                                letterSpacing: "0.5px"
                              }}>
                                FERMI
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "4px" }}>
                                <span style={{ fontSize: "22px", fontWeight: "900", color: isCritical ? "#ef4444" : "#f59e0b" }}>{minutes}</span>
                                <span style={{ fontSize: "10px", fontWeight: "700", opacity: 0.6 }}>min</span>
                              </div>
                              <div style={{ 
                                fontSize: "11px", 
                                fontWeight: "600", 
                                color: "var(--text-secondary)",
                                marginTop: "8px",
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                columnGap: "16px",
                                rowGap: "4px",
                                overflow: "hidden",
                                lineHeight: "1.3"
                              }}>
                                {entries.map((entry, idx) => (
                                  <div key={idx} style={{ 
                                    display: "flex", 
                                    gap: "6px", 
                                    alignItems: "flex-start",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis"
                                  }}>
                                    <span style={{ color: isCritical ? "#ef4444" : "#f59e0b", flexShrink: 0 }}>•</span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                      <span style={{ fontWeight: "800", opacity: 0.9, marginRight: "4px" }}>{entry.durata}m</span>
                                      {entry.is_automazione && <span style={{ color: "#a855f7", fontWeight: "800" }}>A: </span>}
                                      {m.isTwin && entry.macchina_id && (
                                        <span style={{ opacity: 0.6 }}>({entry.macchina_id.replace(/\D/g, '').slice(-2)}) </span>
                                      )}
                                      {entry.motivo}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div style={{ 
                              height: "100%", 
                              display: "flex", 
                              flexDirection: "column", 
                              justifyContent: "center", 
                              alignItems: "center",
                              gap: "4px",
                              opacity: 0.4
                            }}>
                              <div style={{ fontSize: "20px" }}>{Icons.plus}</div>
                              <div style={{ fontSize: "9px", fontWeight: "800", textAlign: "center" }}>RECORD<br/>FERMO</div>
                            </div>
                          )}
                        </div>
                        </div>
                      );
                    }

                    const hasData = !!displayComp || !!productionInfo;
                    const bgGradient = hasData 
                      ? "linear-gradient(145deg, #10b981, #059669)" // Green if data
                      : "linear-gradient(145deg, #3c6ef0, #2f5bd6)"; // Blue if empty

                    // Extract total quantity and materials from refactored structure
                    const totalQty = productionInfo?.total ?? 0;
                    const materials = productionInfo?.materials ?? [];

                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
                        {/* Project label above slot */}
                        <div style={{
                          height: "18px",
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "var(--text-muted)",
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          letterSpacing: "0.3px",
                          lineHeight: "18px"
                        }}>
                          {displayProj || ""}
                        </div>
                        {/* Slot card */}
                        <div style={{
                          height: "100px",
                          background: bgGradient,
                          color: "white",
                          borderRadius: "15px",
                          textAlign: "left",
                          boxShadow: "0 8px 18px rgba(0,0,0,0.15)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          padding: "10px 14px",
                          transition: "transform 0.2s ease",
                          cursor: "pointer",
                          overflow: "hidden",
                          position: "relative"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        onClick={() => {
                          if (isSlotEditMode) {
                            const existing = slotConfigs[mid]?.[i];
                            setSlotModalData({
                              machineId: mid,
                              slotIndex: i,
                              componente: existing?.componente || displayComp || "",
                              progetto: existing?.progetto || "",
                              codiceMateriale: existing?.codice_materiale || "",
                              sapWorkCenter: existing?.sap_work_center || "",
                            });
                            setShowSlotModal(true);
                            return;
                          }
                          setProdModalData({
                            machineId: m.id,
                            comp: displayComp,
                            proj: displayProj,
                            materials,
                            totalQty
                          });
                          setShowProdModal(true);
                        }}
                        >
                          {/* Edit mode overlay */}
                          {isSlotEditMode && (
                            <div style={{
                              position: "absolute",
                              inset: 0,
                              background: "rgba(0,0,0,0.55)",
                              borderRadius: "15px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 2,
                              backdropFilter: "blur(1px)"
                            }}>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "18px" }}>✏️</div>
                                <div style={{ fontSize: "9px", fontWeight: "900", color: "white", letterSpacing: "0.5px", marginTop: "2px" }}>
                                  {slotConfigs[mid]?.[i] ? "MODIFICA" : "CONFIGURA"}
                                </div>
                              </div>
                            </div>
                          )}
                          {hasData ? (
                            <>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                <span style={{ fontSize: "14px", fontWeight: "700", opacity: 0.85 }}>{displayComp}</span>
                                <span style={{ fontSize: "28px", fontWeight: "900", lineHeight: 1 }}>{totalQty}</span>
                              </div>
                            </>
                          ) : (
                            <div style={{
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              <div style={{ fontSize: "20px" }}>{Icons.plus}</div>
                              <div style={{ fontSize: "9px", fontWeight: "800" }}>RECORD</div>
                            </div>
                          )}
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

      {/* Slot Config Modal */}
      {showSlotModal && (
        <Modal
          title={`${slotConfigs[slotModalData.machineId]?.[slotModalData.slotIndex] ? "Modifica" : "Configura"} Slot ${slotModalData.slotIndex + 1} — ${slotModalData.machineId}`}
          onClose={() => setShowSlotModal(false)}
          footer={
            <div style={{ display: "flex", gap: "12px", width: "100%" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSaveSlot}
                disabled={isSavingSlot}
              >
                {isSavingSlot ? "Salvataggio..." : "Salva"}
              </button>
              {slotConfigs[slotModalData.machineId]?.[slotModalData.slotIndex] && (
                <button
                  className="btn btn-secondary"
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                  onClick={handleDeleteSlot}
                  disabled={isSavingSlot}
                >
                  Ripristina Default
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowSlotModal(false)}>Annulla</button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px" }}>
            <div style={{ padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
              Configura cosa mostrare nello slot {slotModalData.slotIndex + 1} della macchina <strong style={{ color: "var(--text-primary)" }}>{slotModalData.machineId}</strong>.
              Lascia vuoto un campo per usare il comportamento di default.
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Componente</label>
              <input
                type="text"
                className="input"
                placeholder="Es. SG3, SG4, PG, RG..."
                value={slotModalData.componente}
                onChange={e => setSlotModalData(p => ({ ...p, componente: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Progetto</label>
              <input
                type="text"
                className="input"
                placeholder="Es. DCT Eco, DCT 300..."
                value={slotModalData.progetto}
                onChange={e => setSlotModalData(p => ({ ...p, progetto: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Codice Materiale <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "11px" }}>(opzionale)</span></label>
              <input
                type="text"
                className="input"
                placeholder="Es. M0153389/S"
                value={slotModalData.codiceMateriale}
                onChange={e => setSlotModalData(p => ({ ...p, codiceMateriale: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Centro di Lavoro SAP <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "11px" }}>(opzionale)</span></label>
              <input
                type="text"
                className="input"
                placeholder="Es. FRW10000, DRA14100..."
                value={slotModalData.sapWorkCenter}
                onChange={e => setSlotModalData(p => ({ ...p, sapWorkCenter: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
        </Modal>
      )}

      {showProdModal && prodModalData && (
        <Modal
          title={`${prodModalData.machineId} — ${prodModalData.comp || "Slot Produzione"}`}
          onClose={() => setShowProdModal(false)}
          footer={
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setShowProdModal(false)}>Chiudi</button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "8px 0" }}>
            {/* Header info */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "4px", letterSpacing: "0.5px" }}>COMPONENTE</div>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "var(--accent)" }}>{prodModalData.comp || "—"}</div>
              </div>
              {prodModalData.proj && (
                <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "4px", letterSpacing: "0.5px" }}>PROGETTO</div>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)" }}>{prodModalData.proj}</div>
                </div>
              )}
              <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "4px", letterSpacing: "0.5px" }}>TOT. PEZZI</div>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "#10b981" }}>{prodModalData.totalQty}</div>
              </div>
            </div>

            {/* Materials table */}
            {prodModalData.materials.length > 0 ? (
              <div>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "var(--text-muted)", marginBottom: "10px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Dettaglio Materiali</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {/* Header row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", padding: "6px 14px", fontSize: "10px", fontWeight: "800", color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                    <span>Codice Materiale</span>
                    <span>Codice SAP</span>
                    <span>Pezzi</span>
                  </div>
                  {prodModalData.materials.map((mat, idx) => (
                    <div key={idx} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto",
                      gap: "12px",
                      padding: "10px 14px",
                      background: idx % 2 === 0 ? "var(--bg-tertiary)" : "transparent",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}>
                      <span style={{ fontWeight: "600", fontFamily: "monospace" }}>{mat.code}</span>
                      <span style={{ fontWeight: "600", fontFamily: "monospace", color: "var(--text-muted)" }}>{mat.sapCode || "—"}</span>
                      <span style={{ fontWeight: "900", color: "#10b981", fontSize: "16px" }}>{mat.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px", fontStyle: "italic" }}>
                Nessuna conferma SAP registrata per questo componente oggi.
              </div>
            )}
          </div>
        </Modal>
      )}

      {showFermiModal && (
        <Modal 
          title={`Registra Fermo - ${selectedMachine?.id}`} 
          onClose={() => setShowFermiModal(false)}
          footer={(
            <div style={{ display: "flex", gap: "12px", width: "100%" }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={handleSaveFermoDirect}
                disabled={isSaving}
              >
                {isSaving ? "Salvataggio..." : "Salva Fermo"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowFermiModal(false)}>Annulla</button>
            </div>
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px" }}>

            {/* Macchina / Automazione selector */}
            <div style={{ display: "flex", gap: "8px" }}>
              {[{ val: false, label: "Macchina" }, { val: true, label: "Automazione" }].map(({ val, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFermiForm(p => ({ ...p, is_automazione: val, motivo: "" }))}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: "2px solid",
                    borderColor: fermiForm.is_automazione === val ? (val ? "#a855f7" : "var(--accent)") : "var(--border)",
                    background: fermiForm.is_automazione === val ? (val ? "rgba(168,85,247,0.15)" : "rgba(var(--accent-rgb),0.15)") : "transparent",
                    color: fermiForm.is_automazione === val ? (val ? "#a855f7" : "var(--accent)") : "var(--text-muted)",
                    fontWeight: "800",
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Motivo Fermo *</label>
              <select
                className="select-input"
                value={fermiForm.motivo}
                onChange={e => setFermiForm(p => ({ ...p, motivo: e.target.value }))}
              >
                <option value="">-- Seleziona Motivo --</option>
                {(() => {
                  const machineId = selectedMachine?.ids ? selectedMachine.ids[0] : selectedMachine?.id;
                  const machineObj = macchine.find(m => m.id === machineId);
                  const machineTecId = machineObj?.tecnologia_id;
                  return motiviFermo
                    .filter(m => {
                      if (!!m.is_automazione !== !!fermiForm.is_automazione) return false;
                      // Automazione: nessun filtro per tecnologia (fermi comuni a tutte le macchine)
                      if (fermiForm.is_automazione) return true;
                      // Macchina: filtra per tecnologia
                      if (!machineTecId) return true;
                      return m.tecnologia_id === machineTecId;
                    })
                    .map(m => (
                      <option key={m.id} value={m.label}>{m.icona} {m.label}</option>
                    ));
                })()}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Durata in minuti *</label>
              <input
                type="number"
                className="input"
                placeholder="Es. 15"
                value={fermiForm.durata}
                onChange={e => setFermiForm(p => ({ ...p, durata: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Note (opzionale)</label>
              <textarea
                className="input"
                style={{ minHeight: "80px", paddingTop: "8px" }}
                placeholder="Aggiungi dettagli..."
                value={fermiForm.note}
                onChange={e => setFermiForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            {/* Twin Machine Selection */}
            {selectedMachine?.ids && selectedMachine.ids.length > 0 && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: "700" }}>Seleziona Macchina *</label>
                <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                  {selectedMachine.ids.map(id => (
                    <label key={id} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="target_macchina_id"
                        value={id}
                        checked={fermiForm.target_macchina_id === id}
                        onChange={e => setFermiForm(p => ({ ...p, target_macchina_id: e.target.value }))}
                      />
                      <span style={{ fontSize: "14px", fontWeight: "600" }}>{id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

          </div>
        </Modal>
      )}
    </div>
  );
}
