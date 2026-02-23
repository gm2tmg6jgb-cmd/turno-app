import fs from 'fs';
let content = fs.readFileSync('src/views/ReportView.jsx', 'utf-8');

// 1. Remove pie chart
const pieChartRegex = /<div className="card" style={{ height: 320 }}>\s*<h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Distribuzione Presenze<\/h3>\s*<ResponsiveContainer width="100%" height="80%">\s*<PieChart>[\s\S]*?<\/PieChart>\s*<\/ResponsiveContainer>\s*<\/div>/g;
content = content.replace(pieChartRegex, '');

// Adjust grid template columns for the remaining chart
content = content.replace(
`<div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>`,
`<div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>`
);

// 2. Report table headers
content = content.replace(
`                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: "8px 12px", width: "40%", textAlign: "left" }}>Macchina / Zona</th>
                                                        <th style={{ padding: "8px 12px", width: "40%", textAlign: "left" }}>Operatore</th>
                                                        <th style={{ padding: "8px 12px", width: "20%", textAlign: "center" }}>Stato</th>
                                                    </tr>
                                                </thead>`,
`                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: "8px 12px", width: "20%", textAlign: "left" }}>Macchina / Zona</th>
                                                        <th style={{ padding: "8px 12px", width: "20%", textAlign: "left" }}>Operatore</th>
                                                        <th style={{ padding: "8px 12px", width: "25%", textAlign: "left" }}>Produzione</th>
                                                        <th style={{ padding: "8px 12px", width: "25%", textAlign: "left" }}>Fermi Macchina</th>
                                                        <th style={{ padding: "8px 12px", width: "10%", textAlign: "center" }}>Stato</th>
                                                    </tr>
                                                </thead>`);

// 3. Zone colSpan
content = content.replace(
`                                                                        <td style={{ textAlign: "center" }}>
                                                                            {/* Optional: Zone Status if needed, currently empty as per request */}
                                                                        </td>`,
`                                                                        <td colSpan={3} style={{ textAlign: "center" }}>
                                                                            {/* Optional: Zone Status if needed, currently empty as per request */}
                                                                        </td>`);

// 4. Nessuna macchina
content = content.replace(
`                                                                    {zoneMachines.length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={3} style={{ padding: "8px 12px 8px 32px", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                                                                                Nessuna macchina in questa zona
                                                                            </td>
                                                                        </tr>
                                                                    )}`,
`                                                                    {zoneMachines.length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={5} style={{ padding: "8px 12px 8px 32px", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                                                                                Nessuna macchina in questa zona
                                                                            </td>
                                                                        </tr>
                                                                    )}`);

// 5. Altre Macchine
content = content.replace(
`                                                            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                                                                <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                                                    Altre Macchine
                                                                </td>
                                                            </tr>`,
`                                                            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                                                                <td colSpan={5} style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                                                    Altre Macchine
                                                                </td>
                                                            </tr>`);

// 6. zoneMachines Replacement
const oldZoneMachinesCode = `                                                                        return (
                                                                            <React.Fragment key={m.id}>
                                                                                <tr style={{ borderBottom: expandedMachine === m.id ? "none" : "1px solid var(--border-light)", background: expandedMachine === m.id ? "var(--bg-secondary)" : "transparent" }}>
                                                                                    <td style={{ padding: "8px 12px 8px 12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 12 }}>
                                                                                        <div onClick={() => toggleExpandMachine(m.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 4, transition: "background 0.2s" }} className="hover-bg">
                                                                                            {expandedMachine === m.id ? Icons.chevronDown : Icons.chevronRight}
                                                                                        </div>
                                                                                        <div>{m.nome}</div>
                                                                                    </td>
                                                                                    <td style={{ padding: "8px 12px" }}>
                                                                                        {specificNames.length > 0 ? (
                                                                                            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{specificNames.join(", ")}</span>
                                                                                        ) : (
                                                                                            <span style={{ color: "var(--text-lighter)", fontSize: 18, lineHeight: 0 }}>&middot;</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                                        <span className={\`tag \${ok ? "tag-green" : "tag-red"}\`} style={{ padding: "2px 8px", fontSize: 11, minWidth: 50, display: "inline-block", textAlign: "center" }}>
                                                                                            {ok ? "OK" : "SOTTO"}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                                {expandedMachine === m.id && (
                                                                                    <tr style={{ borderBottom: "1px solid var(--border-light)", background: "var(--bg-secondary)" }}>
                                                                                        <td colSpan={3} style={{ padding: "0 12px 16px 48px" }}>
                                                                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, paddingTop: 8 }}>
                                                                                                {/* FERMI MACCHINA */}
                                                                                                <div>
                                                                                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Fermi Macchina</div>
                                                                                                    {fermiMacchina.filter(f => f.macchina_id === m.id).length > 0 ? (
                                                                                                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                                                                                                            {fermiMacchina.filter(f => f.macchina_id === m.id).map(f => (
                                                                                                                <li key={f.id} style={{ fontSize: 13, marginBottom: 4, display: "flex", gap: 8 }}>
                                                                                                                    <span style={{ fontFamily: "monospace", color: "var(--danger)" }}>
                                                                                                                        {f.ora_inizio?.slice(0, 5)} - {f.ora_fine?.slice(0, 5)}
                                                                                                                    </span>
                                                                                                                    <span>{f.motivo}</span>
                                                                                                                    {f.durata_minuti && <span style={{ color: "var(--text-muted)" }}>({f.durata_minuti} min)</span>}
                                                                                                                </li>
                                                                                                            ))}
                                                                                                        </ul>
                                                                                                    ) : (
                                                                                                        <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessun fermo registrato</div>
                                                                                                    )}
                                                                                                </div>

                                                                                                {/* PEZZI PRODOTTI */}
                                                                                                <div>
                                                                                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Produzione</div>
                                                                                                    {pezziProdotti.filter(p => p.macchina_id === m.id).length > 0 ? (
                                                                                                        <div style={{ fontSize: 13 }}>
                                                                                                            {pezziProdotti.filter(p => p.macchina_id === m.id).map(p => (
                                                                                                                <div key={p.id}>
                                                                                                                    <div>Quantità: <strong style={{ color: "var(--success)" }}>{p.quantita}</strong></div>
                                                                                                                    {p.scarti > 0 && <div>Scarti: <span style={{ color: "var(--danger)" }}>{p.scarti}</span></div>}
                                                                                                                    {p.note && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Note: {p.note}</div>}
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessun dato di produzione</div>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </React.Fragment>
                                                                        );`;

