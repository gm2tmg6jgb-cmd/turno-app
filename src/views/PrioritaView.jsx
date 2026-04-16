import React, { useState, useEffect } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

// --- LABORATORIO INVENTARIO: Tracciamento WIP con Inventario Fisico ---

const LOCAL_ANAGRAFICA = {
    "M0153401/S": { comp: "SG3", proj: "8Fe" },
    "M0153401": { comp: "SG3", proj: "8Fe" },
    "M0153389/S": { comp: "SG3", proj: "DCT300" },
    "M0153384/S": { comp: "DG", proj: "DCT300" },
    "M0153384": { comp: "DG", proj: "DCT300" },
    "M0192963/S": { comp: "SG3", proj: "DCT ECO" },
    "M0192963": { comp: "SG3", proj: "DCT ECO" },
    "M0140997/S": { comp: "SG2", proj: "DCT ECO" },
    "M0140997": { comp: "SG2", proj: "DCT ECO" },
    "2516272835": { comp: "SG1", proj: "DCT300" },
    "2516107836": { comp: "SG1", proj: "DCT300" },
    "M0162583/S": { comp: "SG4", proj: "8Fe" },
    "M0162583/T": { comp: "SG4", proj: "8Fe" },
    "M0162583": { comp: "SG4", proj: "8Fe" },
    "M0162623": { comp: "SG5", proj: "8Fe" },
    "M0153387": { comp: "SG6", proj: "8Fe" },
    "M0153397/S": { comp: "SG8", proj: "8Fe" },
    "M0153397/T": { comp: "SG8", proj: "8Fe" },
    "M0153397": { comp: "SG8", proj: "8Fe" }
};

// Label fasi da ID
const PHASE_CODE = {
    "start_soft": "DRA", "dmc": "ZSA", "laser_welding": "SCA",
    "laser_welding_soft_2": "SCA", "shaping": "STW", "milling": "FRA",
    "broaching": "RAA", "hobbing": "FRW", "deburring": "EGW",
    "to_be_treated": "WIP", "ht": "HT", "shot_peening": "OKU",
    "start_hard": "DRA", "laser_welding_2": "SCA", "ut_soft": "MZA",
    "ut": "UT", "grinding_cone": "SLA", "grinding_cone_2": "SLA",
    "teeth_grinding": "SLW", "to_be_washed": "WIP", "washing": "WSH",
    "baa": "BAA"
};

const PHASE_LABEL = {
    "start_soft": "Torn. Soft", "dmc": "DMC", "laser_welding": "Sald. Soft",
    "laser_welding_soft_2": "Sald. Soft 2", "shaping": "Stozzatura", "milling": "Fresatura",
    "broaching": "Brocciatura", "hobbing": "Dentatura", "deburring": "Sbavatura",
    "to_be_treated": "Da Trattare", "ht": "Tratt. Term.", "shot_peening": "Pallinatura",
    "start_hard": "Torn. Hard", "laser_welding_2": "Sald. Hard", "ut_soft": "MZA Soft",
    "ut": "MZA Hard", "grinding_cone": "Rett. Cono", "grinding_cone_2": "Rett. Cono 2",
    "teeth_grinding": "Rett. Denti", "to_be_washed": "Da Lavare", "washing": "Lavaggio",
    "baa": "BAA"
};

// Componenti del laboratorio
const PROJECTS = ["DCT ECO"];
const PROJECT_COMPONENTS_LAB = {
    "DCT ECO": ["SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2"]
};

// Colore tema per progetto
const PROJECT_COLORS = {
    "DCT ECO": { main: "#f59e0b", bg: "rgba(245, 158, 11, 0.05)" },
    "DCT300": { main: "#3c6ef0", bg: "rgba(60, 110, 240, 0.05)" },
    "8Fe": { main: "#10b981", bg: "rgba(16, 185, 129, 0.05)" },
};
const normalizeComp = (c) => {
    if (!c) return "";
    const s = String(c).toUpperCase();
    if (s.includes("SG4")) return "SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2";
    return s;
};


