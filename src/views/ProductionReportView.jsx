import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatItalianDate } from '../lib/dateUtils';

export default function ProductionReportView({ macchine = [], globalDate, turnoCorrente, motiviFermo = [], tecnologie = [] }) {
    const [activeTech, setActiveTech] = useState('TUTTO');
    const [matrice, setMatrice] = useState({});
    const [downtimeMap, setDowntimeMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [anagrafica, setAnagrafica] = useState({});
    const [hoveredCol, setHoveredCol] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);

    const components = [
        "SG1", "DG", "SG3", "SG4", "SG5", "SG6", "SG7", "RW", "RG", // DCT 300 (9)
        "SG2", "SG3_8FE", "SG4_8FE", "SG5_8FE", "SG6_8FE", "SG7_8FE", "SG8", "SGR", "PG", "FG5/7", "RG_8FE", "DH Machine", "DH Assembly", "DH Welding", // 8Fe (14)
        "SG2_ECO", "SG3_ECO", "SG4_ECO", "SG5_ECO", "SGR_ECO", "RG_ECO" // Eco (6)
    ];

    // Fetch anagrafica once
    useEffect(() => {
        const fetchAnagrafica = async () => {
            const { data, error } = await supabase.from('anagrafica_materiali').select('*');
            if (!error && data) {
                const map = {};
                data.forEach(item => {
                    map[item.codice.toUpperCase()] = item;
                });
                setAnagrafica(map);
            }
        };
        fetchAnagrafica();
    }, []);

    // Fetch data when date or shift changes
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const date = globalDate || new Date().toISOString().split('T')[0];

            // 1. Fetch production data
            let qProd = supabase.from('conferme_sap').select('*').eq('data', date);
            if (turnoCorrente) qProd = qProd.eq('turno_id', turnoCorrente);

            // 2. Fetch downtime data
            let qDowntime = supabase.from('fermi_macchina').select('*').eq('data', date);
            if (turnoCorrente) qDowntime = qDowntime.eq('turno_id', turnoCorrente);

            const [resProd, resDowntime] = await Promise.all([qProd, qDowntime]);

            // Process production data into matrix
            const newMatrice = {};
            if (resProd.data) {
                resProd.data.forEach(row => {
                    const machineId = row.macchina_id || row.work_center_sap;
                    if (!machineId) return;

                    const info = anagrafica[row.materiale?.toUpperCase()];
                    const project = info?.progetto || (row.materiale?.startsWith('M016') ? 'DCT Eco' : row.materiale?.startsWith('M015') ? '8Fe' : 'DCT 300');
                    const compName = info?.componente;

                    if (compName) {
                        let key = compName;
                        // Handle naming collisions with suffixes
                        if (project === 'DCT Eco') key += '_ECO';
                        else if (project === '8Fe') key += '_8FE';

                        if (!newMatrice[machineId]) newMatrice[machineId] = {};
                        newMatrice[machineId][key] = (newMatrice[machineId][key] || 0) + (row.qta_ottenuta || 0);
                    }
                });
            }
            setMatrice(newMatrice);

            // Process downtime data
            const newDowntimeMap = {};
            if (resDowntime.data) {
                resDowntime.data.forEach(row => {
                    const mId = row.macchina_id;
                    if (!mId) return;
                    newDowntimeMap[mId] = (newDowntimeMap[mId] || 0) + (row.durata_minuti || 0);
                });
            }
            setDowntimeMap(newDowntimeMap);
            setLoading(false);
        };

        if (Object.keys(anagrafica).length > 0) {
            fetchData();
        } else if (loading) {
            // If anagrafica is empty but we haven't loaded it yet, don't stop loading
        }
    }, [globalDate, turnoCorrente, anagrafica]);

    const all_machines_order = ["DRA10060", "DRA10061", "DRA10062", "DRA10063", "DRA10064", "DRA10065", "DRA10066", "DRA10067", "DRA10068", "DRA10069", "DRA10070", "DRA10071", "DRA10072", "DRA11042", "FRW10193", "FRW10217", "FRW10076", "FRW10078", "FRW12464", "FRW10074", "FRW10075", "FRW10082", "FRW10140", "FRW10079", "FRW11980", "FRW10081", "FRW11010", "FRW11022", "FRW11016", "FRW11017", "EGW11005", "EGW11008", "EGW11014", "EGW11015", "EGW11016", "SCA11008", "SCA11009", "SCA11010", "SCA10151", "SCA11006", "MZA11005", "MZA11006", "MZA11008", "MZA10005", "STW11002", "STW11007", "STW19069", "STW12177", "FRD19013", "FRD19060", "ORE19068", "RAA11009", "FRA11023", "FRA11025", "DRA10110", "DRA10111", "DRA10116", "DRA10106", "DRA10102", "DRA10108", "DRA10099", "DRA10100", "DRA19009", "DRA10097", "DRA10098", "DRA10101", "DRA10107", "DRA11016", "DRA10113", "DRA10114", "DRA10109", "SLW11011", "SLW11012", "SLW11046", "SLW11126", "SLW11044", "SLW11009", "SLW11010", "SLW11017", "SLW11014", "SLW11027", "SLW11026", "SLW11028", "SLW11013", "SLW11048", "HNW16040", "SLA11083", "SLA11084", "SLA11085", "SLA11086", "SLA11087", "SLA11088", "SLA11089", "SLA11090", "SLA11091", "SLA11092", "SLA11108", "SLA11109", "SLA11110", "SCA10078", "DRA10058", "DRA10059", "DRA11044", "FRW10189", "FRW10073", "FRW11015", "EGW11006", "EGW11007", "BOA394", "DRA10096", "DRA10190", "DRA11837", "SLW11018", "SLW11019", "SLW11029", "DRA11130", "DRA11131", "DRA11132", "DRA11133", "ORE11103", "MON12551", "SCA11051"];

    const activeTechMachines = useMemo(() => {
        const softList = ["DRA10060", "DRA10061", "DRA10062", "DRA10063", "DRA10064", "DRA10065", "DRA10066", "DRA10067", "DRA10068", "DRA10069", "DRA10070", "DRA10071", "DRA10072", "DRA11042"];
        const hardList = ["DRA10110", "DRA10111", "DRA10116", "DRA10106", "DRA10102", "DRA10108", "DRA10099", "DRA10100", "DRA19009", "DRA10097", "DRA10098", "DRA10101", "DRA10107", "DRA11016", "DRA10113", "DRA10114", "DRA10109"];

        return macchine.filter(m => {
            if (!activeTech || activeTech === 'TUTTO') return true;
            const tec = tecnologie.find(t => t.id === activeTech || t.label === activeTech || t.codice === activeTech);
            if (!tec) return true;

            const label = tec.label?.toLowerCase() || "";
            const machineId = m.id.toUpperCase();

            // Specific logic for Tornitura Soft/Hard to resolve overlap
            if (label.includes("tornitura soft")) {
                return softList.includes(machineId);
            }
            if (label.includes("tornitura hard")) {
                return hardList.includes(machineId);
            }
            if (label.includes("controllo ut")) {
                return machineId === "MZA10005";
            }

            if (tec.prefissi) {
                const prefixes = tec.prefissi.split(',').map(p => p.trim().toUpperCase());
                return prefixes.some(p => machineId.startsWith(p));
            }
            return m.tecnologia_id === tec.id;
        })
            .map(m => m.id)
            .sort((a, b) => {
                const idxA = all_machines_order.indexOf(a);
                const idxB = all_machines_order.indexOf(b);
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
    }, [macchine, activeTech, tecnologie, all_machines_order]);

    const getBackgroundColor = (value) => {
        if (value === '' || value === 0 || value === undefined) return 'white';
        if (value > 100) return '#D1FAE5';
        if (value > 50) return '#FEF3C7';
        return '#FEE2E2';
    };

    const getRowSum = (machine) => {
        if (!matrice[machine]) return 0;
        return components.reduce((sum, comp) => {
            const val = matrice[machine][comp];
            return sum + (val ? Number(val) : 0);
        }, 0);
    };

    const tabStyle = (techId, label) => ({
        padding: '8px 14px',
        backgroundColor: activeTech === techId ? '#3B82F6' : '#E5E7EB',
        color: activeTech === techId ? 'white' : '#111827',
        border: 'none',
        borderRadius: '6px',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '11px',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap'
    });

    return (
        <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', padding: '32px' }}>
            <div style={{ marginBottom: '16px', padding: '0 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Report Produzione</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Dati del <strong>{formatItalianDate(globalDate || new Date())}</strong> - Turno <strong>{turnoCorrente || 'N/A'}</strong>
                        </p>
                    </div>
                    {loading && <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '14px' }}>Caricamento dati...</div>}
                </div>

                {/* Tab Selector */}
                <div style={{ marginBottom: '24px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button key="TUTTO" onClick={() => setActiveTech('TUTTO')} style={tabStyle('TUTTO')}>TUTTO</button>
                    {(() => {
                        const labelMapping = {
                            "tornitura soft": "Tornitura Soft",
                            "marcatura laser dmc": "DMC",
                            "saldatura laser": "Saldatura Laser",
                            "stozzatura": "Stozzatura",
                            "milling": "Fresatura",
                            "brocciatura": "Brocciatura",
                            "dentatura": "Dentatura",
                            "sbavatura": "Sbavatura",
                            "tornitura hard": "Tornitura Hard",
                            "levigatura": "Levigatura",
                            "tornitura rettifica cono": "Rettifica Cono",
                            "rettifica denti": "Rettifica Denti"
                        };

                        const desiredOrder = [
                            "Tornitura Soft", "DMC", "Saldatura Laser", "Stozzatura", "Fresatura",
                            "Brocciatura", "Dentatura", "Sbavatura", "Tornitura Hard", "Levigatura",
                            "Rettifica Cono", "Rettifica Denti"
                        ];

                        // Prepare the list with mapped labels
                        const mappedTec = tecnologie.map(t => {
                            const originalLabel = t.label.toLowerCase();
                            let displayLabel = t.label;
                            for (const [key, val] of Object.entries(labelMapping)) {
                                if (originalLabel === key || originalLabel.includes(key)) {
                                    displayLabel = val;
                                    break;
                                }
                            }
                            return { ...t, displayLabel };
                        });

                        return mappedTec
                            .sort((a, b) => {
                                let idxA = desiredOrder.indexOf(a.displayLabel);
                                let idxB = desiredOrder.indexOf(b.displayLabel);
                                if (idxA === -1) idxA = 999;
                                if (idxB === -1) idxB = 999;
                                return idxA - idxB;
                            })
                            .map(tec => (
                                <button key={tec.id} onClick={() => setActiveTech(tec.id)} style={tabStyle(tec.id)}>{tec.displayLabel}</button>
                            ));
                    })()}
                </div>
            </div>

            <div style={{
                flex: 1,
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ overflow: 'auto', flex: 1 }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px', width: '100%' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th colSpan={3} style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold' }}></th>
                                <th colSpan={9} style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center', backgroundColor: '#EFF6FF', fontWeight: 'bold', fontSize: '13px', color: '#3B82F6' }}>DCT 300</th>
                                <th colSpan={14} style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center', backgroundColor: '#F3E8FF', fontWeight: 'bold', fontSize: '13px', color: '#A855F7' }}>8Fe</th>
                                <th colSpan={6} style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center', backgroundColor: '#CCFBF1', fontWeight: 'bold', fontSize: '13px', color: '#10B981' }}>DCT ECO</th>
                            </tr>

                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold', minWidth: '100px', position: 'sticky', left: 0, zIndex: 110 }}>Macchina</th>
                                <th style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold', minWidth: '70px', color: 'var(--danger)' }}>Fermi (min)</th>
                                <th style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold', minWidth: '70px' }}>Totale</th>
                                {components.map((comp, idx) => {
                                    const isColHovered = hoveredCol === comp;
                                    return (
                                        <th
                                            key={idx}
                                            onMouseEnter={() => setHoveredCol(comp)}
                                            onMouseLeave={() => setHoveredCol(null)}
                                            style={{
                                                border: '1px solid var(--border)',
                                                padding: '8px',
                                                textAlign: 'center',
                                                backgroundColor: isColHovered ? '#eef2ff' : 'var(--bg-secondary)',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                                minWidth: '70px',
                                                color: 'var(--text-primary)',
                                                fontFamily: 'inherit',
                                                transition: 'background-color 0.1s'
                                            }}
                                        >
                                            {comp.replace('_ECO', '').replace('_8FE', '')}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {activeTechMachines.map((machineId, ridx) => {
                                const mObj = macchine.find(m => m.id === machineId);
                                const machineLabel = mObj?.nome || machineId;
                                const downtime = downtimeMap[machineId] || 0;
                                const isRowHovered = hoveredRow === machineId;
                                return (
                                    <tr
                                        key={ridx}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            backgroundColor: isRowHovered ? '#eef2ff' : 'transparent'
                                        }}
                                        onMouseEnter={() => setHoveredRow(machineId)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                    >
                                        <td style={{
                                            border: '1px solid var(--border)',
                                            padding: '8px',
                                            textAlign: 'center',
                                            backgroundColor: isRowHovered ? '#eef2ff' : 'var(--bg-card)',
                                            fontWeight: '600',
                                            minWidth: '100px',
                                            position: 'sticky',
                                            left: 0,
                                            zIndex: 5
                                        }}>
                                            {machineLabel}
                                        </td>
                                        <td style={{
                                            border: '1px solid var(--border)',
                                            padding: '8px',
                                            textAlign: 'center',
                                            backgroundColor: isRowHovered ? '#eef2ff' : (downtime > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)'),
                                            fontWeight: '700',
                                            color: downtime > 0 ? 'var(--danger)' : 'var(--text-muted)'
                                        }}>
                                            {downtime > 0 ? downtime : "—"}
                                        </td>
                                        <td style={{
                                            border: '1px solid var(--border)',
                                            padding: '8px',
                                            textAlign: 'center',
                                            backgroundColor: isRowHovered ? '#eef2ff' : 'var(--bg-secondary)',
                                            fontWeight: '700',
                                            minWidth: '80px'
                                        }}>
                                            {getRowSum(machineId)}
                                        </td>

                                        {components.map((comp, cidx) => {
                                            const val = matrice[machineId] ? matrice[machineId][comp] : "";
                                            const isColHovered = hoveredCol === comp;
                                            return (
                                                <td
                                                    key={cidx}
                                                    onMouseEnter={() => setHoveredCol(comp)}
                                                    onMouseLeave={() => setHoveredCol(null)}
                                                    style={{
                                                        border: '1px solid var(--border)',
                                                        padding: '8px',
                                                        textAlign: 'center',
                                                        backgroundColor: (isRowHovered || isColHovered) ? '#eef2ff' : getBackgroundColor(val),
                                                        color: '#111827',
                                                        fontWeight: '600',
                                                        fontSize: '12px',
                                                        minWidth: '80px',
                                                        opacity: val ? 1 : 0.2,
                                                        transition: 'background-color 0.1s'
                                                    }}
                                                >
                                                    {val || "0"}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
