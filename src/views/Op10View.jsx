import { useState, useMemo, useEffect, useCallback } from "react";
import { Icons } from "../components/ui/Icons";
import { supabase } from "../lib/supabase";
import { getLocalDate, TODAY } from "../lib/dateUtils";

const INITIAL_DATA = [
    // WEISSER
    { type: "WEISSER", id: "DRA60", progetto: "8Fe", componente: "SG2", racks: 6, ore: 12, note: "" },
    { type: "WEISSER", id: "DRA61", progetto: "8Fe", componente: "SG5", racks: 1, ore: 2, note: "" },
    { type: "WEISSER", id: "DRA62", progetto: "8Fe", componente: "PG", racks: 2, ore: 6, note: "" },
    { type: "WEISSER", id: "DRA63/64", progetto: "8Fe", componente: "1086", racks: 2, ore: 1, note: "" },
    { type: "WEISSER", id: "DRA65/66", progetto: "DCT 300", componente: "SG4", racks: 1, ore: 1, note: "" },
    { type: "WEISSER", id: "DRA67/68", progetto: "DCT 300", componente: "1223", racks: 3, ore: 2, note: "" },
    { type: "WEISSER", id: "DRA69/70", progetto: "8Fe", componente: "SG7", racks: 7, ore: 9, note: "" },
    { type: "WEISSER", id: "DRA71", progetto: "8Fe", componente: "SG3", racks: 6, ore: 22, note: "" },
    { type: "WEISSER", id: "DRA72", progetto: "DCT 300", componente: "1232", racks: 3, ore: 4, note: "" },
    { type: "WEISSER", id: "DRA42", progetto: "DCT 300", componente: "1226", racks: 38, ore: 53, note: "" },
    { type: "WEISSER", id: "DRA58", progetto: "DCT 300", componente: "407", racks: 0, ore: 0, note: "Mancanza grezzo fine turno" },
    { type: "WEISSER", id: "DRA59", progetto: "DCT 300", componente: "1080", racks: 8, ore: 3, note: "" },
    { type: "WEISSER", id: "DRA44", progetto: "DCT 300", componente: "1243", racks: 2, ore: 1, note: "Dopo cambia a 901" },
    // PRETORNITO ECO
    { type: "ECO", id: "Pretornito Eco SG2", progetto: "DCT Eco", componente: "SG2", racks: 2, ore: 0, note: "" },
    { type: "ECO", id: "Pretornito Eco SG3", progetto: "DCT Eco", componente: "SG3", racks: 6, ore: 0, note: "" },
    { type: "ECO", id: "Pretornito Eco SG4", progetto: "DCT Eco", componente: "SG4", racks: 0, ore: 0, note: "" },
    { type: "ECO", id: "Pretornito Eco SG5", progetto: "DCT Eco", componente: "SG5", racks: 0, ore: 0, note: "" },
    { type: "ECO", id: "Pretornito Eco SGR", progetto: "DCT Eco", componente: "SGR", racks: 0, ore: 0, note: "" },
    // PRETORNITO 300
    { type: "300", id: "Pretornito 300 P1", progetto: "DCT 300", componente: "SG4", racks: 0, ore: 0, note: "" },
    { type: "300", id: "Pretornito 300 P2", progetto: "DCT 300", componente: "1223", racks: 0, ore: 0, note: "" },
];

