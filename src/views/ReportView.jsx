import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { REPARTI, TURNI, MOTIVI_FERMO, LIVELLI_COMPETENZA } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { getSlotForGroup } from '../lib/shiftRotation';
import { getLocalDate } from '../lib/dateUtils';

export default function ReportView({ dipendenti, presenze, assegnazioni, macchine, repartoCorrente, turnoCorrente, zones, motivi }) {
    const [reportType, setReportType] = useState("turno");

    const [selectedDate, setSelectedDate] = useState(getLocalDate(new Date()));
    const [selectedTurno, setSelectedTurno] = useState(""); // Default to Daily View (All Shifts) as requested

    // State for Machine Details (Fermi & Pezzi)
    const [fermiMacchina, setFermiMacchina] = useState([]);
    const [pezziProdotti, setPezziProdotti] = useState([]);
    const [absencesViewMode, setAbsencesViewMode] = useState("detail"); // "detail" or "aggregate"

    // Fetch Fermi & Pezzi when Date or Turno changes
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedDate) return;

            let queryFermi = supabase.from('fermi_macchina').select('*').eq('data', selectedDate);
            let queryPezzi = supabase.from('pezzi_prodotti').select('*').eq('data', selectedDate);

            if (selectedTurno) {
                queryFermi = queryFermi.eq('turno_id', selectedTurno);
                queryPezzi = queryPezzi.eq('turno_id', selectedTurno);
            }

            const [fermiRes, pezziRes] = await Promise.all([queryFermi, queryPezzi]);

            if (fermiRes.error) console.error("Error fetching fermi:", fermiRes.error);
            else setFermiMacchina(fermiRes.data || []);

            if (pezziRes.error) console.error("Error fetching pezzi:", pezziRes.error);
            else setPezziProdotti(pezziRes.data || []);
        };

        fetchData();
    }, [selectedDate, selectedTurno]);

    const handlePostFermi = async (machineId, motivo) => {
        if (!selectedDate) return;
        try {
            const newFermo = {
                macchina_id: machineId,
                data: selectedDate,
                turno_id: selectedTurno || "A", // Default to A if not specified
                motivo: motivo,
                ora_inizio: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                ora_fine: null
            };

            const { data, error } = await supabase
                .from('fermi_macchina')
                .insert([newFermo])
                .select();

            if (error) throw error;
            if (data) setFermiMacchina(prev => [...prev, ...data]);
        } catch (e) {
            console.error(e);
            alert("Errore nel salvataggio del fermo");
        }
    };

    const handleDeleteFermi = async (fermoId) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo fermo?")) return;
        try {
            const { error } = await supabase
                .from('fermi_macchina')
                .delete()
                .eq('id', fermoId);

            if (error) throw error;
            setFermiMacchina(prev => prev.filter(f => f.id !== fermoId));
        } catch (e) {
            console.error(e);
            alert("Errore nell'eliminazione del fermo");
        }
    };

    // Filter by Turno (Consistency with Dashboard)
    const allDip = useMemo(() => {
        return dipendenti.filter(d => !selectedTurno || d.turno_default === selectedTurno);
    }, [dipendenti, selectedTurno]);

    const allPres = useMemo(() => {
        return presenze.filter(p => p.data === selectedDate && (!selectedTurno || p.turno_id === selectedTurno));
    }, [presenze, selectedDate, selectedTurno]);

    const allAss = useMemo(() => {
        return assegnazioni.filter(a => a.data === selectedDate && (!selectedTurno || a.turno_id === selectedTurno));
    }, [assegnazioni, selectedDate, selectedTurno]);

    // Trend Data Calculation (Next 14 Days from Selected Date)
    const trendData = useMemo(() => {
        const data = [];
        const currentRefDate = new Date(selectedDate);

        // Go forward 14 days
        for (let i = 0; i < 14; i++) {
            const d = new Date(currentRefDate);
            d.setDate(currentRefDate.getDate() + i);
            const dateStr = getLocalDate(d); // Use helper to ensure "YYYY-MM-DD"
            const label = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });

            const dayPres = presenze.filter(p =>
                p.data === dateStr &&
                (!selectedTurno || p.turno_id === selectedTurno)
            );

            const assenti = dayPres.filter(p => !p.presente).length;
            // Unplanned = All EXCEPT ferie, rol, riposo_compensativo
            const imprevisti = dayPres.filter(p => !p.presente && !['ferie', 'rol', 'riposo_compensativo'].includes(p.motivo_assenza)).length;

            data.push({
                name: label,
                Assenze: assenti,
                Imprevisti: imprevisti
            });
        }
        return data;
    }, [presenze, selectedDate, selectedTurno]);

    // Anomalous Absences Detection (First/Last Night, Last Evening) from start of year
    const anomalousAbsences = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(`${currentYear}-01-01T00:00:00Z`);

        return presenze.filter(p =>
            !p.presente &&
            p.motivo_assenza !== 'riposo_compensativo' &&
            new Date(p.data) >= startOfYear
        ).map(p => {
            const dip = dipendenti.find(dip => dip.id === p.dipendente_id);
            if (!dip) return null;

            const group = dip.turno_default || "D";

            return {
                ...p,
                dipendente: dip,
                group: group
            };
        }).filter(Boolean);
    }, [presenze, dipendenti]);

    const resolvedAnomalies = useMemo(() => {
        try {
            return anomalousAbsences.map(p => {
                const dateStr = p.data;
                const d = new Date(dateStr);
                const slotObj = getSlotForGroup(p.group, dateStr);
                if (!slotObj) return null;

                const prevD = new Date(d); prevD.setDate(d.getDate() - 1);
                const nextD = new Date(d); nextD.setDate(d.getDate() + 1);

                const getIso = (dateObj) => {
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                };

                const prevSlot = getSlotForGroup(p.group, getIso(prevD));
                const nextSlot = getSlotForGroup(p.group, getIso(nextD));

                let isAnomalous = false;
                let anomalyType = "";

                if (slotObj.id === "N") {
                    if (prevSlot?.id !== "N") { isAnomalous = true; anomalyType = "Prima Notte"; }
                    else if (nextSlot?.id !== "N") { isAnomalous = true; anomalyType = "Ultima Notte"; }
                } else if (slotObj.id === "S" && d.getDay() === 6) {
                    isAnomalous = true; anomalyType = "Sabato 18-24";
                }

                if (isAnomalous) {
                    return { ...p, slot: slotObj, type: anomalyType, dateFormatted: new Date(dateStr).toLocaleDateString() };
                }
                return null;
            }).filter(Boolean).sort((a, b) => new Date(b.data) - new Date(a.data));
        } catch (e) {
            console.error(e);
            return [];
        }
    }, [anomalousAbsences]);

    // Planned Strategic Absences (Saturday Evening, Saturday Night, Monday)
    const plannedAnomalies = useMemo(() => {
        try {
            const plannedReasons = ['ferie', 'rol', 'riposo_compensativo'];

            return anomalousAbsences.filter(p => plannedReasons.includes(p.motivo_assenza)).map(p => {
                const dateStr = p.data;
                // Parse date carefully to avoid timezone shifts shifting the day
                const [year, month, day] = dateStr.split('-');
                const d = new Date(year, month - 1, day);
                const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, 6 = Saturday

                const slotObj = getSlotForGroup(p.group, dateStr);
                if (!slotObj) return null;

                let isStrategic = false;
                let strategyType = "";

                if (dayOfWeek === 6 && slotObj.id === "S") {
                    isStrategic = true; strategyType = "Sabato Sera";
                } else if (dayOfWeek === 6 && slotObj.id === "N") {
                    isStrategic = true; strategyType = "Sabato Notte";
                } else if (dayOfWeek === 1) {
                    isStrategic = true; strategyType = `Lunedì (${slotObj.nome})`;
                }

                if (isStrategic) {
                    return { ...p, slot: slotObj, type: strategyType, dateFormatted: d.toLocaleDateString("it-IT") };
                }
                return null;
            }).filter(Boolean).sort((a, b) => new Date(b.data) - new Date(a.data));
        } catch (e) {
            console.error(e);
            return [];
        }
    }, [anomalousAbsences]);

    const aggregatedAbsenceData = useMemo(() => {
        const map = {};

        // Merge both types
        const allOutliers = [
            ...resolvedAnomalies.map(a => ({ ...a, category: 'Anomala' })),
            ...plannedAnomalies.map(a => ({ ...a, category: 'Strategica' }))
        ];

        allOutliers.forEach(a => {
            const id = a.dipendente_id;
            if (!map[id]) {
                map[id] = {
                    dip: a.dipendente,
                    anomalies: 0,
                    strategic: 0,
                    total: 0,
                    patterns: new Set()
                };
            }
            if (a.category === 'Anomala') map[id].anomalies++;
            else map[id].strategic++;

            map[id].total++;
            map[id].patterns.add(a.type);
        });

        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [resolvedAnomalies, plannedAnomalies]);

    const allMacchine = macchine; // Machines might not strictly belong to a shift, but their operators do.

    // Calculate Assenti first
    const assentiCount = allPres.filter((p) => !p.presente).length;

    // Calculate Presenti deductively (Total - Assenti) ensuring it's never negative
    // This allows "Forza Lavoro" to be visible even if explicit "presente" records haven't been generated yet for the day
    const presentiCount = Math.max(0, allDip.length - assentiCount);

    // Calculate Unplanned Absences (User Request: All EXCEPT Ferie, ROL, Riposo Compensativo)
    const plannedReasons = ['ferie', 'rol', 'riposo_compensativo'];
    const unplannedAbsencesCount = allPres.filter((p) => !p.presente && !plannedReasons.includes(p.motivo_assenza)).length;

    // Data for Presence PieChart
    const presenceData = useMemo(() => [
        { name: 'Presenti', value: presentiCount, color: 'var(--success)' },
        { name: 'Assenze Pianificate', value: assentiCount - unplannedAbsencesCount, color: 'var(--warning)' }, // Planned = Yellow
        { name: 'Assenze Non Pianificate', value: unplannedAbsencesCount, color: 'var(--danger)' } // Unplanned = Red
    ], [presentiCount, assentiCount, unplannedAbsencesCount]);

    // Data for Machine Coverage BarChart - Show by REPARTO instead of single machine if showing factory-wide?
    const coverageByReparto = useMemo(() => {
        return REPARTI.map(r => {
            // Machines in this reparto
            const mRep = allMacchine.filter(m => m.reparto_id === r.id);

            // 1. Direct assignments to machines
            const assignedMachineIds = new Set(allAss.map(a => a.macchina_id));

            // 2. Zone assignments (covering all machines in that zone)
            // Identify zones belonging to this Reparto
            const repZoneIds = new Set(zones.filter(z => (z.repart_id || z.reparto) === r.id).map(z => z.id));
            // Find which of these zones have an assignment
            const coveredZoneIds = new Set(allAss
                .filter(a => repZoneIds.has(a.macchina_id) || repZoneIds.has(a.attivita_id)) // Check correct field (macchina_id used for everything mostly)
                .map(a => a.macchina_id || a.attivita_id)
            );

            // Count machines that are EITHER directly assigned OR belong to a covered zone
            const coveredMachinesCount = mRep.filter(m => {
                const isDirectlyAssigned = assignedMachineIds.has(m.id);
                const isZoneCovered = m.zona && coveredZoneIds.has(m.zona);
                return isDirectlyAssigned || isZoneCovered;
            }).length;

            const totalRequired = mRep.length;

            // Staff Presente logic (Deductive per Team)
            const teamMembers = allDip.filter(d => d.reparto_id === r.id);
            const teamAbsences = allPres.filter(p => !p.presente && teamMembers.some(d => d.id === p.dipendente_id)).length;
            const teamPresenti = Math.max(0, teamMembers.length - teamAbsences);

            return {
                name: r.nome.replace("Team ", "T"), // Shorten for X-Axis
                richiesti: totalRequired,
                presenti: teamPresenti,
                assegnati: coveredMachinesCount
            };
        });
    }, [allMacchine, allAss, zones, allDip, allPres]);

    // Total Machine Coverage %
    const totalMachinesCount = allMacchine.length;
    const totalCoveredMachines = coverageByReparto.reduce((sum, item) => sum + item.assegnati, 0);
    const totalCoveragePercent = totalMachinesCount > 0 ? Math.round((totalCoveredMachines / totalMachinesCount) * 100) : 0;

    // PDF Export Function
    const exportPDF = async () => {
        const input = document.getElementById('report-content');
        if (!input) return;

        try {
            const canvas = await html2canvas(input, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`report_turno_${selectedDate}.pdf`);
        } catch (err) {
            console.error("PDF Export failed:", err);
            alert("Errore durante l'esportazione del PDF.");
        }
    };

    // Email Reporting Function
    const sendReport = () => {
        const subject = `Report Turno - ${selectedDate}`;
        const body = `Report Turno del ${selectedDate}%0D%0A%0D%0A` +
            `Totale Presenti: ${presentiCount}%0D%0A` +
            `Totale Assenti: ${assentiCount}%0D%0A` +
            `Assenze Impreviste: ${unplannedAbsencesCount}%0D%0A%0D%0A` +
            `Visualizza il report completo in allegato o sulla dashboard.`;

        // Placeholder mailing list - User can configure this or we can add a settings page later
        const mailingList = "direzione@azienda.com, hr@azienda.com";

        window.open(`mailto:${mailingList}?subject=${subject}&body=${body}`);
    };

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>
            {/* Filters Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="tabs" style={{ display: "inline-flex", margin: 0 }}>
                    <button className={`tab ${reportType === "turno" ? "active" : ""}`} onClick={() => setReportType("turno")}>Report Fine Turno</button>
                    <button className={`tab ${reportType === "settimanale" ? "active" : ""}`} onClick={() => setReportType("settimanale")}>Analisi Avanzata</button>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--bg-card)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    {/* Date Picker */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Data:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                                padding: "6px 10px",
                                borderRadius: 6,
                                fontSize: 13,
                                fontFamily: "inherit"
                            }}
                        />
                    </div>

                    <div style={{ width: 1, height: 20, background: "var(--border)" }}></div>

                    {/* Shift Selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Turno:</span>
                        <select
                            value={selectedTurno}
                            onChange={(e) => setSelectedTurno(e.target.value)}
                            style={{
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                                padding: "6px 24px 6px 10px",
                                borderRadius: 6,
                                fontSize: 13,
                                cursor: "pointer"
                            }}
                        >
                            <option value="">Tutti i Turni (Giornaliero)</option>
                            {TURNI.map(t => (
                                <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {reportType === "turno" && (
                <div id="report-content">
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Report {selectedTurno ? `Turno ${TURNI.find(t => t.id === selectedTurno)?.nome}` : "Giornaliero (Tutti i Turni)"}</h2>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    Tutti i Reparti — {new Date(selectedDate).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                </div>
                            </div>
                            <div data-html2canvas-ignore="true" style={{ display: "flex", gap: 8 }}>
                                <button className="btn btn-secondary" onClick={exportPDF}>{Icons.report} Esporta PDF</button>
                                <button className="btn btn-primary" onClick={sendReport}>{Icons.send} Invia Direzione</button>
                            </div>
                        </div>

                        <div className="stats-grid" style={{ marginBottom: 0, gridTemplateColumns: "repeat(4, 1fr)" }}>
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>FORZA LAVORO</div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--info)" }}>
                                    {presentiCount} <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>/ {allDip.length}</span>
                                </div>
                            </div>
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>TOT ASSENTI</div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>{assentiCount}</div>
                            </div>
                            <div style={{ padding: "12px 16px", background: "rgba(220, 38, 38, 0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(220, 38, 38, 0.2)" }}>
                                <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 4, fontWeight: 600 }}>NON PIANIFICATE</div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>{unplannedAbsencesCount}</div>
                            </div>
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>% COPERTURA TOT</div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
                                    {totalCoveragePercent}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visual Analysis Section */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>

                        <div className="card" style={{ height: 320 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Copertura per Team (Macchine Assegnate vs Totali)</h3>
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={coverageByReparto} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    />
                                    <Bar dataKey="richiesti" fill="var(--text-muted)" radius={[4, 4, 0, 0]} name="Totale Macchine" opacity={0.3} />
                                    <Bar dataKey="presenti" fill="var(--success)" radius={[4, 4, 0, 0]} name="Staff Presente" opacity={0.6} />
                                    <Bar dataKey="assegnati" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Assegnate" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="report-section">
                        <h3>Assegnazioni Macchine per Reparto (Raggruppate per Zona)</h3>
                        <div className="table-container">
                            {(() => {
                                // 1. Group by Reparto first, then by Zone
                                const repartiInUse = [...new Set(allMacchine.map(m => m.reparto_id))];

                                return repartiInUse.map(repId => {
                                    const repObj = REPARTI.find(r => r.id === repId);
                                    const macchineDelReparto = allMacchine.filter(m => m.reparto_id === repId);

                                    // Group by Zone - ONLY those defined in 'zones' prop
                                    const repZones = zones.filter(z => (z.repart_id || z.reparto) === repId);

                                    // Find machines that match these zones
                                    const validZoneIds = repZones.map(z => z.id);
                                    const machinesInZones = macchineDelReparto.filter(m => validZoneIds.includes(m.zona));
                                    const machinesWithoutZone = macchineDelReparto.filter(m => !m.zona || !validZoneIds.includes(m.zona));

                                    return (
                                        <div key={repId} style={{ marginBottom: 32 }}>
                                            <h4 style={{ borderBottom: "2px solid var(--border)", paddingBottom: 8, marginBottom: 16, color: "var(--text-primary)" }}>
                                                {repObj?.nome || repId}
                                            </h4>

                                            {/* ZONES */}
                                            {/* Single Table per Reparto */}
                                            <table style={{ background: "var(--bg-card)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: "8px 12px", width: "30%", textAlign: "left" }}>Macchina / Zona</th>
                                                        <th style={{ padding: "8px 12px", width: "25%", textAlign: "left" }}>Operatore</th>
                                                        <th style={{ padding: "8px 12px", width: "20%", textAlign: "left" }}>Produzione</th>
                                                        <th style={{ padding: "8px 12px", width: "25%", textAlign: "left" }}>Fermi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {zones
                                                        .filter(z => (z.repart_id || z.reparto) === repId)
                                                        .map(zone => {
                                                            const zoneMachines = macchineDelReparto.filter(m => m.zona === zone.id);
                                                            // Find Zone Responsible
                                                            const zoneResponsibles = allAss.filter(a => (a.macchina_id === zone.id || a.attivita_id === zone.id));
                                                            const zoneOpComponent = zoneResponsibles.map(z => {
                                                                const d = dipendenti.find(dd => dd.id === z.dipendente_id);
                                                                if (!d) return null;
                                                                return (
                                                                    <span key={`${zone.id}-${d.id}`} style={{ color: "var(--primary)", fontWeight: 500, fontSize: 15 }}>
                                                                        {d.cognome} {d.nome}
                                                                    </span>
                                                                );
                                                            }).filter(Boolean);

                                                            const isZoneCovered = zoneResponsibles.length > 0;

                                                            return (
                                                                <React.Fragment key={zone.id}>
                                                                    {/* ZONE HEADER ROW */}
                                                                    <tr key={`zone-${zone.id}`} style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                                                                        <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                                {Icons.grid} {zone.label}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: "10px 12px", fontWeight: 500, fontSize: 15, color: "var(--primary)" }}>
                                                                            {zoneOpComponent.length > 0 ? zoneOpComponent : <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 13, fontStyle: "italic" }}>— Nessun Responsabile —</span>}
                                                                        </td>
                                                                        <td style={{ textAlign: "center" }}>
                                                                            {/* Optional: Zone Status if needed, currently empty as per request */}
                                                                        </td>
                                                                    </tr>

                                                                    {/* MACHINE ROWS */}
                                                                    {zoneMachines.map(m => {
                                                                        const machineOps = allAss.filter(a => a.macchina_id === m.id);
                                                                        const specificNames = machineOps.map(o => {
                                                                            const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                            return d ? `${d.cognome} ${d.nome.charAt(0)}.` : null;
                                                                        }).filter(Boolean);

                                                                        // Logic: Machine is OK if it has specific op OR if zone is covered
                                                                        const ok = machineOps.length > 0 || isZoneCovered;

                                                                        return (
                                                                            <React.Fragment key={m.id}>
                                                                                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                                    <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                                                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                                                            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{m.nome}</div>
                                                                                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ok ? "✅ Operativa" : "⚠️ Sotto-organico"}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: "8px 12px" }}>
                                                                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                                                            {machineOps.length > 0 ? (
                                                                                                machineOps.map(o => {
                                                                                                    const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                                                    if (!d) return null;
                                                                                                    const rawLevel = d.competenze?.[m.id];
                                                                                                    const isFormazione = String(rawLevel || '').includes('=>');
                                                                                                    const level = isFormazione ? 0 : (rawLevel || 0);
                                                                                                    const skill = LIVELLI_COMPETENZA.find(l => l.value === level) || LIVELLI_COMPETENZA[0];
                                                                                                    return (
                                                                                                        <span key={`${m.id}-${d.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                                                                            <span style={{ fontWeight: 500, fontSize: 15 }}>
                                                                                                                {d.cognome} {d.nome.charAt(0)}.
                                                                                                            </span>
                                                                                                            {isFormazione ? (
                                                                                                                <span style={{ color: "#8B5CF6", fontWeight: 700, fontSize: 13 }}>{rawLevel}</span>
                                                                                                            ) : level > 0 ? (
                                                                                                                <span style={{ color: skill.color, fontWeight: 700, fontSize: 15 }}>
                                                                                                                    Liv. {level}
                                                                                                                </span>
                                                                                                            ) : (
                                                                                                                <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: 12 }}>Nessuna Formazione</span>
                                                                                                            )}
                                                                                                        </span>
                                                                                                    );
                                                                                                })
                                                                                            ) : (
                                                                                                // Coperta dalla zona: mostra Liv. del responsabile per questa macchina
                                                                                                zoneResponsibles.length > 0 ? (
                                                                                                    zoneResponsibles.map(za => {
                                                                                                        const zd = dipendenti.find(dd => dd.id === za.dipendente_id);
                                                                                                        if (!zd) return null;
                                                                                                        const rawZLevel = zd.competenze?.[m.id];
                                                                                                        const isZFormazione = String(rawZLevel || '').includes('=>');
                                                                                                        const zLevel = isZFormazione ? 0 : (rawZLevel || 0);
                                                                                                        const zSkill = LIVELLI_COMPETENZA.find(l => l.value === zLevel) || LIVELLI_COMPETENZA[0];
                                                                                                        return isZFormazione ? (
                                                                                                            <span key={`zs-${za.dipendente_id}`} style={{ color: "#8B5CF6", fontWeight: 700, fontSize: 13 }}>{rawZLevel}</span>
                                                                                                        ) : zLevel > 0 ? (
                                                                                                            <span key={`zs-${za.dipendente_id}`} style={{ color: zSkill.color, fontWeight: 700, fontSize: 15 }}>
                                                                                                                Liv. {zLevel}
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            <span key={`zs-${za.dipendente_id}`} style={{ color: "var(--danger)", fontWeight: 600, fontSize: 12 }}>Nessuna Formazione</span>
                                                                                                        );
                                                                                                    }).filter(Boolean)
                                                                                                ) : (
                                                                                                    <span style={{ color: "var(--text-lighter)", fontSize: 18, lineHeight: 0 }}>&middot;</span>
                                                                                                )
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: "8px 12px" }}>
                                                                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                                                            {pezziProdotti.filter(p => p.macchina_id === m.id).map(p => (
                                                                                                <div key={p.id} style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                                                                                                    📦 {p.quantita} pz {p.scarti > 0 && <span style={{ color: "var(--danger)", fontSize: 11 }}>(scarti: {p.scarti})</span>}
                                                                                                </div>
                                                                                            ))}
                                                                                            {pezziProdotti.filter(p => p.macchina_id === m.id).length === 0 && (
                                                                                                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td style={{ padding: "8px 12px" }}>
                                                                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                                                                {fermiMacchina.filter(f => f.macchina_id === m.id).map(f => (
                                                                                                    <div key={f.id} className="tag tag-red" style={{ fontSize: 10, padding: "2px 6px", display: "flex", alignItems: "center", gap: 4 }}>
                                                                                                        <span>⚠️ {f.motivo}</span>
                                                                                                        <button onClick={() => handleDeleteFermi(f.id)} style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", opacity: 0.7 }}>{Icons.x}</button>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                            <select
                                                                                                className="select-input"
                                                                                                style={{ padding: "4px 8px", fontSize: 12, height: "auto", width: "100%" }}
                                                                                                onChange={(e) => {
                                                                                                    if (e.target.value) {
                                                                                                        handlePostFermi(m.id, e.target.value);
                                                                                                        e.target.value = "";
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                <option value="">+ Aggiungi fermo...</option>
                                                                                                {MOTIVI_FERMO.map(mot => <option key={mot.id} value={mot.label}>{mot.icona} {mot.label}</option>)}
                                                                                            </select>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            </React.Fragment>
                                                                        );
                                                                    })}
                                                                    {zoneMachines.length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={3} style={{ padding: "8px 12px 8px 32px", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                                                                                Nessuna macchina in questa zona
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}

                                                    {/* Machines without Zone */}
                                                    {machinesWithoutZone.length > 0 && (
                                                        <React.Fragment key={`${repId}-others`}>
                                                            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                                                                <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                                                    Altre Macchine
                                                                </td>
                                                            </tr>
                                                            {machinesWithoutZone.map(m => {
                                                                const machineOps = allAss.filter(a => a.macchina_id === m.id);
                                                                const specificNames = machineOps.map(o => {
                                                                    const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                    return d ? `${d.cognome} ${d.nome.charAt(0)}.` : null;
                                                                }).filter(Boolean);
                                                                const ok = machineOps.length >= (m.personale_minimo || 1);

                                                                return (
                                                                    <React.Fragment key={m.id}>
                                                                        <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                            <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                                                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{m.nome}</div>
                                                                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ok ? "✅ Operativa" : "⚠️ Sotto-organico"}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: "8px 12px" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                                                    {machineOps.length > 0 ? (
                                                                                        machineOps.map(o => {
                                                                                            const d = dipendenti.find(dd => dd.id === o.dipendente_id);
                                                                                            if (!d) return null;
                                                                                            const rawLevel = d.competenze?.[m.id];
                                                                                            const isFormazione = String(rawLevel || '').includes('=>');
                                                                                            const level = isFormazione ? 0 : (rawLevel || 0);
                                                                                            const skill = LIVELLI_COMPETENZA.find(l => l.value === level) || LIVELLI_COMPETENZA[0];
                                                                                            return (
                                                                                                <span key={`${m.id}-${d.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                                                                    <span style={{ fontWeight: 500, fontSize: 15 }}>
                                                                                                        {d.cognome} {d.nome.charAt(0)}.
                                                                                                    </span>
                                                                                                    {isFormazione ? (
                                                                                                        <span style={{ color: "#8B5CF6", fontWeight: 700, fontSize: 13 }}>{rawLevel}</span>
                                                                                                    ) : level > 0 ? (
                                                                                                        <span style={{ color: skill.color, fontWeight: 700, fontSize: 15 }}>
                                                                                                            Liv. {level}
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: 12 }}>Nessuna Formazione</span>
                                                                                                    )}
                                                                                                </span>
                                                                                            );
                                                                                        })
                                                                                    ) : (
                                                                                        <span style={{ color: "var(--text-muted)" }}>—</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: "8px 12px" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                                                    {pezziProdotti.filter(p => p.macchina_id === m.id).map(p => (
                                                                                        <div key={p.id} style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                                                                                            📦 {p.quantita} pz {p.scarti > 0 && <span style={{ color: "var(--danger)", fontSize: 11 }}>(scarti: {p.scarti})</span>}
                                                                                        </div>
                                                                                    ))}
                                                                                    {pezziProdotti.filter(p => p.macchina_id === m.id).length === 0 && (
                                                                                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: "8px 12px" }}>
                                                                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                                                        {fermiMacchina.filter(f => f.macchina_id === m.id).map(f => (
                                                                                            <div key={f.id} className="tag tag-red" style={{ fontSize: 10, padding: "2px 6px", display: "flex", alignItems: "center", gap: 4 }}>
                                                                                                <span>⚠️ {f.motivo}</span>
                                                                                                <button onClick={() => handleDeleteFermi(f.id)} style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", opacity: 0.7 }}>{Icons.x}</button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    <select
                                                                                        className="select-input"
                                                                                        style={{ padding: "4px 8px", fontSize: 12, height: "auto", width: "100%" }}
                                                                                        onChange={(e) => {
                                                                                            if (e.target.value) {
                                                                                                handlePostFermi(m.id, e.target.value);
                                                                                                e.target.value = "";
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <option value="">+ Aggiungi fermo...</option>
                                                                                        {MOTIVI_FERMO.map(mot => <option key={mot.id} value={mot.label}>{mot.icona} {mot.label}</option>)}
                                                                                    </select>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    <div className="report-section">
                        <h3>Dettaglio Assenze Odierne (Tutti i Team)</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Dipendente</th>
                                        <th>Team</th>
                                        <th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allPres.filter((p) => !p.presente).map((p) => {
                                        const d = dipendenti.find((dd) => dd.id === p.dipendente_id);
                                        const motivoObj = motivi.find((m) => m.id === p.motivo_assenza);
                                        return (
                                            <tr key={p.dipendente_id}>
                                                <td style={{ fontWeight: 500, fontSize: 15 }}>{d?.cognome} {d?.nome?.charAt(0)}.</td>
                                                <td>{REPARTI.find((r) => r.id === d?.reparto_id)?.nome || "—"}</td>
                                                <td>
                                                    {motivoObj ? (
                                                        <span style={{
                                                            display: "inline-flex", alignItems: "center", gap: 6,
                                                            fontSize: 13, fontWeight: 500
                                                        }}>
                                                            <span style={{ width: 10, height: 10, borderRadius: 2, background: motivoObj.colore }}></span>
                                                            {motivoObj.label}
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {allPres.filter((p) => !p.presente).length === 0 && (
                                        <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Nessuna assenza registrata</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {reportType === "settimanale" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div className="card">
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Analisi Trend Assenze (Prossimi 14 gg)</h3>
                        <div style={{ height: 400, width: '100%' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                                Previsione dell'andamento delle assenze totali e impreviste a partire da oggi.
                            </p>
                            <ResponsiveContainer width="100%" height={340}>
                                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorAssenze" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorImprevisti" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    />
                                    <Area type="monotone" dataKey="Assenze" stroke="var(--danger)" fillOpacity={1} fill="url(#colorAssenze)" />
                                    <Area type="monotone" dataKey="Imprevisti" stroke="var(--warning)" fillOpacity={1} fill="url(#colorImprevisti)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Analisi Percorsi Assenze (Anomale e Strategiche)</h3>
                                <div style={{ display: "flex", background: "var(--bg-secondary)", padding: 4, borderRadius: 8, gap: 4 }}>
                                    <button
                                        onClick={() => setAbsencesViewMode("detail")}
                                        style={{
                                            padding: "4px 12px", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer",
                                            background: absencesViewMode === "detail" ? "var(--bg-card)" : "transparent",
                                            boxShadow: absencesViewMode === "detail" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                                            fontWeight: absencesViewMode === "detail" ? 600 : 400,
                                            color: "var(--text-primary)"
                                        }}
                                    >
                                        Dettaglio Log
                                    </button>
                                    <button
                                        onClick={() => setAbsencesViewMode("aggregate")}
                                        style={{
                                            padding: "4px 12px", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer",
                                            background: absencesViewMode === "aggregate" ? "var(--bg-card)" : "transparent",
                                            boxShadow: absencesViewMode === "aggregate" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                                            fontWeight: absencesViewMode === "aggregate" ? 600 : 400,
                                            color: "var(--text-primary)"
                                        }}
                                    >
                                        Agglomerato (Per Dipendente)
                                    </button>
                                </div>
                            </div>
                            <span className="tag tag-red" style={{ fontSize: 11, fontWeight: 700 }}>{resolvedAnomalies.length + plannedAnomalies.length} Segnalazioni Totali</span>
                        </div>

                        {absencesViewMode === "aggregate" ? (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Dipendente</th>
                                            <th style={{ textAlign: "center" }}>Pattern Rilevati</th>
                                            <th style={{ textAlign: "center" }}>Anomale</th>
                                            <th style={{ textAlign: "center" }}>Strategiche</th>
                                            <th style={{ textAlign: "center" }}>Punteggio Totale</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aggregatedAbsenceData.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 600, fontSize: 15 }}>{item.dip.cognome} {item.dip.nome.charAt(0)}.</td>
                                                <td style={{ textAlign: "center", fontSize: 12 }}>
                                                    {Array.from(item.patterns).map((p, pidx) => (
                                                        <span key={pidx} style={{
                                                            display: "inline-block",
                                                            background: "var(--bg-secondary)",
                                                            padding: "2px 6px",
                                                            borderRadius: 4,
                                                            margin: "2px",
                                                            fontSize: 10,
                                                            color: "var(--text-secondary)"
                                                        }}>
                                                            {p}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td style={{ textAlign: "center", color: "var(--danger)", fontWeight: 700 }}>{item.anomalies || "—"}</td>
                                                <td style={{ textAlign: "center", color: "var(--primary)", fontWeight: 700 }}>{item.strategic || "—"}</td>
                                                <td style={{ textAlign: "center" }}>
                                                    <span style={{
                                                        background: item.total > 3 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                                        color: item.total > 3 ? "var(--danger)" : "var(--success)",
                                                        padding: "4px 12px",
                                                        borderRadius: 12,
                                                        fontWeight: 800,
                                                        fontSize: 14
                                                    }}>
                                                        {item.total}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <>
                                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                                    Dettaglio delle assenze che avvengono in momenti critici (es. cambi turno notte o weekend lavorativi), calcolato su tutti i dati presenti nel sistema.
                                </p>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: "left" }}>Data Assenza</th>
                                                <th style={{ textAlign: "left" }}>Dipendente</th>
                                                <th style={{ textAlign: "center" }}>Turno</th>
                                                <th style={{ textAlign: "left" }}>Motivo</th>
                                                <th style={{ textAlign: "center" }}>Anomalia Rilevata</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resolvedAnomalies.map((a, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.dateFormatted}</td>
                                                    <td style={{ fontWeight: 600, fontSize: 15 }}>{a.dipendente.cognome} {a.dipendente.nome.charAt(0)}.</td>
                                                    <td style={{ textAlign: "center", color: "var(--text-primary)" }}>{a.group}</td>
                                                    <td style={{ color: "var(--text-muted)" }}>
                                                        {motivi.find(m => m.id === a.motivo_assenza)?.label || a.motivo_assenza || "Assenza"}
                                                    </td>
                                                    <td style={{ textAlign: "center" }}>
                                                        <span style={{
                                                            background: "rgba(220, 38, 38, 0.1)",
                                                            color: "var(--danger)",
                                                            padding: "4px 10px",
                                                            borderRadius: 12,
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            display: "inline-block"
                                                        }}>
                                                            ⚠️ {a.type}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    {absencesViewMode === "detail" && (
                        <div className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Assenze Pianificate Strategiche (Sab/Lun)</h3>
                                <span className="tag tag-blue" style={{ fontSize: 11, fontWeight: 700 }}>{plannedAnomalies.length} Segnalazioni</span>
                            </div>
                            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                                Questo pannello evidenzia le assenze pianificate (Ferie, ROL, Riposo Compensativo) strategiche che cadono di Sabato Sera, Sabato Notte o Lunedì, dall'inizio dell'anno.
                            </p>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: "left" }}>Data Assenza</th>
                                            <th style={{ textAlign: "left" }}>Dipendente</th>
                                            <th style={{ textAlign: "center" }}>Turno Assegnato</th>
                                            <th style={{ textAlign: "left" }}>Motivo Pianificato</th>
                                            <th style={{ textAlign: "center" }}>Giornata Strategica</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plannedAnomalies.map((a, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.dateFormatted}</td>
                                                <td style={{ fontWeight: 600, fontSize: 15 }}>{a.dipendente.cognome} {a.dipendente.nome.charAt(0)}.</td>
                                                <td style={{ textAlign: "center", color: "var(--text-primary)" }}>{a.group}</td>
                                                <td style={{ color: "var(--text-muted)" }}>
                                                    {motivi.find(m => m.id === a.motivo_assenza)?.label || a.motivo_assenza || "Assenza"}
                                                </td>
                                                <td style={{ textAlign: "center" }}>
                                                    <span style={{
                                                        background: "rgba(59, 130, 246, 0.1)",
                                                        color: "var(--primary)",
                                                        padding: "4px 10px",
                                                        borderRadius: 12,
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        display: "inline-block"
                                                    }}>
                                                        🎯 {a.type}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Report Fermi Macchina</h3>
                            <span className="tag tag-red" style={{ fontSize: 11, fontWeight: 700 }}>{fermiMacchina.length} Fermi</span>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Macchina</th>
                                        <th>Orario</th>
                                        <th>Motivo</th>
                                        <th style={{ textAlign: "center" }}>Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fermiMacchina.map((f, idx) => {
                                        const mName = macchine.find(m => m.id === f.macchina_id)?.nome || f.macchina_id;
                                        return (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 600 }}>{mName}</td>
                                                <td>{f.ora_inizio?.slice(0, 5)} - {f.ora_fine?.slice(0, 5)}</td>
                                                <td>{f.motivo}</td>
                                                <td style={{ textAlign: "center" }}>
                                                    <button
                                                        onClick={() => handleDeleteFermi(f.id)}
                                                        className="btn btn-ghost"
                                                        style={{ color: "var(--danger)", padding: 4 }}
                                                    >
                                                        {Icons.trash}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {fermiMacchina.length === 0 && (
                                        <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Nessun fermo registrato</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Produzione (Pezzi e Scarti)</h3>
                            <span className="tag tag-green" style={{ fontSize: 11, fontWeight: 700 }}>{pezziProdotti.length} Record</span>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Macchina</th>
                                        <th style={{ textAlign: "center" }}>Quantità</th>
                                        <th style={{ textAlign: "center" }}>Scarti</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pezziProdotti.map((p, idx) => {
                                        const mName = macchine.find(m => m.id === p.macchina_id)?.nome || p.macchina_id;
                                        return (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 600 }}>{mName}</td>
                                                <td style={{ textAlign: "center", fontWeight: 700, color: "var(--success)" }}>{p.quantita}</td>
                                                <td style={{ textAlign: "center", color: "var(--danger)" }}>{p.scarti || 0}</td>
                                                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.note || "—"}</td>
                                            </tr>
                                        );
                                    })}
                                    {pezziProdotti.length === 0 && (
                                        <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>Nessun dato di produzione</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
