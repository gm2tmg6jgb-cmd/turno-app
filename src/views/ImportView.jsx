import { useState } from "react";
import { Icons } from "../components/ui/Icons";

export default function ImportView({ showToast }) {
    const [dragOver, setDragOver] = useState(false);
    const [imported, setImported] = useState(false);

    return (
        <div className="fade-in">
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <div className="card-title">{Icons.upload} Import Dati SAP</div>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                    Carica file Excel esportati da SAP per importare dati produttivi e associarli ai turni.
                    Il sistema mapperà automaticamente i Work Center SAP alle macchine della webapp.
                </p>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); setImported(true); showToast("File importato con successo", "success"); }}
                    style={{
                        border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-light)"}`,
                        borderRadius: "var(--radius-lg)",
                        padding: "48px 20px",
                        textAlign: "center",
                        background: dragOver ? "var(--accent-muted)" : "var(--bg-tertiary)",
                        transition: "var(--transition)",
                        cursor: "pointer",
                    }}
                    onClick={() => { setImported(true); showToast("File importato (simulazione)", "success"); }}
                >
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{Icons.upload}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                        Trascina qui il file Excel o clicca per selezionare
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Formati supportati: .xlsx, .xls — Max 10MB
                    </div>
                </div>
            </div>

            {imported && (
                <div className="card fade-in">
                    <div className="alert alert-success">
                        <span>{Icons.check}</span>
                        File importato con successo. 248 righe lette, 12 macchine mappate.
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Work Center SAP</th>
                                    <th>Macchina Webapp</th>
                                    <th>Righe Importate</th>
                                    <th>Stato</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ["FRW14410", "Tornio CNC 1", 22, true],
                                    ["FRW14411", "Tornio CNC 2", 18, true],
                                    ["SLA14335", "Hobbing CNC", 34, true],
                                    ["DEN14220", "Dentatrice Gleason", 28, true],
                                    ["RET14500", "Rettifica Studer", 16, true],
                                    ["LWD14600", "Laser Welding", 41, true],
                                    ["ASS14700", "Linea Assemblaggio 1", 52, true],
                                    ["UNKNOWN1", "—", 8, false],
                                ].map(([sap, webapp, righe, ok], i) => (
                                    <tr key={i}>
                                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{sap}</td>
                                        <td style={{ fontWeight: ok ? 600 : 400, color: ok ? "var(--text-primary)" : "var(--text-muted)" }}>{webapp}</td>
                                        <td>{righe}</td>
                                        <td><span className={`tag ${ok ? "tag-green" : "tag-red"}`}>{ok ? "Mappato" : "Non mappato"}</span></td>
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
