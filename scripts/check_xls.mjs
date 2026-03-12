import fs from "fs";

const filePath = "/Users/angelofato/Documents/turno-app copia/CONFERMESAP (4).xls";
const buffer = fs.readFileSync(filePath);

const isUtf16LE = buffer[0] === 0xFF && buffer[1] === 0xFE;
const isUtf16BE = buffer[0] === 0xFE && buffer[1] === 0xFF;

console.log("Is UTF-16 LE:", isUtf16LE);
console.log("Is UTF-16 BE:", isUtf16BE);

if (isUtf16LE || isUtf16BE) {
    const text = new TextDecoder(isUtf16BE ? "utf-16be" : "utf-16le").decode(buffer);
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const json = lines
        .map(line => line.split("\t").map(v => v.replace(/^"|"$/g, "")))
        .filter(row => row.some(v => v.trim() !== ""));
    
    console.log("First 5 lines headers/data:");
    json.slice(0, 5).forEach((row, i) => console.log(`Row ${i}:`, row));
} else {
    console.log("Not UTF-16. First 100 bytes:", buffer.slice(0, 100));
}
