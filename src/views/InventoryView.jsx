import React, { useState } from 'react';
import { Icons } from '../components/ui/Icons';


const matchPhases = (label) => {
    let l = label.toLowerCase();
    if (l.match(/ore 33|lavaggio ore33/)) return 10;
    if (l.match(/soft turn/)) return 20;
    if (l.match(/weisser/)) return 30;
    if (l.match(/ws coron/)) return 35;
    if (l.match(/dmc/)) return 40;
    if (l.match(/broaching/)) return 50;
    if (l.match(/lavaggio ore 48/)) return 60;
    if (l.match(/laser.w.*sca78/)) return 186; // Assicura che sia DOPO Power Honing (185)
    if (l.match(/laser.w.*sca06|laser.w.*sca08|laser.w.*sca09|laser.w.*sca10|laser.w.*sca151/)) return 70; // Specific early lasers
    if (l.match(/shaping|stozza/)) return 80;
    if (l.match(/milling/)) return 90;
    if (l.match(/hobbing|pfauter|dentare/)) return 100;
    if (l.match(/deburr|sbav|smuss/)) return 110;
    if (l.match(/mozzetta sca/)) return 115;
    if (l.match(/ut |ut[123]? |mza/)) return 120; // Specific early UTs
    if (l.match(/dg car/)) return 125;
    if (l.match(/rh160/)) return 126;
    if (l.match(/da tratta|trattare/)) return 130;
    if (l.match(/ht|in tratt/)) return 140;
    if (l.match(/pallina/)) return 150;
    if (l.match(/emag/)) return 160;
    if (l.match(/cono est|cone.*sla110/)) return 170;
    if (l.match(/cono int|cone.*sla84/)) return 175;
    if (l.match(/power hon/)) return 178;
    if (l.match(/^laser$/)) return 180; // General Laser for SG5
    if (l.match(/^ut$/)) return 185; // General UT for SG5
    if (l.match(/ut1 mza06/)) return 188;
    if (l.match(/cone|cono/)) return 190;
    if (l.match(/grind|rz|sla /)) return 192;
    if (l.match(/us/)) return 195;
    if (l.match(/ac1/)) return 196;
    if (l.match(/da lavare/)) return 200;
    if (l.match(/sala.*ingran|ingran.*sala/)) return 210;
    if (l.match(/ingranometro/)) return 215;
    if (l.match(/sala/)) return 220;
    if (l.match(/finiti /) || l === 'finiti') return 230;
    if (l.match(/blister/)) return 240;
    if (l.match(/sveva/)) return 245;
    if (l.match(/diff/)) return 250;
    if (l.match(/box/)) return 260;
    return 999;
};

const getBgColor = (type, diffVal) => {
    if (type === 'blue') return '#BDD7EE';
    if (type === 'yellow') return '#FFFF00';
    if (type === 'green') return '#C6E0B4';
    if (type === 'gray') return '#D9D9D9';
    if (type === 'cyan') return '#B4E4F1';
    if (type === 'diffColor') return diffVal < 0 ? '#F8CBAD' : '#C6E0B4';
    return 'transparent';
};

