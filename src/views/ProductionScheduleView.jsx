import React, { useState } from 'react';

const defaultStyles = {
  container: { padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', minHeight: '100vh' },
  tableContainer: { backgroundColor: 'white', borderRadius: '0px', overflowX: 'auto', marginTop: '0px' },
  table: { borderCollapse: 'collapse', fontSize: '11px', width: '100%' },
  th: { backgroundColor: '#f0f0f0', padding: '6px 4px', border: '1px solid #999', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap', minWidth: '60px' },
  td: { padding: '6px 4px', border: '1px solid #ccc', textAlign: 'center', minHeight: '20px', cursor: 'pointer' },
  cellYellow: { backgroundColor: '#ffff00', color: '#000', fontWeight: '500' },
  cellGreen: { backgroundColor: '#92d050', color: '#000', fontWeight: '500' },
  cellRed: { backgroundColor: '#ff0000', color: '#fff', fontWeight: 'bold' },
  cellOrange: { backgroundColor: '#ffc000', color: '#000', fontWeight: '500' },
  cellWhite: { backgroundColor: '#ffffff', color: '#000' },
  sectionHeader: { backgroundColor: '#d3d3d3', fontWeight: 'bold', fontSize: '12px', padding: '8px 4px', border: '1px solid #999' }
};

// Dati di inventario mock dal Laboratorio (sarà collegato ai dati reali dopo)
const INVENTORY_DATA = {
  'EMAG': { qty: 1250, location: 'Cella EMAG', status: 'In lavorazione', machine: 'EMAG Station' },
  'DA LAVARE': { qty: 890, location: 'Lavaggio', status: 'In coda', machine: 'Wash Station' },
  'DA TRATTARE': { qty: 560, location: 'Trattamento', status: 'In coda', machine: 'Treatment' },
  'LASER': { qty: 2340, location: 'Laser Room', status: 'In lavorazione', machine: 'LASER DCT 300' },
  'FINITI': { qty: 5600, location: 'Magazzino', status: 'Completato', machine: 'Storage' },
  'AC1': { qty: 1200, location: 'AC1 Station', status: 'In lavorazione', machine: 'AC1 Cell' },
  'START': { qty: 450, location: 'Start Area', status: 'Non avviato', machine: 'Start Station' },
  'PFAUTER DG': { qty: 340, location: 'Pfauter DG', status: 'In lavorazione', machine: 'PFAUTER DG' },
  'RH160': { qty: 280, location: 'RH160', status: 'In lavorazione', machine: 'RH160 Station' },
  'DG cor SCA11006': { qty: 620, location: 'DG Correction', status: 'In lavorazione', machine: 'DG Station' },
  'IN TRATT.': { qty: 180, location: 'In Trattamento', status: 'In lavorazione', machine: 'Treatment Station' },
  'US': { qty: 90, location: 'US Cleaning', status: 'In lavorazione', machine: 'US Station' },
  'DA PALLIN.': { qty: 140, location: 'Pallinatura', status: 'In coda', machine: 'Pallinatura' },
  'DA DENTARE': { qty: 500, location: 'Dentatura', status: 'In coda', machine: 'Dentatura Station' },
  'STROZZA': { qty: 200, location: 'Strozzatura', status: 'In lavorazione', machine: 'Strozzatura' }
};

const PRODUCTION_DATA = [
  // LINEA 1
  { id: 1, line: 'Linea 1', date: '17/04/2026', time: '17:44', jph: 40, variant: 'M0156528-002 21A', qty: 410, col1A: 410, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'DA LAVARE', dg2: 'AC1', sg3: 'RH160', sg4: 'FINITI', sg5: 'AC1', sg6: 'FINITI', sg7: 'FINITI', rg: 'DA LAVARE' },
  { id: 2, line: 'Linea 1', date: '18/04/2026', time: '11:14', jph: 40, variant: '251/17.44-002 21A', qty: 210, col1A: 210, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'DA LAVARE', dg2: 'DA TRATTARE', sg3: 'AC1', sg4: 'FINITI', sg5: 'US', sg6: 'LASER', sg7: 'FINITI', rg: 'EMAG' },
  { id: 3, line: 'Linea 1', date: '18/04/2026', time: '16:29', jph: 40, variant: '251/24.22-003 21A', qty: 120, col1A: 120, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'EMAG', dg2: 'DA TRATTARE', sg3: 'AC1', sg4: 'FINITI', sg5: 'US', sg6: 'LASER', sg7: 'FINITI', rg: 'EMAG' },
  { id: 4, line: 'Linea 1', date: '18/04/2026', time: '19:29', jph: 40, variant: '251/24.15-008 21A', qty: 250, col1A: 250, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'EMAG', dg2: 'PFAUTER DG', sg3: 'AC1', sg4: 'FINITI', sg5: 'LASER', sg6: 'LASER', sg7: 'FINITI', rg: 'EMAG' },
  { id: 5, line: 'Linea 1', date: '20/04/2026', time: '01:44', jph: 40, variant: '251/04.15-006 21C', qty: 200, col1A: '', col2A: '', col1C: 200, col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'PFAUTER DG', sg3: 'AC1', sg4: 'FINITI', sg5: 'LASER', sg6: 'LASER', sg7: 'FINITI', rg: 'FINITI' },
  { id: 6, line: 'Linea 1', date: '20/04/2026', time: '06:44', jph: 40, variant: '251/04.15-003 21C', qty: 250, col1A: '', col2A: '', col1C: 250, col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'AC1', sg4: 'FINITI', sg5: 'LASER', sg6: 'LASER', sg7: 'FINITI', rg: 'DA PALLIN.' },
  { id: 7, line: 'Linea 1', date: '20/04/2026', time: '12:59', jph: 40, variant: '251/17.44-002 21A', qty: 140, col1A: 140, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'AC1', sg4: 'FINITI', sg5: 'LASER', sg6: 'LASER', sg7: 'DA LAVARE', rg: 'EMAG' },
  { id: 8, line: 'Linea 1', date: '20/04/2026', time: '16:29', jph: 40, variant: '251/24.15-008 21A', qty: 240, col1A: 240, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'IN TRATT.', sg4: 'FINITI', sg5: 'LASER', sg6: 'DA LAVARE', sg7: 'DA LAVARE', rg: 'EMAG' },
  { id: 9, line: 'Linea 1', date: '20/04/2026', time: '22:29', jph: 40, variant: '251/24.22-003 21A', qty: 120, col1A: 120, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'IN TRATT.', sg4: 'FINITI', sg5: 'LASER', sg6: 'DA LAVARE', sg7: 'DA LAVARE', rg: 'EMAG' },
  { id: 10, line: 'Linea 1', date: '21/04/2026', time: '01:29', jph: 40, variant: 'M0156528-001 21A', qty: 450, col1A: 450, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'START', sg4: '', sg5: 'LASER', sg6: 'EMAG', sg7: 'RH160', rg: 'EMAG' },
  { id: 11, line: 'Linea 1', date: '21/04/2026', time: '12:44', jph: 40, variant: '251/17.44-002 21A', qty: 140, col1A: 140, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: '', sg4: 'DA LAVARE', sg5: 'LASER', sg6: 'EMAG', sg7: 'RH160', rg: 'EMAG' },
  { id: 12, line: 'Linea 1', date: '21/04/2026', time: '16:14', jph: 40, variant: '251/24.15-005 1A', qty: 300, col1A: 300, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'PFAUTER DG', sg3: 'AC1', sg4: 'AC1', sg5: 'LASER', sg6: 'FINITI', sg7: 'FINITI', rg: 'EMAG' },
  { id: 13, line: 'Linea 1', date: '21/04/2026', time: '23:44', jph: 40, variant: '251/24.10-005 1A', qty: 300, col1A: 300, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'AC1', sg4: 'AC1', sg5: 'LASER', sg6: 'EMAG', sg7: 'EMAG', rg: 'EMAG' },
  { id: 14, line: 'Linea 1', date: '22/04/2026', time: '07:14', jph: 40, variant: 'M0141898-002 32C', qty: 15, col1A: '', col2A: '', col1C: '', col3C: 15, col61A: '', col61E: '', sg1: 'FINITI', dg2: 'FINITI', sg3: 'FINITI', sg4: 'FINITI', sg5: 'FINITI', sg6: 'FINITI', sg7: '', rg: 'IN TRATT.AL.' },
  { id: 15, line: 'Linea 1', date: '22/04/2026', time: '07:36', jph: 40, variant: 'M0141898-001 32C', qty: 122, col1A: '', col2A: '', col1C: '', col3C: 122, col61A: '', col61E: '', sg1: 'FINITI', dg2: 'PFAUTER DG', sg3: 'DA TRATTARE', sg4: 'FINITI', sg5: 'LASER', sg6: 'FINITI', sg7: 'FINITI', rg: 'Start' },
  { id: 16, line: 'Linea 1', date: '22/04/2026', time: '10:39', jph: 40, variant: '251/04.16-006 21C', qty: 200, col1A: '', col2A: 200, col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'RH160', sg4: 'RH160', sg5: 'LASER', sg6: 'DA TRATTARE', sg7: 'RH160', rg: 'Start' },
  { id: 17, line: 'Linea 1', date: '22/04/2026', time: '15:39', jph: 40, variant: 'M0156528-002 21A', qty: 500, col1A: 500, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'Start', sg4: 'LASER', sg5: 'LASER', sg6: 'Start', sg7: 'EMAG', rg: 'DA DENTARE' },
  { id: 18, line: 'Linea 1', date: '23/04/2026', time: '04:09', jph: 40, variant: 'M0156528-002 21A', qty: 500, col1A: '', col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: '', sg4: 'LASER', sg5: 'LASER', sg6: 'Start', sg7: 'DA TRATTARE', rg: 'DA DENTARE' },
  { id: 19, line: 'Linea 1', date: '23/04/2026', time: '16:39', jph: 40, variant: '251/17.44-002 21A', qty: 600, col1A: 600, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'Start', sg4: 'Start', sg5: 'LASER', sg6: 'Start', sg7: 'STROZZA', rg: 'Start' },
  { id: 20, line: 'Linea 1', date: '24/04/2026', time: '07:39', jph: 40, variant: '251/04.15-003 21C', qty: 200, col1A: 200, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'Start', dg2: 'Start', sg3: '', sg4: 'Start', sg5: 'LASER', sg6: 'STROZZA', sg7: '', rg: 'Start' },
  // LINEA 2
  { id: 21, line: 'Linea 2', date: '17/04/2026', time: '21:35', jph: 50, variant: '4910002302-101 61A', qty: 300, col1A: '', col2A: '', col1C: '', col3C: '', col61A: 300, col61E: '', sg1: 'DA LAVARE', dg2: 'DA TRATTARE', sg3: 'FINITI', sg4: 'FINITI', sg5: 'LASER', sg6: 'FINITI', sg7: 'FINITI', rg: 'DA LAVARE' },
  { id: 22, line: 'Linea 2', date: '18/04/2026', time: '05:35', jph: 50, variant: 'M0164185-001 1A', qty: 440, col1A: 440, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'DA LAVARE', dg2: 'DA TRATTARE', sg3: 'FINITI', sg4: 'FINITI', sg5: 'LASER', sg6: 'FINITI', sg7: 'FINITI', rg: 'DA LAVARE' },
  { id: 23, line: 'Linea 2', date: '18/04/2026', time: '14:23', jph: 50, variant: '4910002402-101 61E', qty: 300, col1A: '', col2A: '', col1C: '', col3C: '', col61A: '', col61E: 300, sg1: 'DA LAVARE', dg2: '', sg3: '', sg4: '', sg5: '', sg6: '', sg7: '', rg: '' },
  { id: 24, line: 'Linea 2', date: '18/04/2026', time: '20:23', jph: 50, variant: '4910002402-002 61E', qty: 300, col1A: '', col2A: '', col1C: '', col3C: '', col61A: '', col61E: 300, sg1: '', dg2: '', sg3: '', sg4: '', sg5: '', sg6: '', sg7: '', rg: '' },
  { id: 25, line: 'Linea 2', date: '20/04/2026', time: '02:23', jph: 50, variant: '9FLE 185-001 1A', qty: 500, col1A: '', col2A: 500, col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'PFAUTER DG', sg3: 'RH160', sg4: 'RH160', sg5: 'Start', sg6: 'LASER', sg7: 'FINITI', rg: 'EMAG' },
  { id: 26, line: 'Linea 2', date: '20/04/2026', time: '12:23', jph: 50, variant: '4910002302-101 61A', qty: 600, col1A: '', col2A: '', col1C: '', col3C: '', col61A: 600, col61E: '', sg1: 'LASER', dg2: '', sg3: '', sg4: '', sg5: '', sg6: '', sg7: '', rg: '' },
  { id: 27, line: 'Linea 2', date: '21/04/2026', time: '00:23', jph: 50, variant: '4910002402-101 61E', qty: 300, col1A: '', col2A: '', col1C: '', col3C: '', col61A: '', col61E: 300, sg1: 'LASER', dg2: '', sg3: '', sg4: '', sg5: '', sg6: '', sg7: '', rg: '' },
  { id: 28, line: 'Linea 2', date: '21/04/2026', time: '06:23', jph: 50, variant: '4910002402-002 61E', qty: 300, col1A: '', col2A: '', col1C: '', col3C: '', col61A: '', col61E: 300, sg1: 'LASER', dg2: '', sg3: '', sg4: '', sg5: '', sg6: '', sg7: '', rg: '' },
  { id: 29, line: 'Linea 2', date: '21/04/2026', time: '12:23', jph: 50, variant: '4910002402-101 61E', qty: 300, col1A: '', col2A: '', col1C: '', col3C: '', col61A: '', col61E: 300, sg1: 'LASER', dg2: '', sg3: '', sg4: '', sg5: '', sg6: '', sg7: '', rg: '' },
  { id: 30, line: 'Linea 2', date: '21/04/2026', time: '18:23', jph: 50, variant: '4910002302-101 61A', qty: 300, col1A: '', col2A: '', col1C: '', col3C: '', col61A: 300, col61E: '', sg1: 'LASER', dg2: '', sg3: '', sg4: '', sg5: '', sg6: '', sg7: '', rg: '' },
  { id: 31, line: 'Linea 2', date: '22/04/2026', time: '00:23', jph: 50, variant: 'M0164185-001 1A', qty: 400, col1A: 400, col2A: '', col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'AC1', sg4: 'AC1', sg5: '', sg6: 'EMAG', sg7: 'EMAG', rg: 'EMAG' },
  { id: 32, line: 'Linea 2', date: '22/04/2026', time: '08:23', jph: 50, variant: 'M0164502-002 1A', qty: 200, col1A: '', col2A: 200, col1C: '', col3C: '', col61A: '', col61E: '', sg1: 'LASER', dg2: 'DG cor SCA11006', sg3: 'AC1', sg4: 'DA LAVARE', sg5: 'LASER', sg6: 'EMAG', sg7: 'EMAG', rg: 'EMAG' }
];

const getStatusColor = (status) => {
  if (!status) return defaultStyles.cellWhite;
  const upper = String(status).toUpperCase();
  if (upper === 'START') return defaultStyles.cellRed;
  if (upper.includes('LASER') || upper.includes('LAVARE') || upper.includes('TRATTARE')) return defaultStyles.cellYellow;
  if (upper.includes('FINITI') || upper === 'AC1') return defaultStyles.cellGreen;
  if (upper.includes('EMAG') || upper.includes('RH160') || upper.includes('PFAUTER') || upper.includes('PALLIN') || upper.includes('DENTARE') || upper.includes('STOZZA')) return defaultStyles.cellYellow;
  return defaultStyles.cellWhite;
};

const ProductionScheduleView = ({ showToast }) => {
  const [selectedRow, setSelectedRow] = useState(null);
  const [modalData, setModalData] = useState(null);

  const groupedData = {
    'Linea 1': PRODUCTION_DATA.filter(d => d.line === 'Linea 1'),
    'Linea 2': PRODUCTION_DATA.filter(d => d.line === 'Linea 2')
  };

  const handlePhaseClick = (phaseValue, phaseColumn) => {
    if (!phaseValue) return;

    // Trova tutte le righe con questa fase
    const pipelineRows = PRODUCTION_DATA.filter(row => {
      return row[phaseColumn] === phaseValue;
    });

    // Calcola i pezzi totali richiesti per questa fase
    const totalQtyRequired = pipelineRows.reduce((sum, row) => sum + (row.qty || 0), 0);

    const inventoryInfo = INVENTORY_DATA[phaseValue] || {
      qty: 0,
      location: 'Non disponibile',
      status: 'Sconosciuto',
      machine: 'N/A'
    };

    // Calcola copertura %
    const coverage = totalQtyRequired > 0 ? Math.round((inventoryInfo.qty / totalQtyRequired) * 100) : 0;
    const shortage = Math.max(0, totalQtyRequired - inventoryInfo.qty);

    // Breakdown per linea
    const breakdownPerLine = {};
    pipelineRows.forEach(row => {
      if (!breakdownPerLine[row.line]) {
        breakdownPerLine[row.line] = { qty: 0, count: 0 };
      }
      breakdownPerLine[row.line].qty += row.qty;
      breakdownPerLine[row.line].count += 1;
    });

    // Breakdown per variante
    const breakdownPerVariant = {};
    pipelineRows.forEach(row => {
      if (!breakdownPerVariant[row.variant]) {
        breakdownPerVariant[row.variant] = { qty: 0 };
      }
      breakdownPerVariant[row.variant].qty += row.qty;
    });

    setModalData({
      phase: phaseValue,
      phaseColumn,
      rows: pipelineRows,
      inventory: inventoryInfo,
      totalQtyRequired,
      coverage,
      shortage,
      breakdownPerLine,
      breakdownPerVariant
    });
  };

  return (
    <div style={defaultStyles.container}>
      {/* Modal Pipeline */}
      {modalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setModalData(null)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', padding: '30px',
            maxWidth: '900px', width: '90%', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Pipeline: <strong>{modalData.phase}</strong></h2>
              <button onClick={() => setModalData(null)} style={{
                background: 'none', border: 'none', fontSize: '24px',
                cursor: 'pointer', color: '#666'
              }}>✕</button>
            </div>

            {/* Inventario Info con Copertura */}
            <div style={{
              backgroundColor: modalData.coverage >= 100 ? '#c8e6c9' : '#ffccbc',
              border: `2px solid ${modalData.coverage >= 100 ? '#4CAF50' : '#ff7043'}`,
              borderRadius: '6px', padding: '15px', marginBottom: '20px'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>📦 Copertura Inventario</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Pezzi Richiesti</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>{modalData.totalQtyRequired}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Pezzi Disponibili</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>{modalData.inventory.qty}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Copertura</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: modalData.coverage >= 100 ? '#4CAF50' : '#ff7043' }}>{modalData.coverage}%</div>
                </div>
              </div>

              {modalData.shortage > 0 && (
                <div style={{ backgroundColor: '#ffebee', border: '1px solid #ef5350', borderRadius: '4px', padding: '10px', color: '#c62828', fontWeight: 'bold' }}>
                  ⚠️ Deficit di {modalData.shortage} pezzi
                </div>
              )}

              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                <strong style={{ display: 'block', marginBottom: '8px' }}>📍 Ubicazione:</strong>
                <div style={{ fontSize: '13px', color: '#555' }}>
                  <div>🏢 {modalData.inventory.machine}</div>
                  <div>📌 {modalData.inventory.location}</div>
                  <div>🔄 Stato: <span style={{ color: modalData.inventory.status === 'Completato' ? '#4CAF50' : '#FF9800', fontWeight: 'bold' }}>{modalData.inventory.status}</span></div>
                </div>
              </div>
            </div>

            {/* Breakdown per Linea */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>🏭 Allocazione per Linea</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {Object.entries(modalData.breakdownPerLine).map(([linea, data]) => (
                  <div key={linea} style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{linea}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      <div>{data.qty} pezzi ({data.count} articoli)</div>
                      <div style={{ marginTop: '5px', color: '#2196F3', fontWeight: '500' }}>
                        {Math.round((data.qty / modalData.totalQtyRequired) * 100)}% della pipeline
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Breakdown per Variante */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>📦 Dettaglio per Variante</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #999' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #ccc' }}>Variante</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ccc' }}>Qty</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ccc' }}>% del Total</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Articoli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(modalData.breakdownPerVariant).map(([variant, data], idx) => (
                      <tr key={variant} style={{ borderBottom: '1px solid #ddd', backgroundColor: idx % 2 === 0 ? '#fafafa' : 'white' }}>
                        <td style={{ padding: '8px', borderRight: '1px solid #ddd', fontSize: '11px' }}><strong>{variant}</strong></td>
                        <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ddd', fontWeight: 'bold', color: '#2196F3' }}>{data.qty}</td>
                        <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ddd', color: '#666' }}>
                          {Math.round((data.qty / modalData.totalQtyRequired) * 100)}%
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#666' }}>
                          {modalData.rows.filter(r => r.variant === variant).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Articoli Dettagliati */}
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>📋 Articoli in Pipeline ({modalData.rows.length})</h3>
              <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #999' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #ccc' }}>Linea</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #ccc' }}>Data</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #ccc' }}>Variante</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ccc' }}>Qty</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ccc' }}>SG1</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ccc' }}>DG2</th>
                      <th style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ccc' }}>SG3</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.rows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #ddd', backgroundColor: row[modalData.phaseColumn] === modalData.phase ? '#fff9c4' : (idx % 2 === 0 ? '#fafafa' : 'white') }}>
                        <td style={{ padding: '8px', borderRight: '1px solid #ddd', fontWeight: 'bold' }}>{row.line}</td>
                        <td style={{ padding: '8px', borderRight: '1px solid #ddd', fontSize: '10px' }}>{row.date} {row.time}</td>
                        <td style={{ padding: '8px', borderRight: '1px solid #ddd', fontSize: '10px' }}>{row.variant}</td>
                        <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ddd', fontWeight: 'bold', color: '#2196F3' }}>{row.qty}</td>
                        <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ddd', ...getStatusColor(row.sg1), fontSize: '10px' }}>{row.sg1}</td>
                        <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ddd', ...getStatusColor(row.dg2), fontSize: '10px' }}>{row.dg2}</td>
                        <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #ddd', ...getStatusColor(row.sg3), fontSize: '10px' }}>{row.sg3}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: row[modalData.phaseColumn] === modalData.phase ? '#4CAF50' : '#999', fontWeight: 'bold' }}>
                          {row[modalData.phaseColumn] === modalData.phase ? '✓ QUI' : '→ Dopo'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={defaultStyles.tableContainer}>
        <table style={defaultStyles.table}>
          {Object.entries(groupedData).map(([linea, rows]) => (
            <tbody key={linea}>
              {/* Sezione Linea Header */}
              <tr>
                <td colSpan="20" style={{...defaultStyles.sectionHeader, textAlign: 'left'}}>
                  {linea}
                </td>
              </tr>

              {/* Header delle colonne */}
              <tr>
                <th style={defaultStyles.th}>Data</th>
                <th style={defaultStyles.th}>JPH</th>
                <th style={defaultStyles.th}>Variante</th>
                <th style={defaultStyles.th}>Qty</th>
                <th style={defaultStyles.th}>1A</th>
                <th style={defaultStyles.th}>2A</th>
                <th style={defaultStyles.th}>1C</th>
                <th style={defaultStyles.th}>3C</th>
                <th style={defaultStyles.th}>61A</th>
                <th style={defaultStyles.th}>61E</th>
                <th style={defaultStyles.th}>SG1</th>
                <th style={defaultStyles.th}>DG2</th>
                <th style={defaultStyles.th}>SG3</th>
                <th style={defaultStyles.th}>SG4</th>
                <th style={defaultStyles.th}>SG5</th>
                <th style={defaultStyles.th}>SG6</th>
                <th style={defaultStyles.th}>SG7</th>
                <th style={defaultStyles.th}>RG</th>
              </tr>

              {/* Data rows */}
              {rows.map((row) => (
                <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRow(selectedRow === row.id ? null : row.id)}>
                  <td style={defaultStyles.td}>{row.date} {row.time}</td>
                  <td style={defaultStyles.td}>{row.jph}</td>
                  <td style={{...defaultStyles.td, textAlign: 'left', fontSize: '10px'}}>{row.variant}</td>
                  <td style={defaultStyles.td}>{row.qty}</td>
                  <td style={defaultStyles.td}>{row.col1A}</td>
                  <td style={defaultStyles.td}>{row.col2A}</td>
                  <td style={defaultStyles.td}>{row.col1C}</td>
                  <td style={defaultStyles.td}>{row.col3C}</td>
                  <td style={defaultStyles.td}>{row.col61A}</td>
                  <td style={defaultStyles.td}>{row.col61E}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.sg1)}} onClick={() => handlePhaseClick(row.sg1, 'sg1')} title="Clicca per vedere la pipeline">{row.sg1}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.dg2)}} onClick={() => handlePhaseClick(row.dg2, 'dg2')} title="Clicca per vedere la pipeline">{row.dg2}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.sg3)}} onClick={() => handlePhaseClick(row.sg3, 'sg3')} title="Clicca per vedere la pipeline">{row.sg3}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.sg4)}} onClick={() => handlePhaseClick(row.sg4, 'sg4')} title="Clicca per vedere la pipeline">{row.sg4}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.sg5)}} onClick={() => handlePhaseClick(row.sg5, 'sg5')} title="Clicca per vedere la pipeline">{row.sg5}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.sg6)}} onClick={() => handlePhaseClick(row.sg6, 'sg6')} title="Clicca per vedere la pipeline">{row.sg6}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.sg7)}} onClick={() => handlePhaseClick(row.sg7, 'sg7')} title="Clicca per vedere la pipeline">{row.sg7}</td>
                  <td style={{...defaultStyles.td, ...getStatusColor(row.rg)}} onClick={() => handlePhaseClick(row.rg, 'rg')} title="Clicca per vedere la pipeline">{row.rg}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
};

export default ProductionScheduleView;
