import React, { useState, useEffect } from 'react';
import {
  fetchProductionDeadlines,
  createProductionDeadline,
  updateProductionDeadline,
  deleteProductionDeadline,
  enrichDeadline
} from '../lib/delayCalculations';
import { getLocalDate } from '../lib/dateUtils';

// Projects and components (same as ComponentFlowView)
const PROJECTS = ["DCT300", "DCT ECO", "8Fe", "RG + DH"];
const PROJECT_COMPONENTS = {
  "DCT300": ["SG1", "DG-REV", "DG", "SG3", "SG4", "SG5", "SG6", "SG7", "SGR", "RG"],
  "8Fe": ["SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "FG5/7"],
  "DCT ECO": ["SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2"],
  "RG + DH": ["RG FD1", "RG FD2", "DH TORNITURA", "DH ASSEMBLAGGIO", "DH SALDATURA"]
};

// Nota: Using inline styles instead of CSS module

// Importa il CSS se esiste, altrimenti usa inline styles
const defaultStyles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  header: {
    marginBottom: '20px',
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#333'
  },
  summary: {
    display: 'flex',
    gap: '20px',
    marginTop: '10px',
    flexWrap: 'wrap'
  },
  summaryItem: {
    padding: '10px 15px',
    borderRadius: '4px',
    fontWeight: 'bold',
    color: 'white'
  },
  criticalBadge: {
    backgroundColor: '#dc3545'
  },
  warningBadge: {
    backgroundColor: '#ff9800'
  },
  okBadge: {
    backgroundColor: '#28a745'
  },
  controls: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  select: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '14px'
  },
  button: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    backgroundColor: '#007bff',
    color: 'white'
  },
  buttonGreen: {
    backgroundColor: '#28a745'
  },
  buttonRed: {
    backgroundColor: '#dc3545'
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflowX: 'auto',
    marginBottom: '20px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  },
  th: {
    backgroundColor: '#f8f9fa',
    padding: '12px',
    textAlign: 'left',
    fontWeight: 'bold',
    borderBottom: '2px solid #dee2e6',
    color: '#333',
    cursor: 'pointer',
    userSelect: 'none'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #dee2e6'
  },
  tdCenter: {
    textAlign: 'center'
  },
  rowCritical: {
    backgroundColor: '#ffe5e5'
  },
  rowWarning: {
    backgroundColor: '#fff3e0'
  },
  rowOk: {
    backgroundColor: '#f1f8f4'
  },
  rowHover: {
    cursor: 'pointer'
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontWeight: 'bold',
    display: 'inline-block',
    fontSize: '12px',
    color: 'white'
  },
  statusCritical: {
    backgroundColor: '#dc3545'
  },
  statusWarning: {
    backgroundColor: '#ff9800'
  },
  statusOk: {
    backgroundColor: '#28a745'
  },
  noData: {
    padding: '40px',
    textAlign: 'center',
    color: '#999',
    fontSize: '16px'
  },
  formModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  formContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
  },
  formGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    fontWeight: 'bold',
    marginBottom: '5px',
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  formButtons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '20px'
  },
  detailsModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001
  },
  detailsContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
    marginBottom: '20px'
  },
  detailsItem: {
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    borderLeft: '4px solid #007bff'
  },
  detailsLabel: {
    fontWeight: 'bold',
    color: '#666',
    fontSize: '12px',
    textTransform: 'uppercase'
  },
  detailsValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    marginTop: '5px'
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#999'
  }
};

