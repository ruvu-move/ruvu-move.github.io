/* Simulación mínima de Google Apps Script (SpreadsheetApp, LockService,
   ContentService) para correr apps-script/Code.gs en Node durante las pruebas. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function crearHoja(nombre) {
  let celdas = []; // filas de arrays
  const sh = {
    getName: () => nombre,
    getLastRow: () => celdas.length,
    getLastColumn: () => celdas.reduce((m, f) => Math.max(m, f.length), 0),
    setFrozenRows() {},
    getDataRange() {
      const nr = Math.max(sh.getLastRow(), 1), nc = Math.max(sh.getLastColumn(), 1);
      return sh.getRange(1, 1, nr, nc);
    },
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const fila = [];
            for (let j = 0; j < nc; j++) {
              const v = (celdas[r - 1 + i] || [])[c - 1 + j];
              fila.push(v === undefined ? '' : v);
            }
            out.push(fila);
          }
          return out;
        },
        setValues(vals) {
          if (vals.length !== nr || vals[0].length !== nc) throw new Error('setValues: tamaño incorrecto');
          for (let i = 0; i < nr; i++) {
            celdas[r - 1 + i] = celdas[r - 1 + i] || [];
            for (let j = 0; j < nc; j++) {
              let v = vals[i][j];
              // Sheets guarda "'texto" como texto y no muestra el apóstrofo
              if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1);
              celdas[r - 1 + i][c - 1 + j] = v;
            }
          }
          return this;
        },
        setFontWeight() { return this; }
      };
    },
    _filas: () => celdas
  };
  return sh;
}

function crearEntorno(archivo) {
  const hojas = {};
  const ss = {
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = crearHoja(n)),
    getSheets: () => Object.values(hojas),
    deleteSheet: sh => { delete hojas[sh.getName()]; }
  };
  const salida = txt => ({ txt, setMimeType() { return this; }, getContent() { return txt; } });
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: salida, MimeType: { JSON: 'json', JAVASCRIPT: 'js' } },
    Logger: { log: (...a) => console.log(...a) },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(archivo || path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), ctx);

  // Convierte una hoja en objetos {columna: valor}
  function tabla(nombre) {
    const sh = hojas[nombre];
    if (!sh) return [];
    const [enc, ...filas] = sh._filas();
    return filas.map(f => Object.fromEntries(enc.map((h, i) => [h, f[i] === undefined ? '' : f[i]])));
  }
  return { ctx, ss, hojas, tabla };
}

module.exports = { crearEntorno };
