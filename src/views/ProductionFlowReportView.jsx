import React, { useState, useEffect } from "react";
import { Icons } from "../components/ui/Icons";
import { supabase } from "../lib/supabase";
import { Modal } from "../components/ui/Modal";
import { formatItalianDate, getLocalDate } from "../lib/dateUtils";
import { TURNI, ORARI_TURNI } from "../data/constants";

const normFino = s => { const n = parseInt(s, 10); return isNaN(n) ? (s || "").toUpperCase() : String(n); };

export default function ProductionFlowReportView({ macchine = [], tecnologie = [], motiviFermo = [], globalDate, setGlobalDate, turnoCorrente, setTurnoCorrente }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTech, setActiveTech] = useState("TUTTO");
  const [productionData, setProductionData] = useState({});
  const [fermiData, setFermiData] = useState({});
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
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotModalData, setSlotModalData] = useState({ machineId: "", slotIndex: 0, componente: "", progetto: "", codiceMateriale: "", fino: "" });
  const [isSavingSlot, setIsSavingSlot] = useState(false);

  // New Machine State
  const [showNewMachineModal, setShowNewMachineModal] = useState(false);
  const [newMachineForm, setNewMachineForm] = useState({ id: "", nome: "", tecnologia_id: "", target_performance: 91, target_quality: 98 });
  const [isSavingMachine, setIsSavingMachine] = useState(false);
  const [temporaryMachines, setTemporaryMachines] = useState([]); // To show new machines immediately

  // Edit Machine State
  const [showEditMachineModal, setShowEditMachineModal] = useState(false);
  const [editMachineForm, setEditMachineForm] = useState({ id: "", nome: "", tecnologia_id: "", target_performance: 91, target_quality: 98 });
  const [isDeletingMachine, setIsDeletingMachine] = useState(false);
  const [deletedMachineIds, setDeletedMachineIds] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const date = globalDate || new Date().toISOString().split("T")[0];
        
        // 1. Fetch production
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
          const comp = row.componente?.toUpperCase();
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
                progetto: row.progetto || "",
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

  const allMachines = React.useMemo(() => {
    // Combine base macchine with newly added/edited ones, respecting deletions
    const combined = [...macchine].filter(m => !deletedMachineIds.has(m.id.toUpperCase()));
    
    temporaryMachines.forEach(tm => {
      if (deletedMachineIds.has(tm.id.toUpperCase())) return;
      
      const idx = combined.findIndex(m => m.id.toUpperCase() === tm.id.toUpperCase());
      if (idx !== -1) {
        combined[idx] = { ...combined[idx], ...tm };
      } else {
        combined.push(tm);
      }
    });
    return combined;
  }, [macchine, temporaryMachines, deletedMachineIds]);

  const filteredMachines = allMachines.filter((m) => {
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

  const handleDeleteSlot = async (machineIdParam, slotIndexParam) => {
    const machineId = machineIdParam || slotModalData.machineId;
    const slotIndex = (slotIndexParam !== undefined) ? slotIndexParam : slotModalData.slotIndex;
    
    if (!window.confirm(`Sei sicuro di voler eliminare lo Slot ${parseInt(slotIndex) + 1} per ${machineId}?\nLe configurazioni verranno rimosse permanentemente.`)) {
      return;
    }

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

  const handleSaveNewMachine = async () => {
    if (!newMachineForm.id || !newMachineForm.tecnologia_id) {
      alert("ID e Tecnologia sono obbligatori!");
      return;
    }

    setIsSavingMachine(true);
    try {
      const payload = {
        id: newMachineForm.id.toUpperCase(),
        nome: newMachineForm.nome || newMachineForm.id,
        tecnologia_id: newMachineForm.tecnologia_id,
        target_performance: newMachineForm.target_performance,
        target_quality: newMachineForm.target_quality,
        attivo: true,
      };

      const { error } = await supabase.from("macchine").insert([payload]);
      if (error) throw error;

      // Add to local state to show immediately
      setTemporaryMachines(prev => [...prev, payload]);
      setShowNewMachineModal(false);
      setNewMachineForm({ id: "", nome: "", tecnologia_id: "" });
      alert(`Macchina ${payload.id} inserita con successo!`);
    } catch (err) {
      console.error("Errore inserimento macchina:", err);
      alert("Errore durante l'inserimento della macchina!");
    } finally {
      setIsSavingMachine(false);
    }
  };

  const handleUpdateMachine = async () => {
    if (!editMachineForm.id) return;
    setIsSavingMachine(true);
    try {
      const payload = {
        nome: editMachineForm.nome || editMachineForm.id,
        tecnologia_id: editMachineForm.tecnologia_id,
        target_performance: editMachineForm.target_performance,
        target_quality: editMachineForm.target_quality,
      };
      
      const { error } = await supabase.from("macchine")
        .update(payload)
        .eq("id", editMachineForm.id);
      
      if (error) throw error;
      
      // Update local state (temporaryMachines and prop-based macchine if possible)
      setTemporaryMachines(prev => {
        const idx = prev.findIndex(m => m.id === editMachineForm.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...payload };
          return next;
        }
        // If not in temporary, add as a temporary override anyway
        return [...prev, { id: editMachineForm.id, ...payload }];
      });

      setShowEditMachineModal(false);
      alert("Macchina aggiornata con successo! Se non vedi il cambiamento nei filtri, ricarica la pagina.");
    } catch (err) {
      console.error("Errore aggiornamento macchina:", err);
      alert("Errore durante l'aggiornamento!");
    } finally {
      setIsSavingMachine(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!editMachineForm.id) return;
    if (!window.confirm(`Sei sicuro di voler ELIMINARE DEFINITIVAMENTE la macchina ${editMachineForm.id}?\nQuesta azione non può essere annullata.`)) {
      return;
    }
    
    setIsDeletingMachine(true);
    try {
      const { error } = await supabase.from("macchine")
        .delete()
        .eq("id", editMachineForm.id);
      
      if (error) throw error;
      
      // Update local state to hide it
      setDeletedMachineIds(prev => new Set([...prev, editMachineForm.id.toUpperCase()]));
      
      setShowEditMachineModal(false);
      alert("Macchina eliminata con successo!");
    } catch (err) {
      console.error("Errore eliminazione macchina:", err);
      alert("Errore durante l'eliminazione!");
    } finally {
      setIsDeletingMachine(false);
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
                fontFamily: "inherit",
                width: "210px"
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
                cursor: "pointer",
                width: "210px"
              }}
            >
              <option value="ALL">Tutti i turni</option>
              {TURNI.map(t => (
                <option key={t.id} value={t.id}>Turno {t.id} — {t.coordinatore}</option>
              ))}
            </select>
          </div>

          {activeTech === "TUTTO" && (
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
                    width: "210px",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
              </div>
            </div>
          )}

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
                whiteSpace: "nowrap",
                width: "210px"
              }}
            >
              {isSlotEditMode ? "✓ Esci da Configura" : "⚙ Configura Singolo"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", fontWeight: "700", color: "transparent", letterSpacing: "0.5px" }}>_</label>
            <button
              onClick={() => setShowNewMachineModal(true)}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: "1px solid #10b981",
                backgroundColor: "#10b981",
                color: "white",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                width: "210px"
              }}
            >
              ➕ Nuova Macchina
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
            
            // KPI Calculation Logic
            const shiftMinutes = (turnoCorrente && turnoCorrente !== "ALL") ? 360 : 1440;
            const fermi = fermiData[mid] || { minutes: 0, entries: [] };
            let totalDowntime = fermi.minutes || 0;
            if (m.ids && m.ids.length > 1) {
              totalDowntime = 0;
              m.ids.forEach(id => {
                totalDowntime += (fermiData[id.toUpperCase()]?.minutes || 0);
              });
            }
            
            const availability = Math.max(0, (shiftMinutes - totalDowntime) / shiftMinutes);
            const prodHours = (shiftMinutes - totalDowntime) / 60;
            const displayProdHours = `${Math.floor(prodHours)}h`;
            const displayTotalHours = `${Math.floor(shiftMinutes / 60)}h`;
            
            // Dynamic Performance/Quality for OEE calculation
            const targetPerf = (m.target_performance || 91) / 100;
            const targetQual = (m.target_quality || 98) / 100;
            
            const performance = targetPerf; // Placeholder constant efficiency
            const oee = availability * performance * targetQual;
            
            const isFRW = mid === "FRW10075"; // FRW10075 → SG5 / DCT300
            const isFRW74 = mid === "FRW10074"; // FRW10074 → SAP FRW14410
            const isMZA = mid === "MZA10005";
            const isRAA = mid === "RAA11009";
            const isZSA = mid.startsWith("ZSA");
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

            // Dynamic Slot Count: only configured slots + 1 extra if in edit mode
            const configIdForCount = m.ids ? m.ids[0].toUpperCase() : mid;
            const configuredIndices = Object.keys(slotConfigs[configIdForCount] || {}).map(k => parseInt(k));
            const maxConfiguredIndex = configuredIndices.length > 0 ? Math.max(...configuredIndices) : -1;
            
            let prodSlots = maxConfiguredIndex + 1;
            if (isSlotEditMode) prodSlots += 1;

            const SLOT_COUNT = prodSlots + 1; // Total slots including Fermi
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
            const computedSlotData = Array.from({ length: prodSlots }).map((_, i) => {
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
                  // Filter by both material code AND fino
                  const matFilter = slotConf.codice_materiale.toUpperCase();
                  const qty = prodByFino[finoKey]?.[matFilter] || 0;
                  displayProj = slotConf.progetto || null;
                  productionInfo = { total: qty, materials: qty > 0 ? [{ code: matFilter, qty, progetto: displayProj || "" }] : [] };
                } else if (slotConf.codice_materiale) {
                  // Only material code
                  const matFilter = slotConf.codice_materiale.toUpperCase();
                  const qty = prodByMaterialGlobal[matFilter] || 0;
                  displayProj = slotConf.progetto || null;
                  productionInfo = { total: qty, materials: qty > 0 ? [{ code: matFilter, qty, progetto: displayProj || "" }] : [] };
                } else if (finoKey) {
                  // Only fino
                  const finoMats = prodByFino[finoKey] || {};
                  const total = Object.values(finoMats).reduce((s, v) => s + v, 0);
                  const materials = Object.entries(finoMats).map(([code, qty]) => ({ code, qty, progetto: "" }));
                  if (total > 0) {
                    productionInfo = { total, materials };
                    displayProj = slotConf.progetto || null;
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
              return { productionInfo, displayComp, displayProj, isConfigured: !!slotConf };
            });
            const headerTotal = computedSlotData.reduce((sum, s) => sum + (s.hidden ? 0 : (s.productionInfo?.total || 0)), 0);

            return (
              <div key={m.id} style={{
                backgroundColor: "#ffffff",
                borderRadius: "24px",
                padding: "24px",
                border: "1px solid #eef2f6",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                minHeight: "520px",
                height: "100%",
                color: "#1e293b",
                position: "relative"
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2 style={{ 
                      fontWeight: "900", 
                      fontSize: "26px", 
                      color: "#10b981", 
                      margin: 0,
                      letterSpacing: "-0.5px"
                    }}>
                      {m.id}
                    </h2>
                    <span style={{ 
                      backgroundColor: "#ffedd5", 
                      color: "#9a3412", 
                      fontSize: "10px", 
                      fontWeight: "900", 
                      padding: "2px 8px", 
                      borderRadius: "6px",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase"
                    }}>
                      Nuovo
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase" }}>Tot. Pezzi</div>
                    <div style={{ fontSize: "28px", fontWeight: "900", color: "#1e293b" }}>{headerTotal}</div>
                  </div>
                </div>

                {/* KPI Boxes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  {/* OEE */}
                  <div style={{ backgroundColor: "#f8fafc", borderRadius: "16px", padding: "14px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "9px", fontWeight: "800", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>OEE</div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: "#10b981" }}>{Math.round(oee * 100)}%</div>
                    <div style={{ height: "4px", backgroundColor: "#e2e8f0", borderRadius: "2px", marginTop: "8px", overflow: "hidden" }}>
                      <div style={{ width: `${oee * 100}%`, height: "100%", backgroundColor: "#10b981" }} />
                    </div>
                  </div>
                  {/* Performance */}
                  <div style={{ backgroundColor: "#f8fafc", borderRadius: "16px", padding: "14px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "9px", fontWeight: "800", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>Performance</div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: "#1e293b" }}>{Math.round(performance * 100)}%</div>
                    <div style={{ height: "4px", backgroundColor: "#e2e8f0", borderRadius: "2px", marginTop: "8px", overflow: "hidden" }}>
                      <div style={{ width: `${performance * 100}%`, height: "100%", backgroundColor: "#3b82f6" }} />
                    </div>
                  </div>
                  {/* Ore Prod */}
                  <div style={{ backgroundColor: "#f8fafc", borderRadius: "16px", padding: "14px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "9px", fontWeight: "800", color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>Ore Prod.</div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: "#1e293b" }}>{displayProdHours}</div>
                    <div style={{ fontSize: "10px", fontWeight: "600", color: "#94a3b8" }}>su {displayTotalHours}</div>
                  </div>
                </div>

                <div style={{ height: "1px", backgroundColor: "#f1f5f9" }} />

                {/* Slots Grid */}
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(3, 1fr)", 
                  gap: "12px",
                  flex: 1
                }}>
                  {Array.from({ length: 6 }).map((_, i) => {
                    // In edit mode, we want to show all 6 possible slots to allow configuration
                    // In normal mode, we only show what's configured or has production
                    const slotData = computedSlotData[i] || { isConfigured: false, displayComp: "+" };
                    
                    if (!isSlotEditMode) {
                      if (!slotData?.isConfigured && (slotData?.productionInfo?.total ?? 0) === 0) return <div key={i} />;
                    }

                    const totalQty = slotData?.productionInfo?.total ?? 0;
                    const displayComp = slotData?.displayComp || "—";
                    const isConfigured = !!slotData?.isConfigured;
                    const hasProduction = totalQty > 0;
                    
                    const bgColor = isConfigured ? "#10b981" : "#f1f5f9";
                    const textColor = isConfigured ? "#ffffff" : "#64748b";

                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        {isConfigured ? (
                          <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>8Fe</div>
                        ) : <div style={{ height: "15px" }} />}
                        
                        <div 
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
                              proj: slotData.displayProj,
                              materials: slotData.productionInfo?.materials || [],
                              totalQty
                            });
                            setShowProdModal(true);
                          }}
                          style={{
                            backgroundColor: bgColor,
                            borderRadius: "18px",
                            padding: "12px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: textColor,
                            cursor: "pointer",
                            transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                            position: "relative",
                            boxShadow: isConfigured ? "0 8px 15px -3px rgba(16, 185, 129, 0.2)" : "none",
                            border: isConfigured ? "none" : "1px dashed #cbd5e1",
                            height: "100px",
                            width: "100%",
                            textAlign: "center"
                          }}
                          onMouseEnter={(e) => {
                            if (isConfigured) e.currentTarget.style.transform = "translateY(-4px)";
                          }}
                          onMouseLeave={(e) => {
                            if (isConfigured) e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          <div style={{ fontSize: "16px", fontWeight: "800", letterSpacing: "-0.5px", marginBottom: "2px" }}>{displayComp}</div>
                          <div style={{ fontSize: "32px", fontWeight: "900", lineHeight: "1" }}>
                            {isConfigured ? (hasProduction ? totalQty : "0") : ""}
                          </div>
                          {isSlotEditMode && (
                             <div style={{ position: "absolute", top: 6, right: 6, fontSize: "10px" }}>✏️</div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Unified "+ RECORD FERMO" action button box as seen in photo - placed AFTER the map slots */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ height: "15px" }} /> {/* Spacer to align with 8Fe labels */}
                    <div 
                      onClick={() => handleOpenFermiModal(m)}
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "18px",
                        padding: "16px 12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#94a3b8",
                        cursor: "pointer",
                        height: "100px",
                        width: "100%",
                        border: "1px dashed #e2e8f0",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                        e.currentTarget.style.borderColor = "#cbd5e1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                        e.currentTarget.style.borderColor = "#e2e8f0";
                      }}
                    >
                      <div style={{ fontSize: "20px", fontWeight: "300", marginBottom: "4px" }}>+</div>
                      <div style={{ fontSize: "10px", fontWeight: "800", textAlign: "center", lineHeight: "1.2" }}>RECORD<br/>FERMO</div>
                    </div>
                  </div>
                </div>

                {/* Edit Machine Button (Absolute overlay if in edit mode) */}
                {isSlotEditMode && (
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditMachineForm({
                        id: m.id,
                        nome: m.nome || m.id,
                        tecnologia_id: m.tecnologia_id || "",
                        target_performance: m.target_performance || 91,
                        target_quality: m.target_quality || 98
                      });
                      setShowEditMachineModal(true);
                    }}
                    style={{ 
                      position: "absolute",
                      top: 12,
                      left: 12,
                      background: "white", 
                      border: "1px solid #e2e8f0", 
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      cursor: "pointer", 
                      fontSize: "14px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    }}
                    title="Modifica Macchina"
                  >
                    ✏️
                  </button>
                )}
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
                  style={{ color: "var(--danger)", borderColor: "var(--danger)", display: "flex", alignItems: "center", gap: "6px" }}
                  onClick={() => handleDeleteSlot()}
                  disabled={isSavingSlot}
                >
                  {Icons.trash} Elimina Slot
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


      {/* New Machine Modal */}
      {showNewMachineModal && (
        <Modal
          title="Inserisci Nuova Macchina"
          onClose={() => setShowNewMachineModal(false)}
          footer={
            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSaveNewMachine}
                disabled={isSavingMachine}
              >
                {isSavingMachine ? "Salvataggio..." : "Salva Macchina"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowNewMachineModal(false)}>Annulla</button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px" }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>ID Macchina *</label>
              <input
                type="text"
                className="input"
                placeholder="Es. DRA10115"
                value={newMachineForm.id}
                onChange={e => setNewMachineForm(p => ({ ...p, id: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Nome (Opzionale)</label>
              <input
                type="text"
                className="input"
                placeholder="Es. DRA 15"
                value={newMachineForm.nome}
                onChange={e => setNewMachineForm(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Tecnologia *</label>
              <select
                className="select-input"
                value={newMachineForm.tecnologia_id}
                onChange={e => setNewMachineForm(p => ({ ...p, tecnologia_id: e.target.value }))}
              >
                <option value="">-- Seleziona --</option>
                {tecnologie.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
                <option value="DMC">Marcatura Laser DMC</option>
                <option value="ZSA">ZSA (Zahnstangen)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ fontWeight: "700" }}>Target Performance (%)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="100"
                  value={newMachineForm.target_performance}
                  onChange={e => setNewMachineForm(p => ({ ...p, target_performance: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ fontWeight: "700" }}>Target Qualità (%)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="100"
                  value={newMachineForm.target_quality}
                  onChange={e => setNewMachineForm(p => ({ ...p, target_quality: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Machine Modal */}
      {showEditMachineModal && (
        <Modal
          title={`Modifica Macchina — ${editMachineForm.id}`}
          onClose={() => setShowEditMachineModal(false)}
          footer={
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", width: "100%" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 2, minWidth: "150px" }}
                onClick={handleUpdateMachine}
                disabled={isSavingMachine}
              >
                {isSavingMachine ? "Salvataggio..." : "Salva Modifiche"}
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, color: "var(--danger)", borderColor: "var(--danger)", minWidth: "100px" }}
                onClick={handleDeleteMachine}
                disabled={isDeletingMachine || isSavingMachine}
              >
                {isDeletingMachine ? "Eliminazione..." : "Elimina"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEditMachineModal(false)}>Annulla</button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px" }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>ID Macchina (Sola Lettura)</label>
              <input
                type="text"
                className="input"
                value={editMachineForm.id}
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Nome Macchina</label>
              <input
                type="text"
                className="input"
                placeholder="Es. DRA 15"
                value={editMachineForm.nome}
                onChange={e => setEditMachineForm(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: "700" }}>Tecnologia</label>
              <select
                className="select-input"
                value={editMachineForm.tecnologia_id}
                onChange={e => setEditMachineForm(p => ({ ...p, tecnologia_id: e.target.value }))}
              >
                <option value="">-- Seleziona --</option>
                {tecnologie.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
                <option value="DMC">Marcatura Laser DMC</option>
                <option value="ZSA">ZSA (Zahnstangen)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ fontWeight: "700" }}>Target Performance (%)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="100"
                  value={editMachineForm.target_performance}
                  onChange={e => setEditMachineForm(p => ({ ...p, target_performance: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ fontWeight: "700" }}>Target Qualità (%)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="100"
                  value={editMachineForm.target_quality}
                  onChange={e => setEditMachineForm(p => ({ ...p, target_quality: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
