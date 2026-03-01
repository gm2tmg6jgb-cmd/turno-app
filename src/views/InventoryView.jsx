import React, { useState } from 'react';
import { Icons } from '../components/ui/Icons';

const InventoryBlock = ({ data, type = "normal" }) => {
    return (
        <div style={{
            minWidth: type === "wide" ? 400 : 240,
            flex: 1,
            border: '2px solid #000',
            fontSize: 10,
            fontFamily: 'monospace',
            backgroundColor: '#fff'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', borderBottom: '2px solid #000', fontWeight: 'bold', textAlign: 'center' }}>
                <div style={{ flex: 1, padding: 4, borderRight: '1px solid #000' }}>{data.id}-{data.code}</div>
                <div style={{ flex: 1, padding: 4 }}>{data.primaryPart}</div>
            </div>
            {/* Rack Size */}
            <div style={{ display: 'flex', borderBottom: '1px solid #000', textAlign: 'center' }}>
                <div style={{ flex: 1, padding: 2, borderRight: '1px solid #000' }}>rack size {data.rackSize}</div>
                <div style={{ flex: 1, padding: 2, fontWeight: 'bold' }}>{data.primaryPart}/S</div>
            </div>

            {/* Rows */}
            {data.rows.map((row, idx) => {
                let bgColor = 'transparent';
                if (row.type === 'blue') bgColor = '#BDD7EE';
                if (row.type === 'yellow') bgColor = '#FFFF00';
                if (row.type === 'green') bgColor = '#C6E0B4';
                if (row.type === 'gray') bgColor = '#D9D9D9';
                if (row.type === 'cyan') bgColor = '#B4E4F1';

                return (
                    <div key={idx} style={{
                        display: 'flex',
                        borderBottom: '1px solid #000',
                        backgroundColor: bgColor,
                        height: 20,
                        alignItems: 'center'
                    }}>
                        <div style={{ flex: 1.5, padding: '0 4px', borderRight: '1px solid #000', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {row.label}
                        </div>
                        {/* Support for multiple columns if value is an array */}
                        {Array.isArray(row.value) ? (
                            row.value.map((val, vIdx) => (
                                <div key={vIdx} style={{ flex: 1, textAlign: 'center', fontWeight: val ? 'bold' : 'normal', borderRight: vIdx < row.value.length - 1 ? '1px solid #000' : 'none', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {val || ''}
                                </div>
                            ))
                        ) : (
                            <div style={{ flex: 1, textAlign: 'center', fontWeight: row.value ? 'bold' : 'normal' }}>
                                {row.value || ''}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Totals */}
            <div style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: '#eee', height: 20, alignItems: 'center' }}>
                <div style={{ flex: 1.5, padding: '0 4px', borderRight: '1px solid #000', fontWeight: 'bold' }}>{data.totLabel || 'Tot. WIP'}</div>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold' }}>{data.totWip}</div>
            </div>
            <div style={{ display: 'flex', borderBottom: '2px solid #000', backgroundColor: '#C6E0B4', height: 20, alignItems: 'center' }}>
                <div style={{ flex: 1.5, padding: '0 4px', borderRight: '1px solid #000', fontWeight: 'bold' }}>TOT FINITI</div>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold' }}>{data.totFiniti}</div>
            </div>

            {/* Difference Row */}
            <div style={{ display: 'flex', height: 24, alignItems: 'center' }}>
                <div style={{ flex: 1.5, padding: '0 4px', borderRight: '1px solid #000', fontWeight: 'bold' }}>{data.grandLabel || data.grandTotal}</div>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', backgroundColor: data.diff < 0 ? '#F8CBAD' : '#C6E0B4' }}>
                    {data.diff}
                </div>
            </div>

            {/* Footer text if any */}
            {data.footerNote && (
                <div style={{
                    backgroundColor: '#FFCC00',
                    borderTop: '2px solid #000',
                    textAlign: 'center',
                    padding: 2,
                    fontWeight: 'bold',
                    fontSize: 9
                }}>
                    {data.footerNote}
                </div>
            )}
        </div>
    );
};

const InventoryView = ({ showToast }) => {
    const [activeTab, setActiveTab] = useState('8Fe');

    const tabs = ['DCT 300', '8Fe', 'DCT Eco'];

    const data8FeRow1 = [
        {
            id: 'SG2', code: 'M0153390-790', rackSize: '60 pz', primaryPart: 'M0153389',
            rows: [
                { label: 'Soft Turning dra60', value: '' },
                { label: 'DMC zsa19', value: '1740' },
                { label: 'Laser W sca10', value: '120' },
                { label: 'Hobbing frw193 (frw 217)', value: '150' },
                { label: 'Deburring egw18', value: '' },
                { label: 'DA Trattare', value: '60', type: 'blue' },
                { label: 'HT - (120)', value: '' },
                { label: 'Emag dra110/111', value: '40' },
                { label: 'Grinding rz48', value: '630' },
                { label: 'Da lavare', value: '' },
                { label: 'Sala', value: '', type: 'yellow' },
                { label: 'Finiti', value: '240', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 2740, totFiniti: 240, grandTotal: 2980, diff: -1860
        },
        {
            id: 'SG3', code: 'M0153402-790', rackSize: '72 pz', primaryPart: 'M0153401',
            rows: [
                { label: 'Soft Turning dra60 - 71', value: '' },
                { label: 'DMC zsa19', value: '576', type: 'green' }, // green in image
                { label: 'Laser W est sca08', value: '432' },
                { label: 'Laser W int sca10', value: '720' },
                { label: 'Hobbing frw77 (frw 79)', value: '' },
                { label: 'Deburring 08', value: '' },
                { label: 'DA Trattare', value: '288', type: 'blue' },
                { label: 'HT - (144)', value: '288', type: 'blue' },
                { label: 'Grinding cone sla108', value: '432', type: 'blue' },
                { label: 'Emag dra009', value: '' },
                { label: 'Grinding rz48/10', value: '60' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '288', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 2796, totFiniti: 288, grandTotal: 3084, diff: -1812
        },
        {
            id: 'SG4', code: 'M0153400-791', rackSize: '48 pz', primaryPart: 'M0170686',
            rows: [
                { label: 'Soft Turning dra65/66', value: '' },
                { label: 'DMC zsa19', value: '240' },
                { label: 'Laser W sca09', value: '180' },
                { label: 'Shaping stw07', value: '1020' },
                { label: 'Milling frw23', value: '' },
                { label: 'Hobbing frw77 (frw 79)', value: '' },
                { label: 'DA Trattare', value: '300', type: 'blue' },
                { label: 'HT - (144)', value: '540', type: 'blue' },
                { label: 'Emag dra97/98', value: '' },
                { label: 'Grinding rz48/44', value: '564' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '270', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 2844, totFiniti: 270, grandTotal: 3114, diff: -1830
        },
        {
            id: 'SG5', code: 'M0153394-790', rackSize: '96 pz', primaryPart: 'M0155199',
            rows: [
                { label: 'Soft Turning dra61', value: '', type: 'green' },
                { label: 'DMC zsa19', value: '1584' },
                { label: 'Laser W sca09', value: '576' },
                { label: 'Hobbing frw62', value: '' },
                { label: 'Deburring egw08', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (288)', value: '176', type: 'blue' },
                { label: 'Grinding cone sla08', value: '816', type: 'blue' },
                { label: 'Grinding rz48', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '1344', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 3152, totFiniti: 1344, grandTotal: 4496, diff: -766
        },
        {
            id: 'SG6', code: 'M0153388-790', rackSize: '120 pz', primaryPart: 'M0153387',
            rows: [
                { label: 'Soft Turning dra69/70', value: '' },
                { label: 'Hobbing frw78', value: '' },
                { label: 'Laser W sca151', value: '840' },
                { label: 'UT mza05', value: '360' },
                { label: 'DMC zsa19', value: '' },
                { label: 'DA Trattare', value: '120', type: 'blue' },
                { label: 'HT - (360)', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Ingranometro', value: '' },
                { label: 'Finiti', value: '840', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 1320, totFiniti: 840, grandTotal: 2160, diff: -1260,
            footerNote: 'da riprendere ingran'
        },
        {
            id: 'SG7', code: 'M0153404-790', rackSize: '120 pz', primaryPart: 'M0155201',
            rows: [
                { label: 'Soft Turning dra69/70', value: '' },
                { label: 'Hobbing frw 180', value: '960' },
                { label: 'Deburring egw05', value: '1560' },
                { label: 'Laser W sca151', value: '420' }, // Wait image says 120? Let's check SG7
                // Re-checking SG7: Hobbing frw 180 (960), Deburring egw05 (1560), Laser W sca151 (120). 
                // Ah, the 420 is Grinding cone sla109.
                { label: 'UT mza05', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (360)', value: '' },
                { label: 'Grinding cone SLA109', value: '420' },
                { label: 'Da lavare', value: '' },
                { label: 'Ingranometro/sala', value: '' },
                { label: 'Finiti', value: '120', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 3060, totFiniti: 120, grandTotal: 3180, diff: -1980,
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
                { label: 'HT - (360)', value: '296', type: 'blue' },
                { label: 'Grinding cone sla87', value: '1500' },
                { label: 'Da lavare', value: '' },
                { label: 'Ingranometro', value: '' },
                { label: 'Finiti', value: '120', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 1796, totFiniti: 120, grandTotal: 1916, diff: -1980,
            footerNote: 'da riprendere ingran / da mis sala'
        },
        {
            id: 'SGR', code: 'M0153392-790', rackSize: '66 pz', primaryPart: 'M0153391',
            rows: [
                { label: 'Soft Turning dra60 - 71', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'Laser W sca08', value: '132' },
                { label: 'Hobbing frw140', value: '198' },
                { label: 'DA Trattare', value: '66', type: 'blue' },
                { label: 'HT - (198)', value: '' },
                { label: 'Emag dra101/107', value: '1485' },
                { label: 'Grinding rz26', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '165', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 1881, totFiniti: 165, grandTotal: 2046, diff: -1935
        },
        {
            id: 'PG', code: 'M0154996-790', rackSize: '120 pz', primaryPart: 'M0154995',
            rows: [
                { label: 'Soft Turning dra62', value: '' },
                { label: 'DMC ZSA19', value: '120' },
                { label: 'Broaching raa009', value: '480' },
                { label: 'Lavaggio ORE 48/49', value: '120' },
                { label: 'Hobbing FRW82', value: '1320' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (360)', value: '' },
                { label: 'Emag dra109', value: '' },
                { label: 'Grinding rz26', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '1320', type: 'green' },
                { label: 'box', value: '' },
            ],
            totWip: 2040, totFiniti: 1320, grandTotal: 3360, diff: -780
        },
        {
            id: 'FG5/7', code: 'M0153383-790', rackSize: '120 pz', primaryPart: 'M0155197',
            rows: [
                { label: 'Soft Turning dra61', value: '' },
                { label: 'DMC zsa19', value: '' },
                { label: 'Hobbing frw78', value: '' },
                { label: 'Sbavatura egw14', value: '' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (288)', value: '283', type: 'blue' },
                { label: 'Pallinatura', value: '480', type: 'blue' },
                { label: 'Emag dra109', value: '660' },
                { label: 'Grinding rz26', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '3240', type: 'green' },
                { label: 'box', value: '' },
            ],
            totWip: 1423, totFiniti: 3240, grandTotal: 4663, diff: 1140,
            footerNote: 'da misurare sala'
        },
        {
            id: 'RG FD1', code: 'M0153407-791', rackSize: '28 pz', primaryPart: 'M153407',
            rows: [
                { label: 'Soft Turning dra58/59', value: '' },
                { label: 'DMC zsa22', value: '' },
                { label: 'Hobbing frw73/1189', value: '' },
                { label: 'Sbavatura egw07', value: '392' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (60)', value: '300', type: 'blue' },
                { label: 'Emag dra190', value: '504' },
                { label: 'Grinding rz29', value: '28' },
                { label: 'Da lavare', value: '84' },
                { label: 'Sala', value: '28', type: 'yellow' },
                { label: 'Finiti', value: '84', type: 'green' },
                { label: 'diff saldati', value: '774', type: 'cyan' },
            ],
            totWip: 1336, totFiniti: 858, grandTotal: 2194, diff: -1242,
            footerNote: 'diff saldati rec smontaggio 420'
        },
        {
            id: 'RG FD2', code: 'M0153703-791', rackSize: '28 pz', primaryPart: 'M153703',
            rows: [
                { label: 'Soft Turning dra58/59', value: '' },
                { label: 'DMC zsa22', value: '' },
                { label: 'Hobbing frw73/189', value: '' },
                { label: 'Sbavatura egw07', value: '280' },
                { label: 'DA Trattare', value: '', type: 'blue' },
                { label: 'HT - (60)', value: '', type: 'blue' },
                { label: 'Emag dra190', value: '28' },
                { label: 'Grinding rz29', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Sala', value: '', type: 'yellow' },
                { label: 'Finiti', value: '0', type: 'green' },
                { label: 'diff saldati', value: '', type: 'cyan' },
            ],
            totWip: 308, totFiniti: 0, grandTotal: 308, diff: 0
        }
    ];

    const summaryData8Fe = [
        { label: 'wip+finiti', values: [2980, 3084, 3114, 4496, 2160, 3180, 1916, 2046, 3360, 4663, 2194, 308] },
        { label: 'gg di copertura wip + finiti', values: [9.9, 10.3, 10.4, 15.0, 7.2, 10.6, 6.4, 6.8, 11.2, 15.5, 7.3, 1.0], colors: [null, null, '#FFA500', null, null, null, null, null, null, null, '#FFA500', null] },
        { label: 'gg di copertura solo finiti', values: [0.8, 1.0, 0.9, 4.5, 2.8, 0.4, 0.4, 0.6, 4.4, 10.8, 2.9, 0.0], colors: [null, null, '#FF0000', null, null, null, '#FF0000', null, null, null, '#FFA500', null] }
    ];

    const differentialHouse8Fe = [
        { cat: 'A - Torniti', code: 'M0150712', qta: '', gg: 0.0 },
        { cat: 'B - Torniti Sferico', code: 'M0150712', qta: '300', gg: 1.0, color: '#FF0000' },
        { cat: 'C - Lavati', code: 'M0150712', qta: '990', gg: 3.3, color: '#FFA500' },
        { cat: 'D - Assemblati', code: 'M0150743', qta: '180', gg: 0.6, color: '#FF0000' },
        { cat: 'diff saldati recuperati da smontaggio', code: '', qta: '', gg: 0.0, color: '#FF0000' }
    ];

    // --- DCT ECO DATA ---
    const dataEcoRow1 = [
        {
            id: 'SG2', code: 'M0162645-784', rackSize: '80 pz', primaryPart: 'M0162644',
            rows: [
                { label: 'Lavaggio ore33', value: '240' },
                { label: 'Laser W sca06 (151)', value: '800' },
                { label: 'UT mza05', value: '' },
                { label: 'Hobbing frw78', value: '' },
                { label: 'Deburring egw08', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (240)', value: '646', type: 'blue' },
                { label: 'Pallinatura', value: '480', type: 'blue' },
                { label: 'Emag dra110/111', value: '' },
                { label: 'Grinding rz14', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '80', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 1926, totFiniti: 80, grandLabel: 'DELTA FINITI', diff: -2508, totLabel: 'Tot.'
        },
        {
            id: 'SG3', code: 'M0162624-784', rackSize: '120 pz', primaryPart: 'M0162623',
            rows: [
                { label: 'Lavaggio ore33', value: '1080' },
                { label: 'Laser W sca78(151)', value: '360' },
                { label: 'UT mza08', value: '' },
                { label: 'Hobbing frw76', value: '' },
                { label: 'Da Trattare', value: '120', type: 'blue' },
                { label: 'HT - (240)', value: '480', type: 'blue' },
                { label: 'Cono esterno sla110', value: '480' },
                { label: 'Cono interno sla84', value: '' },
                { label: 'Grinding Rz44', value: '120' },
                { label: 'Da lavare', value: '360' },
                { label: 'Finiti', value: '240', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 1920, totFiniti: 240, grandLabel: 'DELTA FINITI', diff: -2348, totLabel: 'Tot.'
        },
        {
            id: 'SG4', code: 'M0162639-785', rackSize: '120 pz', primaryPart: 'M0162637',
            rows: [
                { label: 'Lavaggio ore33', value: '' },
                { label: 'Shaping stw07', value: '720' },
                { label: 'Milling fra25', value: '360' },
                { label: 'Hobbing frw217', value: '600' },
                { label: 'Da Trattare', value: '180', type: 'blue' },
                { label: 'HT - (240)', value: '240', type: 'blue' },
                { label: 'Emag pre w dra 99/100', value: '' },
                { label: 'Grinding Rz14', value: '' },
                { label: 'Laser W Sca78', value: '240' },
                { label: 'UT mza05', value: '600' },
                { label: 'Cone Grinding sla92', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '480', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 2940, totFiniti: 480, grandLabel: 'DELTA FINITI', diff: -2108, totLabel: 'Tot.'
        },
        {
            id: 'SG5', code: 'M0162622-784', rackSize: '120 pz', primaryPart: 'M0162621',
            rows: [
                { label: 'Lavaggio ore33', value: '1560' },
                { label: 'Hobbing frw62', value: '480' },
                { label: 'Da Trattare', value: '240', type: 'blue' },
                { label: 'HT - (600)', value: '596', type: 'blue' },
                { label: 'Emag pre w dra102/108', value: '360' },
                { label: 'Power Honing hmw40', value: '' },
                { label: 'Laser W sca78(151)', value: '360' },
                { label: 'UT1 mza06 --> 0h', value: '' },
                { label: 'UT2 mza06 --> 48h', value: '' },
                { label: 'UT3 mza06 --> 96h', value: '' },
                { label: 'Cone Grinding sla91', value: '' },
                { label: 'Da lavare', value: '120' },
                { label: 'Finiti', value: '600', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 2156, totFiniti: 600, grandLabel: 'DELTA FINITI', diff: -1988, totLabel: 'Tot.'
        },
        {
            id: 'SGR', code: 'M162624-784', rackSize: '80 pz', primaryPart: 'M162623',
            rows: [
                { label: 'Lavaggio ore33', value: '1760' },
                { label: 'Laser W sca06 (151)', value: '800' },
                { label: 'UT mza05', value: '' },
                { label: 'Hobbing frw79', value: '' },
                { label: 'Deburring egw08', value: '' },
                { label: 'Da Trattare', value: '', type: 'blue' },
                { label: 'HT - (240)', value: '' },
                { label: 'Emag dra101/107', value: '400' },
                { label: 'Grinding rz14', value: '240' },
                { label: 'Da lavare', value: '400' },
                { label: 'Finiti', value: '720', type: 'green' },
                { label: 'Box', value: '' },
            ],
            totWip: 1840, totFiniti: 720, grandLabel: 'DELTA FINITI', diff: -1868, totLabel: 'Tot.'
        },
        {
            id: 'RG-FD1', code: 'M0162587-790', rackSize: '32 pz', primaryPart: 'M0162587 61A',
            rows: [
                { label: 'Soft Turning dra44', value: '' },
                { label: 'Hobbing frw15', value: '' },
                { label: 'Deburring egw06', value: '' },
                { label: 'Da Trattare', value: '32', type: 'blue' },
                { label: 'HT - (60)', value: '' },
                { label: 'Pallinatura', value: '' },
                { label: 'Emag dra190', value: '32' },
                { label: 'Grinding rz29', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '64', type: 'green' },
                { label: 'Box', value: '288', type: 'green' }, // box counts as row for Eco too
            ],
            totWip: 64, totFiniti: 352, grandLabel: 'DELTA FINITI', diff: -536, totLabel: 'Tot.'
        },
        {
            id: 'RG-FD2', code: 'M0162901-790', rackSize: '32 pz', primaryPart: 'M0162901 61E',
            rows: [
                { label: 'Soft Turning dra44', value: '' },
                { label: 'Hobbing frw15', value: '' },
                { label: 'Deburring egw06', value: '' },
                { label: 'Da Trattare', value: '32', type: 'blue' },
                { label: 'HT - (60)', value: '128', type: 'blue' },
                { label: 'Emag dra190', value: '544' },
                { label: 'Grinding rz29', value: '' },
                { label: 'Da lavare', value: '' },
                { label: 'Finiti', value: '672', type: 'green' },
                { label: 'Box', value: '47', type: 'green' },
            ],
            totWip: 704, totFiniti: 719, grandLabel: 'DELTA FINITI', diff: -981, totLabel: 'Tot.'
        }
    ];

    const summaryDataEco = [
        { label: 'wip + finiti', values: [2006, 2160, 3420, 2756, 2560, 128, 1376] },
        { label: 'gg copertura wip + finiti', values: [1.2, 1.3, 2.0, 1.6, 1.5, 0.1, 0.8], colors: ['#FFFF00', null, '#FF0000', null, null, '#FFFF00', '#FF0000'] },
        { label: 'gg copertura finiti', values: [0.05, 0.14, 0.28, 0.35, 0.42, 0.21, 0.42], colors: ['#FF0000', '#FFA500', '#FFA500', '#FFFF00', '#FFFF00', '#FFFF00', '#FFFF00'] }
    ];

    // --- DCT 300 DATA ---
    const data300TopRow = [
        {
            id: 'SG1',
            headers: [
                { id: 'h1', values: [{ v: 'codice KK' }, { v: '2511108150', color: 'blue' }, { v: 'LOW TORQUE M0140994', bg: '#FFFF00', bold: true }, { v: '2511124450', color: 'blue' }] },
                { id: 'h2', values: [{ v: '550726300' }, { v: '2511108150/S', bold: true }, { v: 'M0140994/S', bold: true }, { v: '2511124450/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: 'ORE 33', vals: [{}, {}, {}] },
                { label: 'LASER', vals: [{ v: '270', bg: '#FFFF00' }, {}, {}] },
                { label: 'PFAUTER', vals: [{ v: '108', bg: '#C6E0B4' }, {}, {}] },
                { label: 'SMUSSATURA', vals: [{}, {}, {}] },
                { label: 'DA TRATTARE', vals: [{ v: '216', bg: '#FFFF00' }, {}, {}] },
                { label: 'IN TRATT.', vals: [{ v: '480', bg: '#F4B084' }, {}, {}] },
                { label: 'DA PALLINARE', vals: [{ v: '810', bg: '#F4B084' }, {}, {}] },
                { label: 'EMAG', vals: [{}, {}, {}] },
                { label: 'RH160', vals: [{}, {}, {}] },
                { label: '', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'DA LAVARE', vals: [{ v: '54', bg: '#C6E0B4' }, {}, {}] },
                { label: 'FINITI', vals: [{ v: '594', bg: '#F4B084' }, {}, { v: '346', bg: '#FFFF00' }] }
            ],
            footers: [
                { label: 'blister', rowBg: '#00B0F0', labelColor: 'blue', vals: [{}, {}, {}] },
                { label: '', rowBg: '#F4B084', vals: [{}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}] },
            ]
        },
        {
            id: 'DG2',
            headers: [
                { id: 'h1', values: [{ v: 'codice KK' }, { v: 'Mozzetto' }, { v: '251.1.1055.50', color: 'blue' }, { v: 'LOW TORQUE M0156540', bg: '#FFFF00', bold: true }, { v: '251.1.1223.50', color: 'blue' }, { v: 'LOW TORQUE M0146872', bg: '#FFFF00', bold: true }, { v: '251.1.1246.50', color: 'blue' }] },
                { id: 'h2', values: [{ v: '0550130300' }, { v: '251110950/S', bold: true }, { v: '2511109350/S', bold: true }, { v: 'M0156540/S', bold: true }, { v: '2511122350/S', bold: true }, { v: 'M0146872/S', bold: true }, { v: '2511124650/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: '', vals: [{}, {}, {}, {}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'WS CORONCINA', vals: [{}, {}, {}, {}, {}, {}] },
                { label: 'PFAUTER MOZZETTO', vals: [{ v: '144', bg: '#FFFF00' }, {}, {}, {}, {}, {}] },
                { label: 'mozzetta SCA110/6', vals: [{ v: '792', bg: '#F4B084' }, {}, {}, {}, {}, {}] },
                { label: 'US', vals: [{}, {}, {}, {}, {}, {}] },
                { label: 'DG car SCA110/6', vals: [{}, { v: '720', bg: '#FFFF00' }, {}, { v: '3168', bg: '#F4B084' }, {}, {}] },
                { label: 'PFAUTER DG', vals: [{}, {}, {}, { v: '1656', bg: '#F4B084' }, {}, {}] },
                { label: 'DA TRATTARE', vals: [{}, {}, {}, {}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'IN TRATT.', vals: [{}, {}, {}, {}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'DA PALLINARE', vals: [{}, { v: '72', bg: '#C6E0B4' }, {}, { v: '144', bg: '#FFFF00' }, {}, {}] },
                { label: 'ore33', vals: [{}, { v: '216', bg: '#FFFF00' }, {}, { v: '1116', bg: '#F4B084' }, {}, {}] },
                { label: 'AC1', vals: [{}, { v: '72', bg: '#C6E0B4' }, {}, { v: '288', bg: '#FFFF00' }, {}, {}] },
                { label: 'RH160', vals: [{}, { v: '216', bg: '#FFFF00' }, {}, {}, {}, {}] },
                { label: 'DA LAVARE', vals: [{}, { v: '144', bg: '#FFFF00' }, {}, {}, {}, {}] },
                { label: 'FINITI', vals: [{}, { v: '612', bg: '#F4B084' }, {}, { v: '180', bg: '#FFFF00' }, {}, { v: '72', bg: '#C6E0B4' }] }
            ],
            footers: [
                { label: '', rowBg: '#00B0F0', vals: [{}, {}, {}, {}, {}, {}] },
                { label: '', rowBg: '#F4B084', vals: [{}, {}, {}, {}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}, {}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}, {}, {}, {}] },
            ]
        },
        {
            id: 'SG 5',
            headers: [
                { id: 'h1', values: [{ v: 'codice KK' }, { v: '2511108862', color: 'blue' }, { v: '2511122851', color: 'blue' }, { v: '2511126150', color: 'blue' }] },
                { id: 'h2', values: [{ v: '550730005' }, { v: '2511108851/S', bold: true }, { v: '2511122851/S', bold: true }, { v: '2511126150/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: '', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'WEISSER', vals: [{}, {}, {}] },
                { label: 'PFAUTER', vals: [{ v: '528', bg: '#FFFF00' }, { v: '1716', bg: '#FF0000' }, { v: '212', bg: '#C6E0B4' }] },
                { label: 'DA TRATTARE', vals: [{}, {}, {}] },
                { label: 'IN TRATT.', vals: [{ v: '396', bg: '#C6E0B4' }, {}, {}] },
                { label: 'EMAG', vals: [{ v: '264', bg: '#FFFF00' }, { v: '1188', bg: '#FF0000' }, { v: '462', bg: '#F4B084' }] },
                { label: 'RH160', vals: [{}, { v: '264', bg: '#FFFF00' }, {}] },
                { label: 'LASER', vals: [{}, { v: '1980', bg: '#FF0000' }, {}] },
                { label: 'US', vals: [{}, { v: '264', bg: '#FFFF00' }, {}] },
                { label: 'AC1', vals: [{}, { v: '132', bg: '#C6E0B4' }, {}] },
                { label: '', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: '', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'DA LAVARE', vals: [{}, {}, {}] },
                { label: 'FINITI', vals: [{ v: '577', bg: '#FFFF00' }, { v: '726', bg: '#F4B084' }, { v: '8', bg: '#C6E0B4' }] }
            ],
            footers: [
                { label: '', rowBg: '#00B0F0', vals: [{}, {}, {}] },
                { label: '', rowBg: '#F4B084', vals: [{}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}] },
            ]
        },
        {
            id: 'SG 6',
            headers: [
                { id: 'h1', values: [{ v: 'codice KK' }, { v: '2511109151', color: 'blue' }, { v: '2511123050', color: 'blue' }, { v: '2511125350', color: 'blue' }] },
                { id: 'h2', values: [{ v: '550730305' }, { v: '2511109250/S', bold: true }, { v: '2511123150/S', bold: true }, { v: '2511125450/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: '', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'WEISSER', vals: [{}, {}, {}] },
                { label: 'DA TRATTARE', vals: [{ v: '120', bg: '#C6E0B4' }, { v: '960', bg: '#F4B084' }, {}] },
                { label: 'IN TRATT.', vals: [{}, { v: '600', bg: '#FFFF00' }, {}] },
                { label: 'EMAG', vals: [{}, {}, {}] },
                { label: 'RH160', vals: [{}, {}, {}] },
                { label: 'LASER', vals: [{ v: '840', bg: '#F4B084' }, { v: '1920', bg: '#FF0000' }, {}] },
                { label: 'US', vals: [{}, {}, {}] },
                { label: 'AC1', vals: [{ v: '384', bg: '#C6E0B4' }, { v: '253', bg: '#C6E0B4' }, {}] },
                { label: '', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: '', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'DA LAVARE', vals: [{}, { v: '120', bg: '#FFFF00' }, {}] },
                { label: 'FINITI', vals: [{ v: '156', bg: '#FFFF00' }, { v: '180', bg: '#FFFF00' }, { v: '411', bg: '#F4B084' }] }
            ],
            footers: [
                { label: '', rowBg: '#00B0F0', vals: [{}, {}, {}] },
                { label: '', rowBg: '#F4B084', vals: [{}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}] },
            ]
        }
    ];

    const data300BottomRow = [
        {
            id: 'SG 3',
            headers: [
                { id: 'h1', values: [{ v: '' }, { v: '2511108850', color: 'blue' }, { v: '2511122550', color: 'blue' }, { v: '2511124850', color: 'blue' }] },
                { id: 'h2', values: [{ v: '' }, { v: '2511108850/S', bold: true }, { v: '2511122550/S', bold: true }, { v: '2511122550/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: 'LORENZ', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'PFAUTER WEIMA', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'PFAUTER', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'ORE 33', vals: [{}, {}, {}] },
                { label: 'DA TRATTARE', vals: [{ v: '480', bg: '#F4B084' }, {}, {}] },
                { label: 'IN TRATT.', vals: [{}, {}, {}] },
                { label: 'AC1', vals: [{}, {}, { v: '96', bg: '#C6E0B4' }] },
                { label: 'RH160', vals: [{}, { v: '71', bg: '#C6E0B4' }, {}] },
                { label: 'DA LAVARE', vals: [{ v: '256', bg: '#FFFF00' }, {}, {}] },
                { label: 'FINITI', vals: [{ v: '384', bg: '#F4B084' }, { v: '96', bg: '#FFFF00' }, { v: '96', bg: '#FFFF00' }] },
            ],
            footers: [
                { label: 'blister', rowBg: '#00B0F0', labelColor: 'blue', vals: [{}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}] },
            ]
        },
        {
            id: 'SG4',
            headers: [
                { id: 'h1', values: [{ v: '0556536100' }, { v: '2511108751', color: 'blue' }, { v: '2511122651', color: 'blue' }, { v: '2511124950', color: 'blue' }] },
                { id: 'h2', values: [{ v: '' }, { v: '2511108750/S', bold: true }, { v: '2511122651/S', bold: true }, { v: '2511124950/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: 'WEISSER', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'LASER', vals: [{ v: '176', bg: '#F4B084' }, { v: '264' }, {}] },
                { label: 'PFAUTER', vals: [{ v: '704', bg: '#F4B084' }, {}, {}] },
                { label: 'DA TRATTARE', vals: [{ v: '176', bg: '#FFFF00' }, {}, {}] },
                { label: 'IN TRATT.', vals: [{}, {}, {}] },
                { label: 'AC1', vals: [{ v: '88', bg: '#C6E0B4' }, { v: '88', bg: '#C6E0B4' }, { v: '704', bg: '#FFFF00' }] },
                { label: 'RH160', vals: [{ v: '88', bg: '#C6E0B4' }, { v: '232' }, {}] },
                { label: 'DA LAVARE', vals: [{ v: '176', bg: '#FFFF00' }, {}, {}] },
                { label: 'FINITI', vals: [{ v: '616', bg: '#F4B084' }, {}, { v: '132', bg: '#FFFF00' }] },
            ],
            footers: [
                { label: '', rowBg: '#00B0F0', vals: [{}, {}, {}] },
                { label: '', rowBg: '#F4B084', vals: [{}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}] },
            ]
        },
        {
            id: 'RG',
            headers: [
                { id: 'h1', values: [{ v: '' }, { v: '2511108653', color: 'blue' }, { v: 'LOW TORQUE M0140999', bg: '#FFFF00', bold: true }, { v: '2511130051', color: 'blue' }, { v: 'LOW TORQUE M0160207', bg: '#FFFF00', bold: true }, { v: '2511124351', color: 'blue' }] },
                { id: 'h2', values: [{ v: '' }, { v: '2511108653/S', bold: true }, { v: 'M0140999/S', bold: true }, { v: '' }, { v: 'M0160207/S', bold: true }, { v: '2511124350/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: 'DA DENTARE', vals: [{ v: '60', bg: '#FFFF00' }, {}, {}, {}, {}] },
                { label: 'DA SBAVARE', vals: [{}, {}, {}, {}, {}] },
                { label: 'DA LAVARE', vals: [{ v: '240', bg: '#FFFF00' }, {}, {}, {}, {}] },
                { label: 'IN TRATTAM.', vals: [{ v: '300', bg: '#FFFF00' }, {}, {}, {}, {}] },
                { label: 'DA PALLIN.', vals: [{ v: '60', bg: '#C6E0B4' }, {}, {}, {}, {}] },
                { label: 'EMAG', vals: [{ v: '150', bg: '#C6E0B4' }, {}, {}, { v: '420', bg: '#FFFF00' }, {}] },
                { label: 'RH250', vals: [{}, {}, {}, {}, {}] },
                { label: 'DA LAVARE', vals: [{ v: '270', bg: '#C6E0B4' }, {}, {}, {}, {}] },
                { label: 'FINITI', vals: [{ v: '480', bg: '#F4B084' }, {}, { v: '100', bg: '#FFFF00' }, { v: '570', bg: '#FFFF00' }, {}] },
            ],
            footers: [
                { label: 'Blister', rowBg: '#00B0F0', vals: [{}, {}, {}, {}, {}] },
                { label: 'SVEVA', rowBg: '#F4B084', vals: [{}, {}, {}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}, {}, {}] },
            ]
        },
        {
            id: 'SG7',
            headers: [
                { id: 'h1', values: [{ v: '' }, { v: '2511109050', color: 'blue' }, { v: '2511123250', color: 'blue' }, { v: '2511125550', color: 'blue' }] },
                { id: 'h2', values: [{ v: '' }, { v: '2511109050/S', bold: true }, { v: '2511123250/S', bold: true }, { v: '2511125550/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }, { v: '' }, { v: '' }] },
            ],
            rows: [
                { label: 'WEISSER', vals: [{}, {}, {}], rowBg: '#D9D9D9' },
                { label: 'STOZZA', vals: [{ v: '416', bg: '#C6E0B4' }, { v: '624', bg: '#FFFF00' }, {}] },
                { label: 'PFAUTER', vals: [{ v: '104', bg: '#C6E0B4' }, {}, {}] },
                { label: 'DA TRATTARE', vals: [{}, { v: '624', bg: '#FFFF00' }, {}] },
                { label: 'IN TRATTAM.', vals: [{}, { v: '826', bg: '#F4B084' }, {}] },
                { label: 'EMAG', vals: [{}, {}, {}] },
                { label: 'RH160', vals: [{}, {}, {}] },
                { label: 'DA LAVARE', vals: [{}, { v: '624', bg: '#FFFF00' }, {}] },
                { label: 'FINITI', vals: [{ v: '780', bg: '#F4B084' }, { v: '884', bg: '#F4B084' }, { v: '227', bg: '#C6E0B4' }] },
            ],
            footers: [
                { label: '', rowBg: '#00B0F0', vals: [{}, {}, {}] },
                { label: '', rowBg: '#F4B084', vals: [{}, {}, {}] },
                { label: '', rowBg: '#FF00FF', vals: [{}, {}, {}] },
                { label: '', rowBg: '#00B050', vals: [{}, {}, {}] },
            ]
        },
        {
            id: 'SGRW',
            headers: [
                { id: 'h1', values: [{ v: '' }, { v: '2511109451', color: 'blue' }] },
                { id: 'h2', values: [{ v: '' }, { v: '2511109451/S', bold: true }] },
                { id: 'h3', values: [{ v: 'Lotto soft', bold: true }, { v: '' }] },
            ],
            rows: [
                { label: 'ORE33', vals: [{}] },
                { label: 'LASER', vals: [{ v: '432', bg: '#FFFF00' }] },
                { label: 'PFAUTER', vals: [{ v: '648', bg: '#F4B084' }] },
                { label: 'DA TRATTAM', vals: [{ v: '576', bg: '#F4B084' }] },
                { label: 'IN TRATTAM.', vals: [{ v: '360', bg: '#C6E0B4' }] },
                { label: 'PALLINATURA', vals: [{ v: '360', bg: '#C6E0B4' }] },
                { label: 'EMAG', vals: [{ v: '1116', bg: '#FF0000' }] },
                { label: 'RH160', vals: [{}] },
                { label: 'DA LAVARE', vals: [{ v: '72', bg: '#C6E0B4' }] },
                { label: 'FINITI', vals: [{ v: '468', bg: '#FFFF00' }] },
            ],
            footers: [
                { label: '', rowBg: '#00B0F0', vals: [{}] },
                { label: '', rowBg: '#F4B084', vals: [{}] },
                { label: '', rowBg: '#FF00FF', vals: [{}] },
                { label: '', rowBg: '#00B050', vals: [{}] },
            ]
        }
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
                    <div style={{ display: 'flex', fontSize: 20, fontWeight: 'bold', borderBottom: '2px solid #000', marginBottom: 10 }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>888 <span style={{ fontSize: 12 }}>domanda wk FD1</span></div>
                        <div style={{ flex: 1, textAlign: 'center' }}>1700 <span style={{ fontSize: 12 }}>domanda wk FD2</span></div>
                        <div style={{ flex: 1, textAlign: 'center', backgroundColor: '#FFFF00' }}>2650</div>
                        <div style={{ flex: 1, textAlign: 'center' }}>7188</div>
                        <div style={{ flex: 1, textAlign: 'center' }}>6976</div>
                        <div style={{ flex: 2, textAlign: 'center' }}>27/02/2026</div>
                    </div>
                    {/* Eco Blocks */}
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'space-between', marginBottom: 20 }}>
                        {dataEcoRow1.map(item => <InventoryBlock key={item.id} data={item} />)}
                    </div>
                    {/* Eco Summary */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '2px solid #000' }}>
                        <tbody>
                            {summaryDataEco.map((row, rIdx) => (
                                <tr key={rIdx}>
                                    <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold', width: 150 }}>{row.label}</td>
                                    {row.values.map((val, vIdx) => (
                                        <td key={vIdx} style={{
                                            border: '1px solid #000',
                                            padding: 4,
                                            textAlign: 'center',
                                            fontWeight: 'bold',
                                            backgroundColor: row.colors && row.colors[vIdx] ? row.colors[vIdx] : 'transparent'
                                        }}>
                                            {val}
                                        </td>
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
        const renderBlock300 = (item) => (
            <div key={item.id} style={{
                flex: item.id === 'DG2' || item.id === 'RG' ? 2 : 1,
                border: '1px solid #000',
                fontSize: 10,
                backgroundColor: '#fff',
                fontFamily: 'monospace, sans-serif'
            }}>
                {/* Header Title */}
                <div style={{ backgroundColor: '#e2efda', textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #000', padding: 4, fontSize: 13 }}>
                    {item.id}
                </div>
                {/* Sub Headers */}
                {item.headers.map((hRow) => (
                    <div key={hRow.id} style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: '#f2f2f2' }}>
                        {hRow.values.map((col, idx) => (
                            <div key={idx} style={{
                                flex: idx === 0 ? 1.5 : 1,
                                padding: 3,
                                textAlign: 'center',
                                borderRight: idx < hRow.values.length - 1 ? '1px solid #000' : 'none',
                                backgroundColor: col.bg || 'transparent',
                                color: col.color || '#000',
                                fontWeight: col.bold ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {col.v}
                            </div>
                        ))}
                    </div>
                ))}
                {/* Data Rows */}
                {item.rows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: row.rowBg || '#fff', minHeight: 18 }}>
                        <div style={{ flex: 1.5, padding: '0 4px', borderRight: '1px solid #000', fontSize: 9, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                            {row.label}
                        </div>
                        {row.vals.map((val, vIdx) => (
                            <div key={vIdx} style={{
                                flex: 1,
                                textAlign: 'center',
                                borderRight: vIdx < row.vals.length - 1 ? '1px solid #000' : 'none',
                                backgroundColor: val.bg || 'transparent',
                                fontWeight: val.v ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {val.v || ''}
                            </div>
                        ))}
                    </div>
                ))}
                {/* Footers */}
                {item.footers.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', borderBottom: idx < item.footers.length - 1 ? '1px solid #000' : 'none', backgroundColor: row.rowBg || '#fff', height: 18 }}>
                        <div style={{ flex: 1.5, padding: '0 4px', borderRight: '1px solid #000', fontSize: 9, fontWeight: 'bold', color: row.labelColor || '#000', display: 'flex', alignItems: 'center' }}>
                            {row.label}
                        </div>
                        {row.vals.map((val, vIdx) => (
                            <div key={vIdx} style={{
                                flex: 1,
                                borderRight: vIdx < row.vals.length - 1 ? '1px solid #000' : 'none'
                            }}></div>
                        ))}
                    </div>
                ))}
            </div>
        );

        return (
            <div className="inventory-view" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'auto' }}>
                <div className="card" style={{ padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {tabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 'var(--radius)', background: activeTab === tab ? 'var(--primary)' : 'transparent', color: activeTab === tab ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{tab}</button>
                        ))}
                    </div>
                </div>

                <div style={{ padding: 10, background: '#fff', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 30 }}>
                    {/* Top Row Grid */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {data300TopRow.map(renderBlock300)}
                    </div>
                    {/* Bottom Row Grid */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {data300BottomRow.map(renderBlock300)}
                    </div>
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
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                    {data8FeRow1.map(item => <InventoryBlock key={item.id} data={item} />)}
                </div>

                {/* Row 2 */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                    {data8FeRow2.map(item => <InventoryBlock key={item.id} data={item} />)}
                </div>

                {/* Summary Table 1 */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '2px solid #000' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#eee' }}>
                            <th style={{ border: '1px solid #000', padding: 4, width: 140 }}></th>
                            {[...data8FeRow1, ...data8FeRow2].map(item => (
                                <th key={item.id} style={{ border: '1px solid #000', padding: 4 }}>{item.id}-{item.code}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {summaryData8Fe.map((row, rIdx) => (
                            <tr key={rIdx}>
                                <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>{row.label}</td>
                                {row.values.map((val, vIdx) => (
                                    <td key={vIdx} style={{
                                        border: '1px solid #000',
                                        padding: 4,
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        backgroundColor: row.colors && row.colors[vIdx] ? row.colors[vIdx] : 'transparent'
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
                                <th colSpan="2" style={{ border: '1px solid #000', padding: 4 }}>DIFFERENTIAL HOUSE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {differentialHouse8Fe.map((row, idx) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid #000', padding: 4 }}>{row.cat}</td>
                                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.code}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <table style={{ width: 400, borderCollapse: 'collapse', fontSize: 11, border: '2px solid #000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#eee' }}>
                                <th style={{ border: '1px solid #000', padding: 4 }}>DIFFERENTIAL HOUSE</th>
                                <th style={{ border: '1px solid #000', padding: 4 }}></th>
                                <th style={{ border: '1px solid #000', padding: 4 }}>gg di copertura</th>
                            </tr>
                        </thead>
                        <tbody>
                            {differentialHouse8Fe.map((row, idx) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid #000', padding: 4 }}>{row.cat}</td>
                                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.qta}</td>
                                    <td style={{
                                        border: '1px solid #000',
                                        padding: 4,
                                        textAlign: 'center',
                                        backgroundColor: row.color || 'transparent',
                                        fontWeight: 'bold'
                                    }}>{row.gg}</td>
                                </tr>
                            ))}
                            <tr>
                                <td colSpan="2" style={{ border: '1px solid #000', padding: 4, textAlign: 'right', fontWeight: 'bold' }}></td>
                                <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center', borderTop: '2px solid #000' }}>0,6</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InventoryView;
