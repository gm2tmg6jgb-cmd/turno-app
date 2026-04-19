import React, { useState } from 'react';

export default function NuovaPianificazioneView() {
  const [pastedData, setPastedData] = useState('');
  const [selectedLinea, setSelectedLinea] = useState('Linea 1');
  const [parsedRows, setParsedRows] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const parseTableData = (text) => {
    setError('');
    setSaved(false);

    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    try {
      // Split by newline
      const lines = text.split('\n').filter(line => line.trim());
      const rows = [];

      lines.forEach((line, idx) => {
        // Skip header rows
        if (line.includes('Data') || line.includes('Linea') || line === '') return;

        // Split by tabs or multiple spaces
        const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p);

        // Expected format: Data JPH Variante Qty 1A 21A 21C 32C 61A 61E
        if (parts.length >= 5) {
          // Prendi i primi 4 elementi sempre
          const date = parts[0]; // Data (es. 15/04/2026 21:59)
          const jph = parseInt(parts[1]) || 0; // JPH

          // Variante potrebbe essere 1 o 2 celle (se ha spazi)
          // Quantidade è sempre dopo variante
          // Cerchiamo il primo numero che non è JPH
          let variantStart = 2;
          let variantEnd = 2;
          let qtyIdx = -1;

          // Trovare dove finisce la variante e inizia qty
          for (let i = 2; i < parts.length; i++) {
            const isNumber = !isNaN(parts[i]) && parts[i] !== '';
            if (isNumber && qtyIdx === -1) {
              qtyIdx = i;
              variantEnd = i;
              break;
            }
          }

          const variant = parts.slice(variantStart, variantEnd).join(' ');
          const qty = parseInt(parts[qtyIdx]) || 0;

          // Estrai le colonne 1A, 21A, 21C, 32C, 61A, 61E
          const col1A = parseInt(parts[qtyIdx + 1]) || 0;
          const col21A = parseInt(parts[qtyIdx + 2]) || 0;
          const col21C = parseInt(parts[qtyIdx + 3]) || 0;
          const col32C = parseInt(parts[qtyIdx + 4]) || 0;
          const col61A = parseInt(parts[qtyIdx + 5]) || 0;
          const col61E = parseInt(parts[qtyIdx + 6]) || 0;

          if (variant && qty > 0) {
            rows.push({
              date,
              jph,
              variant,
              qty,
              col1A,
              col21A,
              col21C,
              col32C,
              col61A,
              col61E
            });
          }
        }
      });

      if (rows.length === 0) {
        setError('Nessun dato valido trovato. Verifica il formato.');
      } else {
        setParsedRows(rows);
      }
    } catch (err) {
      setError('Errore nel parsing: ' + err.message);
      setParsedRows([]);
    }
  };

  const saveToDatabase = async () => {
    try {
      // Salva i dati parsed (per ora just in memory, poi faremo Supabase)
      console.log('Saving to database:', { linea: selectedLinea, rows: parsedRows });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Errore nel salvataggio: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#333' }}>📋 Nuova Pianificazione Produzione</h1>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Input tabella */}
        <div style={{ marginBottom: '20px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>📌 Incolla la tabella dal PDF/Screenshot</h3>

          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            Copia le righe della tabella cliente (inclusa data, JPH, variante, qty, 1A, 21A, 21C, 32C, 61A, 61E) e incolla qui:
          </p>

          <textarea
            value={pastedData}
            onChange={(e) => {
              setPastedData(e.target.value);
              parseTableData(e.target.value);
            }}
            placeholder="Incolla i dati della tabella qui..."
            style={{
              width: '100%',
              height: '150px',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '10px'
            }}
          />

          {/* Selezione Linea */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
              Linea:
              <select
                value={selectedLinea}
                onChange={(e) => setSelectedLinea(e.target.value)}
                style={{
                  marginLeft: '10px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '12px'
                }}
              >
                <option>Linea 1</option>
                <option>Linea 2</option>
              </select>
            </label>
          </div>

          {error && (
            <div style={{ backgroundColor: '#ffebee', border: '1px solid #ef5350', borderRadius: '4px', padding: '10px', color: '#c62828', marginBottom: '10px' }}>
              ⚠️ {error}
            </div>
          )}

          {saved && (
            <div style={{ backgroundColor: '#c8e6c9', border: '1px solid #4CAF50', borderRadius: '4px', padding: '10px', color: '#2e7d32', marginBottom: '10px' }}>
              ✓ Dati salvati con successo!
            </div>
          )}
        </div>

        {/* Preview tabella parsata */}
        {parsedRows.length > 0 && (
          <div style={{ marginBottom: '20px', backgroundColor: '#f0f7ff', padding: '20px', borderRadius: '8px', border: '1px solid #90caf9' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1976d2' }}>✓ Preview Dati Parsati ({parsedRows.length} ordini)</h3>

            <div style={{ overflowX: 'auto', marginBottom: '15px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e3f2fd', borderBottom: '2px solid #1976d2' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #90caf9' }}>Data</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #90caf9' }}>JPH</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #90caf9' }}>Variante</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #90caf9' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #90caf9' }}>1A</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #90caf9' }}>21A</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #90caf9' }}>21C</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #90caf9' }}>32C</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #90caf9' }}>61A</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>61E</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '8px', borderRight: '1px solid #e0e0e0', fontSize: '10px' }}>{row.date}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{row.jph}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e0e0e0', fontSize: '10px' }}>{row.variant}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', color: '#d32f2f' }}>{row.qty}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{row.col1A || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{row.col21A || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{row.col21C || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{row.col32C || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{row.col61A || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{row.col61E || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={saveToDatabase}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              💾 Salva Pianificazione ({selectedLinea})
            </button>
          </div>
        )}

        {/* Info */}
        <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', padding: '15px', fontSize: '12px', color: '#856404' }}>
          <strong>ℹ️ Come usare:</strong>
          <ol style={{ marginTop: '10px', paddingLeft: '20px' }}>
            <li>Apri il PDF/screenshot della richiesta cliente</li>
            <li>Seleziona e copia le righe della tabella (da Data a 61E)</li>
            <li>Incolla nel textarea sopra</li>
            <li>Verifica il preview dei dati</li>
            <li>Clicca "Salva Pianificazione"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