export default function ProductionDelaysView({ showToast, globalDate }) {
  const [delays, setDelays] = useState([]);
  const [filteredDelays, setFilteredDelays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterProgetto, setFilterProgetto] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedDelay, setSelectedDelay] = useState(null);
  const [formData, setFormData] = useState({
    progetto: '',
    componente: '',
    quantita_target: '',
    deadline_date: '',
    data_inizio: '',
    note: ''
  });

  // Fetch deadlines on mount
  useEffect(() => {
    loadDeadlines();
  }, []);

  // Apply filters when data changes
  useEffect(() => {
    applyFilters();
  }, [delays, filterProgetto, filterStatus]);

  const loadDeadlines = async () => {
    setLoading(true);
    try {
      const data = await fetchProductionDeadlines();
      setDelays(data);
      showToast?.(`Caricati ${data.length} deadline`, 'info');
    } catch (error) {
      console.error('Error loading deadlines:', error);
      showToast?.('Errore nel caricamento dei deadline', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = delays;

    if (filterProgetto) {
      filtered = filtered.filter(d => d.progetto === filterProgetto);
    }

    if (filterStatus) {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    setFilteredDelays(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDeadlines();
      showToast?.('Deadline aggiornati', 'success');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleComponenteChange = (progetto) => {
    setFormData(prev => ({
      ...prev,
      progetto,
      componente: '' // reset componente
    }));
  };

  const handleSaveDeadline = async () => {
    if (!formData.progetto || !formData.componente || !formData.quantita_target || !formData.deadline_date) {
      showToast?.('Compila tutti i campi obbligatori', 'error');
      return;
    }

    try {
      const newDeadline = await createProductionDeadline(formData);
      const enriched = await enrichDeadline(newDeadline);
      setDelays(prev => [...prev, enriched].sort((a, b) => a.slack - b.slack));
      setFormData({
        progetto: '',
        componente: '',
        quantita_target: '',
        deadline_date: '',
        data_inizio: '',
        note: ''
      });
      setShowFormModal(false);
      showToast?.('Deadline aggiunto con successo', 'success');
    } catch (error) {
      console.error('Error saving deadline:', error);
      showToast?.('Errore nel salvataggio del deadline', 'error');
    }
  };

  const handleDeleteDeadline = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo deadline?')) return;

    try {
      await deleteProductionDeadline(id);
      setDelays(prev => prev.filter(d => d.id !== id));
      setSelectedDelay(null);
      showToast?.('Deadline eliminato', 'success');
    } catch (error) {
      console.error('Error deleting deadline:', error);
      showToast?.('Errore nell\'eliminazione', 'error');
    }
  };

  const countByStatus = (status) => filteredDelays.filter(d => d.status === status).length;

  const getStatusColor = (status) => {
    switch (status) {
      case 'CRITICO':
        return defaultStyles.statusCritical;
      case 'WARNING':
        return defaultStyles.statusWarning;
      case 'ON_TRACK':
        return defaultStyles.statusOk;
      default:
        return { backgroundColor: '#6c757d' };
    }
  };

  const getRowStyle = (status) => {
    switch (status) {
      case 'CRITICO':
        return defaultStyles.rowCritical;
      case 'WARNING':
        return defaultStyles.rowWarning;
      case 'ON_TRACK':
        return defaultStyles.rowOk;
      default:
        return {};
    }
  };

  if (loading) {
    return <div style={defaultStyles.loading}>Caricamento deadline...</div>;
  }

  const componentiPerProgetto = filterProgetto
    ? (PROJECT_COMPONENTS[filterProgetto] || [])
    : [];

  return (
    <div style={defaultStyles.container}>
      {/* Header e Summary */}
      <div style={defaultStyles.header}>
        <div style={defaultStyles.title}>📊 Gestione Ritardi Produzione</div>

        <div style={defaultStyles.summary}>
          <div style={{ ...defaultStyles.summaryItem, ...defaultStyles.criticalBadge }}>
            🔴 {countByStatus('CRITICO')} Critici
          </div>
          <div style={{ ...defaultStyles.summaryItem, ...defaultStyles.warningBadge }}>
            🟡 {countByStatus('WARNING')} Warning
          </div>
          <div style={{ ...defaultStyles.summaryItem, ...defaultStyles.okBadge }}>
            🟢 {countByStatus('ON_TRACK')} On Track
          </div>
        </div>

        {/* Controls */}
        <div style={defaultStyles.controls}>
          <select
            style={defaultStyles.select}
            value={filterProgetto}
            onChange={(e) => setFilterProgetto(e.target.value)}
          >
            <option value="">Tutti i Progetti</option>
            {PROJECTS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            style={defaultStyles.select}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tutti gli Status</option>
            <option value="CRITICO">Critico</option>
            <option value="WARNING">Warning</option>
            <option value="ON_TRACK">On Track</option>
          </select>

          <button
            style={{ ...defaultStyles.button, ...defaultStyles.buttonGreen }}
            onClick={() => setShowFormModal(true)}
          >
            + Aggiungi Deadline
          </button>

          <button
            style={defaultStyles.button}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Aggiornamento...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Tabella */}
      {filteredDelays.length > 0 ? (
        <div style={defaultStyles.tableContainer}>
          <table style={defaultStyles.table}>
            <thead>
              <tr>
                <th style={defaultStyles.th}>Componente</th>
                <th style={defaultStyles.th}>Progetto</th>
                <th style={defaultStyles.th}>Deadline</th>
                <th style={defaultStyles.th}>Target</th>
                <th style={defaultStyles.th}>Effettiva</th>
                <th style={defaultStyles.th}>Mancante</th>
                <th style={defaultStyles.th}>Gg Residui</th>
                <th style={defaultStyles.th}>Slack</th>
                <th style={defaultStyles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDelays.map(delay => (
                <tr
                  key={delay.id}
                  style={{
                    ...defaultStyles.td,
                    ...getRowStyle(delay.status),
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedDelay(delay)}
                >
                  <td style={defaultStyles.td}>{delay.componente}</td>
                  <td style={defaultStyles.td}>{delay.progetto}</td>
                  <td style={defaultStyles.td}>{delay.deadline_date}</td>
                  <td style={{ ...defaultStyles.td, ...defaultStyles.tdCenter }}>
                    {delay.quantita_target}
                  </td>
                  <td style={{ ...defaultStyles.td, ...defaultStyles.tdCenter }}>
                    {delay.quantita_effettiva}
                  </td>
                  <td style={{ ...defaultStyles.td, ...defaultStyles.tdCenter }}>
                    <span style={{
                      fontWeight: 'bold',
                      color: delay.quantita_mancante > 0 ? '#dc3545' : '#28a745'
                    }}>
                      {delay.quantita_mancante}
                    </span>
                  </td>
                  <td style={{ ...defaultStyles.td, ...defaultStyles.tdCenter }}>
                    {delay.giorni_residui}
                  </td>
                  <td style={{ ...defaultStyles.td, ...defaultStyles.tdCenter }}>
                    <span style={{
                      fontWeight: 'bold',
                      color: delay.slack < 0 ? '#dc3545' : delay.slack < 2 ? '#ff9800' : '#28a745'
                    }}>
                      {delay.slack}
                    </span>
                  </td>
                  <td style={defaultStyles.td}>
                    <span style={{ ...defaultStyles.statusBadge, ...getStatusColor(delay.status) }}>
                      {delay.status === 'CRITICO' && '🔴 CRITICO'}
                      {delay.status === 'WARNING' && '🟡 WARNING'}
                      {delay.status === 'ON_TRACK' && '🟢 ON TRACK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={defaultStyles.noData}>
          Nessun deadline trovato. Aggiungi il primo deadline!
        </div>
      )}

      {/* Form Modal */}
      {showFormModal && (
        <div style={defaultStyles.formModal} onClick={() => setShowFormModal(false)}>
          <div style={defaultStyles.formContent} onClick={e => e.stopPropagation()}>
            <h2>Aggiungi Nuovo Deadline</h2>

            <div style={defaultStyles.formGroup}>
              <label style={defaultStyles.label}>Progetto *</label>
              <select
                style={defaultStyles.input}
                value={formData.progetto}
                onChange={(e) => handleComponenteChange(e.target.value)}
              >
                <option value="">Seleziona Progetto</option>
                {PROJECTS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div style={defaultStyles.formGroup}>
              <label style={defaultStyles.label}>Componente *</label>
              <select
                style={defaultStyles.input}
                value={formData.componente}
                onChange={(e) => handleFormChange('componente', e.target.value)}
                disabled={!formData.progetto}
              >
                <option value="">Seleziona Componente</option>
                {componentiPerProgetto.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={defaultStyles.formGroup}>
              <label style={defaultStyles.label}>Quantità Target *</label>
              <input
                type="number"
                style={defaultStyles.input}
                value={formData.quantita_target}
                onChange={(e) => handleFormChange('quantita_target', parseInt(e.target.value) || '')}
                placeholder="Es: 500"
              />
            </div>

            <div style={defaultStyles.formGroup}>
              <label style={defaultStyles.label}>Data Deadline *</label>
              <input
                type="date"
                style={defaultStyles.input}
                value={formData.deadline_date}
                onChange={(e) => handleFormChange('deadline_date', e.target.value)}
              />
            </div>

            <div style={defaultStyles.formGroup}>
              <label style={defaultStyles.label}>Data Inizio (opzionale)</label>
              <input
                type="date"
                style={defaultStyles.input}
                value={formData.data_inizio}
                onChange={(e) => handleFormChange('data_inizio', e.target.value)}
              />
            </div>

            <div style={defaultStyles.formGroup}>
              <label style={defaultStyles.label}>Note</label>
              <textarea
                style={{ ...defaultStyles.input, minHeight: '80px' }}
                value={formData.note}
                onChange={(e) => handleFormChange('note', e.target.value)}
                placeholder="Aggiungi note..."
              />
            </div>

            <div style={defaultStyles.formButtons}>
              <button
                style={{ ...defaultStyles.button, ...defaultStyles.buttonRed }}
                onClick={() => setShowFormModal(false)}
              >
                Annulla
              </button>
              <button
                style={{ ...defaultStyles.button, ...defaultStyles.buttonGreen }}
                onClick={handleSaveDeadline}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedDelay && (
        <div style={defaultStyles.detailsModal} onClick={() => setSelectedDelay(null)}>
          <div style={defaultStyles.detailsContent} onClick={e => e.stopPropagation()}>
            <h2>{selectedDelay.componente} ({selectedDelay.progetto})</h2>

            <div style={defaultStyles.detailsGrid}>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Deadline</div>
                <div style={defaultStyles.detailsValue}>{selectedDelay.deadline_date}</div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Status</div>
                <div style={{ ...defaultStyles.detailsValue, color: getStatusColor(selectedDelay.status).backgroundColor }}>
                  {selectedDelay.status}
                </div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Quantità Target</div>
                <div style={defaultStyles.detailsValue}>{selectedDelay.quantita_target} pz</div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Prodotta</div>
                <div style={defaultStyles.detailsValue}>{selectedDelay.quantita_effettiva} pz</div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Mancante</div>
                <div style={{ ...defaultStyles.detailsValue, color: '#dc3545' }}>
                  {selectedDelay.quantita_mancante} pz
                </div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Giorni Residui</div>
                <div style={defaultStyles.detailsValue}>{selectedDelay.giorni_residui}</div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Slack (Buffer)</div>
                <div style={{
                  ...defaultStyles.detailsValue,
                  color: selectedDelay.slack < 0 ? '#dc3545' : selectedDelay.slack < 2 ? '#ff9800' : '#28a745'
                }}>
                  {selectedDelay.slack} giorni
                </div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>ETA Completamento</div>
                <div style={defaultStyles.detailsValue}>{selectedDelay.eta}</div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Throughput Assunto</div>
                <div style={defaultStyles.detailsValue}>{selectedDelay.throughput} pz/gg</div>
              </div>
              <div style={defaultStyles.detailsItem}>
                <div style={defaultStyles.detailsLabel}>Giorni Necessari</div>
                <div style={defaultStyles.detailsValue}>{selectedDelay.giorni_necessari}</div>
              </div>
            </div>

            {selectedDelay.machines && selectedDelay.machines.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Macchine Coinvolte:</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {selectedDelay.machines.map(m => (
                    <span key={m} style={{
                      backgroundColor: '#e9ecef',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedDelay.note && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Note:</h4>
                <p style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px', fontSize: '13px' }}>
                  {selectedDelay.note}
                </p>
              </div>
            )}

            <div style={defaultStyles.formButtons}>
              <button
                style={{ ...defaultStyles.button, ...defaultStyles.buttonRed }}
                onClick={() => handleDeleteDeadline(selectedDelay.id)}
              >
                Elimina
              </button>
              <button
                style={defaultStyles.button}
                onClick={() => setSelectedDelay(null)}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
