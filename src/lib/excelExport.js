import * as XLSX from 'xlsx';
import { formatItalianDate } from './dateUtils';

export function exportProductionReport(data) {
  const {
    reportDate,
    selectedTurno,
    activeTech,
    matrice,
    detailedDowntime,
    activeTechMachines,
    components,
    technologies,
    macchine,
  } = data;

  // Build workbook structure
  const workbookData = buildWorkbookStructure(data);

  // Create workbook and worksheet
  const ws = XLSX.utils.aoa_to_sheet(workbookData);

  // Apply styles
  applyWorksheetStyles(ws, components, activeTech, technologies);

  // Set column widths
  const colWidths = [];
  colWidths[0] = 18; // Macchina
  colWidths[1] = 12; // Fermi
  colWidths[2] = 12; // Totale
  for (let i = 3; i < 3 + components.length; i++) {
    colWidths[i] = 10;
  }
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produzione');

  // Generate filename and download
  const fileName = generateFileName(reportDate, selectedTurno);
  XLSX.writeFile(wb, fileName);
}

function buildWorkbookStructure(data) {
  const {
    reportDate,
    selectedTurno,
    activeTech,
    matrice,
    detailedDowntime,
    activeTechMachines,
    components,
    technologies,
  } = data;

  const rows = [];

  // Row 1: Title
  rows.push(['REPORT PRODUZIONE']);

  // Row 2: Filters info
  const turnoLabel = selectedTurno === 'ALL' ? 'Tutto il giorno' : `Turno ${selectedTurno}`;
  const techLabel = activeTech === 'ALL' ? 'Tutte le tecnologie' : `Tecnologia: ${activeTech}`;
  rows.push([`Data: ${formatItalianDate(reportDate)} | ${turnoLabel} | ${techLabel}`]);

  // Row 3: Empty
  rows.push([]);

  // Row 4: Technology headers with merged cells
  const techRow = ['', '', ''];
  const mergedCells = [];

  let colIdx = 3;
  const techGroups = activeTech === 'ALL'
    ? technologies
    : technologies.filter(t => t.nome === activeTech);

  for (const tech of techGroups) {
    const techComponents = components.filter(c => c.tecnologia_id === tech.id);
    if (techComponents.length > 0) {
      techRow.push(tech.nome);
      for (let i = 1; i < techComponents.length; i++) {
        techRow.push('');
      }
      if (techComponents.length > 1) {
        const startCol = colIdx;
        const endCol = colIdx + techComponents.length - 1;
        mergedCells.push({
          s: { r: 3, c: startCol },
          e: { r: 3, c: endCol },
        });
      }
      colIdx += techComponents.length;
    }
  }
  rows.push(techRow);

  // Row 5: Component headers
  const compRow = ['Macchina', 'Fermi', 'Totale'];
  for (const comp of components) {
    compRow.push(comp.nome);
  }
  rows.push(compRow);

  // Rows 6+: Data
  for (const machineId of activeTechMachines) {
    const machine = matrice[machineId];
    if (!machine) continue;

    const fermiCount = detailedDowntime[machineId] ? detailedDowntime[machineId].length : 0;
    const total = machine.totale || 0;

    const row = [
      machineId,
      fermiCount,
      total,
    ];

    for (const comp of components) {
      const value = machine[comp.id] || 0;
      row.push(value);
    }

    rows.push(row);
  }

  // Attach merged cells to rows array (for later use in styling)
  rows._mergedCells = mergedCells;

  return rows;
}

function applyWorksheetStyles(ws, components, activeTech, technologies) {
  if (!ws['!merges']) {
    ws['!merges'] = [];
  }

  // Apply merged cells for technology headers
  const techGroups = activeTech === 'ALL'
    ? technologies
    : technologies.filter(t => t.nome === activeTech);

  let colIdx = 3;
  for (const tech of techGroups) {
    const techComponents = components.filter(c => c.tecnologia_id === tech.id);
    if (techComponents.length > 1) {
      const startCol = colIdx;
      const endCol = colIdx + techComponents.length - 1;
      ws['!merges'].push({
        s: { r: 3, c: startCol },
        e: { r: 3, c: endCol },
      });
    }
    colIdx += techComponents.length;
  }

  // Apply styles to all cells
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (!ws[cellRef]) continue;

      const cell = ws[cellRef];

      // Header styling (rows 0-4)
      if (row <= 4) {
        cell.font = { bold: true, color: { rgb: '000000' } };
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        if (row === 3 || row === 4) {
          cell.fill = { fgColor: { rgb: 'D3D3D3' } };
          cell.border = {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          };
        }
      } else {
        // Data rows
        cell.alignment = { horizontal: 'center', vertical: 'center' };
        cell.border = {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } },
        };

        // Conditional coloring for data cells (starting from column 3)
        if (col >= 3) {
          const value = cell.v;
          if (typeof value === 'number') {
            cell.fill = getColorForValue(value);
          }
        }

        // Special styling for Fermi column (column 1)
        if (col === 1 && typeof cell.v === 'number' && cell.v > 0) {
          cell.fill = { fgColor: { rgb: 'EF4444' } };
          cell.font = { color: { rgb: 'FFFFFF' }, bold: true };
        }
      }
    }
  }
}

function getColorForValue(value) {
  if (value > 100) {
    return { fgColor: { rgb: 'D1FAE5' } }; // Green
  } else if (value > 50) {
    return { fgColor: { rgb: 'FEF3C7' } }; // Yellow
  } else if (value > 0) {
    return { fgColor: { rgb: 'FEE2E2' } }; // Light red
  }
  return {}; // No color for 0
}

function generateFileName(date, selectedTurno) {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const turnoStr = selectedTurno === 'ALL' ? 'TuttoGiorno' : `Turno${selectedTurno}`;
  return `Report_Produzione_${dateStr}_${turnoStr}.xlsx`;
}
