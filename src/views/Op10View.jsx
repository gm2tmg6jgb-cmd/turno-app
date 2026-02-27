import { useState, useMemo, useEffect, useCallback } from "react";
import { Icons } from "../components/ui/Icons";
import { supabase } from "../lib/supabase";
import { getLocalDate, TODAY } from "../lib/dateUtils";

const INITIAL_WEISSER = [
    { id: "DRA60", progetto: "8Fe", componente: "SG2", racks: 6, ore: 12, note: "" },
    { id: "DRA61", progetto: "8Fe", componente: "SG5", racks: 1, ore: 2, note: "" },
    { id: "DRA62", progetto: "8Fe", componente: "PG", racks: 2, ore: 6, note: "" },
    { id: "DRA63/64", progetto: "8Fe", componente: "1086", racks: 2, ore: 1, note: "" },
    { id: "DRA65/66", progetto: "DCT 300", componente: "SG4", racks: 1, ore: 1, note: "" },
    { id: "DRA67/68", progetto: "DCT 300", componente: "1223", racks: 3, ore: 2, note: "" },
    { id: "DRA69/70", progetto: "8Fe", componente: "SG7", racks: 7, ore: 9, note: "" },
    { id: "DRA71", progetto: "8Fe", componente: "SG3", racks: 6, ore: 22, note: "" },
    { id: "DRA72", progetto: "DCT 300", componente: "1232", racks: 3, ore: 4, note: "" },
    { id: "DRA42", progetto: "DCT 300", componente: "1226", racks: 38, ore: 53, note: "" },
    { id: "DRA58", progetto: "DCT 300", componente: "407", racks: 0, ore: 0, note: "Mancanza grezzo fine turno" },
    { id: "DRA59", progetto: "DCT 300", componente: "1080", racks: 8, ore: 3, note: "" },
    { id: "DRA44", progetto: "DCT 300", componente: "1243", racks: 2, ore: 1, note: "Dopo cambia a 901 - autonomia 9 ore" },
];

const INITIAL_ECO = [
    { componente: "SG2", racks: 2, note: "" },
    { componente: "SG3", racks: 6, note: "" },
    { componente: "SG4", racks: 0, note: "" },
    { componente: "SG5", racks: 0, note: "" },
    { componente: "SGR", racks: 0, note: "" },
];

