/* Servidor local de desarrollo / pruebas.
   - Sirve el sitio estático.
   - Simula el Apps Script en /api corriendo apps-script/Code.gs sobre una
     "planilla" en memoria (tests/gas-mock.js).
   Uso: npm run dev  →  http://localhost:8080/?p=plaza-san-martin
   Extras para pruebas: /__datos (ver la planilla), /__offline?on=1|0 (cortar /api). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { crearEntorno } = require('./gas-mock');

const RAIZ = path.join(__dirname, '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain; charset=utf-8'
};

function iniciar(puerto = 8080) {
  let gas = crearEntorno();
  let offline = false;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const cors = { 'Access-Control-Allow-Origin': '*' };

    if (url.pathname === '/api') {
      if (offline) { req.socket.destroy(); return; } // simula falta de conexión
      if (req.method === 'POST') {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
          const out = gas.ctx.doPost({ postData: { contents: body } });
          res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
          res.end(out.getContent());
        });
        return;
      }
      const out = gas.ctx.doGet({ parameter: Object.fromEntries(url.searchParams) });
      const esJs = out.getContent().startsWith(url.searchParams.get('callback') + '(');
      res.writeHead(200, { ...cors, 'Content-Type': esJs ? 'text/javascript' : 'application/json' });
      res.end(out.getContent());
      return;
    }
    if (url.pathname === '/__datos') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ respuestas: gas.tabla('respuestas'), eventos: gas.tabla('eventos'), conteo: gas.tabla('conteo') }));
      return;
    }
    if (url.pathname === '/__offline') { offline = url.searchParams.get('on') === '1'; res.end('ok'); return; }
    if (url.pathname === '/__reset') { gas = crearEntorno(); res.end('ok'); return; }

    let archivo = path.join(RAIZ, decodeURIComponent(url.pathname));
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
    if (url.pathname.endsWith('/')) archivo = path.join(archivo, 'index.html');
    fs.readFile(archivo, (err, data) => {
      if (err) { res.writeHead(404); res.end('no encontrado'); return; }
      if (url.pathname === '/config.js') {
        // apuntar el sitio al Apps Script simulado
        data = Buffer.from(data.toString() + "\nwindow.RUVU_CONFIG.API_URL = '/api';\n");
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise(ok => server.listen(puerto, () => ok(server)));
}

if (require.main === module) {
  const puerto = Number(process.env.PORT || 8080);
  iniciar(puerto).then(() => console.log(`RUVU local en http://localhost:${puerto}/?p=plaza-san-martin  (panel: /panel.html, contador: /contador.html)`));
}

module.exports = { iniciar };
