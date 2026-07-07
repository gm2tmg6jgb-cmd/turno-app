import React, { useState, useEffect } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { normalizeProject } from "../utils/sapMapping";

const PROJECTS = [
  { id: "DCT300", label: "DCT300", headerColor: "#3B82F6" },
  { id: "8Fe", label: "8Fedct", headerColor: "#DC2626" },
  { id: "DCT ECO", label: "DCT ECO", headerColor: "#F59E0B" },
];

const PHASES = ["Allestimento", "Start Soft", "End Soft", "HT", "Start Hard", "End Hard", "Washing"];

// Target giornaliero per progetto (da ComponentFlowView)
const PROJECT_TARGETS = {
  "DCT300": 450,
  "8Fe": 800,
  "9TECO": 600,
};

// Hook per caricare dati di produzione
function useProductionData(date, weekStart) {
  const [data, setData] = useState({ daily: {}, weekly: {}, targets: PROJECT_TARGETS, loading: true, error: null });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));

        // Carica overrides materiali per il mapping
        const { data: overrides, error: overridesErr } = await fetchAllRows(() =>
          supabase.from("material_fino_overrides").select("materiale,fino,fase,componente,progetto")
        );
        if (overridesErr) throw overridesErr;

        // Mappa materiale+fino → progetto+fase
        const materialMap = {};
        (overrides || []).forEach(o => {
          const key = `${(o.materiale || "").toUpperCase()}::${String(o.fino || "").padStart(4, "0")}`;
          materialMap[key] = { progetto: o.progetto, fase: o.fase };
        });

        // Carica dati SAP per il giorno
        const { data: dailyRecords, error: dailyErr } = await fetchAllRows(() =>
          supabase.from("conferme_sap")
            .select("materiale,fino,qta_ottenuta,data,turno_id")
            .eq("data", date)
        );
        if (dailyErr) throw dailyErr;

        // Carica dati SAP per la settimana
        const endDate = new Date(weekStart);
        endDate.setDate(endDate.getDate() + 6);
        const endDateStr = endDate.toISOString().split("T")[0];

        const { data: weeklyRecords, error: weeklyErr } = await fetchAllRows(() =>
          supabase.from("conferme_sap")
            .select("materiale,fino,qta_ottenuta,data,turno_id")
            .gte("data", weekStart)
            .lte("data", endDateStr)
        );
        if (weeklyErr) throw weeklyErr;

        // Aggregazione funzione
        const aggregate = (records) => {
          const result = {};

          console.log("🔍 DEBUG Aggregazione:", {
            recordsCount: records.length,
            mapSize: Object.keys(materialMap).length,
            mapKeys: Object.keys(materialMap).slice(0, 5),
            firstRecord: records[0],
          });

          records.forEach((r, idx) => {
            const matKey = `${(r.materiale || "").toUpperCase()}::${String(r.fino || "").padStart(4, "0")}`;
            const mapping = materialMap[matKey];

            if (!mapping) {
              if (idx < 3) console.log(`⚠️ No mapping for matKey: "${matKey}"`);
              return;
            }

            const proj = normalizeProject(mapping.progetto);
            if (!PROJECTS.find(p => p.id === proj)) {
              console.log(`⚠️ Unknown project: ${proj} (original: ${mapping.progetto})`);
              return;
            }

            // Mappa fase SAP → fase display
            const faseLabel = PHASES[0]; // Placeholder: dovrebbe mappare da SAP a PHASES
            const qta = r.qta_ottenuta || 0;

            if (!result[proj]) result[proj] = {};
            if (!result[proj][faseLabel]) result[proj][faseLabel] = 0;
            result[proj][faseLabel] += qta;

            if (idx < 2) console.log(`✅ Added: ${proj}::${faseLabel} += ${qta}`);
          });

          console.log("📊 Result:", result);
          return result;
        };

        const dailyData = aggregate(dailyRecords || []);
        const weeklyData = aggregate(weeklyRecords || []);

        // Normalizza struttura: assicura che tutti i progetti e fasi siano presenti
        const normalizeStructure = (data) => {
          const result = {};
          PROJECTS.forEach(p => {
            result[p.id] = {};
            PHASES.forEach(phase => {
              result[p.id][phase] = data[p.id]?.[phase] || 0;
            });
          });
          return result;
        };

        setData({
          daily: normalizeStructure(dailyData),
          weekly: normalizeStructure(weeklyData),
          targets: PROJECT_TARGETS,
          loading: false,
          error: null
        });
      } catch (err) {
        console.error("Errore caricamento dati Consuntivo:", err);
        setData(prev => ({
          ...prev,
          loading: false,
          error: err.message || "Errore sconosciuto"
        }));
      }
    };

    fetchData();
  }, [date, weekStart]);

  return data;
}

