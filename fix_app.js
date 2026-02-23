const fs = require('fs');
let content = fs.readFileSync('src/data/constants.js', 'utf-8');

const turniRegex = /export const TURNI = \[\n([^\]]+)\];/;
const newTurni = \`export const TURNI = [
    { id: "A", nome: "Turno A", colore: "#F59E0B", coordinatore: "Piperis" },
    { id: "B", nome: "Turno B", colore: "#3B82F6", coordinatore: "Abatescianni" },
    { id: "C", nome: "Turno C", colore: "#6366F1", coordinatore: "Sannicandro" },
    { id: "D", nome: "Turno D", colore: "#10B981", coordinatore: "Fato" },
];\`;

content = content.replace(turniRegex, newTurni);
fs.writeFileSync('src/data/constants.js', content, 'utf-8');
console.log("constants.js updated");