const PivotTableGroup = ({ dataGroups, macchine = [], hideFooter = false }) => {

    // Dynamic Label Resolver
    const resolveLabel = (row) => {
        // Find by explicit ID
        if (row.macchina_id && macchine && macchine.length > 0) {
            const m = macchine.find(mac => mac.id === row.macchina_id);
            if (m && m.nome) return m.nome;
        }
        // Find by explicit SAP Code
        if (row.codice_sap && macchine && macchine.length > 0) {
            const m = macchine.find(mac => mac.codice_sap === row.codice_sap);
            if (m && m.nome) return m.nome;
        }

        // As a fallback/extra behavior, if the hardcoded label exactly matches a machine name (case-insensitive) we could return it
        // but for safety we just return the hardcoded label if no explicit ID/SAP is provided yet.
        return row.label;
    };
    const getRowColor = (stepId, cellType) => {
        if (cellType) return getBgColor(cellType);
        // Dynamic backgrounds for specific phases (row-wide)
        if (stepId >= 130 && stepId <= 150) return '#BDD7EE'; // DA TRATTARE, HT, PALLINATURA are Blue
        if (stepId === 230) return '#C6E0B4'; // FINITI is Green
        return 'transparent';
    };
    const columnsWithSteps = dataGroups.map(col => {
        const rowsWithSteps = col.rows.map(r => ({ ...r, stepId: matchPhases(r.label) }));
        const usedSteps = new Set();
        rowsWithSteps.forEach(r => {
            while (usedSteps.has(r.stepId)) { r.stepId += 0.1; }
            usedSteps.add(r.stepId);
        });
        return { ...col, rows: rowsWithSteps };
    });

    const allStepIds = Array.from(
        new Set(columnsWithSteps.flatMap(col => col.rows.map(r => r.stepId)))
    ).sort((a, b) => a - b);

    return (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 9, width: '100%', border: '2px solid #000', backgroundColor: '#fff' }}>
                <colgroup>
                    {columnsWithSteps.map((col, idx) => (
                        <React.Fragment key={"cg-" + idx}>
                            {!col.isVariant && <col style={{ width: '120px' }} />}
                            <col style={{ width: '60px' }} />
                        </React.Fragment>
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        {columnsWithSteps.map((col, idx) => {
                            const isLastInGroup = !columnsWithSteps[idx + 1] || !columnsWithSteps[idx + 1].isVariant;
                            const rightBorder = isLastInGroup ? '2px solid #000' : '1px solid #000';
                            return (
                                <React.Fragment key={"h1-" + idx}>
                                    {!col.isVariant && (
                                        <th contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', borderRight: '1px solid #000', borderBottom: '2px solid #000', padding: 2, textAlign: 'center', outline: 'none', cursor: 'text' }}>
                                            {col.id}
                                        </th>
                                    )}
                                    <th contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', borderRight: rightBorder, borderBottom: '2px solid #000', padding: 2, textAlign: 'center', outline: 'none', cursor: 'text' }}>
                                        {col.code || col.primaryPart}
                                    </th>
                                </React.Fragment>
                            );
                        })}
                    </tr>
                    <tr>
                        {columnsWithSteps.map((col, idx) => {
                            const isLastInGroup = !columnsWithSteps[idx + 1] || !columnsWithSteps[idx + 1].isVariant;
                            const rightBorder = isLastInGroup ? '2px solid #000' : '1px solid #000';
                            return (
                                <React.Fragment key={"h2-" + idx}>
                                    {!col.isVariant && (
                                        <th contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', borderRight: '1px solid #000', padding: 2, textAlign: 'center', fontWeight: 'normal', outline: 'none', cursor: 'text' }}>
                                            {col.rackSize ? 'rack size ' + col.rackSize : ''}
                                        </th>
                                    )}
                                    <th contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', borderRight: rightBorder, padding: 2, textAlign: 'center', fontWeight: 'bold', outline: 'none', cursor: 'text' }}>
                                        {col.primaryPart ? col.primaryPart + '/S' : ''}
                                    </th>
                                </React.Fragment>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {allStepIds.map(stepId => (
                        <tr key={"step-" + stepId} style={{ borderBottom: '1px solid #000', height: 20 }}>
                            {columnsWithSteps.map((col, idx) => {
                                const isLastInGroup = !columnsWithSteps[idx + 1] || !columnsWithSteps[idx + 1].isVariant;
                                const rightBorder = isLastInGroup ? '2px solid #000' : '1px solid #000';
                                const cellRow = col.rows.find(r => r.stepId === stepId);
                                if (!cellRow) {
                                    return (
                                        <React.Fragment key={"empty-" + stepId + "-" + col.id}>
                                            {!col.isVariant && <td style={{ fontSize: 9, border: '1px solid #000', borderRight: '1px solid #000', padding: '0 4px', width: '110px' }}></td>}
                                            <td style={{ fontSize: 9, border: '1px solid #000', borderRight: rightBorder, width: '50px' }}></td>
                                        </React.Fragment>
                                    );
                                }
                                const bgColor = getRowColor(stepId, cellRow.type);
                                return (
                                    <React.Fragment key={"cell-" + stepId + "-" + col.id}>
                                        {!col.isVariant && (
                                            <td
                                                contentEditable={true}
                                                suppressContentEditableWarning={true}
                                                style={{
                                                    fontSize: 9,
                                                    border: '1px solid #000',
                                                    borderRight: '1px solid #000',
                                                    padding: '0 4px',
                                                    backgroundColor: bgColor,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    width: '110px',
                                                    cursor: 'text',
                                                    outline: 'none'
                                                }}>
                                                {resolveLabel(cellRow)}
                                            </td>
                                        )}
                                        <td
                                            contentEditable={true}
                                            suppressContentEditableWarning={true}
                                            style={{
                                                fontSize: 9,
                                                border: '1px solid #000',
                                                borderRight: rightBorder,
                                                textAlign: 'center',
                                                backgroundColor: bgColor,
                                                fontWeight: cellRow.value ? 'bold' : 'normal',
                                                width: '50px',
                                                cursor: 'text',
                                                outline: 'none'
                                            }}>
                                            {cellRow.value || ''}
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    ))}
                    <tr style={{ backgroundColor: '#eee', height: 20 }}>
                        {columnsWithSteps.map(col => (
                            <React.Fragment key={"totwip-" + col.id}>
                                <td style={{ fontSize: 9, border: '1px solid #000', borderRight: '1px solid #000', padding: '0 4px', fontWeight: 'bold' }}>{col.totLabel || 'Tot. WIP'}</td>
                                <td contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', borderRight: '2px solid #000', textAlign: 'center', fontWeight: 'bold', outline: 'none', cursor: 'text' }}>{col.totWip}</td>
                            </React.Fragment>
                        ))}
                    </tr>
                    <tr style={{ backgroundColor: '#C6E0B4', height: 20, borderBottom: '2px solid #000' }}>
                        {columnsWithSteps.map(col => (
                            <React.Fragment key={"totfiniti-" + col.id}>
                                <td style={{ fontSize: 9, border: '1px solid #000', borderRight: '1px solid #000', padding: '0 4px', fontWeight: 'bold' }}>TOT FINITI</td>
                                <td contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', borderRight: '2px solid #000', textAlign: 'center', fontWeight: 'bold', outline: 'none', cursor: 'text' }}>{col.totFiniti}</td>
                            </React.Fragment>
                        ))}
                    </tr>
                    {!hideFooter && <tr style={{ height: 24 }}>
                        {columnsWithSteps.map(col => (
                            <React.Fragment key={"diff-" + col.id}>
                                <td style={{ fontSize: 9, border: '1px solid #000', borderRight: '1px solid #000', padding: '0 4px', fontWeight: 'bold' }}>{col.grandLabel || col.grandTotal}</td>
                                <td style={{
                                    fontSize: 9,
                                    border: '1px solid #000',
                                    borderRight: '2px solid #000',
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    backgroundColor: getBgColor('diffColor', col.diff)
                                }}>
                                    {col.diff}
                                </td>
                            </React.Fragment>
                        ))}
                    </tr>}
                    {!hideFooter && <tr>
                        {columnsWithSteps.map(col => (
                            <td key={"note-" + col.id} colSpan="2" style={{
                                fontSize: 9,
                                border: '1px solid #000',
                                borderRight: '2px solid #000',
                                backgroundColor: col.footerNote ? '#FFCC00' : 'transparent',
                                textAlign: 'center',
                                padding: col.footerNote ? 2 : 0,
                                fontWeight: 'bold'
                            }}>
                                {col.footerNote || ''}
                            </td>
                        ))}
                    </tr>}
                </tbody>
            </table>
        </div>
    );
};

const InventoryView = ({ showToast, macchine = [] }) => {
    const [activeTab, setActiveTab] = useState('8Fe');

    const tabs = ['DCT 300', '8Fe', 'DCT Eco'];

    const data8FeRow1 = [
        {
            id: 'SG2', code: 'M0153390-790', rackSize: '60 pz', primaryPart: 'M0153389',
            rows: [
                // ESEMPIO DI CONFIGURAZIONE DINAMICA:
                // Aggiungendo codice_sap o macchina_id, PivotTableGroup chiederà il nome all'Anagrafica Macchine.
                // Es: Se in anagrafica c'è una macchina FRW14020 chiamata "WEISSER NUOVA", la label diventerà "WEISSER NUOVA".
                // Se non viene trovata, userà la label scritta qua (es. "Soft Turning dra60") come fallback di sicurezza!
                { label: 'Soft Turning dra60', codice_sap: 'FRW14020', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'Laser W sca10', value: '' },
                { label: 'Hobbing frw193 (frw 217)', value: '' },
                { label: 'Deburring egw18', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (120)', value: '' },
                { label: 'Emag dra110/111', value: '' },
                { label: 'Grinding rz48', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Sala', value: '', type: 'yellow' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: ''
        },
        {
            id: 'SG3', code: 'M0153402-790', rackSize: '72 pz', primaryPart: 'M0153401',
            rows: [
                { label: 'Soft Turning dra60 - 71', value: '' },
                { label: 'DMC zsa19', value: '', type: 'green' }, // green in image
                { label: 'Laser W est sca08', value: '' },
                { label: 'Laser W int sca10', value: '' },
                { label: 'Hobbing frw77 (frw 79)', value: '' },
                { label: 'Deburring 08', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (144)', value: '', type: 'blue' },
                { label: 'Grinding cone sla108', value: '' },
                { label: 'Emag dra009', value: '' },
                { label: 'Grinding rz48/10', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: ''
        },
        {
            id: 'SG4', code: 'M0153400-791', rackSize: '48 pz', primaryPart: 'M0170686',
            rows: [
                { label: 'Soft Turning dra65/66', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'Laser W sca09', value: '' },
                { label: 'Shaping stw07', value: '' },
                { label: 'Milling frw23', value: '' },
                { label: 'Hobbing frw77 (frw 79)', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (144)', value: '', type: 'blue' },
                { label: 'Emag dra97/98', value: '' },
                { label: 'Grinding rz48/44', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: ''
        },
        {
            id: 'SG5', code: 'M0153394-790', rackSize: '96 pz', primaryPart: 'M0155199',
            rows: [
                { label: 'Soft Turning dra61', value: '', type: 'green' },
                { label: 'DMC zsa19', value: '' },
                { label: 'Laser W sca09', value: '' },
                { label: 'Hobbing frw62', value: '' },
                { label: 'Deburring egw08', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (288)', value: '', type: 'blue' },
                { label: 'Grinding cone sla08', value: '' },
                { label: 'Grinding rz48', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: ''
        },
        {
            id: 'SG6', code: 'M0153388-790', rackSize: '120 pz', primaryPart: 'M0153387',
            rows: [
                { label: 'Soft Turning dra69/70', value: '' },
                { label: 'Hobbing frw78', value: '' },
                { label: 'Laser W sca151', value: '' },
                { label: 'UT mza05', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (360)', value: '' },
                { label: 'Ingranometro', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: '',
            footerNote: 'da riprendere ingran'
        },
        {
            id: 'SG7', code: 'M0153404-790', rackSize: '120 pz', primaryPart: 'M0155201',
            rows: [
                { label: 'Soft Turning dra69/70', value: '' },
                { label: 'Hobbing frw 180', value: '' },
                { label: 'Deburring egw05', value: '' },
                { label: 'Laser W sca151', value: '' }, // Wait image says 120? Let's check SG7
                // Re-checking SG7: Hobbing frw 180 (960), Deburring egw05 (1560), Laser W sca151 (120). 
                // Ah, the 420 is Grinding cone sla109.
                { label: 'UT mza05', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (360)', value: '' },
                { label: 'Grinding cone SLA109', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Ingranometro/sala', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: '',
            footerNote: 'da riprendere ingran'
        }
    ];

    const data8FeRow2 = [
        {
            id: 'SG8', code: 'M0153398-790', rackSize: '120 pz', primaryPart: 'M0153397',
            rows: [
                { label: 'Soft Turning dra62', value: '' },
                { label: 'Hobbing frw180', value: '' },
                { label: 'Laser W sca151', value: '' },
                { label: 'UT mza05', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (360)', value: '', type: 'blue' },
                { label: 'Grinding cone sla87', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Ingranometro', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: '',
            footerNote: 'da riprendere ingran / da mis sala'
        },
        {
            id: 'SGR', code: 'M0153392-790', rackSize: '66 pz', primaryPart: 'M0153391',
            rows: [
                { label: 'Soft Turning dra60 - 71', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'Laser W sca08', value: '' },
                { label: 'Hobbing frw140', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (198)', value: '' },
                { label: 'Emag dra101/107', value: '' },
                { label: 'Grinding rz26', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: ''
        },
        {
            id: 'PG', code: 'M0154996-790', rackSize: '120 pz', primaryPart: 'M0154995',
            rows: [
                { label: 'Soft Turning dra62', value: '' },
                { label: 'DMC ZSA19', value: '' },
                { label: 'Broaching raa009', value: '' },
                { label: 'Lavaggio ORE 48/49', value: '' },
                { label: 'Hobbing FRW82', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (360)', value: '' },
                { label: 'Emag dra109', value: '' },
                { label: 'Grinding rz26', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: ''
        },
        {
            id: 'FG5/7', code: 'M0153383-790', rackSize: '120 pz', primaryPart: 'M0155197',
            rows: [
                { label: 'Soft Turning dra61', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'Hobbing frw78', value: '' },
                { label: 'Sbavatura egw14', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (288)', value: '', type: 'blue' },
                { label: 'Pallinatura', value: '', type: 'blue' },
                { label: 'Emag dra109', value: '' },
                { label: 'Grinding rz26', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'box', value: '' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: '',
            footerNote: 'da misurare sala'
        },
        {
            id: 'RG FD1', code: 'M0153407-791', rackSize: '28 pz', primaryPart: 'M153407',
            rows: [
                { label: 'Soft Turning dra58/59', value: '' },
                { label: 'DMC zsa22', value: '' },
                { label: 'Hobbing frw73/1189', value: '' },
                { label: 'Sbavatura egw07', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (60)', value: '', type: 'blue' },
                { label: 'Emag dra190', value: '' },
                { label: 'Grinding rz29', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Sala', value: '', type: 'yellow' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'diff saldati', value: '', type: 'cyan' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: '',
            footerNote: 'diff saldati rec smontaggio 420'
        },
        {
            id: 'RG FD2', code: 'M0153703-791', rackSize: '28 pz', primaryPart: 'M153703',
            rows: [
                { label: 'Soft Turning dra58/59', value: '' },
                { label: 'DMC zsa22', value: '' },
                { label: 'Hobbing frw73/189', value: '' },
                { label: 'Sbavatura egw07', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (60)', value: '', type: 'blue' },
                { label: 'Emag dra190', value: '' },
                { label: 'Grinding rz29', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Sala', value: '', type: 'yellow' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'diff saldati', value: '', type: 'cyan' },
            ],
            totWip: '', totFiniti: '', grandTotal: '', diff: ''
        }
    ];

    const summaryData8Fe = [
        { label: 'wip+finiti', values: Array(12).fill('') },
        { label: 'gg di copertura wip + finiti', values: Array(12).fill('') },
        { label: 'gg di copertura solo finiti', values: Array(12).fill('') }
    ];

    const differentialHouse8Fe = [
        { cat: 'A - Torniti', code: 'M0150712', qta: '', gg: '' },
        { cat: 'B - Torniti Sferico', code: 'M0150712', qta: '', gg: '' },
        { cat: 'C - Lavati', code: 'M0150712', qta: '', gg: '' },
        { cat: 'D - Assemblati', code: 'M0150743', qta: '', gg: '' },
        { cat: 'diff saldati recuperati da smontaggio', code: '', qta: '', gg: '' }
    ];

    // --- DCT ECO DATA ---
    const dataEcoRow1 = [
        {
            id: 'SG2', code: 'M0162645-784', rackSize: '80 pz', primaryPart: 'M0162644',
            rows: [
                { label: 'Laser W sca06 (151)', value: '' },
                { label: 'UT mza05', value: '' },
                { label: 'Hobbing frw78', value: '' },
                { label: 'Deburring egw08', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (240)', value: '', type: 'blue' },
                { label: 'Pallinatura', value: '', type: 'blue' },
                { label: 'Emag dra110/111', value: '' },
                { label: 'Grinding rz14', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandLabel: 'DELTA FINITI', diff: '', totLabel: 'Tot.'
        },
        {
            id: 'SG3', code: 'M0162624-784', rackSize: '120 pz', primaryPart: 'M0162623',
            rows: [
                { label: 'Laser W sca78(151)', value: '' },
                { label: 'UT mza08', value: '' },
                { label: 'Hobbing frw76', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (240)', value: '', type: 'blue' },
                { label: 'Cono esterno sla110', value: '' },
                { label: 'Cono interno sla84', value: '' },
                { label: 'Grinding Rz44', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandLabel: 'DELTA FINITI', diff: '', totLabel: 'Tot.'
        },
        {
            id: 'SG4', code: 'M0162639-785', rackSize: '120 pz', primaryPart: 'M0162637',
            rows: [
                { label: 'Shaping stw07', value: '' },
                { label: 'Milling fra25', value: '' },
                { label: 'Hobbing frw217', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (240)', value: '', type: 'blue' },
                { label: 'Emag pre w dra 99/100', value: '' },
                { label: 'Grinding Rz14', value: '' },
                { label: 'Laser W Sca78', value: '' },
                { label: 'UT mza05', value: '' },
                { label: 'Cone Grinding sla92', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandLabel: 'DELTA FINITI', diff: '', totLabel: 'Tot.'
        },
        {
            id: 'SG5', code: 'M0162622-784', rackSize: '120 pz', primaryPart: 'M0162621',
            rows: [
                { label: 'Hobbing frw62', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (600)', value: '', type: 'blue' },
                { label: 'Emag', value: '' },
                { label: 'Power Honing', value: '' },
                { label: 'Laser', value: '' },
                { label: 'UT', value: '' },
                { label: 'Cone Grinding', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandLabel: 'DELTA FINITI', diff: '', totLabel: 'Tot.'
        },
        {
            id: 'SGR', code: 'M162624-784', rackSize: '80 pz', primaryPart: 'M162623',
            rows: [
                { label: 'Laser W sca06 (151)', value: '' },
                { label: 'UT mza05', value: '' },
                { label: 'Hobbing frw79', value: '' },
                { label: 'Deburring egw08', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (240)', value: '' },
                { label: 'Emag dra101/107', value: '' },
                { label: 'Grinding rz14', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: '', totFiniti: '', grandLabel: 'DELTA FINITI', diff: '', totLabel: 'Tot.'
        },
        {
            id: 'RG-FD1', code: 'M0162587-790', rackSize: '32 pz', primaryPart: 'M0162587 61A',
            rows: [
                { label: 'Hobbing frw15', value: '' },
                { label: 'Deburring egw06', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (60)', value: '' },
                { label: 'Pallinatura', value: '' },
                { label: 'Emag dra190', value: '' },
                { label: 'Grinding rz29', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '', type: 'green' }, // box counts as row for Eco too
            ],
            totWip: '', totFiniti: '', grandLabel: 'DELTA FINITI', diff: '', totLabel: 'Tot.'
        },
        {
            id: 'RG-FD2', code: 'M0162901-790', rackSize: '32 pz', primaryPart: 'M0162901 61E',
            rows: [
                { label: 'Hobbing frw15', value: '' },
                { label: 'Deburring egw06', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (60)', value: '', type: 'blue' },
                { label: 'Emag dra190', value: '' },
                { label: 'Grinding rz29', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '', type: 'green' },
                { label: 'Box', value: '', type: 'green' },
            ],
            totWip: '', totFiniti: '', grandLabel: 'DELTA FINITI', diff: '', totLabel: 'Tot.'
        }
    ];

    const summaryDataEco = [
        { label: 'wip + finiti', values: Array(7).fill('') },
        { label: 'gg copertura wip + finiti', values: Array(7).fill('') },
        { label: 'gg copertura finiti', values: Array(7).fill('') }
    ];


    const sg1Rows = [
        { label: 'ORE 33', value: '' },
        { label: 'LASER', value: '' },
        { label: 'PFAUTER', value: '', type: 'green' },
        { label: 'SMUSSATURA', value: '' },
        { label: 'DA TRATTARE', value: '', type: 'blue' },
        { label: 'IN TRATT.', value: '', type: 'blue' },
        { label: 'DA PALLINARE', value: '', type: 'orange' },
        { label: 'EMAG', value: '' },
        { label: 'RH160', value: '' },
        { label: 'DA LAVARE', value: '', type: 'green' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const dg2Rows = [
        { label: 'WS CORONCINA', value: '' },
        { label: 'PFAUTER MOZZETTO', value: '' },
        { label: 'mozzetta SCA110/6', value: '', type: 'orange' },
        { label: 'US', value: '' },
        { label: 'DG car SCA110/6', value: '' },
        { label: 'PFAUTER DG', value: '', type: 'orange' },
        { label: 'DA TRATTARE', value: '', type: 'blue' },
        { label: 'IN TRATT.', value: '', type: 'blue' },
        { label: 'DA PALLINARE', value: '', type: 'green' },
        { label: 'ore33', value: '' },
        { label: 'AC1', value: '', type: 'green' },
        { label: 'RH160', value: '' },
        { label: 'DA LAVARE', value: '' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const sg5Rows = [
        { label: 'WEISSER', value: '' },
        { label: 'PFAUTER', value: '' },
        { label: 'DA TRATTARE', value: '', type: 'blue' },
        { label: 'IN TRATT.', value: '', type: 'blue' },
        { label: 'EMAG', value: '' },
        { label: 'RH160', value: '' },
        { label: 'LASER', value: '', type: 'red' },
        { label: 'US', value: '' },
        { label: 'AC1', value: '', type: 'green' },
        { label: 'DA LAVARE', value: '' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const sg6Rows = [
        { label: 'WEISSER', value: '' },
        { label: 'DA TRATTARE', value: '', type: 'blue' },
        { label: 'IN TRATT.', value: '', type: 'blue' },
        { label: 'EMAG', value: '' },
        { label: 'RH160', value: '' },
        { label: 'LASER', value: '', type: 'orange' },
        { label: 'US', value: '' },
        { label: 'AC1', value: '', type: 'green' },
        { label: 'DA LAVARE', value: '' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const data300Row1 = [
        { id: 'SG1',  code: 'LOW TORQUE M0140994', rackSize: ' ', primaryPart: 'M0140994', rows: sg1Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '', footerNote: 'blister' },
        { id: 'SG1b', code: '', rackSize: '', primaryPart: '', rows: sg1Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'DG2',  code: 'LOW TORQUE M0156540', rackSize: ' ', primaryPart: 'M0156540', rows: dg2Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'DG2b', code: '', rackSize: '', primaryPart: '', rows: dg2Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'DG2c', code: '', rackSize: '', primaryPart: '', rows: dg2Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG5',  code: '2511108851', rackSize: ' ', primaryPart: '2511108851', rows: sg5Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG5b', code: '', rackSize: '', primaryPart: '', rows: sg5Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG5c', code: '', rackSize: '', primaryPart: '', rows: sg5Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG6',  code: '2511109250', rackSize: ' ', primaryPart: '2511109250', rows: sg6Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG6b', code: '', rackSize: '', primaryPart: '', rows: sg6Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG6c', code: '', rackSize: '', primaryPart: '', rows: sg6Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
    ];

    const sg3Rows = [
        { label: 'LORENZ', value: '' },
        { label: 'PFAUTER WEIMA', value: '' },
        { label: 'PFAUTER', value: '' },
        { label: 'ORE 33', value: '' },
        { label: 'DA TRATTARE', value: '', type: 'blue' },
        { label: 'IN TRATT.', value: '', type: 'blue' },
        { label: 'AC1', value: '' },
        { label: 'RH160', value: '', type: 'green' },
        { label: 'DA LAVARE', value: '' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const sg4Rows = [
        { label: 'WEISSER', value: '' },
        { label: 'LASER', value: '', type: 'orange' },
        { label: 'PFAUTER', value: '', type: 'orange' },
        { label: 'DA TRATTARE', value: '', type: 'blue' },
        { label: 'IN TRATT.', value: '', type: 'blue' },
        { label: 'AC1', value: '', type: 'green' },
        { label: 'RH160', value: '', type: 'green' },
        { label: 'DA LAVARE', value: '' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const rgRows = [
        { label: 'DA DENTARE', value: '' },
        { label: 'DA SBAVARE', value: '' },
        { label: 'DA LAVARE', value: '' },
        { label: 'IN TRATTAM.', value: '', type: 'blue' },
        { label: 'DA PALLIN.', value: '', type: 'green' },
        { label: 'EMAG', value: '', type: 'green' },
        { label: 'RH250', value: '' },
        { label: 'DA LAVARE', value: '', type: 'green' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const sg7Rows = [
        { label: 'WEISSER', value: '' },
        { label: 'STOZZA', value: '', type: 'green' },
        { label: 'PFAUTER', value: '', type: 'green' },
        { label: 'DA TRATTARE', value: '', type: 'blue' },
        { label: 'IN TRATTAM.', value: '', type: 'blue' },
        { label: 'EMAG', value: '' },
        { label: 'RH160', value: '' },
        { label: 'DA LAVARE', value: '' },
        { label: 'FINITI', value: '', type: 'green' }
    ];
    const data300Row2 = [
        { id: 'SG3',  code: '2511108850', rackSize: ' ', primaryPart: '2511108850', rows: sg3Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '', footerNote: 'blister' },
        { id: 'SG3b', code: '', rackSize: '', primaryPart: '', rows: sg3Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG3c', code: '', rackSize: '', primaryPart: '', rows: sg3Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG4',  code: '2511108750', rackSize: ' ', primaryPart: '2511108750', rows: sg4Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG4b', code: '', rackSize: '', primaryPart: '', rows: sg4Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG4c', code: '', rackSize: '', primaryPart: '', rows: sg4Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'RG',   code: 'LOW TORQUE M0140999', rackSize: ' ', primaryPart: 'M0140999', rows: rgRows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '', footerNote: 'Blister' },
        { id: 'RGb',  code: '', rackSize: '', primaryPart: '', rows: rgRows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'RGc',  code: '', rackSize: '', primaryPart: '', rows: rgRows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG7',  code: '2511109050', rackSize: ' ', primaryPart: '2511109050', rows: sg7Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG7b', code: '', rackSize: '', primaryPart: '', rows: sg7Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SG7c', code: '', rackSize: '', primaryPart: '', rows: sg7Rows.map(r => ({ ...r })), totWip: '', totFiniti: '', grandLabel: '', diff: '' },
        { id: 'SGRW', code: '2511109451', rackSize: ' ', primaryPart: '2511109451', rows: [
            { label: 'ORE33', value: '' },
            { label: 'LASER', value: '' },
            { label: 'PFAUTER', value: '', type: 'orange' },
            { label: 'DA TRATTAM', value: '', type: 'blue' },
            { label: 'IN TRATTAM.', value: '', type: 'blue' },
            { label: 'PALLINATURA', value: '', type: 'green' },
            { label: 'EMAG', value: '', type: 'red' },
            { label: 'RH160', value: '' },
            { label: 'DA LAVARE', value: '', type: 'green' },
            { label: 'FINITI', value: '', type: 'green' }
        ], totWip: '', totFiniti: '', grandLabel: '', diff: '' },
    ];
    if (activeTab === 'DCT Eco') {
        return (
            <div className="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'auto' }}>
                <div className="card" style={{ padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {tabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 'var(--radius)', background: activeTab === tab ? 'var(--primary)' : 'transparent', color: activeTab === tab ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{tab}</button>
                        ))}
                    </div>
                </div>

                <div style={{ padding: 10, background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {/* Project Header Labels */}
                    <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', marginBottom: -2, border: '2px solid #000', borderBottom: 'none' }}>
                        <colgroup>
                            {dataEcoRow1.map(col => (
                                <React.Fragment key={"cgt-" + col.id}>
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '60px' }} />
                                </React.Fragment>
                            ))}
                        </colgroup>
                        <tbody>
                            <tr style={{ height: 40 }}>
                                <th contentEditable={true} suppressContentEditableWarning={true} colSpan="2" style={{ border: '1px solid #000', textAlign: 'center', fontSize: 14, fontWeight: 700, outline: 'none', cursor: 'text' }}><span style={{ fontSize: 11 }}>domanda wk FD1</span></th>
                                <th contentEditable={true} suppressContentEditableWarning={true} colSpan="2" style={{ border: '1px solid #000', textAlign: 'center', fontSize: 14, fontWeight: 700, outline: 'none', cursor: 'text' }}><span style={{ fontSize: 11 }}>domanda wk FD2</span></th>
                                <th contentEditable={true} suppressContentEditableWarning={true} colSpan="2" style={{ border: '1px solid #000', textAlign: 'center', fontSize: 14, fontWeight: 700, outline: 'none', cursor: 'text' }}></th>
                                <th contentEditable={true} suppressContentEditableWarning={true} colSpan="2" style={{ border: '1px solid #000', textAlign: 'center', fontSize: 14, fontWeight: 700, outline: 'none', cursor: 'text' }}></th>
                                <th contentEditable={true} suppressContentEditableWarning={true} colSpan="2" style={{ border: '1px solid #000', textAlign: 'center', fontSize: 14, fontWeight: 700, outline: 'none', cursor: 'text' }}></th>
                                <th contentEditable={true} suppressContentEditableWarning={true} colSpan="4" style={{ border: '1px solid #000', textAlign: 'center', fontSize: 14, fontWeight: 700, outline: 'none', cursor: 'text' }}></th>
                            </tr>
                        </tbody>
                    </table>
                    {/* Eco Blocks */}
                    <PivotTableGroup dataGroups={dataEcoRow1} macchine={macchine} hideFooter={true} />
                    {/* Eco Summary */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11, border: '2px solid #000', borderTop: 'none' }}>
                        <colgroup>
                            {dataEcoRow1.map(col => (
                                <React.Fragment key={"cgb-" + col.id}>
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '60px' }} />
                                </React.Fragment>
                            ))}
                        </colgroup>
                        <tbody>
                            {summaryDataEco.map((row, rIdx) => (
                                <tr key={rIdx}>
                                    {row.values.map((val, vIdx) => (
                                        <React.Fragment key={vIdx}>
                                            <td style={{ fontSize: 9, border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>{vIdx === 0 ? row.label : ''}</td>
                                            <td contentEditable={true} suppressContentEditableWarning={true} style={{
                                                fontSize: 9,
                                                border: '1px solid #000',
                                                padding: 4,
                                                textAlign: 'center',
                                                fontWeight: 'bold',
                                                outline: 'none',
                                                cursor: 'text'
                                            }}>
                                                {val}
                                            </td>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (activeTab === 'DCT 300') {
        return (
            <div className="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'auto' }}>
                <div className="card" style={{ padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {tabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 'var(--radius)', background: activeTab === tab ? 'var(--primary)' : 'transparent', color: activeTab === tab ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{tab}</button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 30, padding: 10, background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <PivotTableGroup dataGroups={data300Row1} macchine={macchine} hideFooter={true} />
                    <PivotTableGroup dataGroups={data300Row2} macchine={macchine} hideFooter={true} />
                </div>
            </div>
        );
    }


    return (
        <div className="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'auto' }}>
            <div className="card" style={{ padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    {tabs.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 'var(--radius)', background: activeTab === tab ? 'var(--primary)' : 'transparent', color: activeTab === tab ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{tab}</button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 30, padding: 10, background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }}>
                {/* Row 1 */}
                <PivotTableGroup dataGroups={data8FeRow1} macchine={macchine} hideFooter={true} />

                {/* Row 2 */}
                <PivotTableGroup dataGroups={data8FeRow2} macchine={macchine} hideFooter={true} />

                {/* Summary Table 1 */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '2px solid #000' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#eee' }}>
                            <th style={{ fontSize: 9, border: '1px solid #000', padding: 4, width: 140 }}></th>
                            {[...data8FeRow1, ...data8FeRow2].map(item => (
                                <th key={item.id} style={{ fontSize: 9, border: '1px solid #000', padding: 4 }}>{item.id}-{item.code}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {summaryData8Fe.map((row, rIdx) => (
                            <tr key={rIdx}>
                                <td style={{ fontSize: 9, border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>{row.label}</td>
                                {row.values.map((val, vIdx) => (
                                    <td key={vIdx} contentEditable={true} suppressContentEditableWarning={true} style={{
                                        fontSize: 9,
                                        border: '1px solid #000',
                                        padding: 4,
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        outline: 'none',
                                        cursor: 'text'
                                    }}>
                                        {val}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Summary Table 2 (Differential House) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                    <table style={{ width: 300, borderCollapse: 'collapse', fontSize: 11, border: '2px solid #000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#eee' }}>
                                <th colSpan="2" style={{ fontSize: 9, border: '1px solid #000', padding: 4 }}>DIFFERENTIAL HOUSE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {differentialHouse8Fe.map((row, idx) => (
                                <tr key={idx}>
                                    <td contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', padding: 4, outline: 'none', cursor: 'text' }}>{row.cat}</td>
                                    <td contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', padding: 4, textAlign: 'center', outline: 'none', cursor: 'text' }}>{row.code}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <table style={{ width: 400, borderCollapse: 'collapse', fontSize: 11, border: '2px solid #000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#eee' }}>
                                <th style={{ fontSize: 9, border: '1px solid #000', padding: 4 }}>DIFFERENTIAL HOUSE</th>
                                <th style={{ fontSize: 9, border: '1px solid #000', padding: 4 }}></th>
                                <th style={{ fontSize: 9, border: '1px solid #000', padding: 4 }}>gg di copertura</th>
                            </tr>
                        </thead>
                        <tbody>
                            {differentialHouse8Fe.map((row, idx) => (
                                <tr key={idx}>
                                    <td contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', padding: 4, outline: 'none', cursor: 'text' }}>{row.cat}</td>
                                    <td contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', padding: 4, textAlign: 'center', outline: 'none', cursor: 'text' }}>{row.qta}</td>
                                    <td contentEditable={true} suppressContentEditableWarning={true} style={{
                                        fontSize: 9,
                                        border: '1px solid #000',
                                        padding: 4,
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        outline: 'none',
                                        cursor: 'text'
                                    }}>{row.gg}</td>
                                </tr>
                            ))}
                            <tr>
                                <td colSpan="2" style={{ fontSize: 9, border: '1px solid #000', padding: 4, textAlign: 'right', fontWeight: 'bold' }}></td>
                                <td contentEditable={true} suppressContentEditableWarning={true} style={{ fontSize: 9, border: '1px solid #000', padding: 4, textAlign: 'center', borderTop: '2px solid #000', outline: 'none', cursor: 'text' }}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InventoryView;
