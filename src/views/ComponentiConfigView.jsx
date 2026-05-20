/**
 * ComponentiConfigView
 *
 * Gestione configurazione componenti produttivi.
 * Permette di aggiungere, modificare e cancellare operazioni dalla tabella componente_ops.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateComponentiConfig } from '../hooks/useComponentiConfigDB';

const FASI = ['soft', 'ht', 'hard'];

const EMPTY_OP = {
  componente: '',
  op_code: '',
  macchina: '',
  descrizione: '',
  jph: '',
  changeover_min: 0,
  fase: 'soft',
  ordine: 1,
  ht_batch_size: '',
  ht_durata_ore: '',
  target_giornaliero: 550,
  codice_materiale_soft: '',
  codice_materiale_ht: '',
  codice_materiale_hard: '',
};

export default function ComponentiConfigView({ showToast }) {

  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [newForm, setNewForm]   = useState(null);
  const [filterComp, setFilterComp] = useState('');
  const [saving, setSaving]     = useState(false);

  // Carica dati
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('componente_ops')
      .select('*')
      .order('componente')
      .order('ordine');
    if (error) {
      showToast?.('Errore caricamento configurazione', 'error');
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Componenti unici
  const componenti = [...new Set(rows.map(r => r.componente))];
  const rowsFiltrate = filterComp
    ? rows.filter(r => r.componente === filterComp)
    : rows;

  // Salva modifica
  const saveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    const { error } = await supabase
      .from('componente_ops')
      .update({
        macchina: editForm.macchina,
        descrizione: editForm.descrizione,
        jph: editForm.jph ? parseInt(editForm.jph) : null,
        changeover_min: parseInt(editForm.changeover_min) || 0,
        fase: editForm.fase,
        ordine: parseInt(editForm.ordine),
        ht_batch_size: editForm.ht_batch_size ? parseInt(editForm.ht_batch_size) : null,
        ht_durata_ore: editForm.ht_durata_ore ? parseInt(editForm.ht_durata_ore) : null,
        target_giornaliero: parseInt(editForm.target_giornaliero) || 550,
        codice_materiale_soft: editForm.codice_materiale_soft || null,
        codice_materiale_ht: editForm.codice_materiale_ht || null,
        codice_materiale_hard: editForm.codice_materiale_hard || null,
      })
      .eq('id', editingId);
    if (error) {
      showToast?.('Errore salvataggio', 'error');
    } else {
      invalidateComponentiConfig();
      showToast?.('Salvato', 'success');
      setEditingId(null);
      setEditForm(null);
      await load();
    }
    setSaving(false);
  };

  // Salva nuova riga
  const saveNew = async () => {
    if (!newForm?.componente || !newForm?.op_code || !newForm?.macchina) {
      showToast?.('Componente, OP e macchina sono obbligatori', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('componente_ops')
      .insert({
        componente: newForm.componente.toUpperCase(),
        op_code: newForm.op_code,
        macchina: newForm.macchina,
        descrizione: newForm.descrizione,
        jph: newForm.jph ? parseInt(newForm.jph) : null,
        changeover_min: parseInt(newForm.changeover_min) || 0,
        fase: newForm.fase,
        ordine: parseInt(newForm.ordine),
        ht_batch_size: newForm.ht_batch_size ? parseInt(newForm.ht_batch_size) : null,
        ht_durata_ore: newForm.ht_durata_ore ? parseInt(newForm.ht_durata_ore) : null,
        target_giornaliero: parseInt(newForm.target_giornaliero) || 550,
        codice_materiale_soft: newForm.codice_materiale_soft || null,
        codice_materiale_ht: newForm.codice_materiale_ht || null,
        codice_materiale_hard: newForm.codice_materiale_hard || null,
      });
    if (error) {
      showToast?.(error.message.includes('unique') ? 'Combinazione componente+OP già esistente' : 'Errore inserimento', 'error');
    } else {
      invalidateComponentiConfig();
      showToast?.('Operazione aggiunta', 'success');
      setNewForm(null);
      await load();
    }
    setSaving(false);
  };

  // Elimina riga
  const deleteRow = async (id, comp, op) => {
    if (!confirm(`Eliminare ${comp} - OP${op}?`)) return;
    const { error } = await supabase.from('componente_ops').delete().eq('id', id);
    if (error) {
      showToast?.('Errore eliminazione', 'error');
    } else {
      invalidateComponentiConfig();
      showToast?.('Eliminato', 'success');
      await load();
    }
  };

  const s = styles;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Configurazione Componenti</h1>
          <p style={s.subtitle}>
            Gestisci il flusso produttivo: operazioni, macchine, JPH e changeover per ogni componente.
          </p>
        </div>
        <button style={s.btnPrimary} onClick={() => setNewForm({ ...EMPTY_OP })}>
          + Nuova operazione
        </button>
      </div>

      {/* Filtro componente */}
      <div style={s.filterBar}>
        <span style={s.filterLabel}>Filtra componente:</span>
        <button
          style={filterComp === '' ? s.filterBtnActive : s.filterBtn}
          onClick={() => setFilterComp('')}
        >
          Tutti ({rows.length})
        </button>
        {componenti.map(c => (
          <button
            key={c}
            style={filterComp === c ? s.filterBtnActive : s.filterBtn}
            onClick={() => setFilterComp(c)}
          >
            {c} ({rows.filter(r => r.componente === c).length})
          </button>
        ))}
      </div>

      {/* Form nuova operazione */}
      {newForm && (
        <div style={s.newFormCard}>
          <h3 style={s.cardTitle}>Nuova operazione</h3>
          <RowForm
            form={newForm}
            onChange={setNewForm}
            componenti={componenti}
          />
          <div style={s.formActions}>
            <button style={s.btnSecondary} onClick={() => setNewForm(null)}>Annulla</button>
            <button style={s.btnPrimary} onClick={saveNew} disabled={saving}>
              {saving ? 'Salvo...' : 'Aggiungi'}
            </button>
          </div>
        </div>
      )}

      {/* Tabella */}
      {loading ? (
        <div style={s.loading}>Caricamento...</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Componente</th>
                <th style={s.th}>OP</th>
                <th style={s.th}>Macchina</th>
                <th style={s.th}>Descrizione</th>
                <th style={s.th}>JPH</th>
                <th style={s.th}>C/O min</th>
                <th style={s.th}>Fase</th>
                <th style={s.th}>Ordine</th>
                <th style={s.th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltrate.map(row => (
                editingId === row.id ? (
                  <tr key={row.id} style={s.trEditing}>
                    <td style={s.td}><strong>{row.componente}</strong></td>
                    <td style={s.td}><strong>{row.op_code}</strong></td>
                    <td style={s.td}>
                      <input style={s.input} value={editForm.macchina}
                        onChange={e => setEditForm(f => ({ ...f, macchina: e.target.value }))} />
                    </td>
                    <td style={s.td}>
                      <input style={s.input} value={editForm.descrizione}
                        onChange={e => setEditForm(f => ({ ...f, descrizione: e.target.value }))} />
                    </td>
                    <td style={s.td}>
                      <input style={{ ...s.input, width: '60px' }} type="number" value={editForm.jph}
                        onChange={e => setEditForm(f => ({ ...f, jph: e.target.value }))} />
                    </td>
                    <td style={s.td}>
                      <input style={{ ...s.input, width: '60px' }} type="number" value={editForm.changeover_min}
                        onChange={e => setEditForm(f => ({ ...f, changeover_min: e.target.value }))} />
                    </td>
                    <td style={s.td}>
                      <select style={s.input} value={editForm.fase}
                        onChange={e => setEditForm(f => ({ ...f, fase: e.target.value }))}>
                        {FASI.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </td>
                    <td style={s.td}>
                      <input style={{ ...s.input, width: '50px' }} type="number" value={editForm.ordine}
                        onChange={e => setEditForm(f => ({ ...f, ordine: e.target.value }))} />
                    </td>
                    <td style={s.td}>
                      <div style={s.actions}>
                        <button style={s.btnSave} onClick={saveEdit} disabled={saving}>
                          {saving ? '...' : '✓'}
                        </button>
                        <button style={s.btnCancel} onClick={() => { setEditingId(null); setEditForm(null); }}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} style={s.tr}>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: compColor(row.componente) }}>
                        {row.componente}
                      </span>
                    </td>
                    <td style={s.td}><code style={s.code}>{row.op_code}</code></td>
                    <td style={s.td}><span style={s.mac}>{row.macchina}</span></td>
                    <td style={s.td}>{row.descrizione}</td>
                    <td style={s.tdNum}>{row.jph ? `${row.jph} pz/h` : '—'}</td>
                    <td style={s.tdNum}>{row.changeover_min ? `${row.changeover_min} min` : '—'}</td>
                    <td style={s.td}>
                      <span style={{ ...s.faseBadge, ...faseStyle(row.fase) }}>{row.fase}</span>
                    </td>
                    <td style={s.tdNum}>{row.ordine}</td>
                    <td style={s.td}>
                      <div style={s.actions}>
                        <button style={s.btnEdit} onClick={() => { setEditingId(row.id); setEditForm({ ...row }); }}>
                          Modifica
                        </button>
                        <button style={s.btnDelete} onClick={() => deleteRow(row.id, row.componente, row.op_code)}>
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info HT per ogni componente */}
      {componenti.length > 0 && (
        <div style={s.infoSection}>
          <h3 style={s.infoTitle}>Parametri Heat Treatment e Materiali</h3>
          <div style={s.infoGrid}>
            {componenti.map(comp => {
              const htRow = rows.find(r => r.componente === comp && r.fase === 'ht');
              const anyRow = rows.find(r => r.componente === comp);
              if (!htRow && !anyRow) return null;
              return (
                <div key={comp} style={s.infoCard}>
                  <div style={s.infoCardTitle}>{comp}</div>
                  <div style={s.infoLine}>Target: <strong>{anyRow?.target_giornaliero} pz/g</strong></div>
                  {htRow && <>
                    <div style={s.infoLine}>HT Batch: <strong>{htRow.ht_batch_size} pz</strong></div>
                    <div style={s.infoLine}>HT Durata: <strong>{htRow.ht_durata_ore}h</strong></div>
                  </>}
                  <div style={s.infoLine}>Soft: <code style={s.codeSmall}>{anyRow?.codice_materiale_soft || '—'}</code></div>
                  <div style={s.infoLine}>HT: <code style={s.codeSmall}>{anyRow?.codice_materiale_ht || '—'}</code></div>
                  <div style={s.infoLine}>Hard: <code style={s.codeSmall}>{anyRow?.codice_materiale_hard || '—'}</code></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Form per inserimento nuovo
function RowForm({ form, onChange, componenti }) {
  const s = styles;
  const isHT = form.fase === 'ht';
  const update = (k, v) => onChange(f => ({ ...f, [k]: v }));

  return (
    <div style={s.formGrid}>
      <Field label="Componente *">
        <input style={s.input}
          list="comp-list"
          value={form.componente}
          onChange={e => update('componente', e.target.value.toUpperCase())}
          placeholder="es. SG5"
        />
        <datalist id="comp-list">
          {componenti.map(c => <option key={c} value={c} />)}
        </datalist>
      </Field>
      <Field label="OP Code *">
        <input style={s.input} value={form.op_code}
          onChange={e => update('op_code', e.target.value)}
          placeholder="es. 0020 o HT" />
      </Field>
      <Field label="Macchina *">
        <input style={s.input} value={form.macchina}
          onChange={e => update('macchina', e.target.value)}
          placeholder="es. DRA10071" />
      </Field>
      <Field label="Descrizione">
        <input style={s.input} value={form.descrizione}
          onChange={e => update('descrizione', e.target.value)}
          placeholder="es. Soft turning" />
      </Field>
      <Field label="Fase">
        <select style={s.input} value={form.fase} onChange={e => update('fase', e.target.value)}>
          {FASI.map(f => <option key={f}>{f}</option>)}
        </select>
      </Field>
      <Field label="Ordine nel flusso">
        <input style={s.input} type="number" value={form.ordine}
          onChange={e => update('ordine', e.target.value)} />
      </Field>
      {!isHT && (
        <Field label="JPH (pz/ora)">
          <input style={s.input} type="number" value={form.jph}
            onChange={e => update('jph', e.target.value)}
            placeholder="es. 20" />
        </Field>
      )}
      <Field label="Changeover (min)">
        <input style={s.input} type="number" value={form.changeover_min}
          onChange={e => update('changeover_min', e.target.value)} />
      </Field>
      {isHT && (
        <>
          <Field label="HT Batch size (pz)">
            <input style={s.input} type="number" value={form.ht_batch_size}
              onChange={e => update('ht_batch_size', e.target.value)}
              placeholder="es. 144" />
          </Field>
          <Field label="HT Durata (ore)">
            <input style={s.input} type="number" value={form.ht_durata_ore}
              onChange={e => update('ht_durata_ore', e.target.value)}
              placeholder="es. 8" />
          </Field>
        </>
      )}
      <Field label="Target giornaliero (pz)">
        <input style={s.input} type="number" value={form.target_giornaliero}
          onChange={e => update('target_giornaliero', e.target.value)} />
      </Field>
      <Field label="Codice materiale SOFT">
        <input style={s.input} value={form.codice_materiale_soft}
          onChange={e => update('codice_materiale_soft', e.target.value)}
          placeholder="es. M0153401/S" />
      </Field>
      <Field label="Codice materiale HT">
        <input style={s.input} value={form.codice_materiale_ht}
          onChange={e => update('codice_materiale_ht', e.target.value)}
          placeholder="es. M0153401/T" />
      </Field>
      <Field label="Codice materiale HARD">
        <input style={s.input} value={form.codice_materiale_hard}
          onChange={e => update('codice_materiale_hard', e.target.value)}
          placeholder="es. M0153401" />
      </Field>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const COMP_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
const _colorCache = {};
let _idx = 0;
function compColor(comp) {
  if (!_colorCache[comp]) _colorCache[comp] = COMP_COLORS[_idx++ % COMP_COLORS.length];
  return _colorCache[comp];
}

function faseStyle(fase) {
  if (fase === 'soft') return { background: '#dbeafe', color: '#1d4ed8' };
  if (fase === 'ht')   return { background: '#fef3c7', color: '#92400e' };
  if (fase === 'hard') return { background: '#ede9fe', color: '#5b21b6' };
  return {};
}

const styles = {
  page: { maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' },
  title: { fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' },
  subtitle: { fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' },
  filterBar: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterLabel: { fontSize: '12px', color: 'var(--color-text-secondary)', marginRight: '4px' },
  filterBtn: { padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-secondary)' },
  filterBtnActive: { padding: '4px 12px', borderRadius: '20px', border: '1px solid #3b82f6', background: '#dbeafe', cursor: 'pointer', fontSize: '12px', color: '#1d4ed8', fontWeight: 600 },
  newFormCard: { background: 'var(--color-background-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' },
  cardTitle: { fontSize: '14px', fontWeight: 600, margin: '0 0 1rem', color: 'var(--color-text-primary)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' },
  tableWrap: { overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s' },
  trEditing: { borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-secondary)' },
  td: { padding: '8px 12px', color: 'var(--color-text-primary)' },
  tdNum: { padding: '8px 12px', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '12px', color: 'white', fontSize: '11px', fontWeight: 700 },
  faseBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
  mac: { fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-secondary)' },
  code: { fontFamily: 'monospace', fontSize: '12px', background: 'var(--color-background-secondary)', padding: '1px 6px', borderRadius: '4px' },
  codeSmall: { fontFamily: 'monospace', fontSize: '11px' },
  actions: { display: 'flex', gap: '6px' },
  btnPrimary: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  btnSecondary: { padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  btnEdit: { padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '12px', cursor: 'pointer' },
  btnDelete: { padding: '4px 10px', borderRadius: '4px', border: '1px solid #fca5a5', background: 'transparent', color: '#dc2626', fontSize: '12px', cursor: 'pointer' },
  btnSave: { padding: '4px 10px', borderRadius: '4px', border: 'none', background: '#10b981', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  btnCancel: { padding: '4px 10px', borderRadius: '4px', border: 'none', background: '#ef4444', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  input: { padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
  loading: { textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' },
  infoSection: { marginTop: '2rem' },
  infoTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem' },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  infoCard: { background: 'var(--color-background-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem' },
  infoCardTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' },
  infoLine: { fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' },
};
