import { useState, useEffect } from "react";
import { SECTIONS, STORAGE_KEY } from "../data/weisserPrioritiesConstants";

// ── Helpers ──────────────────────────────────────────────────────────────────
function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr() {
    return localDateStr(new Date());
}

function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

/** Costruisce lo stato iniziale per una macchina */
function initMachine(machine) {
    const items = machine.priorities.map((p, i) => ({
        id: `${machine.id}-${i}`,
        component: p.component,
        material: p.material,
        cancelled: p.cancelled || false,
        completed: false,
        lotto: "",
        prodotti: "",
        turno: "",
    }));
    const curIdx = machine.priorities.findIndex(p => p.defaultCurrent && !p.cancelled);
    if (curIdx > 0) {
        const [cur] = items.splice(curIdx, 1);
        items.unshift(cur);
    }
    return { items };
}

/** Stato di default per tutte le macchine */
function buildDefaultStates() {
    const s = {};
    SECTIONS.forEach(sec => sec.machines.forEach(m => { s[m.id] = initMachine(m); }));
    return s;
}

/**
 * Ritorna lo stato per una data.
 * Se non esiste, clona dal giorno più recente disponibile (senza lotto/turno/completed).
 * Se non c'è nessun giorno, usa i default.
 */
function getOrInitDate(allData, dateStr) {
    if (allData[dateStr]) return allData[dateStr];

    const sortedDates = Object.keys(allData).sort().reverse();
    if (sortedDates.length > 0) {
        const prev = allData[sortedDates[0]];
        const cloned = {};
        Object.entries(prev).forEach(([machineId, ms]) => {
            cloned[machineId] = {
                items: ms.items
                    .filter(it => !it.completed)
                    .map(it => ({ ...it, completed: false, lotto: "", prodotti: "", turno: "" })),
            };
        });
        return cloned;
    }

    return buildDefaultStates();
}

/** Calcola n e isCurrent in base alla posizione */
function withRanks(items) {
    const firstActive = items.findIndex(x => !x.cancelled && !x.completed);
    let rank = 0;
    return items.map((item, idx) => {
        if (!item.cancelled && !item.completed) {
            rank++;
            return { ...item, n: rank, isCurrent: idx === firstActive };
        }
        return { ...item, n: "—", isCurrent: false };
    });
}

