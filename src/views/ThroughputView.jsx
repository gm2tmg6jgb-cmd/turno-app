import { useState, useCallback } from "react";
import { THROUGHPUT_CONFIG } from "../data/constants";
import { computeThroughput, loadThroughputConfig, saveThroughputConfig } from "../utils/throughput";

export default function ThroughputView({ showToast }) {
    const [cfg, setCfg] = useState(() => loadThroughputConfig());
    const [editing, setEditing] = useState(false);
    // draft è una copia piatta editabile: { lotto, oeePercent, changeOverH, phases: [{phaseId, label, pzH, fixedH}] }
    const [draft, setDraft] = useState(null);

    const startEdit = () => {
        const key = Object.keys(cfg.components)[0];
        setDraft({
            lotto: cfg.lotto,
            oeePercent: Math.round(cfg.oee * 100),
            rackSize: cfg.rackSize ?? 72,
            // changeOverH per-fase: usa quello salvato o il default globale
            phases: cfg.components[key].map(p => ({
                ...p,
                changeOverH: p.noChangeOver ? 0 : (p.changeOverH ?? cfg.changeOverH)
            }))
        });
        setEditing(true);
    };

    const saveEdit = useCallback(() => {
        const key = Object.keys(cfg.components)[0];
        const newCfg = {
            lotto: Number(draft.lotto),
            oee: Number(draft.oeePercent) / 100,
            changeOverH: cfg.changeOverH, // mantieni il globale come fallback
            rackSize: Number(draft.rackSize),
            components: {
                [key]: draft.phases.map(p => ({
                    ...p,
                    pzH: p.fixedH != null ? null : Number(p.pzH),
                    fixedH: p.fixedH != null ? Number(p.fixedH) : null,
                    changeOverH: p.noChangeOver ? undefined : Number(p.changeOverH)
                }))
            }
        };
        saveThroughputConfig(newCfg);
        setCfg(newCfg);
        setEditing(false);
        showToast?.("Parametri salvati", "success");
    }, [draft, cfg, showToast]);

    const resetDefaults = () => {
        localStorage.removeItem("throughput_config");
        setCfg(THROUGHPUT_CONFIG);
        setEditing(false);
        showToast?.("Parametri ripristinati ai valori di default", "info");
    };

    const entries = Object.entries(cfg.components);

    return (
        <div style={{ padding: "32px", maxWidth: 960, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>
                        ⏱ Tempi di Attraversamento
                    </h2>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                        Formula: (Lotto ÷ (Pz/h × OEE)) + Change over
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {!editing ? (
                        <>
                            <button onClick={startEdit} className="btn" style={{
                                padding: "8px 16px", fontWeight: 700,
                                background: "var(--accent)", color: "white",
                                border: "none", borderRadius: 8, cursor: "pointer"
                            }}>✏️ Modifica Parametri</button>
                            <button onClick={resetDefaults} className="btn" style={{
                                padding: "8px 16px", fontWeight: 600,
                                background: "var(--bg-tertiary)", color: "var(--text-muted)",
                                border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer"
                            }}>↺ Reset Default</button>
                        </>
                    ) : (
                        <>
                            <button onClick={saveEdit} className="btn" style={{
                                padding: "8px 16px", fontWeight: 700,
                                background: "#22c55e", color: "white",
                                border: "none", borderRadius: 8, cursor: "pointer"
                            }}>✓ Salva</button>
                            <button onClick={() => setEditing(false)} className="btn" style={{
                                padding: "8px 16px", fontWeight: 600,
                                background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                                border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer"
                            }}>Annulla</button>
                        </>
                    )}
                </div>
            </div>

            {/* Parametri globali (visualizzazione o editing) */}
            <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "16px 24px", marginBottom: 24,
                display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center"
            }}>
                {editing ? (
                    <>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>LOTTO (pz)</span>
                            <input type="number" value={draft.lotto}
                                onChange={e => setDraft(d => ({ ...d, lotto: e.target.value }))}
                                style={inputStyle} />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>OEE (%)</span>
                            <input type="number" value={draft.oeePercent} min={1} max={100}
                                onChange={e => setDraft(d => ({ ...d, oeePercent: e.target.value }))}
                                style={inputStyle} />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>RACK SIZE (pz)</span>
                            <input type="number" value={draft.rackSize} min={1}
                                onChange={e => setDraft(d => ({ ...d, rackSize: e.target.value }))}
                                style={inputStyle} />
                        </label>
                    </>
                ) : (
                    <>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>LOTTO</div>
                            <div style={{ fontSize: 20, fontWeight: 900 }}>{cfg.lotto} pz</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>OEE</div>
                            <div style={{ fontSize: 20, fontWeight: 900 }}>{Math.round(cfg.oee * 100)}%</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>RACK SIZE</div>
                            <div style={{ fontSize: 20, fontWeight: 900 }}>{cfg.rackSize ?? 72} pz</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>T.T. CARICA</div>
                            <div style={{ fontSize: 20, fontWeight: 900 }}>
                                {cfg.components[Object.keys(cfg.components)[0]]?.find(p => p.chargeSize)?.chargeSize ?? 176} pz
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6, fontWeight: 400 }}>× {Math.ceil(cfg.lotto / (cfg.components[Object.keys(cfg.components)[0]]?.find(p => p.chargeSize)?.chargeSize ?? 176))} cariche</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Tabelle componenti */}
            {entries.map(([key]) => {
                const [proj, comp] = key.split("::");
                const phases = computeThroughput(key, cfg);
                const totalH = phases.at(-1)?.cumH || 0;
                const totalDays = (totalH / 24).toFixed(1);

                return (
                    <div key={key} style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 14, padding: "24px", marginBottom: 24
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                            <span style={{ background: "var(--accent)", color: "white", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{proj}</span>
                            <span style={{ fontWeight: 800, fontSize: 17 }}>{comp}</span>
                            <div style={{ marginLeft: "auto", textAlign: "right" }}>
                                <span style={{ fontSize: 26, fontWeight: 900, color: "var(--accent)" }}>{totalH}h</span>
                                <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>≈ {totalDays} giorni</span>
                            </div>
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-tertiary)" }}>
                                    <th style={thStyle("#")}>  #</th>
                                    <th style={thStyle("FASE")}>FASE</th>
                                    <th style={thStyle("right")}>PZ/H</th>
                                    <th style={thStyle("right")}>TEMPO LOTTO</th>
                                    <th style={thStyle("right")}>CHANGE OVER</th>
                                    <th style={thStyle("right")}>TOTALE FASE</th>
                                    <th style={thStyle("right")}>CUMULATO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(editing ? draft.phases : phases).map((p, i) => {
                                    const phase = editing ? p : p;
                                    const computed = editing
                                        ? computeThroughput(key, {
                                            ...cfg,
                                            lotto: Number(draft.lotto),
                                            oee: Number(draft.oeePercent) / 100,
                                            changeOverH: Number(draft.changeOverH),
                                            components: { [key]: draft.phases.map(dp => ({
                                                ...dp,
                                                pzH: dp.fixedH != null ? null : Number(dp.pzH),
                                                fixedH: dp.fixedH != null ? Number(dp.fixedH) : null
                                            })) }
                                        })[i]
                                        : p;

                                    const activeLotto = Number(editing ? draft.lotto : cfg.lotto);
                                    const activeOee = Number(editing ? draft.oeePercent / 100 : cfg.oee);
                                    // Tempo di solo processo (senza change over)
                                    const lottoH = phase.fixedH != null
                                        ? (phase.chargeSize
                                            ? Math.ceil(activeLotto / phase.chargeSize) * phase.fixedH
                                            : phase.fixedH)
                                        : +(activeLotto / (Number(phase.pzH) * activeOee)).toFixed(1);
                                    const coH = phase.noChangeOver ? 0 : Number(editing ? draft.phases[i].changeOverH : (phase.changeOverH ?? cfg.changeOverH));

                                    const barWidth = Math.round((computed.h / totalH) * 100);

                                    return (
                                        <tr key={phase.phaseId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "12px", fontSize: 12, color: "var(--text-muted)" }}>{i + 1}</td>
                                            <td style={{ padding: "12px" }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{phase.label}</div>
                                                <div style={{ marginTop: 4, height: 4, borderRadius: 4, background: "var(--bg-tertiary)", width: "100%", maxWidth: 200 }}>
                                                    <div style={{ height: 4, borderRadius: 4, background: "var(--accent)", width: `${barWidth}%` }} />
                                                </div>
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right" }}>
                                                {editing ? (
                                                    phase.fixedH != null ? (
                                                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>fisso</span>
                                                    ) : (
                                                        <input type="number" value={draft.phases[i].pzH}
                                                            onChange={e => setDraft(d => {
                                                                const phases = [...d.phases];
                                                                phases[i] = { ...phases[i], pzH: e.target.value };
                                                                return { ...d, phases };
                                                            })}
                                                            style={{ ...inputStyle, width: 70, textAlign: "right" }} />
                                                    )
                                                ) : (
                                                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{phase.pzH ?? "—"}</span>
                                                )}
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right" }}>
                                                {editing ? (
                                                    phase.fixedH != null ? (
                                                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                                                            <input type="number" value={draft.phases[i].fixedH}
                                                                onChange={e => setDraft(d => {
                                                                    const phases = [...d.phases];
                                                                    phases[i] = { ...phases[i], fixedH: e.target.value };
                                                                    return { ...d, phases };
                                                                })}
                                                                style={{ ...inputStyle, width: 60, textAlign: "right" }} />
                                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>h fisso</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{isNaN(lottoH) ? "—" : `${lottoH}h`}</span>
                                                    )
                                                ) : (
                                                    <span style={{ fontSize: 13 }}>
                                                        {phase.fixedH != null
                                                            ? (phase.chargeSize
                                                                ? `${Math.ceil(activeLotto / phase.chargeSize)} × ${phase.fixedH}h = ${lottoH}h`
                                                                : `${phase.fixedH}h fisso`)
                                                            : `${lottoH}h`}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right" }}>
                                                {phase.noChangeOver
                                                    ? <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                                                    : editing
                                                        ? <input type="number" value={draft.phases[i].changeOverH} min={0} step={0.5}
                                                            onChange={e => setDraft(d => {
                                                                const phases = [...d.phases];
                                                                phases[i] = { ...phases[i], changeOverH: e.target.value };
                                                                return { ...d, phases };
                                                            })}
                                                            style={{ ...inputStyle, width: 60, textAlign: "right" }} />
                                                        : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{coH}h</span>
                                                }
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--accent)" }}>
                                                {computed.h}h
                                            </td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>
                                                {computed.cumH}h
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: "var(--bg-tertiary)", borderTop: "2px solid var(--border)" }}>
                                    <td colSpan={5} style={{ padding: "12px", fontWeight: 800, fontSize: 14 }}>TOTALE</td>
                                    <td style={{ padding: "12px", textAlign: "right", fontSize: 16, fontWeight: 900, color: "var(--accent)" }}>{totalH}h</td>
                                    <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>≈ {totalDays} gg</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}

const inputStyle = {
    padding: "6px 10px", borderRadius: 6, fontSize: 14, fontWeight: 700,
    background: "var(--bg-tertiary)", border: "1px solid var(--accent)",
    color: "var(--text-primary)", width: 90, outline: "none"
};

const thStyle = () => ({
    padding: "10px 12px", textAlign: "right", fontSize: 11,
    color: "var(--text-muted)", fontWeight: 700
});
