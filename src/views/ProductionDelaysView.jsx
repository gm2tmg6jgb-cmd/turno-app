import React, { useState, useEffect } from 'react';
import {
  fetchProjectComponentPriorities,
  saveComponentInventory,
  saveComponentConsumption,
  calculateConsumptionFromCycleTime
} from '../lib/inventoryCoverageCalculations';
import { supabase } from '../lib/supabase';
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
  summaryItem: { padding: '10px 15px', borderRadius: '4px', fontWeight: 'bold', color: 'white', fontSize: '14px' },
  ritardoBadge: { backgroundColor: '#dc3545' },
  warningBadge: { backgroundColor: '#ff9800' },
  okBadge: { backgroundColor: '#28a745' },
  controls: { display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', alignItems: 'center' },
  select: { padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' },
  button: { padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#007bff', color: 'white', fontSize: '14px' },
  buttonGreen: { backgroundColor: '#28a745' },
  buttonRed: { backgroundColor: '#dc3545' },
  tableContainer: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflowX: 'auto', marginTop: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { backgroundColor: '#f8f9fa', padding: '10px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap' },
  td: { padding: '10px', border: '1px solid #ddd' },
  rowCritical: { backgroundColor: '#ffcccc' },
  rowWarning: { backgroundColor: '#fff4e6' },
  rowOk: { backgroundColor: '#e6ffe6' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' },
  input: { width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontSize: '14px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px', color: '#333' }
};

const ProductionDelaysView = ({ showToast }) => {
  const [prioritiesData, setPrioritiesData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterProject, setFilterProject] = useState('Tutti Progetti');
  const [filterStatus, setFilterStatus] = useState('Tutti gli Status');
  const [loading, setLoading] = useState(true);

  // Modali
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);

  // Form states
  const [consumptionForm, setConsumptionForm] = useState({ pzPerOra: '', tempoCiclo: '' });
  const [inventoryForm, setInventoryForm] = useState({ qty: '' });
  const [targetForm, setTargetForm] = useState({ targetQty: '' });

  // Load priorities data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchProjectComponentPriorities(PROJECT_COMPONENTS);
      setPrioritiesData(data);
      applyFilters(data, filterProject, filterStatus);
    } catch (error) {
      console.error('Error loading priorities:', error);
      showToast?.('Errore caricamento dati ritardi', 'error');
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
    applyFilters(prioritiesData, project, status);
  };

  const handleSaveConsumption = async () => {
    if (!selectedComponent || !consumptionForm.pzPerOra) {
      showToast?.('Compilare i campi obbligatori', 'error');
      return;
    }

    try {
      let pzPerOra = parseFloat(consumptionForm.pzPerOra);

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

  const handleSaveTarget = async () => {
    if (!selectedComponent || !targetForm.targetQty) {
      showToast?.('Compilare quantità target', 'error');
      return;
    }

    try {
      // Prendi il lunedì della settimana corrente
      const today = new Date(getLocalDate(new Date()));
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      const weekStart = getLocalDate(monday);

      const { error } = await supabase
        .from('component_weekly_targets')
        .upsert({
          componente: selectedComponent.componente,
          progetto: selectedComponent.progetto,
          linea: selectedComponent.linea,
          week_start: weekStart,
          target_qty: parseInt(targetForm.targetQty),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'componente,progetto,linea,week_start'
        });

      if (error) throw error;

      showToast?.('Target settimanale salvato', 'success');
      setShowTargetModal(false);
      setTargetForm({ targetQty: '' });
      loadData();
    } catch (error) {
      console.error('Error saving target:', error);
      showToast?.('Errore salvataggio target', 'error');
    }
  };

  const summaryStats = {
    ritardo: filteredData.filter(d => d.status === 'CRITICO').length,
    warning: filteredData.filter(d => d.status === 'WARNING').length,
    ok: filteredData.filter(d => d.status === 'ON_TRACK').length
  };

  const getRowStyle = (status) => {
    if (status === 'CRITICO') return defaultStyles.rowCritical;
    if (status === 'WARNING') return defaultStyles.rowWarning;
    return defaultStyles.rowOk;
  };

  const getPriorityColor = (priority) => {
    if (priority === Infinity) return '#28a745'; // OK
    if (priority < 1) return '#dc3545'; // CRITICO
    if (priority < 5) return '#ff9800'; // WARNING
    return '#28a745'; // OK
  };

  return (
    <div style={defaultStyles.container}>
      {/* Header */}
      <div style={defaultStyles.header}>
        <div style={defaultStyles.title}>⚡ Gestione Ritardi Produzione (Priorità Settimanale)</div>

        {/* Summary Badges */}
        <div style={defaultStyles.summary}>
          <div style={{ ...defaultStyles.summaryItem, ...defaultStyles.ritardoBadge }}>
            🔴 {summaryStats.ritardo} Ritardo
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
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '8px', marginTop: '20px' }}>
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
                <th style={defaultStyles.th}>Target Sett</th>
                <th style={defaultStyles.th}>Prodotto</th>
                <th style={defaultStyles.th}>Gap</th>
                <th style={defaultStyles.th}>Gg Recuperare</th>
                <th style={defaultStyles.th}>Priority</th>
                <th style={defaultStyles.th}>Copertura (gg)</th>
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
                  <td style={defaultStyles.td}><strong>{item.target_qty} pz</strong></td>
                  <td style={defaultStyles.td}>{item.produced} pz</td>
                  <td style={defaultStyles.td}><strong style={{ color: item.gap > 0 ? '#dc3545' : '#28a745' }}>{item.gap} pz</strong></td>
                  <td style={defaultStyles.td}>{item.days_to_recover}</td>
                  <td style={defaultStyles.td}>
                    <strong style={{ color: getPriorityColor(item.priority) }}>
                      {item.priority === Infinity ? '∞' : item.priority.toFixed(2)}
                    </strong>
                  </td>
                  <td style={defaultStyles.td}>
                    <strong>
                      {item.coverage_days === Infinity ? '∞' : `${item.coverage_days}`}
                    </strong>
                  </td>
                  <td style={defaultStyles.td}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      color: 'white',
                      fontSize: '12px',
                      backgroundColor: item.status === 'CRITICO' ? '#dc3545' : item.status === 'WARNING' ? '#ff9800' : '#28a745'
                    }}>
                      {item.status === 'CRITICO' ? '🔴' : item.status === 'WARNING' ? '🟡' : '🟢'} {item.status}
                    </span>
                  </td>
                  <td style={defaultStyles.td}>
                    <button
                      style={{ ...defaultStyles.button, fontSize: '11px', marginRight: '3px', padding: '5px 8px' }}
                      onClick={() => {
                        setSelectedComponent(item);
                        setTargetForm({ targetQty: item.target_qty || '' });
                        setShowTargetModal(true);
                      }}
                      title="Configura target settimanale"
                    >
                      Target
                    </button>
                    <button
                      style={{ ...defaultStyles.button, fontSize: '11px', marginRight: '3px', padding: '5px 8px' }}
                      onClick={() => {
                        setSelectedComponent(item);
                        setConsumptionForm({ pzPerOra: item.pz_per_ora || '', tempoCiclo: '' });
                        setShowConsumptionModal(true);
                      }}
                    >
                      Consumo
                    </button>
                    <button
                      style={{ ...defaultStyles.button, ...defaultStyles.buttonGreen, fontSize: '11px', padding: '5px 8px' }}
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

      {/* Target Modal */}
      {showTargetModal && (
        <div style={defaultStyles.modalOverlay} onClick={() => setShowTargetModal(false)}>
          <div style={defaultStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Configura Target Settimanale</h3>
            <p><strong>{selectedComponent?.componente}</strong> - {selectedComponent?.progetto} ({selectedComponent?.linea})</p>

            <label style={defaultStyles.label}>Quantità Target per Settimana (pz):</label>
            <input
              type="number"
              style={defaultStyles.input}
              placeholder="Es: 500"
              value={targetForm.targetQty}
              onChange={(e) => setTargetForm({ targetQty: e.target.value })}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={defaultStyles.button} onClick={handleSaveTarget}>Salva</button>
              <button style={{ ...defaultStyles.button, ...defaultStyles.buttonRed }} onClick={() => setShowTargetModal(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Consumption Modal */}
      {showConsumptionModal && (
        <div style={defaultStyles.modalOverlay} onClick={() => setShowConsumptionModal(false)}>
          <div style={defaultStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Configura Consumo Orario</h3>
            <p><strong>{selectedComponent?.componente}</strong> - {selectedComponent?.progetto} ({selectedComponent?.linea})</p>

            <label style={defaultStyles.label}>Consumo (pz/ora):</label>
            <input
              type="number"
              style={defaultStyles.input}
              placeholder="Es: 25"
              value={consumptionForm.pzPerOra}
              onChange={(e) => setConsumptionForm({ ...consumptionForm, pzPerOra: e.target.value })}
              step="0.1"
            />

            <label style={defaultStyles.label}>Oppure Tempo Ciclo (minuti):</label>
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

            <label style={defaultStyles.label}>Quantità Disponibile (pz):</label>
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
