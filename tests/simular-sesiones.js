/* Simula sesiones de punta a punta de la encuesta v2 en un navegador real
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

async function nuevoCtx(browser, ua) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: ua || UA_MOVIL });
  await ctx.route(/wa\.me|fonts\.(googleapis|gstatic)/, r => r.abort());
  return ctx;
}

const pantalla = page => page.getAttribute('#pantalla', 'data-pantalla');
async function esperarCambio(page, antes) {
  await page.waitForFunction(a => document.getElementById('pantalla').getAttribute('data-pantalla') !== a, antes, { timeout: 10000 });
}
const sesion = page => page.evaluate(() => window.__ruvu.sesion);
const vaciarCola = page => page.waitForFunction(() => window.__ruvu.cola.pendientes() === 0, null, { timeout: 40000 });

/* Acciones: 'empezar' · 'donde:<id>' · 'otra[:texto]' · '<valor de opción>' · 'wa:<número>' · 'sinwa' · 'bonus' · 'saltar-bonus' */
async function recorrer(page, acciones) {
  for (const a of acciones) {
    const antes = await pantalla(page);
    if (a === 'empezar') await page.click('#empezar');
    else if (a.startsWith('donde:')) await page.click(`#pantalla [data-v="${a.slice(6)}"]`);
    else if (a.startsWith('otra')) {
      await page.click('#pantalla [data-v="otra"]');
      const t = a.split(':')[1];
      if (t) await page.fill('#parada-otra', t);
      await page.click('#siguiente-otra');
    } else if (a.startsWith('wa:')) {
      await page.fill('#wa', a.slice(3));
      await page.check('#consent');
      await page.click('#enviar-wa');
    } else if (a === 'sinwa') await page.click('#no-wa');
    else if (a === 'dejar-numero') await page.click('#dejar-numero');
    else if (a === 'bonus') {
      await page.click('#ir-bonus'); await esperarCambio(page, antes);
      await page.click('[data-grupo="motivo_viaje"] [data-v="facu"]');
      await page.click('[data-grupo="dia_primer_viaje"] [data-v="lun"]');
      await page.click('[data-grupo="franja_primer_viaje"] [data-v="7-10"]');
      const b = await pantalla(page);
      await page.click('#listo-bonus');
      await esperarCambio(page, b);
      continue;
    } else if (a === 'saltar-bonus') {
      await page.click('#ir-bonus'); await esperarCambio(page, antes);
      const b = await pantalla(page);
      await page.click('#saltar-bonus');
      await esperarCambio(page, b);
      continue;
    } else await page.click(`#pantalla [data-v="${a}"]`);
    await esperarCambio(page, antes);
  }
}

