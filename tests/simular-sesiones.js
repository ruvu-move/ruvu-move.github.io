/* Simula sesiones de punta a punta de la encuesta v2.1 en un navegador real
   (Chromium, vista mobile) contra el Apps Script simulado, y verifica la hoja
   "respuestas", "eventos", los agregados del doGet y el panel.
   Uso: npm test */
const { chromium } = require('playwright');
const { iniciar } = require('./servidor-local');

const PUERTO = 8099;
const BASE = `http://localhost:${PUERTO}`;
const UA_MOVIL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

let fallas = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { fallas++; console.log('  ✗ ' + msg); }
}
const get = async ruta => (await fetch(BASE + ruta)).json();
const datosHoja = () => get('/__datos');
const fila = async sid => (await datosHoja()).respuestas.find(f => f.session_id === sid);

async function nuevoCtx(browser, ua, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: ua || UA_MOVIL });
  await ctx.route(/wa\.me|fonts\.(googleapis|gstatic)/, r => r.abort());
  return ctx;
}

const pantalla = page => page.getAttribute('#pantalla', 'data-pantalla');
async function esperarCambio(page, antes) {
  await page.waitForFunction(a => document.getElementById('pantalla').getAttribute('data-pantalla') !== a, antes, { timeout: 10000 });
}
const esperarPantalla = (page, id) =>
  page.waitForFunction(x => document.getElementById('pantalla').getAttribute('data-pantalla') === x, id, { timeout: 10000 });
const sesion = page => page.evaluate(() => window.__ruvu.sesion);
const vaciarCola = page => page.waitForFunction(() => window.__ruvu.cola.pendientes() === 0, null, { timeout: 40000 });

/* Botones habilitados de la pantalla que NO son una respuesta (opción, chip) ni
   "volver"/"empezar de nuevo": si hay alguno, se podría avanzar sin responder. */
const botonesParaSaltear = page => page.$$eval('#pantalla button, #pantalla a.btn', bs => bs
  .filter(b => !b.disabled && !b.closest('[hidden]') && !b.matches('.btn-opcion, .chip, #de-nuevo'))
  .map(b => b.id || b.textContent.trim()));

/* Acciones: 'donde:<id>' · 'otra:<texto>' · '<valor de opción>' · 'pv:<día>:<franja>' · 'wa:<número>' · 'sinwa' · 'dejar-numero' */
async function recorrer(page, acciones, alPasar) {
  for (const a of acciones) {
    const antes = await pantalla(page);
    if (alPasar) await alPasar(antes);
    if (a.startsWith('donde:')) await page.click(`#pantalla [data-v="${a.slice(6)}"]`);
    else if (a.startsWith('otra:')) {
      await page.click('#pantalla [data-v="otra"]');
      await page.fill('#parada-otra', a.slice(5));
      await page.click('#siguiente-otra');
    } else if (a.startsWith('pv:')) {
      const [, dia, franja] = a.split(':');
      await page.click(`[data-grupo="dia_primer_viaje"] [data-v="${dia}"]`);
      await page.click(`[data-grupo="franja_primer_viaje"] [data-v="${franja}"]`);
      await page.click('#siguiente-pv');
    } else if (a.startsWith('wa:')) {
      await page.fill('#wa', a.slice(3));
      await page.check('#consent');
      await page.click('#enviar-wa');
    } else if (a === 'sinwa') await page.click('#no-wa');
    else if (a === 'dejar-numero') await page.click('#dejar-numero');
    else await page.click(`#pantalla [data-v="${a}"]`);
    await esperarCambio(page, antes);
  }
}

// Recorrido completo estándar hasta el WhatsApp
const HASTA_WA = ['donde:plaza-moreno', 'terminal', 'caminando', '2-3', 'facu', 'si', '900', 'pv:lun:7-10', '25-34'];

