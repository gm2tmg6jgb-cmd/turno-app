import React, { useState } from "react";
import { Icons } from "../components/ui/Icons";
import ImportView from "./ImportView";
import SapDataView from "./SapDataView";
import SapFermiView from "./SapFermiView";
import SapSummaryView from "./SapSummaryView";

/**
 * SapHubView
 * Dashboard centralizzata per tutte le operazioni legate a SAP:
 * - Importazione File Excel
 * - Storico Produzione (Dati Grezzi)
 * - Storico Fermi (Dati Grezzi)
 * - Analisi e Performance (Grafici)
 */
export default function SapHubView({
    macchine = [],
    showToast,
    setCurrentView,
    globalDate
}) {
    const [activeTab, setActiveTab] = useState("import"); // "import" | "produzione" | "fermi" | "analisi"

    const tabs = [
        { id: "import", label: "Importazione SAP", icon: Icons.upload },
        { id: "produzione", label: "Storico Produzione", icon: Icons.report },
        { id: "fermi", label: "Storico Fermi", icon: Icons.alert },
        { id: "analisi", label: "Analisi Performance", icon: Icons.dashboard },
    ];

    return (
        <div className="fade-in" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header Hub */}
            <div className="card" style={{ marginBottom: 16, padding: "12px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 24 }}>🛰️</div>
                        <div>
                            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Hub Dati SAP</h1>
                            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>Gestione integrata flussi di produzione e fermi SAP</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ 
                    display: "flex", 
                    gap: 4, 
                    marginTop: 16, 
                    borderTop: "1px solid var(--border-light)", 
                    paddingTop: 12,
                    overflowX: "auto"
                }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`tab ${activeTab === tab.id ? "active" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                            style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 8,
                                padding: "8px 16px",
                                fontSize: 13,
                                borderRadius: "var(--radius)",
                                transition: "var(--transition)",
                                border: "none",
                                background: activeTab === tab.id ? "var(--bg-tertiary)" : "transparent",
                                color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                                fontWeight: activeTab === tab.id ? 700 : 500,
                                cursor: "pointer",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, minHeight: 0 }}>
                {activeTab === "import" && (
                    <ImportView 
                        showToast={showToast} 
                        macchine={macchine} 
                        setCurrentView={setCurrentView} 
                    />
                )}
                {activeTab === "produzione" && (
                    <SapDataView 
                        macchine={macchine} 
                    />
                )}
                {activeTab === "fermi" && (
                    <SapFermiView 
                        macchine={macchine} 
                    />
                )}
                {activeTab === "analisi" && (
                    <SapSummaryView 
                        macchine={macchine} 
                    />
                )}
            </div>
        </div>
    );
}
