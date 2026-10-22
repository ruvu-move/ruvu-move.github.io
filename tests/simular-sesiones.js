/* Simula 20 sesiones de punta a punta en un navegador real (Chromium, vista
   mobile) contra el Apps Script simulado, y verifica que la hoja "respuestas",
   los agregados del doGet y el panel cuenten bien.
   Uso: npm test */
const { chromium } = require('playwright');
const { iniciar } = require('./servidor-local');

const PUERTO = 8099;
const BASE = `http://localhost:${PUERTO}`;
const WA = n => `221 555 ${String(1000 + n)}`;

/* Cada sesión: punto, ref opcional, acciones y lo que debería quedar en la hoja.
   Acciones: 'empezar' · valor de opción · 'wa' · 'nowa' · 'pv' (día+franja) · 'saltar' · 'invitar' · 'offline'/'online' */
const SESIONES = [
  { id: 1, p: 'plaza-san-martin', acc: ['empezar', 'terminal', 'caminando', 'todos_los_dias', 'si', '25-34', 'si', 'wa', 'pv', 'invitar'],
    espera: { usaria: 'si', acepta_precio: 'si', completo: 'si', ultimo_paso: 'fin', wa: true, invito_amigo: 'si', dia_primer_viaje: 'lun', franja_primer_viaje: '7-10' } },
  { id: 2, p: 'plaza-san-martin', acc: ['empezar', 'plaza-moreno', 'micro', '2-3', 'si', '18-24', 'si', 'wa', 'saltar'],
    espera: { usaria: 'si', acepta_precio: 'si', completo: 'si', ultimo_paso: 'fin', wa: true } },
  { id: 3, p: 'bosque', acc: ['empezar', 'terminal', 'caminando', '4_o_mas', 'depende', '18-24', 'caro', 'pack', 'wa', 'saltar'],
    espera: { usaria: 'depende', acepta_precio: 'caro', oferta_elegida: 'pack', completo: 'si', wa: true } },
  { id: 4, p: 'bosque', acc: ['empezar', 'plaza-moreno', 'caminando', '2-3', 'depende', '25-34', 'caro', 'valle', 'wa', 'pv', 'invitar'],
    espera: { usaria: 'depende', acepta_precio: 'caro', oferta_elegida: 'valle', completo: 'si', wa: true, invito_amigo: 'si' } },
  { id: 5, p: 'terminal', acc: ['empezar', 'plaza-moreno', 'micro', '1_o_menos', 'si', '35-44', 'caro', 'abono', 'nowa'],
    espera: { usaria: 'si', acepta_precio: 'caro', oferta_elegida: 'abono', completo: 'si', ultimo_paso: 'fin_sin_whatsapp', wa: false } },
  { id: 6, p: 'terminal', acc: ['empezar', 'rectorado', 'caminando', 'todos_los_dias', 'depende', '18-24', 'caro', 'ninguna', '900', 'wa', 'saltar'],
    espera: { usaria: 'depende', acepta_precio: 'caro', oferta_elegida: 'ninguna', precio_max: '900', completo: 'si', wa: true } },
  { id: 7, p: 'estacion', acc: ['empezar', 'plaza-moreno', 'bici', '2-3', 'depende', '45+', 'caro', 'ninguna', 'menos_600', 'nowa'],
    espera: { usaria: 'depende', acepta_precio: 'caro', oferta_elegida: 'ninguna', precio_max: 'menos_600', completo: 'si', wa: false } },
  { id: 8, p: 'estacion', acc: ['empezar', 'terminal', 'caminando', '2-3', 'no', 'inseguro', '25-34', 'wa', 'saltar'],
    espera: { usaria: 'no', motivo_no: 'inseguro', acepta_precio: '', completo: 'si', wa: true }, sinPrecio: true },
  { id: 9, p: 'plaza-italia', acc: ['empezar', 'plaza-moreno', 'caminando', '1_o_menos', 'no', 'prefiero_caminar', '45+', 'nowa'],
    espera: { usaria: 'no', motivo_no: 'prefiero_caminar', completo: 'si', ultimo_paso: 'fin_sin_whatsapp', wa: false }, sinPrecio: true },
  { id: 10, p: 'plaza-italia', acc: ['empezar', 'terminal', 'caminando', '2-3', 'si', 'menos_18'],
    espera: { usaria: 'si', edad: 'menos_18', completo: 'si', ultimo_paso: 'fin_menor', wa: false, codigo: '' }, menor: true },
  { id: 11, p: 'facultad', acc: ['empezar', 'plaza-moreno', 'micro', '4_o_mas', 'no', 'clima', 'menos_18'],
    espera: { usaria: 'no', motivo_no: 'clima', edad: 'menos_18', completo: 'si', ultimo_paso: 'fin_menor', wa: false }, menor: true },
  { id: 12, p: 'facultad', acc: ['empezar'], espera: { completo: 'no', ultimo_paso: 'destino', wa: false } },
  { id: 13, p: 'control-calle-8', acc: ['empezar', 'terminal', 'caminando', '2-3'], espera: { completo: 'no', ultimo_paso: 'usaria', wa: false } },
  { id: 14, p: 'control-calle-8', acc: ['empezar', 'terminal', 'auto', '2-3', 'si', '25-34'], espera: { completo: 'no', ultimo_paso: 'precio', usaria: 'si', wa: false } },
  { id: 15, p: 'plaza-san-martin', acc: ['empezar', 'estacion', 'caminando', '2-3', 'si', '18-24', 'no_pagaria'],
    espera: { completo: 'no', ultimo_paso: 'whatsapp', acepta_precio: 'no_pagaria', wa: false } },
  { id: 16, p: 'bosque', acc: [], espera: { completo: 'no', ultimo_paso: 'inicio', wa: false, timestamp_inicio: '' } },
  { id: 17, p: null, acc: ['empezar', 'otro', 'caminando', '2-3', 'si', '18-24', 'si', 'wa', 'saltar'],
    espera: { punto: 'sin-punto', usaria: 'si', acepta_precio: 'si', completo: 'si', wa: true, min_monopatin: 10, min_caminando: 25, precio_mostrado: 1250 } },
  { id: 18, p: 'plaza-san-martin', refDe: 1, acc: ['empezar', 'plaza-moreno', 'caminando', '2-3', 'si', '18-24', 'si', 'wa', 'saltar'],
    espera: { usaria: 'si', acepta_precio: 'si', completo: 'si', wa: true } },
  { id: 19, p: 'terminal', acc: ['empezar', 'plaza-moreno', 'uber_remis', '2-3', 'depende', '35-44', 'no_pagaria', 'wa', 'pv'],
    espera: { usaria: 'depende', acepta_precio: 'no_pagaria', completo: 'si', wa: true } },
  { id: 20, p: 'estacion', acc: ['empezar', 'plaza-moreno', 'offline', 'caminando', '2-3', 'si', 'online', '25-34', 'si', 'wa', 'saltar'],
    espera: { usaria: 'si', acepta_precio: 'si', completo: 'si', wa: true, modo_actual: 'caminando' } }
];

