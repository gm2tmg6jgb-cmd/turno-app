import { useState, useMemo } from "react";
import { MOTIVI_ASSENZA } from "../data/constants";
import { Icons } from "../components/ui/Icons";

export default function AbsenzeStoricoView({
    dipendenti, presenze, showToast
}) {
    const [selectedDipId, setSelectedDipId] = useState("");
    const [dateRangeFrom, setDateRangeFrom] = useState("");
    const [dateRangeTo, setDateRangeTo] = useState("");
    const [filterMotivo, setFilterMotivo] = useState("all");

    // Get selected employee
    const selectedEmployee = useMemo(() => {
        if (!selectedDipId) return null;
        return dipendenti.find(d => d.id === selectedDipId);
    }, [selectedDipId, dipendenti]);

    // Filter and sort absences
    const filteredAbsences = useMemo(() => {
        if (!selectedEmployee) return [];

        return presenze
            .filter(p => p.dipendente_id === selectedDipId && !p.presente)
            .filter(p => {
                if (dateRangeFrom && p.data < dateRangeFrom) return false;
                if (dateRangeTo && p.data > dateRangeTo) return false;
                if (filterMotivo !== "all" && p.motivo_assenza !== filterMotivo) return false;
                return true;
            })
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    }, [selectedDipId, presenze, dateRangeFrom, dateRangeTo, filterMotivo, selectedEmployee]);

    // Summary statistics
    const stats = useMemo(() => {
        if (!selectedEmployee) return null;

        const allAbsences = presenze.filter(p =>
            p.dipendente_id === selectedDipId && !p.presente
        );

        const plannedReasons = ['ferie', 'rol', 'riposo_compensativo'];
        const planned = allAbsences.filter(a =>
            plannedReasons.includes(a.motivo_assenza)
        ).length;
        const unplanned = allAbsences.length - planned;

        // Count by reason
        const byReason = {};
        allAbsences.forEach(a => {
            byReason[a.motivo_assenza] = (byReason[a.motivo_assenza] || 0) + 1;
        });

        const topReason = Object.entries(byReason)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            total: allAbsences.length,
            planned,
            unplanned,
            unplannedPercent: allAbsences.length > 0
                ? ((unplanned / allAbsences.length) * 100).toFixed(1)
                : 0,
            topReason: topReason ? topReason[0] : null,
            topReasonCount: topReason ? topReason[1] : 0
        };
    }, [selectedDipId, presenze, selectedEmployee]);

    // Get motivo info for display
    const getMotivoInfo = (motivoId) => {
        return MOTIVI_ASSENZA.find(m => m.id === motivoId);
    };

    return (
        <div className="fade-in" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>
                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                    <span style={{ flexShrink: 0 }}>{Icons.clock}</span>
                    Visualizza lo storico completo delle assenze per ogni dipendente con analisi dettagliate e filtri avanzati.
                </div>

                {/* Employee Selection */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label">Seleziona Dipendente</label>
                    <select
                        className="select-input"
                        value={selectedDipId}
                        onChange={(e) => setSelectedDipId(e.target.value)}
                    >
                        <option value="">-- Scegli un dipendente --</option>
                        {dipendenti
                            .sort((a, b) =>
                                a.cognome.localeCompare(b.cognome) ||
                                a.nome.localeCompare(b.nome)
                            )
                            .map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.cognome} {d.nome} - {d.reparto_id}
                                </option>
                            ))}
                    </select>
                </div>

                {selectedEmployee && stats && (
                    <>
                        {/* Summary Stats Cards */}
                        <div className="card" style={{ marginBottom: 20, padding: 16 }}>
                            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
                                📊 Riepilogo Assenze - {selectedEmployee.cognome} {selectedEmployee.nome}
                            </h3>

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                                gap: 12
                            }}>
                                {/* Total Absences */}
                                <div style={{
                                    background: "var(--bg-tertiary)",
                                    padding: 12,
                                    borderRadius: 6,
                                    textAlign: "center"
                                }}>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                                        Totale Assenze
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
                                        {stats.total}
                                    </div>
                                </div>

                                {/* Planned */}
                                <div style={{
                                    background: "rgba(16, 185, 129, 0.1)",
                                    padding: 12,
                                    borderRadius: 6,
                                    textAlign: "center",
                                    borderLeft: "3px solid #10B981"
                                }}>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                                        Pianificate
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: "#10B981" }}>
                                        {stats.planned}
                                    </div>
                                </div>

                                {/* Unplanned */}
                                <div style={{
                                    background: "rgba(239, 68, 68, 0.1)",
                                    padding: 12,
                                    borderRadius: 6,
                                    textAlign: "center",
                                    borderLeft: "3px solid #EF4444"
                                }}>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                                        Non Pianificate
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: "#EF4444" }}>
                                        {stats.unplanned}
                                    </div>
                                </div>

                                {/* Percentage */}
                                <div style={{
                                    background: "var(--bg-tertiary)",
                                    padding: 12,
                                    borderRadius: 6,
                                    textAlign: "center"
                                }}>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                                        % Non Pianificate
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
                                        {stats.unplannedPercent}%
                                    </div>
                                </div>

                                {/* Top Reason */}
                                {stats.topReason && (
                                    <div style={{
                                        background: "var(--bg-tertiary)",
                                        padding: 12,
                                        borderRadius: 6,
                                        textAlign: "center"
                                    }}>
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                                            Motivo Principale
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                                            {getMotivoInfo(stats.topReason)?.icona} {getMotivoInfo(stats.topReason)?.label}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                            {stats.topReasonCount} volte
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="card" style={{ marginBottom: 20, padding: 16 }}>
                            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700 }}>
                                🔍 Filtri
                            </h3>

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: 12
                            }}>
                                <div>
                                    <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                                        Da
                                    </label>
                                    <input
                                        type="date"
                                        className="select-input"
                                        value={dateRangeFrom}
                                        onChange={(e) => setDateRangeFrom(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                                        A
                                    </label>
                                    <input
                                        type="date"
                                        className="select-input"
                                        value={dateRangeTo}
                                        onChange={(e) => setDateRangeTo(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                                        Motivo
                                    </label>
                                    <select
                                        className="select-input"
                                        value={filterMotivo}
                                        onChange={(e) => setFilterMotivo(e.target.value)}
                                    >
                                        <option value="all">Tutti i motivi</option>
                                        {MOTIVI_ASSENZA.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.icona} {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Absences Table */}
                        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                            <h3 style={{ padding: "16px 16px 0", marginBottom: 12, marginTop: 0, fontSize: 14, fontWeight: 700 }}>
                                📋 Storico Assenze ({filteredAbsences.length})
                            </h3>

                            {filteredAbsences.length > 0 ? (
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                                            <th style={{
                                                padding: "10px 12px",
                                                textAlign: "left",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: "var(--text-secondary)"
                                            }}>
                                                Data
                                            </th>
                                            <th style={{
                                                padding: "10px 12px",
                                                textAlign: "left",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: "var(--text-secondary)"
                                            }}>
                                                Turno
                                            </th>
                                            <th style={{
                                                padding: "10px 12px",
                                                textAlign: "left",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: "var(--text-secondary)"
                                            }}>
                                                Motivo
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAbsences.map((assenza) => {
                                            const motivo = getMotivoInfo(assenza.motivo_assenza);
                                            return (
                                                <tr
                                                    key={assenza.id}
                                                    style={{
                                                        borderBottom: "1px solid var(--border)",
                                                        "&:hover": { background: "var(--bg-tertiary)" }
                                                    }}
                                                >
                                                    <td style={{
                                                        padding: "12px 12px",
                                                        fontSize: 14,
                                                        color: "var(--text-primary)"
                                                    }}>
                                                        {new Date(assenza.data).toLocaleDateString('it-IT', {
                                                            weekday: 'short',
                                                            year: 'numeric',
                                                            month: '2-digit',
                                                            day: '2-digit'
                                                        })}
                                                    </td>
                                                    <td style={{
                                                        padding: "12px 12px",
                                                        fontSize: 14,
                                                        color: "var(--text-primary)"
                                                    }}>
                                                        {assenza.turno_id}
                                                    </td>
                                                    <td style={{
                                                        padding: "12px 12px",
                                                        fontSize: 14
                                                    }}>
                                                        <span style={{
                                                            color: motivo?.colore || "var(--text-primary)",
                                                            fontWeight: 500
                                                        }}>
                                                            {motivo?.icona} {motivo?.label || assenza.motivo_assenza}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ padding: "16px 12px", color: "var(--text-muted)", textAlign: "center", fontSize: 14 }}>
                                    {selectedEmployee
                                        ? "Nessuna assenza trovata con i filtri selezionati"
                                        : "Seleziona un dipendente"}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {!selectedEmployee && (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                        {Icons.info} Seleziona un dipendente per visualizzare lo storico delle assenze
                    </div>
                )}
            </div>
        </div>
    );
}
