import { useMemo, useState } from "react";
import { Icons } from "../components/ui/Icons";
import { getSlotForGroup } from "../lib/shiftRotation";

// Helper: Calcolo Pasqua (algoritmo di Gauss)
const getEaster = (year) => {
    const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);
    return new Date(year, month - 1, day);
};

// Helper: Riconosce Festività Nazionali
const isItalianHoliday = (d) => {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    if (month === 1 && day === 1) return true;
    if (month === 1 && day === 6) return true;
    if (month === 4 && day === 25) return true;
    if (month === 5 && day === 1) return true;
    if (month === 6 && day === 2) return true;
    if (month === 8 && day === 15) return true;
    if (month === 11 && day === 1) return true;
    if (month === 12 && day === 8) return true;
    if (month === 12 && day === 25) return true;
    if (month === 12 && day === 26) return true;

    const easter = getEaster(year);
    const pasquetta = new Date(easter);
    pasquetta.setDate(pasquetta.getDate() + 1);
    if (d.getTime() === pasquetta.getTime()) return true;

    return false;
};

export default function LimitazioniView({ dipendenti, presenze = [] }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);
    const [activeTab, setActiveTab] = useState("limitazioni"); // "limitazioni" | "assenze"

    const handleLogin = (e) => {
        e.preventDefault();
        // Simple client-side password for demo purposes. 
        if (password === "admin123") {
            setIsAuthenticated(true);
            setError(false);
        } else {
            setError(true);
            setPassword("");
        }
    };

    const limitazioniResults = useMemo(() => {
        return dipendenti.filter(d => d.l104 && d.l104.trim() !== "").map(d => ({
            persona: `${d.cognome} ${d.nome}`,
            reparto: d.reparto_id,
            tipo: d.tipo,
            turno: d.turno || d.turno_default || "D",
            limitazioni: d.l104
        }));
    }, [dipendenti]);

    const absenceStats = useMemo(() => {
        if (!presenze || presenze.length === 0) return [];

        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(`${currentYear}-01-01T00:00:00`);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        // Calculate generic expected working days from start of year to yesterday
        // A generic expected day is NOT a Sunday and NOT an Italian Holiday
        let expectedWorkDays = 0;
        let d = new Date(startOfYear);
        while (d <= yesterday) {
            const isSunday = d.getDay() === 0;
            if (!isSunday && !isItalianHoliday(d)) {
                expectedWorkDays++;
            }
            d.setDate(d.getDate() + 1);
        }

        // Filter valid absence records (from Jan 1st until yesterday, !presente)
        // Group by dipendente_id
        const absenceMap = {};
        for (const p of presenze) {
            const pDate = new Date(p.data);
            if (pDate >= startOfYear && pDate <= yesterday && !p.presente) {
                absenceMap[p.dipendente_id] = (absenceMap[p.dipendente_id] || 0) + 1;
            }
        }

        // Map over all dipendenti to calculate stats
        const stats = dipendenti.map(dip => {
            const absCount = absenceMap[dip.id] || 0;
            const percentage = expectedWorkDays > 0 ? ((absCount / expectedWorkDays) * 100).toFixed(1) : 0;

            return {
                ...dip,
                persona: `${dip.cognome} ${dip.nome}`,
                expectedDays: expectedWorkDays,
                absences: absCount,
                percentage: parseFloat(percentage)
            };
        });

        // Sort by highest absence percentage descending
        return stats.sort((a, b) => b.percentage - a.percentage);
    }, [dipendenti, presenze]);

    if (!isAuthenticated) {
        return (
            <div className="fade-in" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: 40 }}>
                <div className="card" style={{ maxWidth: 400, width: "100%", textAlign: "center", padding: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                    <h2 style={{ fontSize: 20, marginBottom: 8, color: "var(--text-primary)" }}>Accesso Ristretto</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
                        L'area "Privacy Alta" contiene dati medici e personali sensibili. Inserisci la password per continuare.
                    </p>

                    <form onSubmit={handleLogin}>
                        <div className="form-group" style={{ textAlign: "left" }}>
                            <input
                                type="password"
                                className={`input ${error ? 'input-error' : ''}`}
                                placeholder="Password..."
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                                style={{ width: "100%", borderColor: error ? "var(--danger)" : "var(--border)" }}
                                autoFocus
                            />
                            {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>Password errata</div>}
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 8 }}>
                            {Icons.key} Sblocca Area
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="card" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="alert alert-info" style={{ marginTop: 0, borderLeftColor: "var(--danger)", flex: 1, marginBottom: 0 }}>
                    <span style={{ fontSize: 16, marginRight: 8 }}>🩺</span>
                    <strong>AREA PRIVACY ALTA:</strong> Accesso a dati sensibili del personale (limitazioni mediche, L104, statistiche assenze).
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={() => setIsAuthenticated(false)}
                    style={{ marginLeft: 16, height: 36 }}
                    title="Blocca e torna alla schermata password"
                >
                    🔒 Blocca Schermo
                </button>
            </div>

            {/* TAB NAV */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                <button
                    className={`btn ${activeTab === "limitazioni" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setActiveTab("limitazioni")}
                    style={{ borderRadius: "8px" }}
                >
                    Limitazioni e Prescrizioni
                </button>
                <button
                    className={`btn ${activeTab === "assenze" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setActiveTab("assenze")}
                    style={{ borderRadius: "8px" }}
                >
                    Statistiche Assenze
                </button>
            </div>

            {/* TAB PANES */}
            {activeTab === "limitazioni" && (
                limitazioniResults.length > 0 ? (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: "left" }}>Dipendente</th>
                                    <th style={{ textAlign: "center" }}>Turno</th>
                                    <th style={{ textAlign: "left" }}>Limitazioni / Note (Dati Sensibili)</th>
                                    <th style={{ textAlign: "center" }}>Team</th>
                                </tr>
                            </thead>
                            <tbody>
                                {limitazioniResults.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                            {r.persona}
                                            {r.tipo === 'interinale' && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}> (Int.)</span>}
                                        </td>
                                        <td style={{ textAlign: "center", color: "var(--text-primary)", background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>{r.turno}</td>
                                        <td style={{ color: "var(--text-primary)", background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                            {r.limitazioni.split(',').map((tag, idx) => (
                                                <span key={idx} style={{ marginRight: 4, display: "inline-block", marginBottom: 2 }}>
                                                    {tag.trim()}{idx < r.limitazioni.split(',').length - 1 ? "," : ""}
                                                </span>
                                            ))}
                                        </td>
                                        <td style={{ textAlign: "center", color: "var(--text-muted)", background: r.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>{r.reparto}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="card" style={{ textAlign: "center", padding: 40 }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>🩺</div>
                        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                            Nessun dipendente con limitazioni o prescrizioni mediche nel sistema.
                        </p>
                    </div>
                )
            )}

            {activeTab === "assenze" && (
                <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Rapporto Assenze su Giorni Lavorativi</h3>
                        <span className="tag tag-blue" style={{ fontSize: 11, fontWeight: 700 }}>Da inizio anno ad oggi</span>
                    </div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                        Questa tabella calcola la percentuale di assenteismo di ogni dipendente. I "Giorni Lavorativi Previsti" sono
                        calcolati dal 1 Gennaio dell'anno in corso fino a ieri, escludendo le domeniche e le festività nazionali.
                    </p>
                    <div className="table-container" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                        <table>
                            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                                <tr>
                                    <th style={{ textAlign: "left", background: "var(--bg-tertiary)" }}>Dipendente</th>
                                    <th style={{ textAlign: "center", background: "var(--bg-tertiary)" }}>Team</th>
                                    <th style={{ textAlign: "center", background: "var(--bg-tertiary)" }}>Giorni Lavorativi Previsti</th>
                                    <th style={{ textAlign: "center", background: "var(--bg-tertiary)" }}>Totale Assenze</th>
                                    <th style={{ textAlign: "center", background: "var(--bg-tertiary)" }}>Tasso di Assenza</th>
                                </tr>
                            </thead>
                            <tbody>
                                {absenceStats.map((d, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                            {d.persona}
                                            {d.tipo === 'interinale' && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}> (Int.)</span>}
                                        </td>
                                        <td style={{ textAlign: "center", color: "var(--text-muted)", background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                            {d.reparto_id || "-"}
                                        </td>
                                        <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                            {d.expectedDays}
                                        </td>
                                        <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: d.absences > 0 ? 700 : 400, color: d.absences > 0 ? "var(--warning)" : "var(--text-muted)", background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                            {d.absences}
                                        </td>
                                        <td style={{ textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: d.percentage > 10 ? "var(--danger)" : "var(--success)", background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "transparent" }}>
                                            {d.percentage}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
