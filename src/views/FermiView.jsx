import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/ui/Icons';
import { MOTIVI_FERMO as motiviFermo_DEFAULT, REPARTI, TURNI } from '../data/constants';
import { getLocalDate } from '../lib/dateUtils';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

/* ── tecnologie fallback (se DB non ancora popolato) ────── */
const TECNOLOGIE_DEFAULT = [
    { id: 'tornitura_soft', label: 'Tornitura Soft', prefissi: 'DRA',     colore: '#3B82F6', ordine: 1 },
    { id: 'dentatrici',     label: 'Dentatrici',     prefissi: 'FRW,FRD', colore: '#F59E0B', ordine: 2 },
    { id: 'rettifiche',     label: 'Rettifiche',     prefissi: 'SLW,SLA', colore: '#8B5CF6', ordine: 3 },
    { id: 'stozzatrici',    label: 'Stozzatrici',    prefissi: 'STW',     colore: '#10B981', ordine: 4 },
    { id: 'saldatrici',     label: 'Saldatrici',     prefissi: 'SCA,SDA', colore: '#EF4444', ordine: 5 },
    { id: 'smussatrici',    label: 'Smussatrici',    prefissi: 'EGW',     colore: '#6366F1', ordine: 6 },
    { id: 'altro',          label: 'Altro',          prefissi: '',        colore: '#6B7280', ordine: 99 },
];