const newZoneMachinesCode = `                                                                        return (
                                                                            <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                                <td style={{ padding: "8px 12px 8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                                                    {m.nome}
                                                                                </td>
                                                                                <td style={{ padding: "8px 12px" }}>
                                                                                    {specificNames.length > 0 ? (
                                                                                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{specificNames.join(", ")}</span>
                                                                                    ) : (
                                                                                        <span style={{ color: "var(--text-lighter)", fontSize: 18, lineHeight: 0 }}>&middot;</span>
                                                                                    )}
                                                                                </td>
                                                                                <td style={{ padding: "8px 12px", fontSize: 12 }}>
                                                                                    {pezziProdotti.filter(p => p.macchina_id === m.id).length > 0 ? (
                                                                                        pezziProdotti.filter(p => p.macchina_id === m.id).map(p => (
                                                                                            <div key={p.id} style={{ marginBottom: 4 }}>
                                                                                                <span style={{ color: "var(--success)", fontWeight: 600 }}>PZ: {p.quantita}</span>
                                                                                                {p.scarti > 0 && <span style={{ color: "var(--danger)", marginLeft: 6 }}>Scarti: {p.scarti}</span>}
                                                                                                {p.note && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>({p.note})</span>}
                                                                                            </div>
                                                                                        ))
                                                                                    ) : (
                                                                                        <span style={{ color: "var(--text-lighter)" }}>—</span>
                                                                                    )}
                                                                                </td>
                                                                                <td style={{ padding: "8px 12px", fontSize: 12 }}>
                                                                                    {fermiMacchina.filter(f => f.macchina_id === m.id).length > 0 ? (
                                                                                        fermiMacchina.filter(f => f.macchina_id === m.id).map(f => (
                                                                                            <div key={f.id} style={{ marginBottom: 4 }}>
                                                                                                <span style={{ color: "var(--danger)", fontFamily: "monospace", fontWeight: 600 }}>{f.ora_inizio?.slice(0, 5)}-{f.ora_fine?.slice(0, 5)}</span>
                                                                                                <span style={{ marginLeft: 6 }}>{f.motivo}</span>
                                                                                            </div>
                                                                                        ))
                                                                                    ) : (
                                                                                        <span style={{ color: "var(--text-lighter)" }}>—</span>
                                                                                    )}
                                                                                </td>
                                                                                <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                                    <span className={\`tag \${ok ? "tag-green" : "tag-red"}\`} style={{ padding: "2px 8px", fontSize: 11, minWidth: 50, display: "inline-block", textAlign: "center" }}>
                                                                                        {ok ? "OK" : "SOTTO"}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        );`;

content = content.replace(oldZoneMachinesCode, newZoneMachinesCode);

