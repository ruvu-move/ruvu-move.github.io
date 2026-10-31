/* Genera un QR por punto en /qr/ (PNG + SVG, negro sobre blanco, con margen).
   Uso: npm run qr
   Toma SITE_URL y PUNTOS de config.js. Cada QR apunta a <SITE_URL>?p=<slug>, y qr/general.* a <SITE_URL> sin punto. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const QRCode = require('qrcode');

const raiz = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(raiz, 'config.js'), 'utf8'), sandbox);
const C = sandbox.window.RUVU_CONFIG;

let base = process.env.SITE_URL || C.SITE_URL;
if (!base.endsWith('/')) base += '/';
if (base.includes('TODO')) {
  console.warn('⚠️  SITE_URL en config.js todavía tiene TODO. Los QR van a apuntar a: ' + base);
  console.warn('   Cambiala por la URL real de GitHub Pages y volvé a correr "npm run qr" antes de imprimir.\n');
}

const opciones = {
  errorCorrectionLevel: 'M', // tolera ~15% de daño (stickers, rayones)
  margin: 4,                 // margen blanco reglamentario (4 módulos)
  color: { dark: '#000000', light: '#FFFFFF' }
};
const dir = path.join(raiz, 'qr');
fs.mkdirSync(dir, { recursive: true });

(async () => {
  const lista = [];
  // QR general (sin ?p=): sirve para cualquier lugar, la persona escribe en qué parada está
  const todos = [{ slug: 'general', nombre: 'QR general (cualquier parada)', general: true }].concat(C.PUNTOS);
  for (const p of todos) {
    const url = p.general ? base : base + '?p=' + encodeURIComponent(p.slug);
    await QRCode.toFile(path.join(dir, p.slug + '.png'), url, { ...opciones, type: 'png', width: 1200 });
    fs.writeFileSync(path.join(dir, p.slug + '.svg'), await QRCode.toString(url, { ...opciones, type: 'svg' }));
    lista.push({ slug: p.slug, nombre: p.nombre, url });
    console.log('✓ ' + p.slug.padEnd(18) + url);
  }
  fs.writeFileSync(path.join(dir, 'puntos.json'), JSON.stringify(lista, null, 2));
  console.log('\nListo: ' + lista.length + ' QR en /qr. Abrí carteles.html para imprimir.');
})();