let fallas = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { fallas++; console.log('  ✗ ' + msg); }
}

async function correrSesion(browser, s, codigos) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await ctx.route(/wa\.me|fonts\.(googleapis|gstatic)/, r => r.abort());
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  let url = BASE + '/' + (s.p ? '?p=' + s.p : '');
  if (s.refDe) url += '&ref=' + codigos[s.refDe];
  await page.goto(url);
  const pantalla = () => page.getAttribute('#pantalla', 'data-pantalla');
  const visitadas = [await pantalla()];
  const esperarCambio = async antes => {
    await page.waitForFunction(a => document.getElementById('pantalla').getAttribute('data-pantalla') !== a, antes, { timeout: 8000 });
    visitadas.push(await pantalla());
  };
  for (const a of s.acc) {
    const antes = await pantalla();
    if (a === 'offline') { await fetch(BASE + '/__offline?on=1'); continue; }
    if (a === 'online') { await fetch(BASE + '/__offline?on=0'); continue; }
    if (a === 'empezar') { await page.click('#empezar'); await esperarCambio(antes); continue; }
    if (a === 'wa') {
      await page.fill('#wa', WA(s.id));
      await page.check('#consent');
      await page.click('#enviar-wa');
      await esperarCambio(antes);
      continue;
    }
    if (a === 'nowa') { await page.click('#no-wa'); await esperarCambio(antes); continue; }
    if (a === 'pv') {
      await page.click('.chips[data-grupo="dia"] [data-v="lun"]');
      await page.click('.chips[data-grupo="franja"] [data-v="7-10"]');
      await page.click('#listo-pv'); await esperarCambio(antes); continue;
    }
    if (a === 'saltar') { await page.click('#saltar-pv'); await esperarCambio(antes); continue; }
    if (a === 'invitar') {
      codigos[s.id] = (await page.textContent('#codigo')).trim();
      const href = await page.getAttribute('#invitar', 'href');
      check(decodeURIComponent(href).includes('&ref=' + codigos[s.id]), `S${s.id}: link de invitación lleva ?p=${s.p}&ref=${codigos[s.id]}`);
      await page.click('#invitar');
      await page.waitForTimeout(300);
      continue;
    }
    await page.click(`#pantalla [data-v="${a}"]`);
    await esperarCambio(antes);
  }
  if (await pantalla() === 'fin') {
    codigos[s.id] = (await page.textContent('#codigo')).trim();
  }
  // esperar a que la cola se vacíe
  await page.waitForFunction(() => window.__ruvu.cola.pendientes() === 0, null, { timeout: 30000 });
  check(!errores.length, `S${s.id}: sin errores de JavaScript ${errores.join(' | ')}`);
  return { ctx, page, visitadas, sesion: await page.evaluate(() => window.__ruvu.sesion) };
}