// 7. machinesWithoutZone Replacement
const oldMachinesWithoutZoneCode = `                                                                return (
                                                                    <React.Fragment key={m.id}>
                                                                        <tr style={{ borderBottom: expandedMachine === m.id ? "none" : "1px solid var(--border-light)", background: expandedMachine === m.id ? "var(--bg-secondary)" : "transparent" }}>
                                                                            <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 12 }}>
                                                                                <div onClick={() => toggleExpandMachine(m.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 4, transition: "background 0.2s" }} className="hover-bg">
                                                                                    {expandedMachine === m.id ? Icons.chevronDown : Icons.chevronRight}
                                                                                </div>
                                                                                <div>{m.nome}</div>
                                                                            </td>
                                                                            <td style={{ padding: "8px 12px" }}>
                                                                                {specificNames.length > 0 ? (
                                                                                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{specificNames.join(", ")}</span>
                                                                                ) : (
                                                                                    <span style={{ color: "var(--text-muted)" }}>—</span>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                                <span className={\`tag \${ok ? "tag-green" : "tag-red"}\`} style={{ padding: "2px 8px", fontSize: 11, minWidth: 50, display: "inline-block", textAlign: "center" }}>
                                                                                    {ok ? "OK" : "SOTTO"}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                        {expandedMachine === m.id && (
                                                                            <tr style={{ borderBottom: "1px solid var(--border-light)", background: "var(--bg-secondary)" }}>
                                                                                <td colSpan={3} style={{ padding: "0 12px 16px 48px" }}>
                                                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, paddingTop: 8 }}>
                                                                                        {/* FERMI MACCHINA */}
                                                                                        <div>
                                                                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Fermi Macchina</div>
                                                                                            {fermiMacchina.filter(f => f.macchina_id === m.id).length > 0 ? (
                                                                                                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                                                                                                    {fermiMacchina.filter(f => f.macchina_id === m.id).map(f => (
                                                                                                        <li key={f.id} style={{ fontSize: 13, marginBottom: 4, display: "flex", gap: 8 }}>
                                                                                                            <span style={{ fontFamily: "monospace", color: "var(--danger)" }}>
                                                                                                                {f.ora_inizio?.slice(0, 5)} - {f.ora_fine?.slice(0, 5)}
                                                                                                            </span>
                                                                                                            <span>{f.motivo}</span>
                                                                                                            {f.durata_minuti && <span style={{ color: "var(--text-muted)" }}>({f.durata_minuti} min)</span>}
                                                                                                        </li>
                                                                                                    ))}
                                                                                                </ul>
                                                                                            ) : (
                                                                                                <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessun fermo registrato</div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* PEZZI PRODOTTI */}
                                                                                        <div>
                                                                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Produzione</div>
                                                                                            {pezziProdotti.filter(p => p.macchina_id === m.id).length > 0 ? (
                                                                                                <div style={{ fontSize: 13 }}>
                                                                                                    {pezziProdotti.filter(p => p.macchina_id === m.id).map(p => (
                                                                                                        <div key={p.id}>
                                                                                                            <div>Quantità: <strong style={{ color: "var(--success)" }}>{p.quantita}</strong></div>
                                                                                                            {p.scarti > 0 && <div>Scarti: <span style={{ color: "var(--danger)" }}>{p.scarti}</span></div>}
                                                                                                            {p.note && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Note: {p.note}</div>}
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Nessun dato di produzione</div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                );`;

const newMachinesWithoutZoneCode = `                                                                return (
                                                                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                                        <td style={{ padding: "8px 12px 8px 32px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                                            {m.nome}
                                                                        </td>
                                                                        <td style={{ padding: "8px 12px" }}>
                                                                            {specificNames.length > 0 ? (
                                                                                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{specificNames.join(", ")}</span>
                                                                            ) : (
                                                                                <span style={{ color: "var(--text-muted)" }}>—</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: "8px 12px", fontSize: 12 }}>
                                                                            {pezziProdotti.filter(p => p.macchina_id === m.id).length > 0 ? (
                                                                                pezziProdotti.filter(p => p.macchina_id === m.id).map(p => (
                                                                                    <div key={p.id} style={{ marginBottom: 4 }}>
                                                                                        <span style={{ color: "var(--success)" }}>PZ: {p.quantita}</span>
                                                                                        {p.scarti > 0 && <span style={{ color: "var(--danger)", marginLeft: 6 }}>Scarti: {p.scarti}</span>}
                                                                                        {p.note && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>({p.note})</span>}
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                <span style={{ color: "var(--text-lighter)" }}>—</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: "8px 12px", fontSize: 12 }}>
                                                                            {fermiMacchina.filter(f => f.macchina_id === m.id).length > 0 ? (
                                                                                fermiMacchina.filter(f => f.macchina_id === m.id).map(f => (
                                                                                    <div key={f.id} style={{ marginBottom: 4 }}>
                                                                                        <span style={{ color: "var(--danger)", fontFamily: "monospace", fontWeight: 600 }}>{f.ora_inizio?.slice(0, 5)}-{f.ora_fine?.slice(0, 5)}</span>
                                                                                        <span style={{ marginLeft: 6 }}>{f.motivo}</span>
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                <span style={{ color: "var(--text-lighter)" }}>—</span>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ textAlign: "center", padding: "8px 12px" }}>
                                                                            <span className={\`tag \${ok ? "tag-green" : "tag-red"}\`} style={{ padding: "2px 8px", fontSize: 11, minWidth: 50, display: "inline-block", textAlign: "center" }}>
                                                                                {ok ? "OK" : "SOTTO"}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );`;

content = content.replace(oldMachinesWithoutZoneCode, newMachinesWithoutZoneCode);

// 8. Move Report dropdown inline
content = content.replace(
`                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                    </div>`,
`                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                    </div>`);

fs.writeFileSync('src/views/ReportView.jsx', content, 'utf-8');
console.log("Done");
