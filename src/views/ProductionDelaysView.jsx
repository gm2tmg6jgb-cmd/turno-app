import React, { useState, useEffect } from 'react';
import {
  fetchAllInventoryCoverage,
  fetchLineInventoryCoverage,
  saveComponentInventory,
  saveComponentConsumption,
  calculateConsumptionFromCycleTime
} from '../lib/inventoryCoverageCalculations';
import { getLocalDate } from '../lib/dateUtils';

const PROJECTS = ["DCT300", "DCT ECO", "8Fe"];
const LINES = { DCT300: "L1", "DCT ECO": "L2", "8Fe": "L3" };
const PROJECT_COMPONENTS = {
  "DCT300": ["SG1", "DG-REV", "DG", "SG3", "SG4", "SG5", "SG6", "SG7", "SGR", "RG"],
  "8Fe": ["SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "FG5/7", "RG-FD1", "RG-FD2"],
  "DCT ECO": ["SG2", "SG3", "SG4", "SG5", "SGR", "RG-FD1", "RG-FD2"]
};

const defaultStyles = {
  container: { padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f5f5f5', minHeight: '100vh' },
  header: { marginBottom: '20px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333' },
  summary: { display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' },
  summaryItem: { padding: '10px 15px', borderRadius: '4px', fontWeight: 'bold', color: 'white' },
  criticalBadge: { backgroundColor: '#dc3545' },
  warningBadge: { backgroundColor: '#ff9800' },
  okBadge: { backgroundColor: '#28a745' },
  controls: { display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', alignItems: 'center' },
  select: { padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer' },
  button: { padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#007bff', color: 'white' },
  buttonGreen: { backgroundColor: '#28a745' },
  buttonRed: { backgroundColor: '#dc3545' },
  tableContainer: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { backgroundColor: '#f8f9fa', padding: '12px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold' },
  td: { padding: '12px', border: '1px solid #ddd' },
  rowCritical: { backgroundColor: '#ffcccc' },
  rowWarning: { backgroundColor: '#fff4e6' },
  rowOk: { backgroundColor: '#e6ffe6' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' },
  input: { width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }
};

const ProductionDelaysView = ({ showToast }) => {
  const [inventoryData, setInventoryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterProject, setFilterProject] = useState('Tutti Progetti');
  const [filterStatus, setFilterStatus] = useState('Tutti gli Status');
  const [loading, setLoading] = useState(true);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);

  // Dati per i modal
  const [consumptionForm, setConsumptionForm] = useState({ pzPerOra: '', tempoCiclo: '' });
  const [inventoryForm, setInventoryForm] = useState({ qty: '' });

  // Load inventory data on mount
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllInventoryCoverage();
      setInventoryData(data);
      applyFilters(data, filterProject, filterStatus);
    } catch (error) {
      console.error('Error loading inventory:', error);
      showToast?.('Errore caricamento dati inventario', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const applyFilters = (data, project, status) => {
    let filtered = data;

    if (project !== 'Tutti Progetti') {
      filtered = filtered.filter(item => item.progetto === project);
    }

    if (status !== 'Tutti gli Status') {
      filtered = filtered.filter(item => item.status === status);
    }

    setFilteredData(filtered);
  };

  const handleFilterChange = (project, status) => {
    setFilterProject(project);
    setFilterStatus(status);
    applyFilters(inventoryData, project, status);
  };

  const handleSaveConsumption = async () => {
    if (!selectedComponent || !consumptionForm.pzPerOra) {
      showToast?.('Compilare i campi obbligatori', 'error');
      return;
    }

    try {
      let pzPerOra = parseFloat(consumptionForm.pzPerOra);

      // Se è stato inserito il tempo ciclo, calcola il consumo
      if (consumptionForm.tempoCiclo) {
        pzPerOra = calculateConsumptionFromCycleTime(parseFloat(consumptionForm.tempoCiclo));
      }

      await saveComponentConsumption(
        selectedComponent.componente,
        selectedComponent.progetto,
        selectedComponent.linea,
        pzPerOra,
        consumptionForm.tempoCiclo ? parseFloat(consumptionForm.tempoCiclo) : null
      );

      showToast?.('Consumo salvato con successo', 'success');
      setShowConsumptionModal(false);
      setConsumptionForm({ pzPerOra: '', tempoCiclo: '' });
      loadData();
    } catch (error) {
      console.error('Error saving consumption:', error);
      showToast?.('Errore salvataggio consumo', 'error');
    }
  };

  const handleSaveInventory = async () => {
    if (!selectedComponent || !inventoryForm.qty) {
      showToast?.('Compilare i campi obbligatori', 'error');
      return;
    }

    try {
      await saveComponentInventory(
        selectedComponent.componente,
        selectedComponent.progetto,
        selectedComponent.linea,
        inventoryForm.qty
      );

      showToast?.('Inventario salvato con successo', 'success');
      setShowInventoryModal(false);
      setInventoryForm({ qty: '' });
      loadData();
    } catch (error) {
      console.error('Error saving inventory:', error);
      showToast?.('Errore salvataggio inventario', 'error');
    }
  };

  const summaryStats = {
    critico: filteredData.filter(d => d.status === 'CRITICO').length,
    warning: filteredData.filter(d => d.status === 'WARNING').length,
    ok: filteredData.filter(d => d.status === 'ON_TRACK').length
  };

  const getRowStyle = (status) => {
    if (status === 'CRITICO') return defaultStyles.rowCritical;
    if (status === 'WARNING') return defaultStyles.rowWarning;
    return defaultStyles.rowOk;
  };

  return (
    <div style={defaultStyles.container}>
      {/* Header */}
      <div style={defaultStyles.header}>
        <div style={defaultStyles.title}>📊 Gestione Ritardi Produzione (Copertura Inventario)</div>

        {/* Summary Badges */}
        <div style={defaultStyles.summary}>
          <div style={{ ...defaultStyles.summaryItem, ...defaultStyles.criticalBadge }}>
            🔴 {summaryStats.critico} Critici
          </div>
          <div style={{ ...defaultStyles.summaryItem, ...defaultStyles.warningBadge }}>
            🟡 {summaryStats.warning} Warning
          </div>
          <div style={{ ...defaultStyles.summaryItem, ...defaultStyles.okBadge }}>
            🟢 {summaryStats.ok} On Track
          </div>
        </div>

        {/* Controls */}
        <div style={defaultStyles.controls}>
          <select
            style={defaultStyles.select}
            value={filterProject}
            onChange={(e) => handleFilterChange(e.target.value, filterStatus)}
          >
            <option>Tutti Progetti</option>
            {PROJECTS.map(p => <option key={p}>{p}</option>)}
          </select>

          <select
            style={defaultStyles.select}
            value={filterStatus}
            onChange={(e) => handleFilterChange(filterProject, e.target.value)}
          >
            <option>Tutti gli Status</option>
            <option>CRITICO</option>
            <option>WARNING</option>
            <option>ON_TRACK</option>
          </select>

          <button style={defaultStyles.button} onClick={loadData}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Caricamento...</div>
      ) : filteredData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '8px' }}>
          Nessun dato disponibile
        </div>
      ) : (
        <div style={defaultStyles.tableContainer}>
          <table style={defaultStyles.table}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={defaultStyles.th}>Componente</th>
                <th style={defaultStyles.th}>Progetto</th>
                <th style={defaultStyles.th}>Linea</th>
                <th style={defaultStyles.th}>Inventario</th>
                <th style={defaultStyles.th}>Consumo/Ora</th>
                <th style={defaultStyles.th}>Gg Copertura</th>
                <th style={defaultStyles.th}>Data Esaurimento</th>
                <th style={defaultStyles.th}>Status</th>
                <th style={defaultStyles.th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => (
                <tr key={idx} style={getRowStyle(item.status)}>
                  <td style={defaultStyles.td}><strong>{item.componente}</strong></td>
                  <td style={defaultStyles.td}>{item.progetto}</td>
                  <td style={defaultStyles.td}>{item.linea}</td>
                  <td style={defaultStyles.td}>{item.qty_disponibile} pz</td>
                  <td style={defaultStyles.td}>{item.pz_per_ora || '-'} pz/ora</td>
                  <td style={defaultStyles.td}>
                    <strong>
                      {item.coverage_days === Infinity ? '∞' : `${item.coverage_days}`}
                    </strong>
                  </td>
                  <td style={defaultStyles.td}>{item.stockout_date || '-'}</td>
                  <td style={defaultStyles.td}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      color: 'white',
                      backgroundColor: item.status === 'CRITICO' ? '#dc3545' : item.status === 'WARNING' ? '#ff9800' : '#28a745'
                    }}>
                      {item.status === 'CRITICO' ? '🔴' : item.status === 'WARNING' ? '🟡' : '🟢'} {item.status}
                    </span>
                  </td>
                  <td style={defaultStyles.td}>
                    <button
                      style={{ ...defaultStyles.button, fontSize: '12px', marginRight: '5px' }}
                      onClick={() => {
                        setSelectedComponent(item);
                        setConsumptionForm({ pzPerOra: item.pz_per_ora || '', tempoCiclo: '' });
                        setShowConsumptionModal(true);
                      }}
                    >
                      Consumo
                    </button>
                    <button
                      style={{ ...defaultStyles.button, ...defaultStyles.buttonGreen, fontSize: '12px' }}
                      onClick={() => {
                        setSelectedComponent(item);
                        setInventoryForm({ qty: item.qty_disponibile });
                        setShowInventoryModal(true);
                      }}
                    >
                      Inventario
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Consumption Modal */}
      {showConsumptionModal && (
        <div style={defaultStyles.modalOverlay} onClick={() => setShowConsumptionModal(false)}>
          <div style={defaultStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Configura Consumo Orario</h3>
            <p><strong>{selectedComponent?.componente}</strong> - {selectedComponent?.progetto} ({selectedComponent?.linea})</p>

            <label>Consumo (pz/ora):</label>
            <input
              type="number"
              style={defaultStyles.input}
              placeholder="Es: 25"
              value={consumptionForm.pzPerOra}
              onChange={(e) => setConsumptionForm({ ...consumptionForm, pzPerOra: e.target.value })}
              step="0.1"
            />

            <label>Oppure Tempo Ciclo (minuti):</label>
            <input
              type="number"
              style={defaultStyles.input}
              placeholder="Es: 2.4"
              value={consumptionForm.tempoCiclo}
              onChange={(e) => setConsumptionForm({ ...consumptionForm, tempoCiclo: e.target.value })}
              step="0.1"
            />
            <small style={{ color: '#666' }}>Se specifichi il tempo ciclo, il consumo sarà calcolato automaticamente (60/min)</small>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={defaultStyles.button} onClick={handleSaveConsumption}>Salva</button>
              <button style={{ ...defaultStyles.button, ...defaultStyles.buttonRed }} onClick={() => setShowConsumptionModal(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {showInventoryModal && (
        <div style={defaultStyles.modalOverlay} onClick={() => setShowInventoryModal(false)}>
          <div style={defaultStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Aggiorna Inventario</h3>
            <p><strong>{selectedComponent?.componente}</strong> - {selectedComponent?.progetto} ({selectedComponent?.linea})</p>

            <label>Quantità Disponibile (pz):</label>
            <input
              type="number"
              style={defaultStyles.input}
              placeholder="Es: 500"
              value={inventoryForm.qty}
              onChange={(e) => setInventoryForm({ qty: e.target.value })}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={defaultStyles.button} onClick={handleSaveInventory}>Salva</button>
              <button style={{ ...defaultStyles.button, ...defaultStyles.buttonRed }} onClick={() => setShowInventoryModal(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionDelaysView;
