import React, { useState, useEffect } from 'react';
import { useProjectAnalysis, useAvailableProjects } from '../hooks/useInventoryAnalysis';
import KPICard from '../components/InventoryAnalysis/KPICard';
import PhaseTimeline from '../components/InventoryAnalysis/PhaseTimeline';
import RecommendationBox from '../components/InventoryAnalysis/RecommendationBox';

export default function InventarioAnalysisView({ showToast }) {
    const { projects, loading: projectsLoading } = useAvailableProjects();
    const [project, setProject] = useState("");
    const [collapsed, setCollapsed] = useState({});

    useEffect(() => {
        if (projects.length > 0 && !project) {
            setProject(projects[0]);
        }
    }, [projects, project]);

    const { components, loading, error } = useProjectAnalysis(project);

    useEffect(() => {
        if (error) showToast?.(`Errore analisi: ${error}`, "error");
    }, [error, showToast]);

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const fmtDateTime = (d) => d ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

    const selectStyle = {
        padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)",
        backgroundColor: "white", fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
        outline: "none", cursor: "pointer"
    };

    const toggleCollapsed = (componente) => {
        setCollapsed(prev => ({ ...prev, [componente]: !prev[componente] }));
    };

    // KPI aggregati sull'intero progetto
    const projectSummary = components.length > 0 ? {
        avgProgress: Math.round(components.reduce((s, c) => s + c.overallProgress, 0) / components.length),
        maxUrgency: Math.max(...components.map(c => c.urgencyScore)),
        criticalCount: components.filter(c => c.urgencyScore >= 60).length,
        totalRecommendations: components.reduce((s, c) => s + c.recommendations.length, 0)
    } : null;

    return (
        <div className="fade-in" style={{ padding: "20px", height: "100%", overflowY: "auto" }}>
            {/* Header e Filtri */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 20 }}>📊</div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard Analisi Inventario</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Avanzamento per fase, scostamenti dal piano e previsioni di completamento</div>
                    </div>
                </div>

                {/* Filtri */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                    <select
                        value={project}
                        onChange={e => setProject(e.target.value)}
                        style={selectStyle}
                    >
                        {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            {projectsLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                    ⏳ Caricamento elenco progetti...
                </div>
            ) : projects.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                    📭 Nessun piano di avanzamento configurato. Compila la tabella "componente_avanzamento" per abilitare l'analisi.
                </div>
            ) : loading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                    ⏳ Caricamento analisi...
                </div>
            ) : components.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                    📭 Nessun dato di avanzamento per {project}
                </div>
            ) : (
                <>
                    {/* KPI Aggregati di Progetto */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 12,
                        marginBottom: 24
                    }}>
                        <KPICard
                            icon="📦"
                            title="Componenti Monitorati"
                            value={components.length}
                            unit=""
                            status="info"
                        />
                        <KPICard
                            icon="✅"
                            title="Avanzamento Medio"
                            value={projectSummary.avgProgress}
                            unit="%"
                            status={
                                projectSummary.avgProgress >= 80 ? "success" :
                                projectSummary.avgProgress >= 50 ? "info" : "warning"
                            }
                        />
                        <KPICard
                            icon="🚨"
                            title="Componenti Critici"
                            value={projectSummary.criticalCount}
                            unit={`/ ${components.length}`}
                            status={projectSummary.criticalCount > 0 ? "danger" : "success"}
                        />
                        <KPICard
                            icon="💡"
                            title="Azioni Suggerite"
                            value={projectSummary.totalRecommendations}
                            unit=""
                            status={projectSummary.totalRecommendations > 0 ? "warning" : "success"}
                        />
                    </div>

                    {/* Card per ogni componente */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {components.map(comp => {
                            const isCollapsed = !!collapsed[comp.componente];
                            const urgencyColor =
                                comp.urgencyScore >= 60 ? "#ef4444" :
                                comp.urgencyScore >= 20 ? "#f59e0b" : "#22c55e";

                            return (
                                <div key={comp.componente} style={{
                                    background: "var(--bg-secondary)",
                                    borderRadius: 12,
                                    border: "1px solid var(--border)",
                                    overflow: "hidden"
                                }}>
                                    {/* Header componente — sempre visibile */}
                                    <div
                                        onClick={() => toggleCollapsed(comp.componente)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 16,
                                            padding: "14px 16px",
                                            cursor: "pointer",
                                            borderLeft: `4px solid ${urgencyColor}`,
                                            flexWrap: "wrap"
                                        }}
                                    >
                                        <div style={{ fontSize: 16, fontWeight: 800, minWidth: 90 }}>
                                            {comp.componente}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 160 }}>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                                                Avanzamento ({comp.completedCount}/{comp.totalPhases} fasi completate)
                                            </div>
                                            <div style={{ position: "relative", height: 10, borderRadius: 6, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                                                <div style={{
                                                    position: "absolute", left: 0, top: 0, bottom: 0,
                                                    width: `${comp.overallProgress}%`,
                                                    background: urgencyColor,
                                                    borderRadius: 6
                                                }} />
                                            </div>
                                        </div>

                                        <div style={{ minWidth: 100 }}>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Fase corrente</div>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                {comp.currentPhase ? comp.currentPhase.label : "✅ Completato"}
                                            </div>
                                        </div>

                                        <div style={{ minWidth: 90 }}>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Urgency</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: urgencyColor }}>
                                                {comp.urgencyScore}/100
                                            </div>
                                        </div>

                                        <div style={{ minWidth: 110 }}>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Completamento stimato</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: comp.delayDays > 0 ? "#ef4444" : "var(--text-primary)" }}>
                                                {fmtDate(comp.completionDate)}
                                                {comp.delayDays > 0 && <span style={{ fontSize: 11 }}> (+{comp.delayDays}gg)</span>}
                                            </div>
                                        </div>

                                        <div style={{ fontSize: 18, color: "var(--text-muted)" }}>
                                            {isCollapsed ? "▸" : "▾"}
                                        </div>
                                    </div>

                                    {/* Dettaglio espandibile */}
                                    {!isCollapsed && (
                                        <div style={{ padding: "0 16px 16px 16px" }}>
                                            {comp.bottleneck && (
                                                <div style={{
                                                    padding: "8px 12px", marginBottom: 12, borderRadius: 8,
                                                    background: "rgba(239, 68, 68, 0.08)", border: "1px solid #ef444433",
                                                    fontSize: 12
                                                }}>
                                                    🚨 <strong>Bottleneck:</strong> {comp.bottleneck.phase} ({comp.bottleneck.reason})
                                                </div>
                                            )}

                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>
                                                    Avanzamento per Fase {comp.targetTotal ? `(target ${comp.targetTotal} pz)` : ""}
                                                </div>
                                                <PhaseTimeline phases={comp.phases} />
                                            </div>

                                            {comp.recommendations.length > 0 && (
                                                <div style={{ marginBottom: 8 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>
                                                        Raccomandazioni
                                                    </div>
                                                    <RecommendationBox recommendations={comp.recommendations} />
                                                </div>
                                            )}

                                            {comp.lastUpdated && (
                                                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>
                                                    Ultimo aggiornamento: {fmtDateTime(comp.lastUpdated)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