export default function Op10View({ turnoCorrente }) {
    const [selectedDate, setSelectedDate] = useState(TODAY);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [allData, setAllData] = useState(INITIAL_DATA);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('asservimento_op10')
                    .select('*')
                    .eq('data', selectedDate)
                    .eq('turno', turnoCorrente)
                    .single();

                if (data) {
                    // Compatibility check: if old data structure exists, try to map or reset
                    if (data.weisser_data && data.eco_data) {
                        const combined = [
                            ...data.weisser_data.map(d => ({ ...d, type: "WEISSER" })),
                            ...data.eco_data.map(d => ({ ...d, type: "ECO", id: `Eco ${d.componente}` })),
                            ...INITIAL_DATA.filter(d => d.type === "300")
                        ];
                        setAllData(combined);
                    } else if (data.all_data) {
                        setAllData(data.all_data);
                    }
                } else {
                    setAllData(INITIAL_DATA);
                }
            } catch (err) {
                console.error("Load error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [selectedDate, turnoCorrente]);

    const saveSituazione = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('asservimento_op10')
                .upsert({
                    data: selectedDate,
                    turno: turnoCorrente,
                    all_data: allData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'data,turno' });

            if (error) throw error;
            alert("✅ Situazione salvata con successo!");
        } catch (err) {
            console.error("Save error:", err);
            alert("❌ Errore: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendEmail = () => {
        const critical = allData.filter(d => d.racks === 0);
        let body = `Situazione Asservimento OP10 - Giorno: ${selectedDate} - Turno: ${turnoCorrente}\n\n`;
        body += `RIASSUNTO CRITICITÀ (0 Racks):\n`;
        critical.forEach(c => {
            body += `- ${c.id}: ${c.progetto} / ${c.componente} ${c.note ? '(' + c.note + ')' : ''}\n`;
        });
        body += `\nDETTAGLIO COMPLETO:\n`;
        allData.forEach(d => {
            body += `${d.id} | ${d.progetto} | ${d.componente} | Racks: ${d.racks} | Ore: ${d.ore} | Note: ${d.note}\n`;
        });

        const mailtoLink = `mailto:?subject=Situazione Asservimento OP10 ${selectedDate}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    };

    const updateRow = (index, field, value) => {
        const newData = [...allData];
        newData[index][field] = value;
        setAllData(newData);
    };

    const nowStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fade-in" style={{ paddingBottom: 40, opacity: isLoading ? 0.6 : 1 }}>
            <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center" }}>
                <div className="card" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 18, color: "var(--accent)" }}>{Icons.calendar}</div>
                    <input type="date" className="input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ background: "transparent", border: "none", fontWeight: 700, width: 130 }} />
                </div>

                <button className="btn btn-primary" onClick={saveSituazione} disabled={isSaving}>
                    {isSaving ? Icons.loading : Icons.save} Salva Target
                </button>

                <button className="btn" onClick={handleSendEmail} style={{ background: "var(--info)", color: "white", border: "none" }}>
                    {Icons.send} Invia Situazione via Email
                </button>

                <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
                    Aggiornato alle: <strong>{nowStr}</strong>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Tabella Unica Asservimento (Weisser / Eco / 300)</h3>
                    <div className="tag tag-blue">Shift: {turnoCorrente}</div>
                </div>

                <div className="table-container">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-secondary)", borderBottom: "2px solid var(--border)" }}>
                                <th style={{ padding: "12px", textAlign: "left", width: 140 }}>Macchina</th>
                                <th style={{ padding: "12px", textAlign: "left", width: 120 }}>Progetto</th>
                                <th style={{ padding: "12px", textAlign: "left", width: 120 }}>Componente</th>
                                <th style={{ padding: "12px", textAlign: "center", width: 90 }}>Buffer (Racks)</th>
                                <th style={{ padding: "12px", textAlign: "center", width: 90 }}>Copertura (h)</th>
                                <th style={{ padding: "12px", textAlign: "left" }}>Note / Osservazioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allData.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid var(--border-light)", background: row.racks === 0 ? "rgba(239, 68, 68, 0.05)" : "transparent" }}>
                                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-secondary)" }}>{row.id}</td>
                                    <td style={{ padding: "6px 12px" }}>
                                        <select className="select-input" value={row.progetto} onChange={e => updateRow(idx, 'progetto', e.target.value)} style={{ height: 32, fontSize: 12 }}>
                                            <option value="8Fe">8Fe</option>
                                            <option value="DCT 300">DCT 300</option>
                                            <option value="DCT Eco">DCT Eco</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: "6px 12px" }}>
                                        <input className="input" value={row.componente} onChange={e => updateRow(idx, 'componente', e.target.value)} style={{ height: 32, fontSize: 12 }} />
                                    </td>
                                    <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                        <input type="number" className="input" value={row.racks} onChange={e => updateRow(idx, 'racks', parseInt(e.target.value) || 0)} style={{ height: 32, width: 60, textAlign: "center", fontWeight: 700, background: row.racks === 0 ? "rgba(239, 68, 68, 0.15)" : "var(--bg-secondary)" }} />
                                    </td>
                                    <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                        <input type="number" className="input" value={row.ore} onChange={e => updateRow(idx, 'ore', parseInt(e.target.value) || 0)} style={{ height: 32, width: 60, textAlign: "center", fontWeight: 700, color: row.ore === 0 ? "var(--danger)" : "var(--accent)" }} />
                                    </td>
                                    <td style={{ padding: "6px 12px" }}>
                                        <input className="input" value={row.note} onChange={e => updateRow(idx, 'note', e.target.value)} style={{ height: 32, fontSize: 11 }} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div className="card" style={{ padding: 20 }}>
                    <h4 style={{ margin: "0 0 16px 0" }}>⚠️ Macchine Critiche</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {allData.filter(d => d.racks === 0).map(d => (
                            <span key={d.id} className="tag tag-red" style={{ padding: "6px 12px" }}>{d.id}</span>
                        )) || <span style={{ color: "var(--text-muted)" }}>Nessuna criticità</span>}
                    </div>
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <h4 style={{ margin: "0 0 16px 0" }}>ℹ️ Info Asservimento</h4>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                        La tabella unificata permette una visione d'insieme di tutti i processi di asservimento OP10.
                        Usa il tasto "Invia Situazione" per generare un report rapido per i responsabili di stabilimento.
                    </p>
                </div>
            </div>
        </div>
    );
}