(async () => {
  const server = await iniciar(PUERTO);
  await fetch(BASE + '/__reset');
  const browser = await chromium.launch();
  const errores = [];
  const sesiones = {};

  async function abrir(ctx, query) {
    const page = await ctx.newPage();
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(BASE + '/' + (query || ''));
    await page.waitForSelector('#pantalla[data-pantalla]');
    return page;
  }

  console.log('\n== 0. Abre directo en la primera pregunta ==');
  for (const vp of [{ width: 375, height: 667 }, { width: 360, height: 740 }, { width: 320, height: 568 }]) {
    const ctx = await nuevoCtx(browser, UA_MOVIL, vp);
    const page = await abrir(ctx);
    const ult = await page.$eval('#pantalla .opciones .btn-opcion:last-child', b => b.getBoundingClientRect().bottom);
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (vp.width >= 360) {
      check(await pantalla(page) === 'parada' && ult <= vp.height && scroll <= 0,
        `${vp.width}×${vp.height}: encabezado + "¿Dónde estás?" + todas las opciones sin scrollear (última opción en ${Math.round(ult)} px)`);
    } else {
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${vp.width}×${vp.height}: sin scroll horizontal`);
    }
    await ctx.close();
  }
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    const enc = await page.textContent('.encabezado');
    check(enc.includes('RUVU llega a La Plata 🛴') && enc.includes('Todavía no anda: respondé 9 preguntas y te regalamos tu primer viaje.'), `encabezado: "${enc.trim()}"`);
    check(!(await page.$('#empezar')), 'ya no hay pantalla de bienvenida ni botón "Quiero mi viaje gratis"');
    await page.waitForTimeout(800);
    const sid = await sesion(page);
    let f = await fila(sid);
    check(f && f.ultimo_paso === 'inicio' && !f.timestamp_inicio && f.version === 'v2.1', 'al cargar: fila con ultimo_paso = inicio, sin timestamp_inicio, version v2.1');
    await page.reload(); await page.waitForSelector('#pantalla[data-pantalla]');
    check(await pantalla(page) === 'parada' && !(await page.$('.retomar')), 'si recarga sin tocar nada, no ofrece "Seguí donde dejaste"');
    await ctx.close();
    const ctx2 = await nuevoCtx(browser);
    const p2 = await abrir(ctx2, '?ref=RUVU-XXXX');
    const enc2 = await p2.textContent('.encabezado');
    check(enc2.includes('Te invitaron a RUVU 🛴') && enc2.includes('Respondé 9 preguntas y tenés tu primer viaje gratis.'), `con ?ref=: "${enc2.trim()}"`);
    await ctx2.close();
  }

  console.log('\n== 1. Completa con número: todas obligatorias ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    const vistas = [], salteables = {}, faltas = [];
    await recorrer(page, HASTA_WA, async id => {
      vistas.push(id);
      faltas.push(await page.textContent('#falta'));
      const b = await botonesParaSaltear(page);
      if (b.length) salteables[id] = b;
      // tocar fuera de las opciones no avanza
      await page.click('h2'); await page.waitForTimeout(80);
      if (await pantalla(page) !== id) salteables[id] = ['avanzó sin responder'];
    });
    check(vistas.join(',') === 'parada,destino,modo,frecuencia,motivo,usaria,precio,primer_viaje,edad', `orden: ${vistas.join(' → ')}`);
    check(!Object.keys(salteables).length, `ninguna pantalla se puede saltear ${JSON.stringify(salteables)}`);
    check(faltas[0] === 'Te faltan 9 para tu viaje gratis' && faltas[8] === '¡Última pregunta!', `barra: "${faltas[0]}" … "${faltas[8]}"`);
    check(await pantalla(page) === 'whatsapp' && (await page.textContent('#falta')).includes('Llegaste'), 'llega a WhatsApp con la barra llena');
    check(await page.isHidden('#caja-consent'), 'el consentimiento no aparece si no escribió número');
    await page.fill('#wa', '12');
    await page.check('#consent');
    await page.click('#enviar-wa');
    check(await page.isVisible('#err-wa') && await pantalla(page) === 'whatsapp', 'número inválido: muestra error y no avanza');
    await page.fill('#wa', '221 555 0101');
    await page.uncheck('#consent');
    await page.click('#enviar-wa');
    check(await page.isVisible('#err-consent') && await pantalla(page) === 'whatsapp', 'número válido sin consentimiento: no avanza');
    await page.check('#consent');
    await page.click('#enviar-wa');
    await esperarPantalla(page, 'codigo');
    const t = await page.textContent('#pantalla');
    check(/RUVU-[A-Z2-9]{4}/.test(t) && t.includes('Te lo mandamos por WhatsApp'), 'código con "Te lo mandamos por WhatsApp"');
    check(!(await page.$('#pantalla .chip, #ir-bonus, #pantalla .btn-opcion')), 'en la pantalla final ya no hay preguntas');
    await page.click('#invitar'); await page.waitForTimeout(300);
    await vaciarCola(page);
    const sid = sesiones.completa = await sesion(page);
    const f = await fila(sid);
    check(f.version === 'v2.1' && f.parada === 'plaza-moreno' && f.destino === 'terminal' && f.modo_actual === 'caminando' &&
      f.frecuencia === '2-3' && f.motivo_viaje === 'facu' && f.usaria === 'si' && f.precio_max_v2 === '900' &&
      f.dia_primer_viaje === 'lun' && f.franja_primer_viaje === '7-10' && f.edad === '25-34', 'fila con todas las respuestas');
    check(/^\+549221555\d{4}$/.test(f.whatsapp) && f.consentimiento === 'si' && f.completo === 'si' && f.ultimo_paso === 'codigo' && /^RUVU-/.test(f.codigo),
      'número, consentimiento, código, completo = si y ultimo_paso = codigo');
    check(f.timestamp_scan && f.timestamp_inicio && f.timestamp_fin, 'timestamp_scan, _inicio y _fin cargados');
    check(f.invito_amigo === 'si', 'invitó a un amigo');
    const pasos = (await datosHoja()).eventos.filter(e => e.session_id === sid && e.tipo === 'respuesta').map(e => e.ultimo_paso).join(',');
    check(pasos === 'destino,modo,frecuencia,motivo,usaria,precio,primer_viaje,edad,whatsapp,codigo', `ultimo_paso con los nombres nuevos (${pasos})`);
    await ctx.close();
  }

  console.log('\n== 2. Sin número, después "Mejor quiero dejar mi número" ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['donde:bosque', 'plaza-moreno', 'micro', '4_o_mas', 'laburo', 'depende', '1200', 'pv:vie:16-19', '18-24']);
    const caja = await page.$eval('#enviar-wa', b => b.getBoundingClientRect());
    const caja2 = await page.$eval('#no-wa', b => b.getBoundingClientRect());
    check(caja2.bottom <= 740 && Math.abs(caja.height - caja2.height) < 1 && Math.abs(caja.width - caja2.width) < 1,
      'WhatsApp: los dos botones del mismo tamaño y a la vista');
    await recorrer(page, ['sinwa']);
    const t = await page.textContent('#pantalla');
    check(await pantalla(page) === 'codigo' && t.includes('Sacale captura'), 'sin número: ve el código y "Sacale captura"');
    const codigo = (await page.textContent('#codigo')).trim();
    await vaciarCola(page);
    let f = await fila(await sesion(page));
    check(f.completo === 'si' && f.codigo === codigo && f.whatsapp === '' && f.motivo_viaje === 'laburo', 'sin número igual guarda todas las respuestas');
    await recorrer(page, ['dejar-numero', 'wa:221 555 0202']);
    check(await pantalla(page) === 'codigo' && (await page.textContent('#codigo')).trim() === codigo, 'deja el número después: mismo código');
    await vaciarCola(page);
    f = await fila(await sesion(page));
    check(/^\+549/.test(f.whatsapp) && f.codigo === codigo, 'la fila tiene el número y el mismo código');
    await ctx.close();
  }

  console.log('\n== 3. "Otra" obligatoria + cuadras ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await page.click('#pantalla [data-v="otra"]');
    check(await page.getAttribute('#parada-otra', 'placeholder') === 'Ej: 7 y 50, Plaza Rocha', 'placeholder "Ej: 7 y 50, Plaza Rocha"');
    check(await page.isDisabled('#siguiente-otra') && await page.isVisible('#err-otra') &&
      (await page.textContent('#err-otra')) === 'Contanos dónde estás para calcular tu viaje', 'vacío: "Siguiente" gris y el mensaje "Contanos dónde estás…"');
    await page.press('#parada-otra', 'Enter'); await page.waitForTimeout(150);
    check(await pantalla(page) === 'parada', 'con Enter y el campo vacío no avanza');
    await page.fill('#parada-otra', '7 ');
    check(await page.isDisabled('#siguiente-otra'), 'con menos de 3 letras sigue deshabilitado');
    await page.waitForTimeout(800);
    const f0 = await fila(await sesion(page));
    check(f0.timestamp_inicio && f0.ultimo_paso === 'parada', 'tocar "Otra" ya cuenta como "empezó"');
    await page.fill('#parada-otra', '7 y 50');
    await page.click('#siguiente-otra');
    await esperarCambio(page, 'parada');
    await recorrer(page, ['otro']);
    check(await pantalla(page) === 'cuadras', 'Otra + Otro → pregunta las cuadras');
    check(!(await botonesParaSaltear(page)).length, 'las cuadras también son obligatorias');
    await recorrer(page, ['10', 'caminando', '2-3', 'tramite_compras']);
    const comp = (await page.textContent('.comparar')).replace(/\s+/g, ' ').trim();
    await recorrer(page, ['si', '900', 'pv:mar:10-13', '25-34', 'sinwa']);
    await vaciarCola(page);
    const f = await fila(await sesion(page));
    check(f.parada === 'otra' && f.parada_texto === '7 y 50' && f.destino === 'otro' && f.cuadras_estimadas === '10' &&
      f.min_monopatin === 6 && f.min_caminando === 17 && f.precio_mostrado === 950, `guarda Otra + texto + cuadras (${comp})`);
    await ctx.close();
  }

  console.log('\n== 4. Días y horarios: opción múltiple, sin horario no deja seguir ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['donde:plaza-italia', 'terminal', 'bici', '2-3', 'juntada_paseo', 'si', '600']);
    check(await pantalla(page) === 'primer_viaje' && await page.isDisabled('#siguiente-pv'), 'sin elegir nada: "Siguiente" deshabilitado');
    await page.click('[data-grupo="dia_primer_viaje"] [data-v="sab"]');
    check(await page.isDisabled('#siguiente-pv'), 'con el día y sin franja: sigue deshabilitado');
    await page.click('#siguiente-pv', { force: true }); await page.waitForTimeout(150);
    check(await pantalla(page) === 'primer_viaje', 'tocarlo igual no avanza');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="19-21"]');
    check(!(await page.isDisabled('#siguiente-pv')), 'con día y franja se habilita');
    check((await page.textContent('h2')) === '¿Qué días y horarios lo usarías?', 'título "¿Qué días y horarios lo usarías?"');
    // opción múltiple: varios días y horarios; tocar de nuevo desmarca
    for (const d of ['lun', 'mie', 'vie']) await page.click(`[data-grupo="dia_primer_viaje"] [data-v="${d}"]`);
    await page.click('[data-grupo="dia_primer_viaje"] [data-v="vie"]');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="7-10"]');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="19-21"]'); // desmarca
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="16-19"]');
    check(await page.$$eval('.chip[aria-pressed="true"]', c => c.length) === 5, 'marca varios días y horarios a la vez');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="7-10"]');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="16-19"]');
    check(await page.isDisabled('#siguiente-pv'), 'si desmarca todos los horarios se vuelve a deshabilitar');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="16-19"]');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="7-10"]');
    await page.click('#siguiente-pv'); await esperarPantalla(page, 'edad');
    await vaciarCola(page);
    const f = await fila(await sesion(page));
    check(f.dia_primer_viaje === 'lun,mie,sab' && f.franja_primer_viaje === '7-10,16-19',
      `guarda todos separados por coma (${f.dia_primer_viaje} · ${f.franja_primer_viaje})`);
    await page.click('#volver'); await esperarPantalla(page, 'primer_viaje');
    check(await page.$$eval('.chip[aria-pressed="true"]', c => c.map(x => x.dataset.v).join(',')) === 'lun,mie,sab,7-10,16-19', 'al volver atrás siguen marcados');
    await ctx.close();
  }

  console.log('\n== 5. "No" → motivo obligatorio, saltea el precio; volver y cambiar ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['donde:calle-8', 'estacion', 'caminando', '1_o_menos', 'facu', 'no']);
    check(await pantalla(page) === 'motivo_no' && !(await botonesParaSaltear(page)).length, 'pide "¿Por qué no?" y no se puede saltear');
    check(await page.textContent('#falta') === 'Te faltan 3 para tu viaje gratis', 'con "No" la barra no cuenta el precio (faltan motivo, día y edad)');
    await recorrer(page, ['clima']);
    check(await pantalla(page) === 'primer_viaje', 'después del motivo va al día y horario (sin precio)');
    // vuelve atrás hasta "¿lo usarías?" y cambia a "Sí": ahora pide el precio
    await page.click('#volver'); await esperarPantalla(page, 'motivo_no');
    check(await page.$eval('[data-v="clima"]', b => b.classList.contains('elegida')), 'al volver se ve marcada la respuesta anterior');
    await page.click('#volver'); await esperarPantalla(page, 'usaria');
    await recorrer(page, ['si']);
    check(await pantalla(page) === 'precio', 'cambió a "Sí": ahora pregunta el precio');
    await recorrer(page, ['1200', 'pv:dom:13-16', '35-44', 'sinwa']);
    await vaciarCola(page);
    const f = await fila(await sesion(page));
    check(f.usaria === 'si' && f.motivo_no === '' && f.precio_max_v2 === '1200' && f.completo === 'si', 'se guarda la nueva y se borra el motivo del "No"');
    // y al revés: de "Sí" a "No" borra el precio
    const ctx2 = await nuevoCtx(browser);
    const q = await abrir(ctx2);
    await recorrer(q, ['donde:terminal', 'plaza-moreno', 'micro', '2-3', 'facu', 'si', '900']);
    await q.click('#volver'); await esperarPantalla(q, 'precio');
    await q.click('#volver'); await esperarPantalla(q, 'usaria');
    await recorrer(q, ['no', 'inseguro', 'pv:lun:7-10', '25-34', 'sinwa']);
    await vaciarCola(q);
    const g = await fila(await sesion(q));
    check(g.usaria === 'no' && g.motivo_no === 'inseguro' && g.precio_max_v2 === '', 'de "Sí" a "No": se borra el precio');
    // cambia el destino: se recalculan minutos y precio
    const ctx3 = await nuevoCtx(browser);
    const w = await abrir(ctx3);
    await recorrer(w, ['donde:plaza-moreno', 'terminal']);
    await vaciarCola(w);
    const a1 = await fila(await sesion(w));
    await w.click('#volver'); await esperarPantalla(w, 'destino');
    await recorrer(w, ['rectorado']);
    await vaciarCola(w);
    const a2 = await fila(await sesion(w));
    check(a2.destino === 'rectorado' && (a1.min_monopatin !== a2.min_monopatin || a1.precio_mostrado !== a2.precio_mostrado),
      `cambia el destino: recalcula minutos/precio (${a1.min_monopatin}→${a2.min_monopatin} min, $${a1.precio_mostrado}→$${a2.precio_mostrado})`);
    await ctx.close(); await ctx2.close(); await ctx3.close();
  }

  console.log('\n== 6. Menor de 18 ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['donde:plaza-moreno', 'plaza-italia', 'micro', '2-3', 'facu', 'si', '600', 'pv:lun:7-10', 'menos_18']);
    check(await pantalla(page) === 'fin_menor' && !(await page.$('#codigo')), 'corta sin código');
    await vaciarCola(page);
    const f = await fila(await sesion(page));
    check(f.edad === 'menos_18' && f.codigo === '' && f.ultimo_paso === 'fin_menor' && f.completo === 'si', 'fila sin código');
    const p2 = await abrir(ctx);
    check(await pantalla(p2) === 'ya_tiene_codigo' && !(await p2.$('#otro-trayecto')), 'al volver: gracias, sin otro trayecto');
    await ctx.close();
  }

  console.log('\n== 7. Abandona, vuelve a escanear → retoma en la primera sin responder ==');
  {
    const ctx = await nuevoCtx(browser);
    let page = await abrir(ctx);
    await recorrer(page, ['donde:bosque', 'terminal', 'bici', '2-3', 'laburo']);
    check(await pantalla(page) === 'usaria', 'está en "¿Lo usarías?"');
    const sid = await sesion(page);
    await vaciarCola(page);
    await page.close();
    page = await abrir(ctx);
    check(await pantalla(page) === 'usaria' && await sesion(page) === sid, 'retoma en "¿Lo usarías?" con el mismo session_id');
    check((await page.textContent('.retomar')).includes('Seguí donde dejaste') && (await page.textContent('.comparar')).includes('min'),
      'muestra "Seguí donde dejaste" y los minutos calculados (respuestas cargadas)');
    await page.click('#volver'); await esperarPantalla(page, 'motivo');
    check(await page.$eval('[data-v="laburo"]', b => b.classList.contains('elegida')), 'al volver atrás está su respuesta anterior');
    await recorrer(page, ['laburo', 'si', '900', 'pv:jue:7-10', '18-24', 'wa:221 555 0606']);
    await vaciarCola(page);
    const f = await fila(sid);
    check(f.retomada === 'si' && f.completo === 'si' && f.modo_actual === 'bici' && f.motivo_viaje === 'laburo' && /^RUVU-/.test(f.codigo),
      'la fila original queda completa y marcada retomada = si');
    check((await datosHoja()).respuestas.filter(x => x.session_id === sid).length === 1, 'una sola fila para esa sesión');
    // sesión guardada de la v2 (sin "motivo" ni día): retoma en la primera que falta
    const ctx2 = await nuevoCtx(browser);
    await ctx2.addInitScript(() => {
      if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1);
      localStorage.setItem('ruvu_sesion', JSON.stringify({ v: 2, session_id: 'viejaV2abc', paso: 'precio', historial: ['inicio', 'parada', 'destino', 'modo', 'frecuencia', 'usaria'],
        r: { timestamp_inicio: '2026-11-27T10:00:00Z', parada: 'terminal', destino: 'plaza-moreno', min_monopatin: 7, min_caminando: 20, precio_mostrado: 1000, modo_actual: 'micro', frecuencia: '2-3', usaria: 'si' },
        test: false, repetido: false, ref: '', punto: 'sin-punto', ts: new Date().toISOString() }));
    });
    const q = await abrir(ctx2);
    check(await pantalla(q) === 'motivo', `sesión guardada con la v2: retoma en la pregunta nueva que le falta (${await pantalla(q)})`);
    await q.click('#volver'); await esperarPantalla(q, 'frecuencia');
    check(true, 'y puede volver atrás sin errores (la bienvenida ya no está en el historial)');
    await ctx2.close();
    // "Empezar de nuevo" crea otra sesión y vuelve a la primera pregunta
    const ctx3 = await nuevoCtx(browser);
    let w = await abrir(ctx3);
    await recorrer(w, ['donde:terminal']);
    const sidViejo = await sesion(w);
    await w.close();
    w = await abrir(ctx3);
    await w.click('#de-nuevo');
    await esperarPantalla(w, 'parada');
    check(await sesion(w) !== sidViejo && await w.isVisible('.encabezado'), '"Empezar de nuevo": sesión nueva en la primera pregunta');
    await vaciarCola(w);
    await ctx.close(); await ctx3.close();
  }

  console.log('\n== 8. Ya tiene código, vuelve → "otro trayecto" reutiliza la sesión ==');
  {
    const ctx = await nuevoCtx(browser);
    let page = await abrir(ctx);
    await recorrer(page, [...HASTA_WA, 'wa:221 555 0707']);
    const codigo = (await page.textContent('#codigo')).trim();
    const sid1 = await sesion(page);
    await vaciarCola(page);
    await page.close();
    page = await abrir(ctx);
    const t = await page.textContent('#pantalla');
    check(await pantalla(page) === 'ya_tiene_codigo' && t.includes('Ya participaste') && t.includes(codigo), 've "¡Ya participaste!" con su código');
    const sidScan = await sesion(page);
    await vaciarCola(page);
    let fs = await fila(sidScan);
    check(fs.repetido === 'si' && fs.ultimo_paso === 'ya_tiene_codigo', 'el escaneo queda con repetido = si y ultimo_paso = ya_tiene_codigo desde el primer evento');
    // recarga: otra fila ya_tiene_codigo, también repetido
    await page.reload(); await page.waitForSelector('#pantalla[data-pantalla]');
    const sidRecarga = await sesion(page);
    await vaciarCola(page);
    const fr = await fila(sidRecarga);
    check(fr.repetido === 'si' && fr.ultimo_paso === 'ya_tiene_codigo', 'al recargar: también repetido = si / ya_tiene_codigo');
    await page.click('#otro-trayecto');
    await esperarPantalla(page, 'destino');
    check(await sesion(page) === sidRecarga, '"Otro trayecto" reutiliza la sesión de ese escaneo (no crea otra)');
    const vistas = [], salteables = {};
    await recorrer(page, ['plaza-moreno', '20', 'micro', '2-3', 'facu', 'depende', '600', 'pv:mie:13-16'], async id => {
      vistas.push(id);
      const b = await botonesParaSaltear(page);
      if (b.length) salteables[id] = b;
    });
    check(vistas.join(',') === 'destino,cuadras,modo,frecuencia,motivo,usaria,precio,primer_viaje', `recorrido: ${vistas.join(' → ')} (sin edad ni WhatsApp)`);
    check(!Object.keys(salteables).length, 'también obligatorias');
    check(await pantalla(page) === 'codigo' && (await page.textContent('#codigo')).trim() === codigo, 'al final muestra el MISMO código');
    await vaciarCola(page);
    const d = await datosHoja();
    const f2 = d.respuestas.find(x => x.session_id === sidRecarga);
    check(f2.repetido === 'si' && f2.codigo === codigo && f2.destino === 'plaza-moreno' && f2.edad === '' && f2.completo === 'si' && f2.ultimo_paso === 'codigo',
      'esa fila: repetido = si, mismo código, sin edad, completo');
    check(d.respuestas.filter(x => x.session_id === sid1 || x.session_id === sidScan || x.session_id === sidRecarga).length === 3 &&
      !d.respuestas.some(x => x.repetido !== 'si' && x.session_id !== sid1 && x.codigo === codigo), 'no se creó ninguna sesión nueva en "inicio" sin marcar');
    check(d.respuestas.filter(x => x.codigo === codigo).length === 2, 'no se generó otro código');
    await ctx.close();
  }

  console.log('\n== 8b. Participante viejo sin número responde otro trayecto ==');
  {
    const ctx = await nuevoCtx(browser);
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('ruvu_participacion')) localStorage.setItem('ruvu_participacion', JSON.stringify({ codigo: null, session_id: 'viejo', ts: '2026-11-01T00:00:00Z' }));
    });
    const page = await abrir(ctx);
    check(await pantalla(page) === 'ya_tiene_codigo' && (await page.textContent('#pantalla')).includes('Ya respondiste'), 've "Ya respondiste"');
    await page.click('#otro-trayecto');
    await esperarPantalla(page, 'destino');
    await recorrer(page, ['plaza-moreno', '30', 'micro', '2-3', 'laburo', 'si', '900', 'pv:lun:7-10']);
    check(await pantalla(page) === 'codigo' && /RUVU-/.test(await page.textContent('#codigo')), 'recibe su código (y puede dejar el número desde ahí)');
    check(await page.isVisible('#dejar-numero'), 'ofrece "Mejor quiero dejar mi número"');
    await vaciarCola(page);
    await ctx.close();
  }

  console.log('\n== 9. Celular con la fecha mal → hora del servidor ==');
  {
    const ctx = await nuevoCtx(browser);
    await ctx.addInitScript(() => { // el reloj del celular adelantado 3 días
      const Real = Date, corr = 3 * 864e5;
      class Falso extends Real {
        constructor(...a) { if (a.length) super(...a); else super(Real.now() + corr); }
        static now() { return Real.now() + corr; }
      }
      window.Date = Falso;
    });
    const antes = Date.now();
    const page = await abrir(ctx);
    await recorrer(page, [...HASTA_WA, 'sinwa']);
    await vaciarCola(page);
    const sid = await sesion(page);
    const f = await fila(sid);
    const despues = Date.now() + 1000;
    const ok = k => { const t = Date.parse(f[k]); return t >= antes - 1000 && t <= despues; };
    check(ok('timestamp_scan') && ok('timestamp_inicio') && ok('timestamp_fin'),
      `timestamp_scan/_inicio/_fin con la hora real (${f.timestamp_scan.slice(0, 19)}), no la del celular`);
    const ev = (await datosHoja()).eventos.filter(e => e.session_id === sid);
    const scan = ev.find(e => e.tipo === 'scan');
    const dScan = JSON.parse(scan.datos);
    check(Date.parse(dScan.hora_cliente) > despues + 2 * 864e5 && !('timestamp_scan' in dScan),
      `la hora del celular queda solo en eventos.datos.hora_cliente (${dScan.hora_cliente.slice(0, 10)})`);
    check(ev.every(e => Date.parse(e.timestamp) <= despues), 'la columna timestamp de "eventos" también es la del servidor');
    await ctx.close();
  }

  console.log('\n== 10. Sin conexión a mitad y respuestas perdidas → sin duplicados ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['donde:plaza-moreno']);
    await fetch(BASE + '/__offline?on=1');
    await recorrer(page, ['terminal', 'caminando', '2-3']);
    check(await page.evaluate(() => window.__ruvu.cola.pendientes()) > 0, 'sin conexión: quedan envíos en la cola');
    await fetch(BASE + '/__offline?on=0');
    await fetch(BASE + '/__perder?on=1');
    await recorrer(page, ['facu', 'si', '900']);
    await page.waitForTimeout(2500);
    await fetch(BASE + '/__perder?on=0');
    await recorrer(page, ['pv:lun:7-10', '25-34', 'wa:221 555 0808']);
    await vaciarCola(page);
    const sid = await sesion(page);
    const d = await datosHoja();
    const ev = d.eventos.filter(e => e.session_id === sid);
    const ids = ev.map(e => e.event_id);
    check(new Set(ids).size === ids.length, `ningún event_id repetido en "eventos" (${ids.length} eventos)`);
    const pasos = ev.filter(e => e.tipo === 'respuesta').map(e => e.ultimo_paso).join(',');
    check(pasos === 'destino,modo,frecuencia,motivo,usaria,precio,primer_viaje,edad,whatsapp,codigo', `todos los envíos llegaron una vez y en orden (${pasos})`);
    const f = d.respuestas.find(x => x.session_id === sid);
    check(f.precio_max_v2 === '900' && f.completo === 'si', 'la fila quedó completa');
    await ctx.close();
  }

  console.log('\n== 11. Modo prueba y computadora ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx, '?test=1');
    await recorrer(page, ['donde:plaza-moreno', 'terminal']);
    await vaciarCola(page);
    sesiones.test = await sesion(page);
    check((await fila(sesiones.test)).test === 'si', '?test=1 guarda test = si');
    await ctx.close();
    const pc = await nuevoCtx(browser, UA_PC);
    const p2 = await abrir(pc);
    await recorrer(p2, ['donde:plaza-moreno']);
    await vaciarCola(p2);
    await pc.close();
  }

  console.log('\n== 12. Servidor: reenvío idéntico y cliente viejo (v2 en caché) ==');
  {
    const ev = { event_id: 'reenvio-1', tipo: 'scan', session_id: 'reenvio', punto: 'sin-punto', ua: UA_MOVIL, datos: { version: 'v2' } };
    const r1 = await (await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: [ev, ev] }) })).json();
    const r2 = await (await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: [ev] }) })).json();
    const n = (await datosHoja()).eventos.filter(e => e.event_id === 'reenvio-1').length;
    check(n === 1 && r1.ok && r2.resultados['reenvio-1'].duplicado, `el mismo event_id 3 veces → 1 fila (${n})`);
    // un celular con la versión vieja en caché manda timestamp_inicio con su hora
    await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: [
      { event_id: 'viejo-2', tipo: 'respuesta', session_id: 'reenvio', datos: { timestamp_inicio: '2020-01-01T00:00:00Z', ultimo_paso: 'parada' } }] }) });
    const f = await fila('reenvio');
    check(f.version === 'v2' && new Date(f.timestamp_inicio).getFullYear() >= 2026, 'cliente v2 viejo: sigue andando y la hora es la del servidor');
    check(/eventos: 0 filas/.test(await (await fetch(BASE + '/__correr?f=contarDuplicados')).text()), 'contarDuplicados: 0');
  }

  console.log('\n== Agregados y panel ==');
  const d = await datosHoja();
  const ag = await get('/api?pin=2026');
  check(!JSON.stringify(ag).includes('+549'), 'doGet no expone WhatsApps');
  check(ag.excluidas.test === 1 && ag.excluidas.computadora === 1, `excluye prueba (${ag.excluidas.test}) y computadora (${ag.excluidas.computadora})`);
  const v2 = d.respuestas.filter(f => /^v2/.test(f.version) && f.test !== 'si' && /Mobile|iPhone|Android/.test(f.user_agent) && f.ultimo_paso !== 'ya_tiene_codigo');
  const esp = {
    escanean: v2.length, empiezan: v2.filter(f => f.timestamp_inicio).length,
    llegan_precio: v2.filter(f => f.precio_max_v2 || f.ultimo_paso === 'precio').length,
    dejan_numero: v2.filter(f => f.whatsapp).length, ven_codigo: v2.filter(f => f.codigo).length,
    invitan: v2.filter(f => f.invito_amigo === 'si').length
  };
  const real = ag.versiones.v2.puntos['sin-punto'];
  const tot = {};
  Object.keys(esp).forEach(k => { tot[k] = real.qr[k] + real.ref[k]; });
  const malos = Object.keys(esp).filter(k => esp[k] !== tot[k]).map(k => `${k} ${tot[k]}≠${esp[k]}`);
  check(!malos.length, `embudo del doGet (v2 + v2.1) coincide con la hoja ${JSON.stringify(esp)} ${malos.join(' ')}`);
  check(real.abandono.inicio >= 2, `abandono en "inicio" (abrió y no tocó nada): ${real.abandono.inicio}`);

  const ctx = await nuevoCtx(browser);
  const pp = await ctx.newPage();
  await pp.setViewportSize({ width: 1200, height: 900 });
  await pp.goto(BASE + '/panel.html');
  await pp.fill('#pin input', '2026'); await pp.click('#pin button');
  await pp.waitForSelector('#tabla-embudo tr.total');
  const total = await pp.$$eval('#tabla-embudo tr.total td', tds => tds.map(td => td.childNodes[0].textContent.trim()));
  check(total[1] === String(real.qr.escanean) && total[2] === String(real.qr.empiezan), `fila Total del panel (QR, sin invitados): ${total.slice(0, 9).join(' | ')}`);
  check(await pp.isVisible('#d-motivo_viaje'), 'el panel muestra "¿Para qué es este viaje?"');
  const dias = real.dist.dia_primer_viaje;
  check(dias.lun >= 2 && dias.mie >= 1 && !Object.keys(dias).some(k => k.includes(',')), `el panel cuenta cada día por separado ${JSON.stringify(dias)}`);

  check(!errores.length, 'sin errores de JavaScript ' + errores.join(' | '));
  await browser.close();
  server.close();
  console.log(`\n${fallas ? '✗ ' + fallas + ' verificaciones fallaron' : '✓ Todo OK'}`);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