/* Agregados esperados, calculados a partir de lo que debería haber en la hoja */
function esperados(filas) {
  const out = {};
  for (const f of filas) {
    const p = (out[f.punto] = out[f.punto] || { qr: {}, ref: {} });
    const e = f.ref ? p.ref : p.qr;
    const inc = k => (e[k] = (e[k] || 0) + 1);
    inc('escanean');
    if (f.timestamp_inicio) inc('empiezan');
    if (f.usaria === 'si') inc('usaria_si');
    if (f.usaria === 'depende') inc('usaria_depende');
    if (f.acepta_precio === 'si') inc('acepta_precio');
    if (f.whatsapp) inc('whatsapp');
    if (f.invito_amigo === 'si') inc('invitan');
    if (f.completo === 'si') inc('completan');
  }
  return out;
}

(async () => {
  const server = await iniciar(PUERTO);
  await fetch(BASE + '/__reset');
  const browser = await chromium.launch();
  const codigos = {};
  const resultados = {};

  console.log('\n== 20 sesiones ==');
  for (const s of SESIONES) {
    console.log(`\nSesión ${s.id} (${s.p || 'sin ?p='}${s.refDe ? ', referida' : ''}): ${s.acc.join(' → ') || '(solo escanea)'}`);
    const r = await correrSesion(browser, s, codigos);
    resultados[s.id] = r;
    if (s.sinPrecio) check(!r.visitadas.includes('precio'), `S${s.id}: no se mostró el precio`);
    if (s.menor) check(r.visitadas.at(-1) === 'fin_menor' && !r.visitadas.includes('whatsapp'), `S${s.id}: menor termina sin pedir WhatsApp`);
    if (s.id === 1) {
      check(/^RUVU-[A-HJ-NP-Z2-9]{4}$/.test(codigos[1]), `S1: código con formato válido (${codigos[1]})`);
      // Re-escaneo desde el mismo celular
      await r.page.goto(BASE + '/?p=plaza-san-martin');
      await r.page.waitForSelector('#codigo');
      check((await r.page.textContent('#codigo')).trim() === codigos[1], 'S1 re-escanea: "Ya participaste" con su mismo código');
      await r.page.waitForFunction(() => window.__ruvu.cola.pendientes() === 0);
    }
    if (s.id !== 1) await r.ctx.close();
  }

  console.log('\n== Contador ==');
  const ctxC = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const pc = await ctxC.newPage();
  await pc.goto(BASE + '/contador.html');
  await pc.fill('#pin input', '1111'); await pc.click('#pin button');
  check(await pc.isVisible('.pin-error'), 'PIN incorrecto rechazado');
  await pc.fill('#pin input', '2026'); await pc.click('#pin button');
  await pc.selectOption('#punto', 'plaza-san-martin');
  for (let i = 0; i < 10; i++) await pc.click('#pasa');
  for (let i = 0; i < 3; i++) await pc.click('#frena');
  await pc.click('#deshacer'); // deshace el último "frena"
  await pc.selectOption('#punto', 'bosque');
  for (let i = 0; i < 5; i++) await pc.click('#pasa');
  await pc.click('#frena');
  await pc.waitForFunction(() => document.getElementById('estado').textContent.includes('Todo guardado'), null, { timeout: 15000 });
  check(await pc.textContent('#n-pasa') === '5' && await pc.textContent('#n-frena') === '1', 'Contador muestra 5 pasa / 1 frena en Paseo del Bosque');

  console.log('\n== Hoja "respuestas" ==');
  const hoja = await (await fetch(BASE + '/__datos')).json();
  const filas = hoja.respuestas;
  check(filas.length === 20, `una fila por sesión: ${filas.length} filas (esperadas 20)`);
  const ids = new Set(filas.map(f => f.session_id));
  check(ids.size === filas.length, 'session_id sin duplicados');
  for (const s of SESIONES) {
    const f = filas.find(x => x.session_id === resultados[s.id].sesion);
    if (!f) { check(false, `S${s.id}: fila encontrada`); continue; }
    const e = { punto: s.p || 'sin-punto', ...s.espera };
    const malos = Object.entries(e).filter(([k, v]) => {
      if (k === 'wa') return v ? !/^\+549221555\d{4}$/.test(f.whatsapp) : f.whatsapp !== '';
      return String(f[k]) !== String(v);
    }).map(([k, v]) => `${k}=${k === 'wa' ? f.whatsapp : f[k]} (esperado ${v})`);
    if (s.espera.wa) {
      if (f.codigo !== codigos[s.id] && codigos[s.id]) malos.push(`codigo ${f.codigo} ≠ pantalla ${codigos[s.id]}`);
      if (f.consentimiento !== 'si') malos.push('consentimiento');
    }
    if (s.refDe && f.ref !== codigos[s.refDe]) malos.push(`ref=${f.ref}`);
    check(!malos.length, `S${s.id}: fila correcta ${malos.join(', ')}`);
  }
  const conCodigo = filas.filter(f => f.codigo).map(f => f.codigo);
  check(new Set(conCodigo).size === conCodigo.length, `códigos únicos (${conCodigo.length})`);
  check(hoja.eventos.filter(e => e.tipo === 'scan').length === 21, `eventos: 21 scans (20 + 1 re-escaneo) → ${hoja.eventos.filter(e => e.tipo === 'scan').length}`);
  check(hoja.conteo.length === 20, `hoja conteo: 20 filas (19 toques + 1 deshacer) → ${hoja.conteo.length}`);

  console.log('\n== Código repetido (lo resuelve el servidor) ==');
  const choque = await (await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: [
    { event_id: 'x1', tipo: 'respuesta', session_id: 'choque', punto: 'bosque', datos: { codigo: codigos[1], ultimo_paso: 'primer_viaje' } }
  ] }) })).json();
  check(choque.resultados.x1.codigo && choque.resultados.x1.codigo !== codigos[1], `si el código ya existe devuelve otro (${codigos[1]} → ${choque.resultados.x1.codigo})`);
  // (esa fila de prueba no tiene timestamps, así que no entra en los conteos)

  console.log('\n== Agregados del doGet ==');
  const ag = await (await fetch(BASE + '/api?pin=2026')).json();
  check((await (await fetch(BASE + '/api?pin=0000')).json()).error === 'pin', 'doGet con PIN incorrecto no devuelve datos');
  check(!JSON.stringify(ag).includes('+549'), 'doGet no expone ningún WhatsApp');
  const esp = esperados(filas);
  for (const [punto, e] of Object.entries(esp)) {
    for (const g of ['qr', 'ref']) {
      for (const [k, v] of Object.entries(e[g])) {
        const real = ag.puntos[punto][g][k];
        if (real !== v) check(false, `${punto}.${g}.${k}: ${real} (esperado ${v})`);
      }
    }
  }
  const psm = ag.puntos['plaza-san-martin'];
  check(psm.conteo.pasan === 12 && psm.conteo.frenan === 2, `Plaza San Martín: pasan 12 (10 + 2 frenan), frenan 2 (3 − 1 deshecho) → ${psm.conteo.pasan}/${psm.conteo.frenan}`);
  check(ag.puntos.bosque.conteo.pasan === 6 && ag.puntos.bosque.conteo.frenan === 1, 'Paseo del Bosque: pasan 6, frenan 1');
  check(psm.qr.escanean === 3 && psm.ref.escanean === 1, `Plaza San Martín: 3 escaneos por QR + 1 referido → ${psm.qr.escanean}+${psm.ref.escanean}`);
  check(psm.reescaneos === 1, 'Plaza San Martín: 1 re-escaneo');
  check(psm.qr.invitan === 1, 'Plaza San Martín: 1 invitó a un amigo');
  check(ag.puntos['control-calle-8'].abandono.usaria === 1 && ag.puntos['control-calle-8'].abandono.precio === 1, 'Calle 8: abandonos en "usaria" y "precio"');
  check(ag.puntos.bosque.abandono.inicio === 1, 'Bosque: 1 escaneó y no empezó');
  check(ag.puntos['sin-punto'].qr.escanean === 1, 'sin-punto registrado');

  console.log('\n== Panel ==');
  const pp = await ctxC.newPage();
  await pp.setViewportSize({ width: 1100, height: 900 });
  await pp.goto(BASE + '/panel.html'); // el PIN quedó guardado del contador
  await pp.waitForSelector('#tabla-embudo tr.total');
  const total = await pp.$$eval('#tabla-embudo tr.total td', tds => tds.map(td => td.childNodes[0].textContent.trim()));
  const qrTot = k => Object.values(ag.puntos).reduce((s, p) => s + p.qr[k], 0);
  const esperadoPanel = ['Total', '18', '3', String(qrTot('escanean')), String(qrTot('empiezan')), String(qrTot('usaria_si')),
    String(qrTot('acepta_precio')), String(qrTot('whatsapp')), String(qrTot('invitan'))];
  check(JSON.stringify(total.slice(0, 9)) === JSON.stringify(esperadoPanel), `fila Total del panel: ${total.slice(0, 9).join(' | ')}`);
  const sinChoque = filas.filter(f => !f.ref); // por QR (incluye sin-punto)
  check(Number(total[3]) === sinChoque.length, `panel: escanean por QR = filas sin ref (${sinChoque.length})`);
  const [descarga] = await Promise.all([pp.waitForEvent('download'), pp.click('#csv')]);
  const csv = require('fs').readFileSync(await descarga.path(), 'utf8');
  check(csv.includes('EMBUDO') && csv.includes('plaza-san-martin;12;2;3') && !csv.includes('+549'), 'CSV exportado con embudo y sin WhatsApps');
  // filtro por fecha: mañana → nada
  const man = new Date(Date.now() + 86400000);
  const f = man.getFullYear() + '-' + String(man.getMonth() + 1).padStart(2, '0') + '-' + String(man.getDate()).padStart(2, '0');
  await pp.fill('#desde', f);
  await pp.click('#actualizar');
  await pp.waitForFunction(() => document.querySelector('#tabla-embudo tr.total td:nth-child(4)').childNodes[0].textContent.trim() === '0', null, { timeout: 8000 });
  check(true, 'filtro "desde mañana" deja todo en 0');

  await browser.close();
  server.close();
  console.log(`\n${fallas ? '✗ ' + fallas + ' verificaciones fallaron' : '✓ Todo OK'}`);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