(async () => {
  const server = await iniciar(PUERTO);
  await fetch(BASE + '/__reset');
  const browser = await chromium.launch();
  const errores = [];
  const sesiones = {}; // nombre → session_id

  async function abrir(ctx, query) {
    const page = await ctx.newPage();
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(BASE + '/' + (query || ''));
    await page.waitForSelector('#pantalla[data-pantalla]');
    return page;
  }

  console.log('\n== 1. Completa con número ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    const txt = await page.textContent('#pantalla');
    check(txt.includes('Todavía no estamos andando') && txt.includes('vamos a llegar más rápido'), 'inicio: "Todavía no estamos andando, pero gracias a tus respuestas…"');
    check(await page.textContent('#empezar') === 'Quiero mi viaje gratis', 'botón "Quiero mi viaje gratis"');
    await recorrer(page, ['empezar']);
    const faltas = [await page.textContent('#falta')];
    for (const x of ['donde:plaza-moreno', 'terminal', 'caminando', '2-3', 'si', '900']) {
      await recorrer(page, [x]);
      faltas.push(await page.textContent('#falta'));
    }
    check(faltas[0] === 'Te faltan 7 preguntas para tu viaje gratis' && faltas[5] === 'Te faltan 2 preguntas para tu viaje gratis' &&
      faltas[6] === '¡Última pregunta para tu viaje gratis!', `la barra cuenta lo que falta para el viaje gratis (${faltas[0]} … ${faltas[6]})`);
    await recorrer(page, ['25-34']);
    check(await pantalla(page) === 'whatsapp', 'llega a WhatsApp');
    check((await page.textContent('#falta')).includes('Llegaste') && await page.isVisible('.meta-regalo'), 'en WhatsApp la barra está llena: "¡Llegaste!"');
    check(await page.isHidden('#caja-consent'), 'el consentimiento no aparece si no escribió número');
    await page.fill('#wa', '12');
    check(await page.isVisible('#caja-consent'), 'el consentimiento aparece al escribir un número');
    await page.check('#consent');
    await page.click('#enviar-wa');
    check(await page.isVisible('#err-wa') && await page.inputValue('#wa') === '12', 'número inválido: muestra error y no borra lo escrito');
    await page.fill('#wa', '221 555 0101');
    const antes = await pantalla(page);
    await page.click('#enviar-wa');
    await esperarCambio(page, antes);
    const t = await page.textContent('#pantalla');
    check(await pantalla(page) === 'codigo' && /RUVU-[A-Z2-9]{4}/.test(t) && t.includes('Te lo mandamos por WhatsApp'), 'código con mensaje de WhatsApp');
    await recorrer(page, ['bonus']);
    check(await pantalla(page) === 'fin_bonus', 'bonus respondido');
    await page.click('#invitar'); await page.waitForTimeout(300);
    await vaciarCola(page);
    const sid = sesiones.completa = await sesion(page);
    const f = await fila(sid);
    check(f.version === 'v2' && f.parada === 'plaza-moreno' && f.destino === 'terminal' && f.modo_actual === 'caminando' &&
      f.frecuencia === '2-3' && f.usaria === 'si' && f.precio_max_v2 === '900' && f.edad === '25-34', 'fila con todas las respuestas');
    check(/^\+549221555\d{4}$/.test(f.whatsapp) && f.consentimiento === 'si' && f.completo === 'si' && /^RUVU-/.test(f.codigo), 'número, consentimiento, código y completo = si');
    check(f.acepta_precio === '' && f.oferta_elegida === '' && f.cuadras_estimadas === '', 'columnas viejas y cuadras vacías');
    check(Number(f.precio_mostrado) > 0, `sigue guardando precio_mostrado (${f.precio_mostrado})`);
    check(f.motivo_viaje === 'facu' && f.dia_primer_viaje === 'lun' && f.franja_primer_viaje === '7-10' && f.ultimo_paso === 'fin_bonus', 'bonus guardado');
    check(f.invito_amigo === 'si', 'invitó a un amigo');
    const ev = (await datosHoja()).eventos.filter(e => e.session_id === sid && e.ultimo_paso === 'precio');
    check(ev.length === 1 && JSON.parse(ev[0].datos).usaria === 'si' && Object.keys(JSON.parse(ev[0].datos)).length === 2,
      'cada envío manda solo los campos de su pantalla (¿lo usarías? → solo "usaria")');
    await ctx.close();
  }

  console.log('\n== 2. Completa sin número ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['empezar', 'donde:bosque', 'plaza-moreno', 'micro', '4_o_mas', 'depende', '1200', '18-24']);
    const caja = await page.$eval('#enviar-wa', b => b.getBoundingClientRect());
    const caja2 = await page.$eval('#no-wa', b => b.getBoundingClientRect());
    check(caja2.bottom <= 740 && Math.abs(caja.height - caja2.height) < 1 && Math.abs(caja.width - caja2.width) < 1,
      `los dos botones del mismo tamaño y visibles sin scrollear (abajo en ${Math.round(caja2.bottom)} px)`);
    await recorrer(page, ['sinwa']);
    const t = await page.textContent('#pantalla');
    check(await pantalla(page) === 'codigo' && /RUVU-[A-Z2-9]{4}/.test(t) && t.includes('Sacale captura'), 've el código y "Sacale captura"');
    check(await page.isVisible('#dejar-numero'), 'botón "Mejor quiero dejar mi número"');
    const codigo = (await page.textContent('#codigo')).trim();
    await recorrer(page, ['saltar-bonus']);
    await vaciarCola(page);
    const sid = sesiones.sinNumero = await sesion(page);
    let f = await fila(sid);
    check(f.completo === 'si' && f.codigo === codigo && f.whatsapp === '' && f.ultimo_paso === 'bonus_saltado', 'completo = si, código guardado, sin número');
    // vuelve a escanear y deja el número ahora
    const p2 = await abrir(ctx);
    check(await pantalla(p2) === 'ya_tiene_codigo' && (await p2.textContent('#codigo')).trim() === codigo, 'al volver ve su mismo código');
    await p2.close();
    await ctx.close();
  }

  console.log('\n== 2b. Sin número y después "Mejor quiero dejar mi número" ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['empezar', 'donde:terminal', 'plaza-moreno', 'caminando', '2-3', 'si', '600', '35-44', 'sinwa']);
    const codigo = (await page.textContent('#codigo')).trim();
    await recorrer(page, ['dejar-numero']);
    check(await pantalla(page) === 'whatsapp', 'vuelve al paso del número');
    await recorrer(page, ['wa:221 555 0202']);
    const t = await page.textContent('#pantalla');
    check(await pantalla(page) === 'codigo' && t.includes(codigo) && t.includes('Te lo mandamos por WhatsApp'), 'mismo código, ahora con número');
    await vaciarCola(page);
    const f = await fila(await sesion(page));
    check(/^\+549/.test(f.whatsapp) && f.codigo === codigo && f.consentimiento === 'si', 'la fila tiene el número y el mismo código');
    await ctx.close();
  }

  console.log('\n== 3. Parada "Otra" + destino "Otro" → cuadras ==');
  {
    const precios = {};
    for (const cuadras of ['10', '40+']) {
      const ctx = await nuevoCtx(browser);
      const page = await abrir(ctx);
      await recorrer(page, ['empezar', 'otra:7 y 50', 'otro']);
      check(await pantalla(page) === 'cuadras', `aparece "¿Más o menos cuántas cuadras son?" (${cuadras})`);
      await recorrer(page, [cuadras, 'caminando', '2-3']);
      const comp = await page.textContent('.comparar');
      await recorrer(page, ['si', '900', '25-34', 'sinwa']);
      await vaciarCola(page);
      const f = await fila(await sesion(page));
      precios[cuadras] = f;
      check(f.parada === 'otra' && f.parada_texto === '7 y 50' && f.destino === 'otro' && f.cuadras_estimadas === cuadras,
        `guarda parada Otra + texto + cuadras_estimadas = ${cuadras} (pantalla: ${comp.replace(/\s+/g, ' ').trim()})`);
      await ctx.close();
    }
    const a = precios['10'], b = precios['40+'];
    check(a.min_monopatin === 6 && a.min_caminando === 17 && a.precio_mostrado === 950,
      `10 cuadras (1,3 km): 6 min / 17 caminando / $950 → ${a.min_monopatin}/${a.min_caminando}/$${a.precio_mostrado}`);
    check(b.min_monopatin === 21 && b.min_caminando === 69 && b.precio_mostrado === 2150,
      `40 o más (5,2 km): 21 min / 69 caminando / $2150 → ${b.min_monopatin}/${b.min_caminando}/$${b.precio_mostrado}`);
    // parada conocida + destino conocido → no pregunta cuadras
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['empezar', 'donde:plaza-italia', 'terminal']);
    check(await pantalla(page) === 'modo', 'con parada y destino conocidos no pregunta cuadras');
    // "Otra" sin escribir nada también deja seguir
    await page.close();
    const p2 = await abrir(ctx);
    await p2.evaluate(() => localStorage.removeItem('ruvu_sesion'));
    await p2.reload(); await p2.waitForSelector('#empezar');
    await recorrer(p2, ['empezar', 'otra']);
    check(await pantalla(p2) === 'destino', '"Otra" sin escribir nada deja seguir');
    await vaciarCola(p2);
    const f = await fila(await sesion(p2));
    check(f.parada === 'otra' && f.parada_texto === '', 'parada_texto queda vacío');
    await ctx.close();
  }

  console.log('\n== 4. Responde "No" → saltea el precio ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    const vistas = [];
    await recorrer(page, ['empezar', 'donde:calle-8', 'estacion', 'caminando', '1_o_menos', 'no']);
    check(await pantalla(page) === 'motivo_no', 'pregunta el motivo');
    check(await page.textContent('#falta') === 'Te faltan 2 preguntas para tu viaje gratis', 'si dice "No": faltan el motivo y la edad (sin precio)');
    await recorrer(page, ['clima']);
    check(await page.textContent('#falta') === '¡Última pregunta para tu viaje gratis!', 'la edad es la última');
    vistas.push(await pantalla(page));
    check(vistas[0] === 'edad', 'después del motivo va directo a edad (sin precio)');
    await recorrer(page, ['45+', 'sinwa']);
    await vaciarCola(page);
    const f = await fila(await sesion(page));
    check(f.usaria === 'no' && f.motivo_no === 'clima' && f.precio_max_v2 === '' && f.completo === 'si' && /^RUVU-/.test(f.codigo), 'fila sin precio, con código');
    await ctx.close();
  }

  console.log('\n== 5. Menor de 18 ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['empezar', 'donde:plaza-moreno', 'plaza-italia', 'micro', '2-3', 'si', '600', 'menos_18']);
    check(await pantalla(page) === 'fin_menor' && !(await page.$('#codigo')), 'corta sin código');
    await vaciarCola(page);
    const f = await fila(await sesion(page));
    check(f.edad === 'menos_18' && f.codigo === '' && f.ultimo_paso === 'fin_menor', 'fila sin código');
    const p2 = await abrir(ctx);
    check(await pantalla(p2) === 'ya_tiene_codigo' && !(await p2.$('#otro-trayecto')) && !(await p2.$('#codigo')), 'al volver: gracias, sin código ni otro trayecto');
    await ctx.close();
  }

  console.log('\n== 6. Abandona en el paso 4, vuelve a escanear → retoma ==');
  {
    const ctx = await nuevoCtx(browser);
    let page = await abrir(ctx);
    await recorrer(page, ['empezar', 'donde:bosque', 'terminal', 'bici']);
    check(await pantalla(page) === 'frecuencia', 'está en el paso 4 (frecuencia)');
    const sid = await sesion(page);
    await vaciarCola(page);
    await page.close();
    page = await abrir(ctx);
    check(await pantalla(page) === 'frecuencia' && await sesion(page) === sid, 'retoma en el paso 4 con el mismo session_id');
    check((await page.textContent('.retomar')).includes('Seguí donde dejaste') && await page.isVisible('#de-nuevo'), 'muestra "Seguí donde dejaste" y "Empezar de nuevo"');
    await page.click('#volver');
    await page.waitForFunction(() => document.getElementById('pantalla').getAttribute('data-pantalla') === 'modo');
    check(await pantalla(page) === 'modo', 'puede volver atrás desde la sesión retomada');
    await recorrer(page, ['bici', '2-3', 'si', '900', '18-24', 'wa:221 555 0606']);
    await vaciarCola(page);
    const f = await fila(sid);
    check(f.retomada === 'si' && f.completo === 'si' && f.modo_actual === 'bici' && /^RUVU-/.test(f.codigo), 'la fila original queda completa y marcada retomada = si');
    const filas = (await datosHoja()).respuestas.filter(x => x.session_id === sid);
    check(filas.length === 1, 'sigue habiendo una sola fila para esa sesión');
    // "Empezar de nuevo" crea otra sesión
    const ctx2 = await nuevoCtx(browser);
    let q = await abrir(ctx2);
    await recorrer(q, ['empezar', 'donde:terminal']);
    const sidViejo = await sesion(q);
    await q.close();
    q = await abrir(ctx2);
    await q.click('#de-nuevo');
    await q.waitForFunction(() => document.getElementById('pantalla').getAttribute('data-pantalla') === 'parada');
    check(await sesion(q) !== sidViejo, '"Empezar de nuevo" crea una sesión nueva');
    await vaciarCola(q);
    await ctx.close(); await ctx2.close();
  }

  console.log('\n== 7. Ya completó, vuelve a escanear → otro trayecto sin código nuevo ==');
  {
    const ctx = await nuevoCtx(browser);
    let page = await abrir(ctx);
    await recorrer(page, ['empezar', 'donde:plaza-san-martin', 'terminal', 'caminando', 'todos_los_dias', 'si', '1500+', '25-34', 'wa:221 555 0707']);
    const codigo = (await page.textContent('#codigo')).trim();
    const sid1 = await sesion(page);
    await vaciarCola(page);
    await page.close();
    page = await abrir(ctx);
    const t = await page.textContent('#pantalla');
    check(await pantalla(page) === 'ya_tiene_codigo' && t.includes('Ya tenés tu viaje gratis') && t.includes(codigo), 've "Ya tenés tu viaje gratis" con su código');
    const sidScan = await sesion(page);
    await page.click('#otro-trayecto');
    await page.waitForFunction(() => document.getElementById('pantalla').getAttribute('data-pantalla') === 'parada');
    await recorrer(page, ['donde:terminal', 'plaza-moreno', 'micro', '2-3', 'depende', '600', '25-34']);
    check(await pantalla(page) === 'codigo' && (await page.textContent('#codigo')).trim() === codigo, 'ya había dejado número: va directo al código, el MISMO');
    await vaciarCola(page);
    const sid2 = await sesion(page);
    const d = await datosHoja();
    const f2 = d.respuestas.find(x => x.session_id === sid2);
    const fs = d.respuestas.find(x => x.session_id === sidScan);
    check(sid2 !== sid1 && f2.repetido === 'si' && f2.codigo === codigo && f2.destino === 'plaza-moreno', 'sesión nueva con repetido = si y el mismo código');
    check(fs && fs.ultimo_paso === 'ya_tiene_codigo', 'el escaneo de quien ya tenía código también crea fila (ya_tiene_codigo)');
    check(d.respuestas.filter(x => x.codigo === codigo).length === 2, 'no se generó otro código');
    await ctx.close();
  }

  console.log('\n== 7b. Participante de la encuesta vieja (sin número) responde otro trayecto ==');
  {
    const ctx = await nuevoCtx(browser);
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('ruvu_participacion')) localStorage.setItem('ruvu_participacion', JSON.stringify({ codigo: null, session_id: 'viejo', ts: '2026-11-01T00:00:00Z' }));
    });
    const page = await abrir(ctx);
    check(await pantalla(page) === 'ya_tiene_codigo' && (await page.textContent('#pantalla')).includes('Ya respondiste'), 've "Ya respondiste" (no tenía código)');
    await page.click('#otro-trayecto');
    await page.waitForFunction(() => document.getElementById('pantalla').getAttribute('data-pantalla') === 'parada');
    await recorrer(page, ['donde:terminal', 'plaza-moreno', 'micro', '2-3', 'si', '900', '18-24']);
    check(await pantalla(page) === 'whatsapp', 'como no dejó número la primera vez, puede dejarlo ahora');
    await recorrer(page, ['wa:221 555 0708']);
    check(/RUVU-/.test(await page.textContent('#codigo')), 'recibe su código');
    await vaciarCola(page);
    await ctx.close();
  }

  console.log('\n== 8. Sin conexión a mitad y respuestas perdidas → sin duplicados ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx);
    await recorrer(page, ['empezar', 'donde:plaza-moreno']);
    await fetch(BASE + '/__offline?on=1');
    await recorrer(page, ['terminal', 'caminando', '2-3']);
    check(await page.evaluate(() => window.__ruvu.cola.pendientes()) > 0, 'sin conexión: quedan envíos en la cola');
    await fetch(BASE + '/__offline?on=0');
    // el servidor guarda pero el celular no recibe la respuesta (lo que pasaba en vivo)
    await fetch(BASE + '/__perder?on=1');
    await recorrer(page, ['si', '900']);
    await page.waitForTimeout(2500);
    await fetch(BASE + '/__perder?on=0');
    await recorrer(page, ['25-34', 'wa:221 555 0808']);
    await vaciarCola(page);
    const sid = await sesion(page);
    const d = await datosHoja();
    const ev = d.eventos.filter(e => e.session_id === sid);
    const ids = ev.map(e => e.event_id);
    check(new Set(ids).size === ids.length, `ningún event_id repetido en "eventos" (${ids.length} eventos)`);
    const pasos = ev.filter(e => e.tipo === 'respuesta').map(e => e.ultimo_paso).join(',');
    check(pasos === 'parada,destino,modo,frecuencia,usaria,precio,edad,whatsapp,codigo', `todos los envíos llegaron una vez y en orden (${pasos})`);
    const f = d.respuestas.find(x => x.session_id === sid);
    check(f.precio_max_v2 === '900' && f.completo === 'si', 'la fila quedó completa');
    await ctx.close();
  }

  console.log('\n== 9. Modo prueba y computadora ==');
  {
    const ctx = await nuevoCtx(browser);
    const page = await abrir(ctx, '?test=1');
    await recorrer(page, ['empezar', 'donde:plaza-moreno', 'terminal']);
    await vaciarCola(page);
    sesiones.test = await sesion(page);
    check((await fila(sesiones.test)).test === 'si', '?test=1 guarda test = si');
    await ctx.close();
    const pc = await nuevoCtx(browser, UA_PC);
    const p2 = await abrir(pc);
    await recorrer(p2, ['empezar', 'donde:plaza-moreno']);
    await vaciarCola(p2);
    sesiones.pc = await sesion(p2);
    await pc.close();
  }

  console.log('\n== 10. Servidor: reenvío idéntico se ignora y limpieza de duplicados ==');
  {
    const ev = { event_id: 'reenvio-1', tipo: 'scan', session_id: 'reenvio', punto: 'sin-punto', ua: UA_MOVIL, datos: { version: 'v2' } };
    const r1 = await (await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: [ev, ev] }) })).json();
    const r2 = await (await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: [ev] }) })).json();
    const n = (await datosHoja()).eventos.filter(e => e.event_id === 'reenvio-1').length;
    check(n === 1 && r1.ok && r2.resultados['reenvio-1'].duplicado, `el mismo event_id 3 veces → 1 fila (${n})`);
    check(/eventos: 0 filas/.test(await (await fetch(BASE + '/__correr?f=contarDuplicados')).text()), 'contarDuplicados: 0 con la versión nueva');
  }

  console.log('\n== Agregados y panel ==');
  const d = await datosHoja();
  const ag = await get('/api?pin=2026');
  check(!JSON.stringify(ag).includes('+549'), 'doGet no expone WhatsApps');
  check(ag.excluidas.test === 1 && ag.excluidas.computadora === 1, `excluye prueba (${ag.excluidas.test}) y computadora (${ag.excluidas.computadora})`);
  // Embudo esperado, calculado a mano desde la hoja
  const v2 = d.respuestas.filter(f => f.version === 'v2' && f.test !== 'si' && /Mobile|iPhone|Android/.test(f.user_agent) && f.ultimo_paso !== 'ya_tiene_codigo');
  const esp = {
    escanean: v2.length, empiezan: v2.filter(f => f.timestamp_inicio).length,
    llegan_precio: v2.filter(f => f.precio_max_v2 || f.ultimo_paso === 'precio').length,
    dejan_numero: v2.filter(f => f.whatsapp).length, ven_codigo: v2.filter(f => f.codigo).length,
    responden_bonus: v2.filter(f => f.motivo_viaje || f.dia_primer_viaje).length, invitan: v2.filter(f => f.invito_amigo === 'si').length
  };
  const real = ag.versiones.v2.puntos['sin-punto'].qr;
  const malos = Object.keys(esp).filter(k => esp[k] !== real[k]).map(k => `${k} ${real[k]}≠${esp[k]}`);
  check(!malos.length, `embudo del doGet coincide con la hoja ${JSON.stringify(esp)} ${malos.join(' ')}`);
  const p = ag.versiones.v2.puntos['sin-punto'];
  check(p.retomadas === 3 && p.repetidas === 2 && p.reescaneos >= 3, `retomadas ${p.retomadas}, otro trayecto ${p.repetidas}, ya tenían código ${p.reescaneos}`);
  check(p.dist.precio_max_v2['900'] >= 3 && !p.dist.acepta_precio.si, 'precio_max_v2 separado de acepta_precio');

  const ctx = await nuevoCtx(browser);
  const pp = await ctx.newPage();
  await pp.setViewportSize({ width: 1200, height: 900 });
  await pp.goto(BASE + '/panel.html');
  await pp.fill('#pin input', '2026'); await pp.click('#pin button');
  await pp.waitForSelector('#tabla-embudo tr.total');
  const total = await pp.$$eval('#tabla-embudo tr.total td', tds => tds.map(td => td.childNodes[0].textContent.trim()));
  check(total[1] === String(esp.escanean) && total[2] === String(esp.empiezan) && total[5] === String(esp.dejan_numero) && total[6] === String(esp.ven_codigo),
    `fila Total del panel: ${total.slice(0, 9).join(' | ')}`);
  check((await pp.textContent('#excluidas')).includes('1 sesiones de prueba'), 'el panel dice cuántas sesiones excluyó');
  await pp.selectOption('#sel-version', 'v1');
  await pp.waitForTimeout(200);
  check(await pp.isVisible('#d-acepta_precio'), 'vista de la encuesta anterior con acepta_precio');

  check(!errores.length, 'sin errores de JavaScript ' + errores.join(' | '));
  await browser.close();
  server.close();
  console.log(`\n${fallas ? '✗ ' + fallas + ' verificaciones fallaron' : '✓ Todo OK'}`);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