// normalizza prefissi stringa → array, e aggiunge sempre "altro" in fondo
function normalizeTecnologie(raw) {
    const list = raw.map(t => ({
        ...t,
        prefissiArr: (t.prefissi || '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean),
    }));
    // assicura che ci sia sempre una voce "altro" catch-all in fondo
    if (!list.find(t => t.prefissiArr.length === 0)) {
        list.push({ id: 'altro', label: 'Altro', prefissi: '', prefissiArr: [], colore: '#6B7280', ordine: 99 });
    }
    return list.sort((a, b) => (a.ordine ?? 99) - (b.ordine ?? 99));
}

function getTecnologiaId(macchinaId, tecnologie) {
    const up = (macchinaId || '').toUpperCase();
    const withPrefissi = tecnologie.filter(t => t.prefissiArr?.length > 0);
    for (const tec of withPrefissi) {
        if (tec.prefissiArr.some(p => up.startsWith(p))) return tec.id;
    }
    // catch-all: primo con prefissiArr vuoto
    return tecnologie.find(t => t.prefissiArr?.length === 0)?.id ?? 'altro';
}

function generateDateRange(from, to) {
    const dates = [];
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
        dates.push(getLocalDate(new Date(cur)));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

function getMotivoTop(lista) {
    if (!lista.length) return null;
    const counts = {};
    for (const f of lista) counts[f.motivo] = (counts[f.motivo] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function defaultFrom() {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return getLocalDate(d);
}

/* ── tooltip custom per recharts ────────────────────────── */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
            <div>Fermi: <strong>{payload[0]?.value}</strong></div>
            {payload[1]?.value > 0 && <div>Minuti: <strong>{payload[1]?.value}</strong></div>}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function FermiView({ macchine = [], initialReparto, initialTurno, motiviFermo: motiviFermoProp, tecnologie: tecnologieProp }) {
    const motiviFermo = motiviFermoProp?.length ? motiviFermoProp : motiviFermo_DEFAULT;
    const tecnologie = useMemo(
        () => normalizeTecnologie(tecnologieProp?.length ? tecnologieProp : TECNOLOGIE_DEFAULT),
        [tecnologieProp]
    );
    const [activeTab, setActiveTab] = useState('lista');
    const [notification, setNotification] = useState(null);

    /* ── LISTA state ── */
    const [date, setDate] = useState(getLocalDate(new Date()));
    const [turno, setTurno] = useState(initialTurno || "A");
    const [fermi, setFermi] = useState([]);
    const [loading, setLoading] = useState(false);

    /* ── FORM INSERIMENTO ── */
    const EMPTY_FORM = { macchina_id: "", ora_inizio: "", ora_fine: "", motivo: "", durata_minuti: "", note: "" };
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const resetForm = () => { setFormData(EMPTY_FORM); setShowForm(false); };

    /* ── calcola durata da ora_inizio/ora_fine ── */
    const calcDurata = (inizio, fine) => {
        if (!inizio || !fine) return "";
        const [ih, im] = inizio.split(":").map(Number);
        const [fh, fm] = fine.split(":").map(Number);
        const diff = (fh * 60 + fm) - (ih * 60 + im);
        return diff > 0 ? String(diff) : "";
    };

    /* ── motivi filtrati per macchina selezionata ── */
    const motiviFiltrati = useMemo(() => {
        if (!formData.macchina_id) return motiviFermo;
        const tec = tecnologie.find(t =>
            t.prefissiArr?.length > 0 &&
            t.prefissiArr.some(p => formData.macchina_id.toUpperCase().startsWith(p))
        );
        if (!tec) return motiviFermo;
        const perTec = motiviFermo.filter(m => m.tecnologia_id === tec.id);
        return perTec.length > 0 ? perTec : motiviFermo;
    }, [formData.macchina_id, motiviFermo, tecnologie]);

    const handleSaveFermo = async () => {
        if (!formData.macchina_id || !formData.motivo) {
            showNotification("Seleziona macchina e motivo", "error"); return;
        }
        setSaving(true);
        const durata = formData.durata_minuti || calcDurata(formData.ora_inizio, formData.ora_fine) || null;
        const payload = {
            data: date,
            turno_id: turno || null,
            macchina_id: formData.macchina_id,
            ora_inizio: formData.ora_inizio || null,
            ora_fine: formData.ora_fine || null,
            motivo: formData.motivo,
            durata_minuti: durata ? parseInt(durata) : null,
            note: formData.note || null,
        };
        const { data, error } = await supabase.from('fermi_macchina').insert([payload]).select();
        setSaving(false);
        if (error) { showNotification("Errore salvataggio: " + error.message, "error"); return; }
        setFermi(prev => [data[0], ...prev]);
        showNotification("Fermo registrato", "success");
        resetForm();
    };

    /* ── PER TECNOLOGIA state ── */
    const [tecFrom, setTecFrom] = useState(defaultFrom());
    const [tecTo, setTecTo] = useState(getLocalDate(new Date()));
    const [fermiTec, setFermiTec] = useState([]);
    const [loadingTec, setLoadingTec] = useState(false);

    const showNotification = (msg, type = "success") => {
        setNotification({ message: msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    /* ── fetch lista ── */
    useEffect(() => {
        if (activeTab !== 'lista') return;
        const run = async () => {
            setLoading(true);
            let q = supabase.from('fermi_macchina').select('*').eq('data', date);
            if (turno) q = q.eq('turno_id', turno);
            q = q.order('ora_inizio', { ascending: false, nullsFirst: false });
            const { data, error } = await q;
            if (error) showNotification("Errore caricamento: " + error.message, "error");
            else setFermi(data || []);
            setLoading(false);
        };
        run();
    }, [date, turno, activeTab]);

    /* ── fetch per tecnologia ── */
    useEffect(() => {
        if (activeTab !== 'tecnologia') return;
        const run = async () => {
            setLoadingTec(true);
            const { data, error } = await supabase
                .from('fermi_macchina')
                .select('*')
                .gte('data', tecFrom)
                .lte('data', tecTo)
                .order('data', { ascending: true });
            if (!error) setFermiTec(data || []);
            setLoadingTec(false);
        };
        run();
    }, [tecFrom, tecTo, activeTab]);

    /* ── delete ── */
    const handleDelete = async (id) => {
        if (!window.confirm("Eliminare questo fermo?")) return;
        const { error } = await supabase.from('fermi_macchina').delete().eq('id', id);
        if (error) showNotification("Errore cancellazione", "error");
        else { setFermi(prev => prev.filter(f => f.id !== id)); showNotification("Fermo eliminato", "warning"); }
    };

    /* ── chart data per tecnologia ── */
    const dateRange = useMemo(() => generateDateRange(tecFrom, tecTo), [tecFrom, tecTo]);

    const { chartData, stats } = useMemo(() => {
        const charts = {};
        const statsMap = {};

        for (const tec of tecnologie) {
            charts[tec.id] = dateRange.map(d => ({
                label: d.slice(5).replace('-', '/'),
                fermi: 0,
                minuti: 0,
            }));
            statsMap[tec.id] = { totale: 0, minuti: 0, motivoTop: null, lista: [] };
        }

        for (const f of fermiTec) {
            const tid = getTecnologiaId(f.macchina_id, tecnologie);
            const idx = dateRange.indexOf(f.data);
            if (idx >= 0) {
                charts[tid][idx].fermi += 1;
                charts[tid][idx].minuti += f.durata_minuti || 0;
            }
            statsMap[tid].totale += 1;
            statsMap[tid].minuti += f.durata_minuti || 0;
            statsMap[tid].lista.push(f);
        }
        for (const tec of tecnologie) {
            statsMap[tec.id].motivoTop = getMotivoTop(statsMap[tec.id].lista);
        }

        return { chartData: charts, stats: statsMap };
    }, [fermiTec, dateRange, tecnologie]);

    /* ═══ RENDER ══════════════════════════════════════════ */
    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>

            {notification && (
                <div style={{
                    position: "fixed", bottom: 20, right: 20, zIndex: 1000,
                    background: notification.type === "error" ? "var(--danger)" :
                        notification.type === "warning" ? "var(--warning)" : "var(--success)",
                    color: "#fff", padding: "12px 24px", borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)", fontWeight: 600
                }}>
                    {notification.message}
                </div>
            )}

            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Fermi Macchina</h2>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4, margin: 0 }}>
                        {activeTab === 'lista' ? 'Riepilogo fermi registrati per turno.' : 'Trend fermi per tecnologia nel periodo selezionato.'}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        className={activeTab === 'lista' ? 'btn btn-primary' : 'btn btn-secondary'}
                        onClick={() => setActiveTab('lista')}
                    >
                        Lista Fermi
                    </button>
                    <button
                        className={activeTab === 'tecnologia' ? 'btn btn-primary' : 'btn btn-secondary'}
                        onClick={() => setActiveTab('tecnologia')}
                    >
                        Per Tecnologia
                    </button>
                </div>
            </div>

            {/* ════════════════════════════════════════════
                TAB 1 — LISTA
            ════════════════════════════════════════════ */}
            {activeTab === 'lista' && (
                <>
                    {/* Filtri */}
                    <div style={{ display: "flex", gap: 12, background: "var(--bg-card)", padding: 12, borderRadius: 8, border: "1px solid var(--border)", marginBottom: 20, alignItems: "flex-end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Data</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" style={{ width: 140 }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Turno</label>
                            <select value={turno} onChange={e => setTurno(e.target.value)} className="select-input" style={{ width: 140 }}>
                                <option value="">Tutti i Turni</option>
                                {TURNI.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                            </select>
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                            <button
                                className={showForm ? "btn btn-secondary" : "btn btn-primary"}
                                onClick={() => { setShowForm(v => !v); setFormData(EMPTY_FORM); }}
                            >
                                {showForm ? "Chiudi" : <>{Icons.plus} Aggiungi Fermo</>}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 340px" : "1fr", gap: 20, alignItems: "start" }}>
                        {/* Lista */}
                        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.02)" }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Fermi Registrati</h3>
                                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Totale: <strong>{fermi.length}</strong></div>
                            </div>
                            {loading ? (
                                <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</div>
                            ) : fermi.length === 0 ? (
                                <div style={{ padding: 60, textAlign: "center", fontStyle: "italic", color: "var(--text-muted)" }}>
                                    Nessun fermo registrato per i criteri selezionati.
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table style={{ width: "100%" }}>
                                        <thead>
                                            <tr style={{ background: "var(--bg-tertiary)" }}>
                                                <th style={{ textAlign: "left", padding: "12px 20px" }}>Macchina</th>
                                                <th style={{ textAlign: "center", padding: "12px" }}>Orario</th>
                                                <th style={{ textAlign: "left", padding: "12px" }}>Motivo / Note</th>
                                                <th style={{ textAlign: "center", padding: "12px" }}>Durata (min)</th>
                                                <th style={{ width: 60, padding: "12px 20px" }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fermi.map(f => {
                                                const motivoObj = motiviFermo.find(m => m.label === f.motivo) || motiviFermo.find(m => m.id === f.motivo);
                                                const machineObj = macchine.find(m => m.id === f.macchina_id);
                                                const machineName = machineObj?.nome || f.macchina_id;
                                                const repartoName = REPARTI.find(r => r.id === machineObj?.reparto_id)?.nome || "";
                                                return (
                                                    <tr key={f.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                        <td style={{ padding: "12px 20px", fontWeight: 600 }}>
                                                            {machineName}
                                                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{repartoName}</div>
                                                        </td>
                                                        <td style={{ textAlign: "center", padding: "12px", fontFamily: "monospace", fontSize: 13 }}>
                                                            {f.ora_inizio ? f.ora_inizio.slice(0, 5) : "—"} – {f.ora_fine ? f.ora_fine.slice(0, 5) : "—"}
                                                        </td>
                                                        <td style={{ padding: "12px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                {motivoObj && <span style={{ fontSize: 18 }}>{motivoObj.icona}</span>}
                                                                <span style={{ fontWeight: 500 }}>{f.motivo}</span>
                                                            </div>
                                                            {f.note && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4, background: "rgba(0,0,0,0.03)", padding: "4px 8px", borderRadius: 4 }}>{f.note}</div>}
                                                        </td>
                                                        <td style={{ textAlign: "center", padding: "12px", fontWeight: 700, color: f.durata_minuti > 30 ? "var(--danger)" : "inherit" }}>
                                                            {f.durata_minuti || "—"}
                                                        </td>
                                                        <td style={{ textAlign: "right", padding: "12px 20px" }}>
                                                            <button onClick={() => handleDelete(f.id)} className="btn-icon-small" style={{ color: "var(--text-muted)" }} title="Elimina">
                                                                {Icons.trash}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Form inserimento fermo */}
                        {showForm && (
                            <div className="card" style={{ position: "sticky", top: 20 }}>
                                <div className="card-header" style={{ marginBottom: 16 }}>
                                    <div className="card-title">Nuovo Fermo</div>
                                    <button className="btn-ghost btn-sm" onClick={resetForm}>{Icons.x}</button>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Macchina *</label>
                                    <select
                                        className="select-input"
                                        value={formData.macchina_id}
                                        onChange={e => setFormData(p => ({ ...p, macchina_id: e.target.value }))}
                                    >
                                        <option value="">— Seleziona —</option>
                                        {tecnologie.map(tec => {
                                            const macchineGruppo = macchine.filter(m =>
                                                tec.prefissiArr?.length > 0
                                                    ? tec.prefissiArr.some(p => (m.id || "").toUpperCase().startsWith(p))
                                                    : false
                                            );
                                            if (macchineGruppo.length === 0) return null;
                                            return (
                                                <optgroup key={tec.id} label={tec.label}>
                                                    {macchineGruppo.map(m => (
                                                        <option key={m.id} value={m.id}>{m.nome || m.id}</option>
                                                    ))}
                                                </optgroup>
                                            );
                                        })}
                                        {/* macchine non classificate */}
                                        {(() => {
                                            const classificate = new Set(
                                                macchine
                                                    .filter(m => tecnologie.some(tec =>
                                                        tec.prefissiArr?.length > 0 &&
                                                        tec.prefissiArr.some(p => (m.id || "").toUpperCase().startsWith(p))
                                                    ))
                                                    .map(m => m.id)
                                            );
                                            const altre = macchine.filter(m => !classificate.has(m.id));
                                            if (!altre.length) return null;
                                            return (
                                                <optgroup label="Altro">
                                                    {altre.map(m => <option key={m.id} value={m.id}>{m.nome || m.id}</option>)}
                                                </optgroup>
                                            );
                                        })()}
                                    </select>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div className="form-group">
                                        <label className="form-label">Ora inizio</label>
                                        <input
                                            type="time"
                                            className="input"
                                            value={formData.ora_inizio}
                                            onChange={e => {
                                                const ora_inizio = e.target.value;
                                                setFormData(p => ({
                                                    ...p,
                                                    ora_inizio,
                                                    durata_minuti: calcDurata(ora_inizio, p.ora_fine),
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ora fine</label>
                                        <input
                                            type="time"
                                            className="input"
                                            value={formData.ora_fine}
                                            onChange={e => {
                                                const ora_fine = e.target.value;
                                                setFormData(p => ({
                                                    ...p,
                                                    ora_fine,
                                                    durata_minuti: calcDurata(p.ora_inizio, ora_fine),
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Durata (min)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="input"
                                        placeholder="auto da orari"
                                        value={formData.durata_minuti}
                                        onChange={e => setFormData(p => ({ ...p, durata_minuti: e.target.value }))}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Motivo *</label>
                                    <select
                                        className="select-input"
                                        value={formData.motivo}
                                        onChange={e => setFormData(p => ({ ...p, motivo: e.target.value }))}
                                    >
                                        <option value="">— Seleziona —</option>
                                        {motiviFiltrati.map(m => (
                                            <option key={m.id} value={m.label}>{m.icona} {m.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Note</label>
                                    <input
                                        className="input"
                                        placeholder="Opzionale"
                                        value={formData.note}
                                        onChange={e => setFormData(p => ({ ...p, note: e.target.value }))}
                                    />
                                </div>

                                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                                    <button
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                        onClick={handleSaveFermo}
                                        disabled={saving}
                                    >
                                        {saving ? "Salvataggio..." : "Salva Fermo"}
                                    </button>
                                    <button className="btn btn-secondary" onClick={resetForm}>Annulla</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════════
                TAB 2 — PER TECNOLOGIA
            ════════════════════════════════════════════ */}
            {activeTab === 'tecnologia' && (
                <>
                    {/* Filtri date range */}
                    <div style={{ display: "flex", gap: 12, background: "var(--bg-card)", padding: 12, borderRadius: 8, border: "1px solid var(--border)", marginBottom: 24, alignItems: "flex-end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Dal</label>
                            <input type="date" value={tecFrom} onChange={e => setTecFrom(e.target.value)} className="input" style={{ width: 140 }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Al</label>
                            <input type="date" value={tecTo} onChange={e => setTecTo(e.target.value)} className="input" style={{ width: 140 }} />
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", paddingBottom: 6 }}>
                            {dateRange.length} giorni · <strong>{fermiTec.length}</strong> fermi totali
                        </div>
                    </div>

                    {loadingTec ? (
                        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 20 }}>
                            {tecnologie.map(tec => {
                                const s = stats[tec.id];
                                const cd = chartData[tec.id];
                                const motivoObj = s.motivoTop ? (motiviFermo.find(m => m.label === s.motivoTop) || motiviFermo.find(m => m.id === s.motivoTop)) : null;
                                const maxFermi = Math.max(...cd.map(d => d.fermi), 1);

                                return (
                                    <div key={tec.id} className="card" style={{ padding: 0, overflow: "hidden", opacity: s.totale === 0 ? 0.55 : 1 }}>
                                        {/* Card header */}
                                        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: tec.colore, flexShrink: 0 }} />
                                                <span style={{ fontWeight: 700, fontSize: 15 }}>{tec.label}</span>
                                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                                    {tec.prefissiArr?.length ? tec.prefissiArr.join(', ') + '*' : '—'}
                                                </span>
                                            </div>
                                            <span style={{
                                                background: s.totale > 0 ? tec.colore + '22' : 'var(--bg-tertiary)',
                                                color: s.totale > 0 ? tec.colore : 'var(--text-muted)',
                                                border: `1px solid ${s.totale > 0 ? tec.colore + '55' : 'var(--border)'}`,
                                                borderRadius: 20, padding: "2px 12px", fontSize: 13, fontWeight: 700
                                            }}>
                                                {s.totale} fermi
                                            </span>
                                        </div>

                                        {/* Stats row */}
                                        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
                                            <div style={{ flex: 1, padding: "10px 18px", borderRight: "1px solid var(--border)" }}>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Minuti fermi</div>
                                                <div style={{ fontSize: 20, fontWeight: 700, color: s.minuti > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                                                    {s.minuti > 0 ? s.minuti : "—"}
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, padding: "10px 18px" }}>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Motivo freq.</div>
                                                <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                                    {motivoObj ? <><span>{motivoObj.icona}</span><span>{motivoObj.label}</span></> : <span style={{ color: "var(--text-muted)" }}>—</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chart */}
                                        <div style={{ padding: "14px 8px 10px 0" }}>
                                            {s.totale === 0 ? (
                                                <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
                                                    Nessun fermo nel periodo
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height={110}>
                                                    <BarChart data={cd} margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barSize={dateRange.length > 10 ? 8 : 14}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                        <XAxis
                                                            dataKey="label"
                                                            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                                                            interval={dateRange.length > 10 ? Math.floor(dateRange.length / 7) : 0}
                                                            tickLine={false}
                                                            axisLine={false}
                                                        />
                                                        <YAxis
                                                            allowDecimals={false}
                                                            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                                                            tickLine={false}
                                                            axisLine={false}
                                                            width={24}
                                                            domain={[0, maxFermi]}
                                                        />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Bar dataKey="fermi" radius={[3, 3, 0, 0]} fill={tec.colore} fillOpacity={0.85} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