export default function PrioritaView({ showToast, globalDate }) {
    const [inventarioDate, setInventarioDate] = useState(() =>
        localStorage.getItem("lab_inv_date") || new Date().toISOString().split("T")[0]
    );
    const [finoSequences, setFinoSequences] = useState({}); // {comp: [{fino, fase}]}
    const [matrixData, setMatrixData] = useState({}); // {comp: {fino: {inv, sap, sapPrev, remaining, records}}}
    const [componentsByProject, setComponentsByProject] = useState({});
    const [loading, setLoading] = useState(false);
    const [editingCell, setEditingCell] = useState(null); // {comp, fino, value}
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [savingCell, setSavingCell] = useState(null); // {comp, fino}
    const [isConfigMode, setIsConfigMode] = useState(false);
    const [quickConfigModal, setQuickConfigModal] = useState(null);
    const [showDetails, setShowDetails] = useState(true);

    useEffect(() => {
        localStorage.setItem("lab_inv_date", inventarioDate);
    }, [inventarioDate]);

    useEffect(() => {
        if (globalDate) setInventarioDate(globalDate);
    }, [globalDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Anagrafica materiali
            const anagrafica = {};
            Object.entries(LOCAL_ANAGRAFICA).forEach(([mat, info]) => {
                anagrafica[mat.toUpperCase()] = { comp: info.comp, proj: info.proj };
            });
            const { data: anagraficaRes } = await fetchAllRows(() =>
                supabase.from("anagrafica_materiali").select("codice,componente,progetto")
            );
            if (anagraficaRes) {
                anagraficaRes.forEach(row => {
                    const c = (row.codice || "").toUpperCase();
                    if (c && !anagrafica[c]) {
                        anagrafica[c] = { comp: row.componente, proj: row.progetto };
                    }
                });
            }

            // Normalizza comp per il laboratorio
            const normalizeComp = (comp) => {
                const c = (comp || "").toUpperCase();
                const eco = ["SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2"];
                if (eco.includes(c)) return c + " ECO";
                return c;
            };

            // 2. Material_fino_overrides → sequenza finos per componente
            const { data: matOverridesRes } = await fetchAllRows(() =>
                supabase.from("material_fino_overrides").select("materiale,fino,fase,componente,progetto")
            );
            const dbOverrides = (matOverridesRes || []).map(r => ({
                mat: (r.materiale || "").toUpperCase(),
                fino: r.fino ? String(r.fino).padStart(4, "0") : null,
                fase: r.fase,
                comp: (r.componente || "").toUpperCase(),
                proj: (r.progetto || "").trim()
            }));

            // Costruisce sequenze finos per componente
            const LAB_SEQUENCE = [
                "start_soft", "dmc", "laser_welding", "laser_welding_soft_2", "shaping", 
                "milling", "broaching", "hobbing", "deburring", "to_be_treated", "ht", 
                "shot_peening", "start_hard", "laser_welding_2", "ut_soft", "ut", 
                "grinding_cone", "grinding_cone_2", "teeth_grinding", "to_be_washed", "washing", "baa"
            ];

            const finoSeqSorted = {};
            PROJECTS.forEach(proj => {
                const comps = PROJECT_COMPONENTS_LAB[proj] || [];
                comps.forEach(comp => {
                    const normComp = normalizeComp(comp);
                    finoSeqSorted[normComp] = LAB_SEQUENCE.map(fase => {
                        const override = dbOverrides.find(o => 
                            normalizeComp(o.comp) === normComp && o.proj === proj && o.fase === fase
                        );
                        return { 
                            fino: override ? override.fino : "0000", 
                            fase: fase 
                        };
                    });
                });
            });
            setFinoSequences(finoSeqSorted);

            // 3. Inventario fisico da Supabase
            const { data: invRes } = await supabase
                .from("inventario_fisico")
                .select("componente,fino,quantita,data_inventario");
            const invMap = {}; // {comp: {fino: qty}}
            if (invRes) {
                invRes.forEach(r => {
                    const comp = (r.componente || "").toUpperCase();
                    const fino = String(r.fino || "").padStart(4, "0");
                    if (!invMap[comp]) invMap[comp] = {};
                    invMap[comp][fino] = r.quantita || 0;
                });
            }
            // 4. SAP conferme dal inventarioDate in poi
            const { data: sapRes } = await fetchAllRows(() =>
                supabase.from("conferme_sap")
                    .select("data,materiale,fino,qta_ottenuta,work_center_sap,macchina_id,turno_id")
                    .gte("data", inventarioDate)
            );

            // Aggrega SAP per comp+fino
            const sapMap = {}; // {comp: {fino: {qty, records}}}

            // Filtro materiali e progetto stretti
            const validConfigMap = {};
            dbOverrides.forEach(o => {
                if (!PROJECTS.includes(o.proj)) return;
                const key = `${o.mat}_${o.fino}`;
                validConfigMap[key] = { comp: normalizeComp(o.comp), fase: o.fase };
            });

            if (sapRes) {
                sapRes.forEach(r => {
                    const matCode = (r.materiale || "").toUpperCase();
                    const fino = String(r.fino || "").padStart(4, "0");
                    if (!fino || fino === "0000") return;

                    const config = validConfigMap[`${matCode}_${fino}`];
                    if (!config) return;

                    const comp = config.comp;
                    if (!sapMap[comp]) sapMap[comp] = {};
                    if (!sapMap[comp][fino]) sapMap[comp][fino] = { qty: 0, records: [] };
                    sapMap[comp][fino].qty += (r.qta_ottenuta || 0);
                    sapMap[comp][fino].records.push({
                        ...r,
                        matCode,
                        macchina: (r.macchina_id || r.work_center_sap || "").toUpperCase()
                    });
                });
            }

            // 5. Calcolo WIP flow per componente
            const newMatrix = {};
            PROJECTS.forEach(proj => {
                const comps = PROJECT_COMPONENTS_LAB[proj] || [];
                comps.forEach(comp => {
                    const normComp = normalizeComp(comp);
                    const seq = finoSeqSorted[normComp] || [];
                    newMatrix[normComp] = {};

                    seq.forEach(({ fino, fase }, idx) => {
                        const inv = invMap[normComp]?.[fino] || 0;
                        const sap = sapMap[normComp]?.[fino]?.qty || 0;
                        const sapRecords = sapMap[normComp]?.[fino]?.records || [];
                        const prevFino = idx > 0 ? seq[idx - 1].fino : null;
                        const sapPrev = prevFino ? (sapMap[normComp]?.[prevFino]?.qty || 0) : 0;
                        const remaining = inv - sap + sapPrev;

                        newMatrix[normComp][fino] = {
                            fino, fase, inv, sap, sapPrev, remaining, records: sapRecords
                        };
                    });
                });
            });

            setMatrixData(newMatrix);
            setComponentsByProject(PROJECT_COMPONENTS_LAB);

        } catch (err) {
            console.error("[PrioritaView] Errore fetchData:", err);
            showToast?.("Errore caricamento dati inventario", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [inventarioDate]);

    const saveInventory = async (comp, fino, qty) => {
        if (!fino || fino === "0000") {
            showToast?.("Configura prima l'operazione (fino) tramite l'ingranaggio", "error");
            return;
        }
        const normComp = comp.toUpperCase();
        setSavingCell({ comp: normComp, fino });
        try {
            const { error } = await supabase.from("inventario_fisico")
                .upsert({
                    componente: normComp,
                    fino,
                    quantita: qty,
                    data_inventario: inventarioDate,
                    updated_at: new Date().toISOString()
                }, { onConflict: "componente,fino" });

            if (error) throw error;

            // Ricalcola rimanenza per questo fino e il successivo
            setMatrixData(prev => {
                const updated = { ...prev };
                if (!updated[normComp]) return prev;
                const seq = finoSequences[normComp] || [];
                const idx = seq.findIndex(s => s.fino === fino);
                if (idx === -1) return prev;

                // Ricalcola fino corrente
                const prevFino = idx > 0 ? seq[idx - 1].fino : null;
                const sapPrev = prevFino ? (updated[normComp][prevFino]?.sap || 0) : 0;
                const cell = updated[normComp][fino];
                updated[normComp][fino] = { ...cell, inv: qty, remaining: qty - (cell?.sap || 0) + sapPrev };

                // Ricalcola fino successivo (perché il suo sapPrev cambia)
                const nextEntry = seq[idx + 1];
                if (nextEntry) {
                    const nextCell = updated[normComp][nextEntry.fino];
                    const newSap = updated[normComp][fino]?.sap || 0;
                    updated[normComp][nextEntry.fino] = {
                        ...nextCell,
                        sapPrev: newSap,
                        remaining: (nextCell?.inv || 0) - (nextCell?.sap || 0) + newSap
                    };
                }
                return updated;
            });

        } catch (err) {
            console.error("[PrioritaView] Errore salvataggio inventario:", err);
            showToast?.("Errore salvataggio inventario", "error");
        } finally {
            setSavingCell(null);
        }
    };

    const startEditing = (comp, fino, currentInv) => {
        if (isConfigMode) {
            const cell = matrixData[comp]?.[fino];
            if (cell) {
                setQuickConfigModal({
                    project: "DCT ECO",
                    comp,
                    phase: cell.fase,
                    phaseLabel: PHASE_LABEL[cell.fase] || cell.fase
                });
            }
            return;
        }
        setEditingCell({ comp, fino, value: currentInv });
    };

    const commitEdit = async () => {
        if (!editingCell) return;
        const qty = parseInt(editingCell.value) || 0;
        await saveInventory(editingCell.comp, editingCell.fino, qty);
        setEditingCell(null);
    };

    const cancelEdit = () => setEditingCell(null);

    // Colore rimanenza
    const remainingColor = (remaining) => {
        if (remaining < 0) return "#ef4444";
        if (remaining === 0) return "var(--text-muted)";
        return "var(--text-primary)";
    };

    const remainingBg = (remaining) => {
        if (remaining < 0) return "rgba(239, 68, 68, 0.12)";
        if (remaining === 0) return "var(--bg-tertiary)";
        return "rgba(255,255,255,0.04)";
    };

    return (
        <div className="fade-in" style={{ padding: "20px", height: "100%", overflowY: "auto" }}>

            {/* Header toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 20 }}>📦</div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Laboratorio Inventario</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>WIP tracking con scarichi SAP</div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {/* Data inventario */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)", padding: "6px 14px", borderRadius: 10, border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Inventario dal</span>
                        <input
                            type="date"
                            value={inventarioDate}
                            onChange={e => setInventarioDate(e.target.value)}
                            style={{
                                border: "none", background: "transparent", fontSize: 13,
                                fontWeight: 800, color: "var(--accent)", cursor: "pointer",
                                outline: "none"
                            }}
                        />
                    </div>

                    <button
                        onClick={() => fetchData()}
                        className="btn btn-secondary btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                        {Icons.refresh} Aggiorna
                    </button>

                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="btn"
                    style={{
                        padding: "8px 12px", display: "flex", alignItems: "center", gap: 6,
                        fontWeight: 700,
                        background: showDetails ? "rgba(96,165,250,0.1)" : "var(--bg-tertiary)",
                        color: showDetails ? "#60a5fa" : "var(--text-secondary)",
                        border: "1px solid " + (showDetails ? "#60a5fa33" : "var(--border)")
                    }}
                >
                    {showDetails ? "Nascondi Dettagli" : "Mostra Dettagli"}
                </button>

                    <button
                        onClick={() => setIsConfigMode(!isConfigMode)}
                        className="btn"
                        style={{
                            padding: "8px 12px", display: "flex", alignItems: "center", gap: 6,
                            fontWeight: 700,
                            background: isConfigMode ? "var(--accent)" : "var(--bg-tertiary)",
                            color: isConfigMode ? "white" : "var(--text-secondary)",
                            border: "1px solid var(--border)",
                            boxShadow: isConfigMode ? "0 0 10px var(--accent)" : "none"
                        }}
                    >
                        {isConfigMode ? "✓ Fine Config" : "⚙ Configura Fasi"}
                    </button>
                </div>
            </div>

            {/* Legenda */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                    { color: "var(--accent)", label: "Inv", desc: "Inventario fisico (editabile)" },
                    { color: "#60a5fa", label: "SAP ↓", desc: "Scarichi SAP dal " + new Date(inventarioDate + "T12:00:00").toLocaleDateString("it-IT") },
                    { color: "#a78bfa", label: "SAP ↑", desc: "Entrate dalla fase precedente" },
                    { color: "var(--text-primary)", label: "=", desc: "Rimanenza = Inv - SAP↓ + SAP↑" },
                ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                        <span style={{ fontWeight: 700, color: item.color }}>{item.label}</span>
                        <span>{item.desc}</span>
                    </div>
                ))}
            </div>

            {loading && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    Caricamento dati...
                </div>
            )}

            {!loading && PROJECTS.map(proj => {
                const comps = componentsByProject[proj] || [];
                if (comps.length === 0) return null;
                const theme = PROJECT_COLORS[proj] || PROJECT_COLORS["DCT300"];

                return (
                    <div key={proj} style={{
                        background: "var(--bg-card)",
                        borderRadius: 16,
                        border: `1px solid ${theme.main}33`,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        overflow: "hidden",
                        marginBottom: 24
                    }}>
                        {/* Header progetto */}
                        <div style={{
                            padding: "10px 20px",
                            background: `linear-gradient(90deg, ${theme.bg}, transparent)`,
                            borderBottom: `1px solid ${theme.main}22`,
                            display: "flex", alignItems: "center", gap: 12
                        }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.main }} />
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.main }}>
                                {proj}
                            </h2>
                        </div>

                        {/* Tabella */}
                        <div style={{ overflow: "auto", padding: 12 }}>
                            <div style={{ minWidth: "max-content" }}>
                                {comps.map(comp => {
                                    const normComp = normalizeComp(comp);
                                    const seq = finoSequences[normComp] || [];
                                    const compMatrix = matrixData[normComp] || {};

                                    if (seq.length === 0) {
                                        return (
                                            <div key={comp} style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
                                                Nessuna fase configurata per {comp}. Configura i materiali tramite ⚙ Configura Fasi.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={comp}>
                                            {/* Intestazione colonne */}
                                            <div style={{ display: "flex", marginBottom: 6, paddingLeft: 120 }}>
                                                {seq.map(({ fino, fase }) => (
                                                    <div key={fase + "_" + fino} style={{
                                                        width: 90, flexShrink: 0, textAlign: "center", paddingTop: 4,
                                                        borderTop: `2px solid ${theme.main}44`
                                                    }}>
                                                        <div style={{ fontSize: 14, fontWeight: 800, color: theme.main }}>
                                                            {PHASE_CODE[fase] || fase}
                                                        </div>
                                                        <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>
                                                            op.{fino}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Riga componente */}
                                            <div style={{ display: "flex", alignItems: "stretch", padding: "8px 0" }}>
                                                {/* Label componente */}
                                                <div style={{
                                                    alignSelf: "flex-start", height: 50, width: 120, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
                                                    fontSize: 16, fontWeight: 800, color: "var(--text-primary)",
                                                    paddingRight: 8
                                                }}>
                                                    {comp}
                                                </div>

                                                {/* Celle */}
                                                {seq.map(({ fino, fase }, idx) => {
                                                    const cell = compMatrix[fino] || { inv: 0, sap: 0, sapPrev: 0, remaining: 0, records: [] };
                                                    const isEditing = editingCell?.comp === normComp && editingCell?.fino === fino;
                                                    const isSaving = savingCell?.comp === normComp && savingCell?.fino === fino;
                                                    const isFirstFino = idx === 0;

                                                    return (
                                                        <div key={fase + "_" + fino} style={{
                                                            width: 90, flexShrink: 0, padding: "0 4px",
                                                            borderLeft: idx > 0 ? "1px solid var(--border-light)" : "none"
                                                        }}>
                                                            {/* Cella principale — rimanenza */}
                                                            <div
                                                                onClick={() => !isEditing && startEditing(normComp, fino, cell.inv)}
                                                                title={isConfigMode ? "Configura fase" : "Clicca per modificare inventario fisico"}
                                                                style={{
                                                                    width: "100%",
                                                                    height: 50,
                                                                    background: remainingBg(cell.remaining),
                                                                    borderRadius: 10,
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    cursor: "pointer",
                                                                    border: `1px solid ${cell.remaining !== 0 ? theme.main + "33" : "transparent"}`,
                                                                    position: "relative",
                                                                    transition: "all 0.15s"
                                                                }}
                                                            >
                                                                {isSaving ? (
                                                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>...</div>
                                                                ) : isConfigMode ? (
                                                                    <div style={{ fontSize: 18, color: "var(--accent)" }}>⚙</div>
                                                                ) : isEditing ? (
                                                                    <input
                                                                        autoFocus
                                                                        type="number"
                                                                        value={editingCell.value}
                                                                        onChange={e => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
                                                                        onBlur={commitEdit}
                                                                        onKeyDown={e => e.key === "Enter" && commitEdit()}
                                                                        style={{
                                                                            width: "90%", fontSize: 16, textAlign: "center",
                                                                            fontWeight: 900, border: "2px solid var(--accent)",
                                                                            borderRadius: 6, padding: "2px 0", outline: "none",
                                                                            background: "white", color: "black"
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div style={{
                                                                        fontSize: Math.abs(cell.remaining) >= 1000 ? 14 : 18,
                                                                        fontWeight: 900,
                                                                        color: remainingColor(cell.remaining),
                                                                        opacity: cell.remaining === 0 ? 0.35 : 1
                                                                    }}>
                                                                        {cell.remaining !== 0 ? cell.remaining : "—"}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Riga dettaglio inv/sap (Verticale) */}
                                                            {showDetails && (
                                                                <div style={{
                                                                    display: "flex", flexDirection: "column", gap: 3,
                                                                    padding: "4px 2px", width: "100%", borderTop: "1px solid var(--border-light)", marginTop: 4
                                                                }}>
                                                                {/* Inventario fisico (editabile) */}
                                                                <div
                                                                    onClick={() => startEditing(normComp, fino, cell.inv)}
                                                                    title="Modifica inventario fisico"
                                                                    style={{
                                                                        width: "100%", fontSize: 12, fontWeight: 800,
                                                                        color: cell.inv > 0 ? "white" : "var(--text-muted)",
                                                                        textAlign: "center", cursor: "pointer",
                                                                        padding: "4px 2px", borderRadius: 6,
                                                                        border: cell.inv > 0 ? "none" : "1px dashed var(--border-light)",
                                                                        background: cell.inv > 0 ? "var(--accent)" : "transparent",
                                                                        opacity: isConfigMode ? 0 : 1
                                                                    }}
                                                                >
                                                                    {`Inv: ${cell.inv || 0}`}
                                                                </div>

                                                                {/* SAP scarichi */}
                                                                {true && (
                                                                    <div
                                                                        onClick={() => !isConfigMode && cell.records.length > 0 && setSelectedDetail({
                                                                            title: `${comp} — op.${fino} (${PHASE_CODE[fase] || fase})`,
                                                                            records: cell.records,
                                                                            fino, fase
                                                                        })}
                                                                        title="Scarichi SAP — clicca per dettaglio"
                                                                        style={{
                                                                            width: "100%", fontSize: 12, fontWeight: 800,
                                                                            color: "#60a5fa",
                                                                            textAlign: "center", cursor: cell.records.length > 0 ? "pointer" : "default",
                                                                            padding: "4px 2px", borderRadius: 6,
                                                                            border: "1px solid rgba(96,165,250,0.3)",
                                                                            background: "rgba(96,165,250,0.1)",
                                                                            whiteSpace: "nowrap"
                                                                        }}
                                                                    >
                                                                        {`SAP ↓: ${cell.sap || 0}`}
                                                                    </div>
                                                                )}

                                                                {/* Entrate dalla fase precedente */}
                                                                {!isFirstFino && true && (
                                                                    <div
                                                                        title="Pezzi entrati dalla fase precedente"
                                                                        style={{
                                                                            width: "100%", fontSize: 12, fontWeight: 800,
                                                                            color: "#a78bfa",
                                                                            textAlign: "center",
                                                                            padding: "4px 2px", borderRadius: 6,
                                                                            border: "1px solid rgba(167,139,250,0.3)",
                                                                            background: "rgba(167,139,250,0.1)",
                                                                            whiteSpace: "nowrap"
                                                                        }}
                                                                    >
                                                                        {`SAP ↑: ${cell.sapPrev || 0}`}
                                                                    </div>
                                                                )}
                                                            </div>)}
                                                            </div>
                                                    );
                                                })}
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Modale dettaglio scarichi SAP */}
            {selectedDetail && (
                <div style={{
                    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
                    display: "flex", flexDirection: "column", alignItems: "center", alignItems: "center", backdropFilter: "blur(4px)"
                }} onClick={() => setSelectedDetail(null)}>
                    <div style={{
                        background: "var(--bg-card)", borderRadius: 16,
                        width: "90%", maxWidth: 600, maxHeight: "80vh",
                        display: "flex", flexDirection: "column",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: "1px solid var(--border)",
                        overflow: "hidden"
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{
                            padding: "16px 20px", borderBottom: "1px solid var(--border)",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "var(--bg-tertiary)"
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedDetail.title}</h3>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                    Scarichi SAP dal {new Date(inventarioDate + "T12:00:00").toLocaleDateString("it-IT")} — {selectedDetail.records.length} record
                                </div>
                            </div>
                            <button onClick={() => setSelectedDetail(null)}
                                style={{ background: "rgba(255,255,255,0.05)", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>✕</button>
                        </div>
                        <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                        {["Data", "Materiale", "Macchina", "Turno", "Q.tà"].map(h => (
                                            <th key={h} style={{ padding: "8px 10px", textAlign: h === "Q.tà" ? "right" : "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedDetail.records.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "8px 10px", fontSize: 12 }}>{new Date(r.data + "T12:00:00").toLocaleDateString("it-IT")}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{r.materiale}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 11 }}>{r.macchina_id || r.work_center_sap || "—"}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 11 }}>{r.turno_id || "—"}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 14, fontWeight: 900, textAlign: "right", color: "#60a5fa" }}>{r.qta_ottenuta}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Config Modal */}
            {quickConfigModal && (
                <QuickConfigModal
                    data={quickConfigModal}
                    onClose={() => setQuickConfigModal(null)}
                    onSave={() => { setQuickConfigModal(null); fetchData(); }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}

// --- QUICK CONFIG MODAL ---
const QuickConfigModal = ({ data, onClose, onSave, showToast }) => {
    const [form, setForm] = useState({
        fino: "",
        componente: data.comp || "",
        codice: "",
        codice2: ""
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchExisting = async () => {
            try {
                const { data: existing } = await supabase
                    .from("material_fino_overrides")
                    .select("*")
                    .eq("fase", data.phase)
                    .eq("componente", data.comp.toUpperCase())
                    .eq("progetto", data.project)
                    .limit(2);

                if (existing && existing.length > 0) {
                    setForm({
                        fino: existing[0].fino || "",
                        componente: existing[0].componente || data.comp || "",
                        codice: existing[0].materiale || "",
                        codice2: existing[1] ? existing[1].materiale : ""
                    });
                }
            } catch (_) { /* table not ready yet */ }
            finally { setIsLoading(false); }
        };
        fetchExisting();
    }, []);

    const handleSave = async () => {
        if (!form.codice.trim()) {
            showToast?.("Inserisci almeno un codice materiale", "error");
            return;
        }
        setIsSaving(true);
        try {
            const rows = [
                {
                    materiale: form.codice.toUpperCase().trim(),
                    fino: form.fino ? String(form.fino).padStart(4, "0") : null,
                    fase: data.phase,
                    componente: form.componente.toUpperCase().trim(),
                    progetto: data.project
                }
            ];
            if (form.codice2.trim()) {
                rows.push({
                    materiale: form.codice2.toUpperCase().trim(),
                    fino: form.fino ? String(form.fino).padStart(4, "0") : null,
                    fase: data.phase,
                    componente: form.componente.toUpperCase().trim(),
                    progetto: data.project
                });
            }
            for (const row of rows) {
                const { data: existing } = await supabase.from("material_fino_overrides")
                    .select("id")
                    .eq("materiale", row.materiale)
                    .eq("fase", row.fase)
                    .eq("componente", row.componente)
                    .maybeSingle();

                if (existing) {
                    await supabase.from("material_fino_overrides").update(row).eq("id", existing.id);
                } else {
                    await supabase.from("material_fino_overrides").insert(row);
                }
            }
            showToast?.("Configurazione salvata!", "success");
            onSave();
        } catch (err) {
            console.error(err);
            showToast?.("Errore salvataggio configurazione", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return null;

    return (
        <div className="modal-backdrop" style={{ zIndex: 3000 }}>
            <div className="modal-content" style={{ width: 380, padding: 24 }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, marginTop: 0 }}>
                    Configura fase: {PHASE_LABEL[data.phase] || data.phase}
                </h3>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
                    {data.comp} — {data.project}
                </div>

                {[
                    { key: "fino", label: "Fino (Operazione SAP)", placeholder: "es. 0100" },
                    { key: "codice", label: "Codice Materiale 1", placeholder: "es. M0162644" },
                    { key: "codice2", label: "Codice Materiale 2 (opzionale)", placeholder: "es. M0162644/S" },
                    { key: "componente", label: "Componente", placeholder: "es. SG4 ECO" },
                ].map(field => (
                    <div key={field.key} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                            {field.label}
                        </label>
                        <input
                            type="text"
                            value={form[field.key]}
                            onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            style={{
                                width: "100%", padding: "8px 12px", fontSize: 13,
                                borderRadius: 8, border: "1px solid var(--border)",
                                background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                boxSizing: "border-box"
                            }}
                        />
                    </div>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Annulla</button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Salvataggio..." : "Salva"}
                    </button>
                </div>
            </div>
        </div>
    );
};