function ProjectTable({ projectId, projectLabel, headerColor, phaseData, target }) {
  const aggregates = {
    TARGET: target,
    "End Hard": Object.values(phaseData).reduce((sum, v) => sum + v, 0),
    WASHED: Object.values(phaseData).reduce((sum, v) => sum + v, 0),
  };

  return (
    <div style={{ marginBottom: 8, overflowX: "auto" }}>
      <div style={{
        backgroundColor: headerColor,
        padding: "8px 12px",
        color: "white",
        fontWeight: 700,
        fontSize: 14,
        marginBottom: 0,
        borderRadius: "4px 4px 0 0"
      }}>
        {projectLabel}
      </div>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        backgroundColor: "var(--bg-card)",
        border: `1px solid ${headerColor}`,
        borderTop: "none",
      }}>
        <tbody>
          <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-primary)", borderRight: "1px solid var(--border)", minWidth: 70 }}>TARGET</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", borderRight: "1px solid var(--border)" }}>{aggregates.TARGET}</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, textAlign: "center", borderRight: "1px solid var(--border)" }}>End Hard</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", color: "#DC2626", borderRight: "1px solid var(--border)" }}>{aggregates["End Hard"]}</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, textAlign: "center", borderRight: "1px solid var(--border)" }}>WASHED</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", color: "#16A34A" }}>{aggregates.WASHED}</td>
            <td colSpan="2"></td>
          </tr>
          <tr style={{ backgroundColor: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
            <td style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600 }}></td>
            {PHASES.map((phase) => (
              <td key={phase} style={{
                padding: "4px 6px",
                fontSize: 10,
                fontWeight: 600,
                textAlign: "center",
                borderRight: "1px solid var(--border)",
              }}>
                {phase}
              </td>
            ))}
          </tr>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <td style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              borderRight: "1px solid var(--border)",
              minWidth: 70,
            }}>
              GEARS
            </td>
            {PHASES.map((phase) => {
              const value = phaseData[phase] || 0;
              const color = value > target ? "#DC2626" : "#16A34A";
              return (
                <td key={phase} style={{
                  padding: "4px 6px",
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: "center",
                  borderRight: "1px solid var(--border)",
                  color: color,
                }}>
                  {value > 0 ? value.toLocaleString("it-IT") : "—"}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TotalRow({ productsData, targets }) {
  const totalTarget = Object.values(targets).reduce((a, b) => a + b, 0);
  const totalEndHard = Object.values(productsData).reduce((sum, proj) =>
    sum + Object.values(proj).reduce((s, v) => s + v, 0), 0
  );

  return (
    <div style={{ marginBottom: 8, overflowX: "auto" }}>
      <div style={{
        backgroundColor: "#6B7280",
        padding: "8px 12px",
        color: "white",
        fontWeight: 700,
        fontSize: 14,
        marginBottom: 0,
        borderRadius: "4px 4px 0 0"
      }}>
        TOTAL
      </div>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        backgroundColor: "var(--bg-card)",
        border: "1px solid #6B7280",
        borderTop: "none",
      }}>
        <tbody>
          <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, borderRight: "1px solid var(--border)", minWidth: 70 }}>TARGET</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", borderRight: "1px solid var(--border)" }}>{totalTarget}</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, textAlign: "center", borderRight: "1px solid var(--border)" }}>End Hard</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", color: "#DC2626", borderRight: "1px solid var(--border)" }}>{totalEndHard}</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, textAlign: "center", borderRight: "1px solid var(--border)" }}>ACTUAL</td>
            <td style={{ padding: "4px 8px", fontSize: 11, fontWeight: 700, textAlign: "center", color: "#DC2626" }}>{totalEndHard}</td>
            <td colSpan="2"></td>
          </tr>
          <tr style={{ backgroundColor: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
            <td style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600 }}></td>
            {PHASES.map((phase) => (
              <td key={phase} style={{
                padding: "4px 6px",
                fontSize: 10,
                fontWeight: 600,
                textAlign: "center",
                borderRight: "1px solid var(--border)",
              }}>
                {phase}
              </td>
            ))}
          </tr>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <td style={{
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              borderRight: "1px solid var(--border)",
              minWidth: 70,
            }}>
              GEARS
            </td>
            {PHASES.map((phase) => {
              const value = Object.values(productsData).reduce((sum, proj) => sum + (proj[phase] || 0), 0);
              const color = value > 1000 ? "#DC2626" : "#16A34A";
              return (
                <td key={phase} style={{
                  padding: "4px 6px",
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: "center",
                  borderRight: "1px solid var(--border)",
                  color: color,
                }}>
                  {value > 0 ? value.toLocaleString("it-IT") : "—"}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
}

export default function ProductionSummaryView({ globalDate, setGlobalDate }) {
  const [selectedDate, setSelectedDate] = useState(globalDate);
  const monday = getMonday(selectedDate);

  const { daily, weekly, targets, loading, error } = useProductionData(selectedDate, monday);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setGlobalDate(e.target.value);
  };

  if (error) {
    return (
      <div style={{ padding: "24px", color: "var(--danger)" }}>
        <h2>Errore caricamento dati</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      {/* Consuntivo Giornaliero */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Consuntivo Produzione</h2>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              border: "1px solid var(--border)",
              borderRadius: 4,
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
          />
          {loading && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>⏳ Caricamento...</span>}
        </div>

        {PROJECTS.map((proj) => (
          <ProjectTable
            key={proj.id}
            projectId={proj.id}
            projectLabel={proj.label}
            headerColor={proj.headerColor}
            phaseData={daily[proj.id] || {}}
            target={targets[proj.id]}
          />
        ))}

        <TotalRow productsData={daily} targets={targets} />
      </div>

      {/* Up to Week */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Up to Week</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Da lunedì {new Date(monday).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
          </p>
        </div>

        {PROJECTS.map((proj) => (
          <ProjectTable
            key={`weekly-${proj.id}`}
            projectId={proj.id}
            projectLabel={proj.label}
            headerColor={proj.headerColor}
            phaseData={weekly[proj.id] || {}}
            target={targets[proj.id]}
          />
        ))}

        <TotalRow productsData={weekly} targets={targets} />
      </div>
    </div>
  );
}
