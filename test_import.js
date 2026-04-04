const rawRows = [
  ["01/01/2026", "A", "Mat1", "Fino1", "10", "1", "12:00"],
  ["01/01/2026", "A", "Mat1", "Fino1", "20", "2", "14:00"]
];
const mapping = {
  acquisito: "Data",
  turno: "Turno",
  materiale: "Mat",
  fino: "Fino",
  qta_ottenuta: "Qt",
  qta_scarto: "Qs",
  ora: "Ora"
};
const hdrIndexMap = {
  Data: 0,
  Turno: 1,
  Mat: 2,
  Fino: 3,
  Qt: 4,
  Qs: 5,
  Ora: 6
};

const get = (row, col) => col ? row[hdrIndexMap[col]] ?? "" : "";

const prodAgg = {};

const parsedRaw = rawRows.map(row => {
    const data = get(row, mapping.acquisito); // simulate formatDate
    const turno_id = get(row, mapping.turno);
    const materiale = String(get(row, mapping.materiale) || "").trim() || null;
    const fino = String(get(row, mapping.fino) || "").trim() || null;
    
    const key = `${data}_${turno_id}_${materiale}_${fino}`;
    
    if (!prodAgg[key]) {
        prodAgg[key] = {
            work_center_sap: null,
            macchina_id: null,
            macchina_nome: null,
            matched: true,
            data,
            materiale,
            qta_ottenuta: 0,
            qta_scarto: 0,
            turno_id,
            ora: get(row, mapping.ora),
            fino,
        };
    }
    
    const qta_ott = parseFloat(get(row, mapping.qta_ottenuta)) || 0;
    const qta_sca = parseFloat(get(row, mapping.qta_scarto)) || 0;
    
    prodAgg[key].qta_ottenuta += qta_ott;
    prodAgg[key].qta_scarto += qta_sca;
    
    return null; 
});

const parsed = Object.values(prodAgg).filter(r => r.data && r.materiale);
console.log(parsed);
