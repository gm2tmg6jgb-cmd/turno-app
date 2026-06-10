import React, { useState } from 'react';
import { useInventoryAnalysis } from '../hooks/useInventoryAnalysis';
import KPICard from '../components/InventoryAnalysis/KPICard';
import TimelineChart from '../components/InventoryAnalysis/TimelineChart';
import AnalysisTable from '../components/InventoryAnalysis/AnalysisTable';
import BottleneckHeatmap from '../components/InventoryAnalysis/BottleneckHeatmap';
import RecommendationBox from '../components/InventoryAnalysis/RecommendationBox';

const PROJECTS = ["DCT ECO", "8Fe", "DCT300"];
const PROJECT_COMPONENTS_LAB = {
    "DCT ECO": ["SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2"],
    "8Fe": ["SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "FG5/7"],
    "DCT300": ["SG1", "DG-REV", "DG - 1A", "DG - 21A", "SG3 - 1A", "SG3 - 21A", "SG4 - 1A", "SG4 - 21A", "SG5 - 1A", "SG5 - 21A", "SG6 - 1A", "SG6 - 21A", "SG7 - 1A", "SG7 - 21A", "SGR", "RG - 1A", "RG - 21A"]
};

export default function InventarioAnalysisView({ showToast, globalDate }) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const startDateStr = weekStart.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];

    const [project, setProject] = useState("DCT ECO");
    const [component, setComponent] = useState("SG2");
    const [startDate, setStartDate] = useState(startDateStr);
    const [endDate, setEndDate] = useState(endDateStr);

    const { data: analysisData, loading, error } = useInventoryAnalysis(project, component, startDate, endDate);

    const components = PROJECT_COMPONENTS_LAB[project] || [];

    if (error) {
        showToast?.(`Errore analisi: ${error}`, "error");
    }

    const getUrgencyColor = (score) => {
        if (score < 20) return "var(--success)";
        if (score < 60) return "#f59e0b";
        return "#ef4444";
    };

    return (
        <div className="fade-in" style={{ padding: "20px", height: "100%", overflowY: "auto" }}>
            {/* Header e Filtri */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 20 }}>📊</div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard Analisi Inventario</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Analisi avanzamento componenti e previsioni</div>
                    </div>
                </div>

                {/* Filtri */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                    <select
                        value={project}
                        onChange={e => {
                            setProject(e.target.value);
                            setComponent(PROJECT_COMPONENTS_LAB[e.target.value]?.[0] || "");
                        }}
                        style={{
                            padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)",
                            backgroundColor: "white", fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                            outline: "none", cursor: "pointer"
                        }}
                    >
                        {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <select
                        value={component}
                        onChange={e => setComponent(e.target.value)}
                        style={{
                            padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)",
                            backgroundColor: "white", fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                            outline: "none", cursor: "pointer"
                        }}
                    >
                        {components.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        style={{
                            padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)",
                            backgroundColor: "white", fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                            outline: "none", cursor: "pointer"
                        }}
                    />

                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        style={{
                            padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)",
                            backgroundColor: "white", fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                            outline: "none", cursor: "pointer"
                        }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                    ⏳ Caricamento analisi...
                </div>
            ) : !analysisData ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                    📭 Nessun dato disponibile per il periodo selezionato
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 12,
                        marginBottom: 24
                    }}>
                        <KPICard
                            icon="⚡"
                            title="Urgency Score"
                            value={analysisData.urgencyScore}
                            unit="/100"
                            status={
                                analysisData.urgencyScore < 20 ? "success" :
                                analysisData.urgencyScore < 60 ? "warning" : "danger"
                            }
                        />

                        <KPICard
                            icon="✅"
                            title="% Completamento"
                            value={analysisData.phaseInventory.length > 0 ?
                                Math.round((analysisData.phaseInventory[0].quantity / 1200) * 100) : 0}
                            unit="%"
                            status="info"
                        />

                        <KPICard
                            icon="🚨"
                            title="Bottleneck"
                            value={analysisData.bottleneckPhase.phase}
                            unit={`+${analysisData.bottleneckPhase.impact}%`}
                            status="warning"
                        />

                        <KPICard
                            icon="⏱️"
                            title="Ciclo Medio"
                            value={Object.keys(analysisData.cycleTimesPerPhase).length > 0 ?
                                Math.round(Object.values(analysisData.cycleTimesPerPhase).reduce((a, b) => a + b, 0) / Object.keys(analysisData.cycleTimesPerPhase).length) : 0}
                            unit="h"
                            status="info"
                        />
                    </div>

                    {/* Timeline */}
                    <div style={{
                        background: "var(--bg-secondary)",
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 24,
                        border: "1px solid var(--border)"
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700 }}>📈 Timeline Avanzamento</h3>
                        <TimelineChart data={analysisData} />
                    </div>

                    {/* Heatmap Bottleneck */}
                    <div style={{
                        background: "var(--bg-secondary)",
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 24,
                        border: "1px solid var(--border)"
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700 }}>🔥 Heatmap Bottleneck</h3>
                        <BottleneckHeatmap data={analysisData} />
                    </div>

                    {/* Tabella Analisi */}
                    <div style={{
                        background: "var(--bg-secondary)",
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 24,
                        border: "1px solid var(--border)"
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700 }}>📋 Analisi Dettagliata</h3>
                        <AnalysisTable data={analysisData} />
                    </div>

                    {/* Raccomandazioni */}
                    <div style={{
                        background: "var(--bg-secondary)",
                        borderRadius: 12,
                        padding: 16,
                        border: "1px solid var(--border)"
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700 }}>💡 Raccomandazioni Intelligenti</h3>
                        <RecommendationBox recommendations={analysisData.recommendations} />
                    </div>
                </>
            )}
        </div>
    );
}