export default function Op10View({ turnoCorrente }) {
    const [selectedDate, setSelectedDate] = useState(TODAY);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Weisser Table State
    const [weisserData, setWeisserData] = useState(INITIAL_WEISSER);
    // Pretornito Eco Table State
    const [ecoData, setEcoData] = useState(INITIAL_ECO);

    // Load data from Supabase
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

                if (error && error.code !== 'PGRST116') {
                    console.error("Errore caricamento asservimento:", error);
                }

                if (data) {
                    setWeisserData(data.weisser_data);
                    setEcoData(data.eco_data);
                } else {
                    // Reset to defaults if no record found
                    setWeisserData(INITIAL_WEISSER);
                    setEcoData(INITIAL_ECO);
                }
            } catch (err) {
                console.error("Catch error:", err);
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
                    weisser_data: weisserData,
                    eco_data: ecoData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'data,turno' });

            if (error) throw error;
            alert("✅ Situazione salvata con successo per il giorno " + selectedDate);
        } catch (err) {
            console.error("Errore salvataggio:", err);
            alert("❌ Errore durante il salvataggio: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const updateWeisser = (index, field, value) => {
        const newData = [...weisserData];
        newData[index][field] = value;
        setWeisserData(newData);
    };

    const updateEco = (index, field, value) => {
        const newData = [...ecoData];
        newData[index][field] = value;
        setEcoData(newData);
    };

    const nowStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fade-in" style={{ paddingBottom: 40, opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {/* Header / Meta Info */}
            <div style={{ display: "flex", gap: 20, marginBottom: 24, alignItems: "center" }}>
                <div className="card" style={{ flex: 1, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 20, color: "var(--accent)" }}>{Icons.calendar}</div>
                    <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Giorno Selezionato</div>
                        <input
                            type="date"
                            className="input"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-primary)",
                                padding: 0,
                                fontWeight: 700,
                                fontSize: 14,
                                width: 130
                            }}
                        />
                    </div>
                </div>
                <div className="card" style={{ flex: 1, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 20, color: "var(--accent)" }}>{Icons.clock}</div>
                    <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Ore Attuali</div>
                        <div style={{ fontWeight: 700 }}>{nowStr}</div>
                    </div>
                </div>

                <div style={{ flex: 1 }}>
                    <button
                        className="btn btn-primary"
                        onClick={saveSituazione}
                        disabled={isSaving || isLoading}
                        style={{ width: "100%", height: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                        {isSaving ? Icons.loading : Icons.save}
                        {isSaving ? "Salvataggio..." : "Salva Situazione (Target)"}
                    </button>
                </div>

                <div style={{ flex: 1 }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 24, alignItems: "start" }}>
                {/* WEISSER TABLE */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{
                        padding: "16px 20px",
                        background: "var(--bg-tertiary)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Situazione Asservimento WEISSER</h3>
                        <div className="tag tag-blue">Pianificazione Live</div>
                    </div>

                    <div className="table-container">
                        <table style={{ width: "100%", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ padding: "10px 12px", textAlign: "left", width: "100px" }}>Weisser</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", width: "140px" }}>Progetto</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", width: "120px" }}>Componente</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", width: "80px" }}>Racks Buffer</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", width: "80px" }}>Ore Copertura</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left" }}>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weisserData.map((row, idx) => (
                                    <tr key={idx} style={{
                                        borderBottom: "1px solid var(--border-light)",
                                        background: row.racks === 0 ? "rgba(239, 68, 68, 0.05)" : "transparent"
                                    }}>
                                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-secondary)" }}>{row.id}</td>
                                        <td style={{ padding: "6px 12px" }}>
                                            <select
                                                className="select-input"
                                                value={row.progetto}
                                                onChange={(e) => updateWeisser(idx, 'progetto', e.target.value)}
                                                style={{ height: 32, fontSize: 12, padding: "0 8px" }}
                                            >
                                                <option value="8Fe">8Fe</option>
                                                <option value="DCT 300">DCT 300</option>
                                                <option value="DCT Eco">DCT Eco</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: "6px 12px" }}>
                                            <input
                                                className="input"
                                                value={row.componente}
                                                onChange={(e) => updateWeisser(idx, 'componente', e.target.value)}
                                                style={{ height: 32, fontSize: 12, padding: "0 8px" }}
                                            />
                                        </td>
                                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                            <input
                                                className="input"
                                                type="number"
                                                value={row.racks}
                                                onChange={(e) => updateWeisser(idx, 'racks', parseInt(e.target.value) || 0)}
                                                style={{
                                                    height: 32,
                                                    width: 50,
                                                    fontSize: 12,
                                                    padding: "0 4px",
                                                    textAlign: "center",
                                                    fontWeight: 700,
                                                    background: row.racks === 0 ? "rgba(239, 68, 68, 0.15)" : "var(--bg-secondary)"
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                            <input
                                                className="input"
                                                type="number"
                                                value={row.ore}
                                                onChange={(e) => updateWeisser(idx, 'ore', parseInt(e.target.value) || 0)}
                                                style={{
                                                    height: 32,
                                                    width: 50,
                                                    fontSize: 12,
                                                    padding: "0 4px",
                                                    textAlign: "center",
                                                    fontWeight: 700,
                                                    color: row.ore === 0 ? "var(--danger)" : "var(--accent)"
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: "6px 12px" }}>
                                            <input
                                                className="input"
                                                value={row.note}
                                                onChange={(e) => updateWeisser(idx, 'note', e.target.value)}
                                                style={{
                                                    height: 32,
                                                    fontSize: 11,
                                                    padding: "0 8px",
                                                    background: row.note ? "rgba(245, 158, 11, 0.05)" : "transparent",
                                                    border: row.note ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid transparent"
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* PRETORNITO ECO TABLE */}
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Asservimento Pretornito Eco</h3>
                        </div>
                        <div className="table-container">
                            <table style={{ width: "100%", fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                                        <th style={{ padding: "10px 12px", textAlign: "left" }}>Componente</th>
                                        <th style={{ padding: "10px 12px", textAlign: "center", width: "100px" }}>Racks Buffer</th>
                                        <th style={{ padding: "10px 12px", textAlign: "left" }}>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ecoData.map((row, idx) => (
                                        <tr key={idx} style={{
                                            borderBottom: "1px solid var(--border-light)",
                                            background: row.racks === 0 ? "rgba(239, 68, 68, 0.05)" : "transparent"
                                        }}>
                                            <td style={{ padding: "10px 12px", fontWeight: 700 }}>{row.componente}</td>
                                            <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                                <input
                                                    className="input"
                                                    type="number"
                                                    value={row.racks}
                                                    onChange={(e) => updateEco(idx, 'racks', parseInt(e.target.value) || 0)}
                                                    style={{
                                                        height: 32,
                                                        width: 60,
                                                        fontSize: 12,
                                                        padding: "0 4px",
                                                        textAlign: "center",
                                                        fontWeight: 700,
                                                        background: row.racks === 0 ? "rgba(239, 68, 68, 0.15)" : "var(--bg-secondary)"
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: "6px 12px" }}>
                                                <input
                                                    className="input"
                                                    value={row.note}
                                                    onChange={(e) => updateEco(idx, 'note', e.target.value)}
                                                    style={{ height: 32, fontSize: 11, padding: "0 8px" }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Stats Card */}
                    <div className="card" style={{ padding: 20, background: "linear-gradient(135deg, var(--accent-muted) 0%, transparent 100%)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                            <div style={{ fontSize: 24 }}>📊</div>
                            <h4 style={{ margin: 0 }}>Riepilogo Criticità</h4>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Macchine a secco (0 racks)</span>
                                <span style={{ fontWeight: 700, color: "var(--danger)" }}>
                                    {weisserData.filter(d => d.racks === 0).length + ecoData.filter(d => d.racks === 0).length}
                                </span>
                            </div>
                            <div style={{ height: 6, background: "var(--bg-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                    width: `${((weisserData.filter(d => d.racks === 0).length + ecoData.filter(d => d.racks === 0).length) / (weisserData.length + ecoData.length)) * 100}%`,
                                    height: "100%",
                                    background: "var(--danger)"
                                }} />
                            </div>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                                {weisserData.filter(d => d.ore < 4 && d.ore > 0).length} macchine hanno meno di 4 ore di autonomia.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