// ── Componente card singola macchina ─────────────────────────────────────────
function MachineCard({ machineId, machineNote, state, accentColor, readOnly, turnoCorrente, onMoveUp, onMoveDown, onComplete, onUpdate, onReset, onAddItem }) {
    const displayed = withRanks(state.items);
    const [adding, setAdding] = useState(false);
    const [newComp, setNewComp] = useState("");
    const [newMat, setNewMat] = useState("");

    function handleAdd() {
        if (!newMat.trim()) return;
        onAddItem(machineId, { component: newComp.trim(), material: newMat.trim() });
        setNewComp("");
        setNewMat("");
        setAdding(false);
    }

    return (
        <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            {/* Header */}
            <div style={{ padding: "8px 12px", background: accentColor, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
                    {machineId} {displayed.find(p => p.isCurrent) ? ` — ${displayed.find(p => p.isCurrent).component} ${displayed.find(p => p.isCurrent).material}` : ""}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {machineNote && (
                        <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", padding: "2px 7px", borderRadius: 4 }}>{machineNote}</span>
                    )}
                    {!readOnly && (
                        <>
                            <button
                                onClick={() => setAdding(a => !a)}
                                title="Aggiungi nuova priorità"
                                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 14, cursor: "pointer", fontWeight: 700, lineHeight: 1.4 }}
                            >+</button>
                            <button
                                onClick={() => onReset(machineId)}
                                title="Ripristina ordine originale"
                                style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 12, cursor: "pointer" }}
                            >↺</button>
                        </>
                    )}
                </div>
            </div>

            {/* Lista priorità */}
            <div>
                {displayed.map((p, i) => {
                    const isTurnoAttivo = turnoCorrente && p.turno === turnoCorrente && !p.completed && !p.cancelled;
                    return (
                        <div
                            key={p.id ?? `${p.material}-${i}`}
                            style={{
                                padding: "7px 10px",
                                background: isTurnoAttivo ? "rgba(239,68,68,0.08)" : p.isCurrent ? "rgba(255,214,0,0.13)" : "transparent",
                                borderLeft: isTurnoAttivo ? "3px solid #EF4444" : p.isCurrent ? "3px solid #FFD600" : "3px solid transparent",
                                borderBottom: i < displayed.length - 1 ? "1px solid var(--border-light)" : "none",
                                opacity: p.completed ? 0.45 : 1,
                            }}
                        >
                            {/* Riga principale */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                                <span style={{
                                    minWidth: 22, height: 22, borderRadius: "50%",
                                    background: p.isCurrent ? "#FFD600" : "var(--bg-tertiary)",
                                    border: "1px solid var(--border)",
                                    color: p.isCurrent ? "#333" : "var(--text-muted)",
                                    fontSize: 11, fontWeight: 700,
                                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                                }}>{p.n}</span>

                                <span style={{
                                    fontSize: 12, fontFamily: "monospace", fontWeight: p.isCurrent ? 700 : 500,
                                    color: p.cancelled ? "var(--text-lighter)" : p.isCurrent ? "var(--text-primary)" : "var(--text-secondary)",
                                    textDecoration: p.cancelled ? "line-through" : "none",
                                    flex: 1, minWidth: 0,
                                }}>
                                    {p.component ? `${p.component} - ${p.material}` : p.material}
                                </span>

                                {isTurnoAttivo && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "#EF4444", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
                                        ⚠ Cambia!
                                    </span>
                                )}
                                {!readOnly && (p.isCurrent ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "#b8860b", background: "rgba(255,214,0,0.3)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                                            IN CORSO
                                        </span>
                                        <button
                                            onClick={() => onComplete(machineId, i)}
                                            title="Segna come completato"
                                            style={{ background: "#22c55e", border: "none", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 12, cursor: "pointer", fontWeight: 700, lineHeight: 1.4 }}
                                        >✓</button>
                                    </div>
                                ) : (!p.cancelled && !p.completed && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                                        {i > 0 && (
                                            <button
                                                onClick={() => onMoveUp(machineId, i)}
                                                title="Sposta su di una posizione"
                                                style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: "1px 6px", fontSize: 13, cursor: "pointer", flexShrink: 0, lineHeight: 1.4 }}
                                            >↑</button>
                                        )}
                                        {i < displayed.length - 1 && (
                                            <button
                                                onClick={() => onMoveDown(machineId, i)}
                                                title="Sposta giù di una posizione"
                                                style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: "1px 6px", fontSize: 13, cursor: "pointer", flexShrink: 0, lineHeight: 1.4 }}
                                            >↓</button>
                                        )}
                                    </div>
                                )))}
                            </div>

                            {/* Lotto + Turno (solo se non completato, non readOnly e NON è l'item in attesa di cambio turno) */}
                            {!p.completed && !readOnly && (!isTurnoAttivo || p.isCurrent) && (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 30 }}>
                                    <input
                                        type="number" min="0" placeholder="pz."
                                        value={p.lotto}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => onUpdate(machineId, i, "lotto", e.target.value)}
                                        style={{ width: 64, padding: "3px 6px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none" }}
                                    />
                                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Prodotti</span>
                                    <input
                                        type="number" min="0" placeholder="pz."
                                        value={p.prodotti || ""}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => onUpdate(machineId, i, "prodotti", e.target.value)}
                                        style={{ width: 64, padding: "3px 6px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none" }}
                                    />
                                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Turno C/O</span>
                                    <select
                                        value={p.turno}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => onUpdate(machineId, i, "turno", e.target.value)}
                                        style={{ padding: "3px 6px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: p.turno ? "var(--text-primary)" : "var(--text-muted)", outline: "none" }}
                                    >
                                        <option value="">—</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Form aggiungi nuova priorità */}
            {adding && (
                <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        autoFocus
                        placeholder="Componente"
                        value={newComp}
                        onChange={e => setNewComp(e.target.value)}
                        style={{ width: 80, padding: "4px 7px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }}
                    />
                    <input
                        placeholder="Codice materiale"
                        value={newMat}
                        onChange={e => setNewMat(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
                        style={{ flex: 1, minWidth: 100, padding: "4px 7px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }}
                    />
                    <button onClick={handleAdd} style={{ background: accentColor, border: "none", color: "#fff", borderRadius: 5, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                        Aggiungi
                    </button>
                    <button onClick={() => setAdding(false)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}

// ── View principale ───────────────────────────────────────────────────────────
export default function WeisserPrioritiesView({ turnoCorrente }) {
    const today = getTodayStr();

    // Tutto il dato storico: { "2026-03-05": { machineId: { items } }, ... }
    const [allData, setAllData] = useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch { }
        // Migrazione da v1 (senza date)
        try {
            const old = localStorage.getItem("weisser-priorities");
            if (old) {
                const parsed = JSON.parse(old);
                return { [today]: parsed };
            }
        } catch { }
        return {};
    });

    const [currentDate, setCurrentDate] = useState(today);

    // Stato per la data corrente (lazy init se non esiste)
    const states = allData[currentDate] ?? getOrInitDate(allData, currentDate);

    // Se la data corrente non è ancora nell'allData, la salviamo subito
    useEffect(() => {
        if (!allData[currentDate]) {
            setAllData(prev => ({ ...prev, [currentDate]: states }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);

    // Persiste ad ogni modifica
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
    }, [allData]);

    const isToday = currentDate === today;
    const readOnly = !isToday;

    // Macchine che hanno almeno un item con turno === turnoCorrente (non completato, non cancellato)
    const groupedReminders = turnoCorrente
        ? SECTIONS.map(s => {
            const sectionReminders = s.machines.map(m => {
                const ms = states[m.id];
                if (!ms) return null;
                const item = ms.items.find(it => it.turno === turnoCorrente && !it.completed && !it.cancelled);
                if (!item) return null;
                return { id: m.id, component: item.component, material: item.material };
            }).filter(Boolean);

            return sectionReminders.length > 0 ? { label: s.label, color: s.color, items: sectionReminders } : null;
        }).filter(Boolean)
        : [];

    // Navigazione date
    function prevDate() {
        const [y, m, d] = currentDate.split("-").map(Number);
        setCurrentDate(localDateStr(new Date(y, m - 1, d - 1)));
    }
    function nextDate() {
        const [y, m, d] = currentDate.split("-").map(Number);
        const str = localDateStr(new Date(y, m - 1, d + 1));
        if (str <= today) setCurrentDate(str);
    }

    function updateStates(updater) {
        setAllData(prev => ({
            ...prev,
            [currentDate]: updater(prev[currentDate] ?? getOrInitDate(prev, currentDate)),
        }));
    }

    const moveUp = (machineId, idx) => {
        if (idx === 0) return;
        updateStates(prev => {
            const ms = prev[machineId];
            if (ms.items[idx].cancelled) return prev;
            const newItems = [...ms.items];
            [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
            return { ...prev, [machineId]: { ...ms, items: newItems } };
        });
    };

    // Move a priority down one position (if not last)
    const moveDown = (machineId, idx) => {
        updateStates(prev => {
            const ms = prev[machineId];
            // Ensure not last item and not cancelled
            if (idx >= ms.items.length - 1) return prev;
            if (ms.items[idx].cancelled) return prev;
            const newItems = [...ms.items];
            [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
            return { ...prev, [machineId]: { ...ms, items: newItems } };
        });
    };

    const complete = (machineId, idx) => {
        updateStates(prev => {
            const ms = prev[machineId];
            const newItems = [...ms.items];
            const [done] = newItems.splice(idx, 1);
            newItems.push({ ...done, completed: true, lotto: "", prodotti: "", turno: "" });
            return { ...prev, [machineId]: { ...ms, items: newItems } };
        });
    };

    const update = (machineId, itemIdx, field, value) => {
        updateStates(prev => {
            const ms = prev[machineId];
            const newItems = ms.items.map((it, i) => i === itemIdx ? { ...it, [field]: value } : it);
            return { ...prev, [machineId]: { ...ms, items: newItems } };
        });
    };

    const reset = (machineId) => {
        const machine = SECTIONS.flatMap(s => s.machines).find(m => m.id === machineId);
        if (machine) updateStates(prev => ({ ...prev, [machineId]: initMachine(machine) }));
    };

    const addItem = (machineId, { component, material }) => {
        updateStates(prev => {
            const ms = prev[machineId];
            const newItem = { id: `${machineId}-add-${Date.now()}`, component, material, cancelled: false, completed: false, lotto: "", prodotti: "", turno: "" };
            return { ...prev, [machineId]: { ...ms, items: [...ms.items, newItem] } };
        });
    };

    const confirmChange = (machineId, itemIdx) => {
        updateStates(prev => {
            const ms = prev[machineId];
            if (!ms) return prev;
            const newItems = ms.items.map((it, i) => {
                if (i < itemIdx && !it.completed && !it.cancelled) {
                    return { ...it, completed: true, lotto: "", prodotti: "", turno: "" };
                }
                return it;
            });
            return { ...prev, [machineId]: { ...ms, items: newItems } };
        });
    };

    const postponeChange = (machineId, itemIdx) => {
        const shifts = ["A", "B", "C", "D"];
        updateStates(prev => {
            const ms = prev[machineId];
            if (!ms) return prev;
            const newItems = ms.items.map((it, i) => {
                if (i === itemIdx) {
                    const currentShiftIdx = shifts.indexOf(it.turno || "A");
                    const nextShift = shifts[(currentShiftIdx + 1) % shifts.length];
                    return { ...it, turno: nextShift };
                }
                return it;
            });
            return { ...prev, [machineId]: { ...ms, items: newItems } };
        });
    };

    const availableDates = Object.keys(allData).sort().reverse();

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", padding: "16px 20px", paddingBottom: 32 }}>
            {/* Header */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Priorità Macchine</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                        {readOnly ? "Vista storica — sola lettura" : "↑ sposta su · ✓ completato · + aggiungi · ↺ ripristina"}
                    </p>
                </div>

                {/* Navigatore data */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                        onClick={prevDate}
                        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 6, padding: "5px 10px", fontSize: 14, cursor: "pointer" }}
                    >‹</button>

                    <div style={{
                        padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                        background: isToday ? "var(--accent, #3c6ef0)" : "var(--bg-secondary)",
                        color: isToday ? "#fff" : "var(--text-primary)",
                        border: "1px solid var(--border)",
                        minWidth: 110, textAlign: "center",
                    }}>
                        {isToday ? "Oggi" : formatDateLabel(currentDate)}
                        {!isToday && (
                            <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>
                                {formatDateLabel(currentDate)}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={nextDate}
                        disabled={currentDate >= today}
                        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: currentDate >= today ? "var(--text-lighter)" : "var(--text-primary)", borderRadius: 6, padding: "5px 10px", fontSize: 14, cursor: currentDate >= today ? "default" : "pointer" }}
                    >›</button>

                    {!isToday && (
                        <button
                            onClick={() => setCurrentDate(today)}
                            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}
                        >Oggi</button>
                    )}

                    {/* Selettore data da lista giorni disponibili */}
                    {availableDates.length > 1 && (
                        <select
                            value={currentDate}
                            onChange={e => setCurrentDate(e.target.value)}
                            style={{ padding: "5px 8px", fontSize: 11, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                        >
                            {availableDates.map(d => (
                                <option key={d} value={d}>{d === today ? `Oggi (${formatDateLabel(d)})` : formatDateLabel(d)}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Banner sola lettura */}
            {readOnly && (
                <div style={{ marginBottom: 16, padding: "8px 14px", background: "rgba(255,200,0,0.12)", border: "1px solid rgba(255,200,0,0.35)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📅</span>
                    <span>Stai visualizzando le priorità del <strong>{formatDateLabel(currentDate)}</strong> — modalità sola lettura.</span>
                    <button onClick={() => setCurrentDate(today)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--accent, #3c6ef0)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        Torna ad oggi →
                    </button>
                </div>
            )}

            {/* Banner "Ricordati di Cambiare" */}
            {groupedReminders.length > 0 && (
                <div style={{
                    marginBottom: 24,
                    padding: "16px 20px",
                    background: "rgba(239,68,68,0.06)",
                    border: "2px solid #EF4444",
                    borderRadius: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 24 }}>⚠</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#b91c1c" }}>
                            RICORDATI DI CAMBIARE (Turno {turnoCorrente})
                        </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                        {groupedReminders.map(section => (
                            <div key={section.label} style={{ flex: "1 1 auto", minWidth: 250 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${section.color}` }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: section.color }} />
                                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", textTransform: "uppercase" }}>{section.label}</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {section.items.map(rem => (
                                        <div key={rem.id} style={{
                                            background: "#EF4444",
                                            color: "#fff",
                                            padding: "8px 12px",
                                            borderRadius: 8,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            boxShadow: "0 2px 4px rgba(239,68,68,0.2)"
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 800 }}>{rem.id}</div>
                                                <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>{rem.component} — {rem.material}</div>
                                            </div>
                                            <div style={{ display: "flex", gap: 4 }}>
                                                <button
                                                    onClick={() => confirmChange(rem.id, states[rem.id].items.findIndex(it => it.material === rem.material && it.turno === turnoCorrente))}
                                                    style={{ background: "#fff", color: "#EF4444", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                                                >OK</button>
                                                <button
                                                    onClick={() => postponeChange(rem.id, states[rem.id].items.findIndex(it => it.material === rem.material && it.turno === turnoCorrente))}
                                                    style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                                                >RIMANDA</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sezioni per tecnologia — layout orizzontale */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {SECTIONS.map(section => (
                    <div key={section.label}>
                        {/* Intestazione sezione */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <div style={{ width: 4, height: 20, borderRadius: 2, background: section.color }} />
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{section.label}</h2>
                        </div>
                        {/* Macchine in riga orizzontale */}
                        <div style={{ display: "flex", flexDirection: "row", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                            {section.machines.map(machine => (
                                <div key={machine.id} style={{ minWidth: 260, flex: "0 0 auto" }}>
                                    <MachineCard
                                        machineId={machine.id}
                                        machineNote={machine.note}
                                        state={states[machine.id] || initMachine(machine)}
                                        accentColor={section.color}
                                        readOnly={readOnly}
                                        turnoCorrente={turnoCorrente}
                                        onMoveUp={moveUp}
                                        onMoveDown={moveDown}
                                        onComplete={complete}
                                        onUpdate={update}
                                        onReset={reset}
                                        onAddItem={addItem}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
