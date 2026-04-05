import React, { useState, useEffect } from "react";
import { Icons } from "../components/ui/Icons";
import { supabase } from "../lib/supabase";
import { Modal } from "../components/ui/Modal";
import { formatItalianDate } from "../lib/dateUtils";
import { TURNI } from "../data/constants";

const normFino = s => { const n = parseInt(s, 10); return isNaN(n) ? (s || "").toUpperCase() : String(n); };

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
  const [prodByFino, setProdByFino] = useState({});
  const [prodByMaterialGlobal, setProdByMaterialGlobal] = useState({});
  const [isSlotEditMode, setIsSlotEditMode] = useState(false);
  const [showGlobalSlotModal, setShowGlobalSlotModal] = useState(false);
  const [globalSlotData, setGlobalSlotData] = useState({ slotIndex: 0, fino: "", componente: "", codiceMateriale: "" });
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotModalData, setSlotModalData] = useState({ machineId: "", slotIndex: 0, componente: "", progetto: "", codiceMateriale: "", fino: "" });
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
        const prodByMatGlobal = {}; // Global index: { material_code: qty } across all machines
        const prodByFinoMap = {}; // Global index by fino: { fino: { material_code: qty } }
        const softMachines = new Set();

        prodData.forEach(row => {
          const mId = (row.macchina_id || row.work_center_sap || "").toUpperCase();
          const mat = (row.materiale || "").toUpperCase();
          const qty = row.qta_ottenuta || 0;
          const info = anaMap[mat];
          const comp = info?.componente?.toUpperCase();
          const fino = normFino(row.fino);

          if (mat.endsWith("/S") && mId) {
            softMachines.add(mId);
          }

          // Direct index by material code (no anagrafica dependency)
          if (mId && mat) {
            if (!prodByMat[mId]) prodByMat[mId] = {};
            prodByMat[mId][mat] = (prodByMat[mId][mat] || 0) + qty;
          }

          // Global index by material (all machines)
          if (mat) {
            prodByMatGlobal[mat] = (prodByMatGlobal[mat] || 0) + qty;
          }

          // Global index by fino (operation number) — machine-agnostic
          if (mat && fino) {
            if (!prodByFinoMap[fino]) prodByFinoMap[fino] = {};
            prodByFinoMap[fino][mat] = (prodByFinoMap[fino][mat] || 0) + qty;
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
        setProdByFino(prodByFinoMap);
        setProdByMaterialGlobal(prodByMatGlobal);
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
            scMap[mId][row.slot_index - 1] = {
              componente: row.componente,
              progetto: row.progetto,
              fino: row.fino,
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
    
    if (activeTech === "saldatrici" || activeTech === "saldatura_laser") {
      if (machineId.startsWith("MZA")) return true;
      if (machineId.startsWith("SCA") && machineId !== "SCA11151") return true;
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
      "DRA11037", "DRA10115",
      "MZA", "SCA"
    ];
    if (customAssignedMachines.some(id => machineId.startsWith(id))) {
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
    const { machineId, slotIndex, componente, progetto, codiceMateriale, fino } = slotModalData;
    if (!componente) {
      alert("Il campo Componente è obbligatorio.");
      return;
    }
    setIsSavingSlot(true);
    try {
      const dbSlotIndex = Number(slotIndex) + 1;
      // REORDERED PAYLOAD to try and fix DB mapping issues
      const payload = {
        codice_materiale: codiceMateriale ? String(codiceMateriale) : null,
        fino: fino ? String(fino) : null,
        macchina_id: String(machineId),
        slot_index: dbSlotIndex,
        componente: componente ? String(componente) : null,
        progetto: progetto ? String(progetto) : null,
      };

      console.log("DEBUG [handleSaveSlot] Reordered Payload:", payload);

      const isUpdate = !!slotConfigs[machineId.toUpperCase()]?.[slotIndex];
      let error;
      if (isUpdate) {
        const { error: updErr } = await supabase.from("slot_config")
          .update(payload)
          .eq("macchina_id", machineId)
          .eq("slot_index", dbSlotIndex);
        error = updErr;
      } else {
        const { error: insErr } = await supabase.from("slot_config")
          .insert([payload]);
        error = insErr;
      }

      if (error) throw error;
      setSlotConfigs(prev => ({
        ...prev,
        [machineId.toUpperCase()]: {
          ...(prev[machineId.toUpperCase()] || {}),
          [slotIndex]: {
            componente: componente || null,
            progetto: progetto || null,
            codice_materiale: codiceMateriale || null,
            fino: fino || null,
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

  const handleSaveSlotForAll = async () => {
    const { slotIndex, componente, progetto, codiceMateriale, fino } = slotModalData;
    if (!componente) {
      alert("Il campo Componente è obbligatorio per la macchina corrente.");
      return;
    }
    const count = filteredMachines.length - 1; // escludo quella corrente
    if (!window.confirm(`Sei sicuro di voler applicare l'OP (Fino) "${fino || 'Vuoto'}" a TUTTE le altre ${count} macchine in questa tab?\nLa macchina corrente salverà tutti i campi, le altre solo l'OP.`)) {
      return;
    }
    setIsSavingSlot(true);
    try {
      const dbSlotIndex = Number(slotIndex) + 1;
      const promises = filteredMachines.map(m => {
        const configId = m.ids ? m.ids[0] : m.id;
        const isCurrent = configId === slotModalData.machineId;
        const existing = slotConfigs[configId.toUpperCase()]?.[slotIndex];
        
        const payloadObj = {
          codice_materiale: isCurrent ? (codiceMateriale || null) : (existing?.codice_materiale || null),
          fino: fino || null,
          macchina_id: String(configId),
          slot_index: dbSlotIndex,
          componente: isCurrent ? (componente || null) : (existing?.componente || null),
          progetto: isCurrent ? (progetto || null) : (existing?.progetto || null),
        };

        if (existing) {
          return supabase.from("slot_config")
            .update(payloadObj)
            .eq("macchina_id", configId)
            .eq("slot_index", dbSlotIndex);
        } else {
          return supabase.from("slot_config").insert([payloadObj]);
        }
      });
      
      console.log("DEBUG [handleSaveSlotForAll] Count:", filteredMachines.length);
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;
      setSlotConfigs(prev => {
        const next = { ...prev };
        filteredMachines.forEach(m => {
          const configId = (m.ids ? m.ids[0] : m.id).toUpperCase();
          const isCurrent = configId === slotModalData.machineId.toUpperCase();
          const existing = next[configId]?.[slotIndex] || {};
          next[configId] = {
            ...(next[configId] || {}),
            [slotIndex]: {
              ...existing,
              componente: isCurrent ? (componente || null) : (existing.componente || null),
              progetto: isCurrent ? (progetto || null) : (existing.progetto || null),
              codice_materiale: isCurrent ? (codiceMateriale || null) : (existing.codice_materiale || null),
              fino: fino || null,
            }
          };
        });
        return next;
      });
      setShowSlotModal(false);
    } catch (err) {
      console.error("Errore salvataggio slot globale:", err);
      alert("Errore durante il salvataggio globale: " + (err?.message || JSON.stringify(err)));
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
        .eq("slot_index", parseInt(slotIndex) + 1);
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

  const handleSaveGlobalSlot = async () => {
    const { slotIndex, componente, codiceMateriale, fino } = globalSlotData;
    if (!fino && !componente && !codiceMateriale) {
      alert("Compila almeno un campo da applicare a tutte le macchine!");
      return;
    }

    if (!window.confirm(`Sei sicuro di voler applicare questi parametri allo Slot ${parseInt(slotIndex) + 1} di TUTTE le ${filteredMachines.length} macchine in questa vista?\nVerranno sovrascritti i parametri corrispondenti.`)) {
      return;
    }

    setIsSavingSlot(true);
    try {
      const dbSlotIndex = Number(slotIndex) + 1;
      const promises = filteredMachines.map(m => {
        const configId = m.ids ? m.ids[0] : m.id;
        const existing = slotConfigs[configId.toUpperCase()]?.[slotIndex];
        
        const payloadObj = {
          codice_materiale: codiceMateriale || existing?.codice_materiale || null,
          fino: fino || existing?.fino || null,
          macchina_id: String(configId),
          slot_index: dbSlotIndex,
          componente: componente || existing?.componente || null,
          progetto: existing?.progetto || null,
        };

        if (existing) {
          return supabase.from("slot_config")
            .update(payloadObj)
            .eq("macchina_id", configId)
            .eq("slot_index", dbSlotIndex);
        } else {
          return supabase.from("slot_config").insert([payloadObj]);
        }
      });

      console.log("DEBUG [handleSaveGlobalSlot] Count:", filteredMachines.length, "Target Slot:", dbSlotIndex);

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      setSlotConfigs(prev => {
        const next = { ...prev };
        filteredMachines.forEach(m => {
          const configId = (m.ids ? m.ids[0] : m.id).toUpperCase();
          const existing = next[configId]?.[slotIndex] || {};
          next[configId] = {
            ...(next[configId] || {}),
            [slotIndex]: {
              ...existing,
              componente: componente || existing.componente || null,
              codice_materiale: codiceMateriale || existing.codice_materiale || null,
              fino: fino || existing.fino || null,
            }
          };
        });
        return next;
      });
      setShowGlobalSlotModal(false);
    } catch (err) {
      console.error("Errore salvataggio slot globale:", err);
      alert("Errore durante il salvataggio globale!");
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
              {isSlotEditMode ? "✓ Esci da Configura" : "⚙ Configura Singolo"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", fontWeight: "700", color: "transparent", letterSpacing: "0.5px" }}>_</label>
            <button
              onClick={() => {
                setGlobalSlotData({ slotIndex: 0, fino: "", componente: "", codiceMateriale: "" });
                setShowGlobalSlotModal(true);
              }}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: "1px solid var(--accent)",
                backgroundColor: "var(--accent)",
                color: "white",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              🚀 Applica OP Globale
            </button>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT: Sidebar (Tabs) + Content (Grid) */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", width: "100%" }}>
        
        {/* TABS SIDEBAR */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "8px", 
          width: "180px", 
          minWidth: "180px", 
          position: "sticky", 
          top: "0",
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
          paddingRight: "8px"
        }}>
          <button onClick={() => setActiveTech("TUTTO")} style={{...tabStyle("TUTTO"), textAlign: "left", width: "100%"}}>Tutte le tecnologie</button>
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
            "saldatura laser": "Saldatura Laser + UT",
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
            "Saldatura Laser + UT",
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
              return !label.includes("foratrice") && !label.includes("automazione") && !label.includes("controllo ut");
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
              <button key={t.id} onClick={() => setActiveTech(t.id)} style={{...tabStyle(t.id), textAlign: "left", width: "100%"}}>
                {t.displayLabel}
              </button>
            ));
        })()}
        </div>

        {/* MACHINES GRID CONTENT */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", flex: 1, alignContent: "start", paddingBottom: "40px" }}>
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
            ["ZSA11019", "ZSA11022"],
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

            // Dynamic Slot Count: default (4/5/12) OR max configured index + 1 OR +1 extra if in edit mode
            const configIdForCount = m.ids ? m.ids[0].toUpperCase() : mid;
            const maxConfiguredIndex = Object.keys(slotConfigs[configIdForCount] || {}).reduce((mx, k) => Math.max(mx, parseInt(k)), -1);
            
            const isZSA = m.ids?.includes("ZSA11019") || m.ids?.includes("ZSA11022") || mid === "ZSA11019" || mid === "ZSA11022";
            const isDMC = m.tecnologia_id === "marcatura laser dmc" || m.tecnologia_id === "DMC" || activeTech === "marcatura laser dmc";
            const baseCount = isZSA ? 12 : (isDMC ? 5 : 4);
            
            let SLOT_COUNT = Math.max(baseCount, maxConfiguredIndex + 1);
            if (isSlotEditMode) SLOT_COUNT += 1;

            const FERMI_IDX = SLOT_COUNT - 1;
            // Slots hidden per machine: index → invisible placeholder
            const hiddenSlots = new Set(mid === "RAA11009" ? [1, 2] : []);

            // Pre-compute production slot data (identical logic to slot rendering)
            // so headerTotal always exactly matches the sum of displayed slot values
            const mProdForPre = {};
            if (m.ids) {
              m.ids.forEach(id => {
                const singleProd = productionData[id.toUpperCase()] || {};
                Object.keys(singleProd).forEach(comp => {
                  if (!mProdForPre[comp]) mProdForPre[comp] = { total: 0, materials: [] };
                  mProdForPre[comp].total += singleProd[comp].total;
                  singleProd[comp].materials.forEach(mat => {
                    const ext = mProdForPre[comp].materials.find(x => x.code === mat.code);
                    if (ext) ext.qty += mat.qty;
                    else mProdForPre[comp].materials.push({...mat});
                  });
                });
              });
            } else {
              Object.assign(mProdForPre, productionData[m.id] || {});
            }
            const prodComponentsForPre = Object.keys(mProdForPre);
            const computedSlotData = Array.from({ length: FERMI_IDX }).map((_, i) => {
              if (hiddenSlots.has(i)) return { hidden: true };
              let productionInfo = null;
              let displayComp = null;
              let displayProj = null;
              const configId = m.ids ? m.ids[0].toUpperCase() : mid;
              const slotConf = slotConfigs[configId]?.[i];
              const machineHasAnyConfig = !!slotConfigs[configId];
              if (slotConf) {
                displayComp = slotConf.componente || null;
                const finoKey = slotConf.fino ? normFino(slotConf.fino) : null;
                if (slotConf.codice_materiale && finoKey) {
                  // Filter by both material code AND fino — turno already filtered by query
                  const matFilter = slotConf.codice_materiale.toUpperCase();
                  const qty = prodByFino[finoKey]?.[matFilter] || 0;
                  displayProj = slotConf.progetto || anagrafica[matFilter]?.progetto || null;
                  productionInfo = { total: qty, materials: qty > 0 ? [{ code: matFilter, qty, progetto: displayProj || "" }] : [] };
                } else if (slotConf.codice_materiale) {
                  // Only material code — global sum across all machines and fino
                  const matFilter = slotConf.codice_materiale.toUpperCase();
                  const qty = prodByMaterialGlobal[matFilter] || 0;
                  displayProj = slotConf.progetto || anagrafica[matFilter]?.progetto || null;
                  productionInfo = { total: qty, materials: qty > 0 ? [{ code: matFilter, qty, progetto: displayProj || "" }] : [] };
                } else if (finoKey) {
                  // Only fino — sum all materials under this operation number
                  const finoMats = prodByFino[finoKey] || {};
                  const total = Object.values(finoMats).reduce((s, v) => s + v, 0);
                  const materials = Object.entries(finoMats).map(([code, qty]) => ({ code, qty, progetto: anagrafica[code]?.progetto || "" }));
                  if (total > 0) {
                    productionInfo = { total, materials };
                    displayProj = slotConf.progetto || materials[0]?.progetto || null;
                  }
                } else {
                  const sourceProd = productionData[mid] || {};
                  if (displayComp && sourceProd[displayComp]) {
                    productionInfo = sourceProd[displayComp];
                    displayProj = slotConf.progetto || productionInfo?.materials?.[0]?.progetto || null;
                  }
                }
              } else if (machineHasAnyConfig) {
                // empty slot
              } else if (isFRW) {
                productionInfo = mProdForPre["SG5"]; displayComp = "SG5"; displayProj = "DCT 300";
              } else if (isFRW74) {
                const frw74Prod = productionData["FRW14410"] || {};
                const frw74Comps = Object.keys(frw74Prod);
                if (frw74Comps[i]) { displayComp = frw74Comps[i]; productionInfo = frw74Prod[displayComp]; if (productionInfo?.materials?.length > 0) displayProj = productionInfo.materials[0].progetto; }
              } else if (isMZA) {
                displayComp = i === 0 ? "CONTROLLO UT" : null;
              } else if (isRAA) {
                productionInfo = i === 0 ? mProdForPre["PG"] : null; displayComp = i === 0 ? "PG" : null; displayProj = i === 0 ? "M0154996/S" : null;
              } else if (isRGMin) {
                displayComp = i === 0 ? "RG" : null;
              } else if (isZSA) {
                const zsaComps = ["SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "FG5/7", "RG"];
                if (i < FERMI_IDX) {
                  displayComp = zsaComps[i] || null;
                  if (displayComp) {
                    productionInfo = mProdForPre[displayComp];
                    if (productionInfo?.materials?.length > 0) displayProj = productionInfo.materials[0].progetto;
                  }
                }
              } else if (mid === "DRA10060") {
                const compMap = ["SG2", "SGR"]; const projMap = ["M0153389/S", "M0153391/S"];
                const prodSources = [mProdForPre, productionData["DRA14100"] || {}];
                displayComp = compMap[i] || null;
                if (displayComp) { productionInfo = prodSources[i][displayComp]; displayProj = productionInfo?.materials?.[0]?.progetto || projMap[i] || ""; }
              } else {
                if (prodComponentsForPre[i]) { displayComp = prodComponentsForPre[i]; productionInfo = mProdForPre[displayComp]; if (productionInfo?.materials?.length > 0) displayProj = productionInfo.materials[0].progetto; }
              }
              return { productionInfo, displayComp, displayProj };
            });
            const headerTotal = computedSlotData.reduce((sum, s) => sum + (s.hidden ? 0 : (s.productionInfo?.total || 0)), 0);

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
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.5px" }}>TOT. PEZZI</div>
                    <div style={{ fontSize: "24px", fontWeight: "900", color: "#10b981" }}>{headerTotal}</div>
                  </div>
                </div>
 
                <div style={{ 
                  display: "flex", 
                  gap: "12px", 
                  justifyContent: "start",
                  flexWrap: "wrap",
                  width: "100%"
                }}>
                  {Array.from({ length: SLOT_COUNT }).map((_, i) => {
                    // Hidden slots: invisible placeholder that still holds its space
                    if (hiddenSlots.has(i)) {
                      return (
                        <div key={i} style={{ flex: "0 0 calc(25% - 9px)", display: "flex", flexDirection: "column", gap: "3px", visibility: "hidden", pointerEvents: "none" }}>
                          <div style={{ height: "14px" }} />
                          <div style={{ height: "100px" }} />
                        </div>
                      );
                    }

                    // Use pre-computed slot data for production slots
                    let productionInfo = null;
                    let displayComp = null;
                    let displayProj = null;
                    if (i < FERMI_IDX) {
                      const pre = computedSlotData[i];
                      if (pre && !pre.hidden) {
                        productionInfo = pre.productionInfo;
                        displayComp = pre.displayComp;
                        displayProj = pre.displayProj;
                      }
                    }

                    // Last slot — FERMI (Downtimes)
                    if (i === FERMI_IDX && !isSlotEditMode) {
                        // Downtime slot (only show if not in edit mode, or handle differently)
                        // In edit mode we show the configuration overlay instead of the downtime record link
                        const fermi = fermiData[mid] || { minutes: 0, entries: [] };
                        let minutes = (fermi.minutes || 0);
                        let entries = [...(fermi.entries || [])];
                        // If it's a twin, add minutes from both but only if current is the "primary" ID or if we want to show combined
                        if (m.ids && m.ids.length > 1) {
                          minutes = 0;
                          entries = [];
                          m.ids.forEach(id => {
                            const f = fermiData[id.toUpperCase()];
                            if (f) {
                              minutes += (f.minutes || 0);
                              if (Array.isArray(f.entries)) entries = [...entries, ...f.entries];
                            }
                          });
                        }
                        const isCritical = minutes > 60;
                        return (
                          <div key={`fermi-${i}`} style={{ flex: "0 0 calc(25% - 9px)", minWidth: "100px", display: "flex", flexDirection: "column", gap: "3px" }}>
                            <div style={{ height: "14px" }} />
                            <div style={{
                              height: "100px",
                              backgroundColor: minutes > 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
                              borderRadius: "16px",
                              border: minutes > 0 ? `1px solid ${isCritical ? "#ef4444" : "#f59e0b"}` : "1px dashed var(--border)",
                              display: "flex", flexDirection: "column", padding: "10px 14px", cursor: "pointer", position: "relative"
                            }} onClick={() => handleOpenFermiModal(m)}>
                              {minutes > 0 ? (
                                <>
                                  <div style={{ position: "absolute", top: 0, right: 0, padding: "4px 8px", background: isCritical ? "#ef4444" : "#f59e0b", color: "white", fontSize: "9px", fontWeight: "900", borderBottomLeftRadius: "8px" }}>FERMI</div>
                                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "4px" }}>
                                    <span style={{ fontSize: "22px", fontWeight: "900", color: isCritical ? "#ef4444" : "#f59e0b" }}>{minutes}</span>
                                    <span style={{ fontSize: "10px", fontWeight: "700", opacity: 0.6 }}>min</span>
                                  </div>
                                </>
                              ) : (
                                <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", opacity: 0.4 }}>
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
                      <div key={i} style={{ flex: "0 0 calc(25% - 9px)", minWidth: "100px", display: "flex", flexDirection: "column", gap: "3px" }}>
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
                            const configId = m.ids ? m.ids[0].toUpperCase() : mid;
                            const existing = slotConfigs[configId]?.[i];
                            setSlotModalData({
                              machineId: configId,
                              slotIndex: i,
                              componente: existing?.componente || displayComp || "",
                              progetto: existing?.progetto || "",
                              codiceMateriale: existing?.codice_materiale || "",
                              fino: existing?.fino || "",
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
                                <div style={{ fontSize: "18px" }}>{slotConfigs[m.ids ? m.ids[0].toUpperCase() : mid]?.[i] ? "✏️" : "➕"}</div>
                                <div style={{ fontSize: "9px", fontWeight: "900", color: "white", letterSpacing: "0.5px", marginTop: "2px" }}>
                                  {slotConfigs[m.ids ? m.ids[0].toUpperCase() : mid]?.[i] ? "MODIFICA" : "AGGIUNGI"}
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
      </div>

      {/* Slot Config Modal */}
      {showSlotModal && (
        <Modal
          title={`${slotConfigs[slotModalData.machineId]?.[slotModalData.slotIndex] ? "Modifica" : "Configura"} Slot ${slotModalData.slotIndex + 1} — ${slotModalData.machineId}`}
          onClose={() => setShowSlotModal(false)}
          footer={
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", width: "100%" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, minWidth: "120px" }}
                onClick={handleSaveSlot}
                disabled={isSavingSlot}
              >
                {isSavingSlot ? "..." : "Salva Solo Questa"}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, background: "var(--accent)", minWidth: "200px" }}
                onClick={handleSaveSlotForAll}
                disabled={isSavingSlot}
              >
                {isSavingSlot ? "..." : "Applica SOLO Fino a Tutte le Macchine"}
              </button>
              {slotConfigs[slotModalData.machineId]?.[slotModalData.slotIndex] && (
                <button
                  className="btn btn-secondary"
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                  onClick={handleDeleteSlot}
                  disabled={isSavingSlot}
                >
                  Azzera
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowSlotModal(false)}>Annulla</button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px" }}>
            <div style={{ padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
              Assegna l'OP (Fino) alla macchina <strong style={{ color: "var(--text-primary)" }}>{slotModalData.machineId}</strong> e definisci il codice SAP del componente per collegare la produzione.
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>OP Macchina (Fino) *</label>
              <input
                type="text"
                className="input"
                placeholder="Es. 0140, 0010..."
                value={slotModalData.fino}
                onChange={e => setSlotModalData(p => ({ ...p, fino: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Componente *</label>
              <input
                type="text"
                className="input"
                placeholder="Es. SG3, SG4, PG, RG..."
                value={slotModalData.componente}
                onChange={e => setSlotModalData(p => ({ ...p, componente: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Codice Materiale *</label>
              <input
                type="text"
                className="input"
                placeholder="Es. M0153389/S"
                value={slotModalData.codiceMateriale}
                onChange={e => setSlotModalData(p => ({ ...p, codiceMateriale: e.target.value.toUpperCase() }))}
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", padding: "6px 14px", fontSize: "10px", fontWeight: "800", color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                    <span>Codice Materiale</span>
                    <span>Pezzi</span>
                  </div>
                  {prodModalData.materials.map((mat, idx) => (
                    <div key={idx} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "12px",
                      padding: "10px 14px",
                      background: idx % 2 === 0 ? "var(--bg-tertiary)" : "transparent",
                      borderRadius: "8px",
                      fontSize: "14px"
                    }}>
                      <span style={{ fontWeight: "600", fontFamily: "monospace" }}>{mat.code}</span>
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

      {/* Global Tab Config Modal */}
      {showGlobalSlotModal && (
        <Modal
          title={`Configura Globale per la Vista Corrente`}
          onClose={() => setShowGlobalSlotModal(false)}
          footer={
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", width: "100%" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 2, background: "var(--accent)", minWidth: "200px" }}
                onClick={handleSaveGlobalSlot}
                disabled={isSavingSlot}
              >
                {isSavingSlot ? "..." : "Applica a Tutte Le Macchine"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowGlobalSlotModal(false)}>Annulla</button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px" }}>
            <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", borderRadius: "8px", fontSize: "12px", color: "var(--text-primary)", border: "1px solid rgba(16,185,129,0.3)" }}>
              Questa funzione applica le impostazioni inserite allo <strong>Slot specificato</strong> per <strong>TUTTE le macchine</strong> attualmente filtrate nella vista.<br/>I campi vuoti NON sovrascriveranno le impostazioni esistenti.
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Seleziona lo Slot di Destinazione *</label>
              <select
                className="select-input"
                value={globalSlotData.slotIndex}
                onChange={e => setGlobalSlotData(p => ({ ...p, slotIndex: e.target.value }))}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", width: "100%" }}
              >
                <option value={0}>Slot 1</option>
                <option value={1}>Slot 2</option>
                <option value={2}>Slot 3</option>
                <option value={3}>Slot 4</option>
                <option value={4}>Slot 5 (Extra)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>OP Macchina (Fino) *</label>
              <input
                type="text"
                className="input"
                placeholder="Es. 0140, 0010..."
                value={globalSlotData.fino}
                onChange={e => setGlobalSlotData(p => ({ ...p, fino: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Componente (Aggiorna Tutte - Opz.)</label>
              <input
                type="text"
                className="input"
                placeholder="Lascia vuoto per non modificare..."
                value={globalSlotData.componente}
                onChange={e => setGlobalSlotData(p => ({ ...p, componente: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Codice Materiale (Aggiorna Tutte - Opz.)</label>
              <input
                type="text"
                className="input"
                placeholder="Lascia vuoto per non modificare..."
                value={globalSlotData.codiceMateriale}
                onChange={e => setGlobalSlotData(p => ({ ...p, codiceMateriale: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
