/* Capturas mobile (375 × 667, iPhone SE/8) de la encuesta v2.1 en /capturas,
   y control de que nada se desborde a 320 px.  Uso: npm run capturas */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { iniciar } = require('./servidor-local');

const PUERTO = 8098;
const BASE = `http://localhost:${PUERTO}`;
const OUT = path.join(__dirname, '..', 'capturas');
const UA_MOVIL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const server = await iniciar(PUERTO);
  await fetch(BASE + '/__reset');
  const browser = await chromium.launch();
  let n = 0;
  const desbordes = [];

  async function nuevo(w = 375, h = 667, init) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_MOVIL });
    await ctx.route(/wa\.me/, r => r.abort());
    if (init) await ctx.addInitScript(init);
    return { ctx, page: await ctx.newPage() };
  }
  async function foto(page, nombre, full) {
    await page.waitForTimeout(450);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ancho > 0) desbordes.push(`${nombre} (${page.viewportSize().width}px): ${ancho}px de más`);
    n++;
    await page.screenshot({ path: path.join(OUT, nombre + ".png"), fullPage: !!full });
  }
  const esperar = (page, antes) =>
    page.waitForFunction(a => document.getElementById('pantalla').getAttribute('data-pantalla') !== a, antes);
  const ir = async (page, sel) => {
    const antes = await page.getAttribute('#pantalla', 'data-pantalla');
    await page.click(sel);
    await esperar(page, antes);
  };
  const v = x => `#pantalla [data-v="${x}"]`;
  const pv = async (page, dia, franja) => {
    await page.click(`[data-grupo="dia_primer_viaje"] [data-v="${dia}"]`);
    await page.click(`[data-grupo="franja_primer_viaje"] [data-v="${franja}"]`);
    await ir(page, '#siguiente-pv');
  };

  // 1 + 3. Primer escaneo y cada pantalla del camino completo (375 y 320 px)
  for (const [w, h] of [[375, 667], [320, 568]]) {
    const { ctx, page } = await nuevo(w, h);
    const s = w === 320 ? '-320' : '';
    await page.goto(BASE + '/');
    await foto(page, '01-primer-escaneo-donde-estas' + s);
    await ir(page, v('plaza-moreno')); await foto(page, '02-a-donde-vas' + s);
    await ir(page, v('terminal')); await foto(page, '03-como-ibas' + s);
    await ir(page, v('caminando')); await foto(page, '04-frecuencia' + s);
    await ir(page, v('2-3')); await foto(page, '05-para-que-es-el-viaje' + s);
    await ir(page, v('facu')); await foto(page, '06-lo-usarias' + s);
    await ir(page, v('si')); await foto(page, '07-precio-maximo' + s);
    await ir(page, v('900')); await foto(page, '08-dias-y-horarios-sin-elegir' + s);
    await pv(page, 'lun', '7-10'); await foto(page, '09-edad' + s);
    await ir(page, v('25-34')); await foto(page, '10-whatsapp' + s);
    await page.fill('#wa', '221 555 1234'); await page.check('#consent');
    await ir(page, '#enviar-wa'); await foto(page, '11-codigo-con-numero' + s);
    await ctx.close();
  }

  // 2. Llegada por invitación
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/?ref=RUVU-XXXX');
    await foto(page, '12-invitacion-ref');
    await ctx.close();
  }

  // 4. "Otra" con el texto vacío
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/');
    await page.click(v('otra'));
    await page.press('#parada-otra', 'Enter');
    await foto(page, '13-otra-vacia-no-avanza');
    await ctx.close();
  }

  // 5. Día elegido sin franja · 6. "No" → motivo y saltea precio
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/');
    for (const x of ['bosque', 'plaza-moreno', 'micro', '4_o_mas', 'laburo']) await ir(page, v(x));
    await ir(page, v('no')); await foto(page, '14-no-pide-por-que-no');
    await ir(page, v('clima'));
    await page.click('[data-grupo="dia_primer_viaje"] [data-v="vie"]');
    await foto(page, '15-dias-sin-horario-boton-gris');
    for (const d of ['lun', 'mie']) await page.click(`[data-grupo="dia_primer_viaje"] [data-v="${d}"]`);
    for (const f of ['7-10', '16-19']) await page.click(`[data-grupo="franja_primer_viaje"] [data-v="${f}"]`);
    await foto(page, '16-varios-dias-y-horarios-boton-habilitado');
    // 7. WhatsApp: inválido, sin consentimiento, sin número
    await ir(page, '#siguiente-pv'); await ir(page, v('18-24'));
    await page.fill('#wa', '12'); await page.check('#consent'); await page.click('#enviar-wa');
    await foto(page, '17-whatsapp-numero-invalido');
    await page.fill('#wa', '221 555 1234'); await page.uncheck('#consent'); await page.click('#enviar-wa');
    await foto(page, '18-whatsapp-sin-consentimiento');
    await page.fill('#wa', '');
    await ir(page, '#no-wa'); await foto(page, '19-codigo-sin-numero');
    // 8. Re-escaneo con código
    await page.goto(BASE + '/');
    await page.waitForSelector('#otro-trayecto');
    await foto(page, '20-reescaneo-ya-tenes-codigo');
    await ir(page, '#otro-trayecto'); await foto(page, '21-otro-trayecto-directo-a-destino');
    for (const x of ['terminal', '20', 'bici', '2-3', 'facu', 'si', '600']) await ir(page, v(x));
    await pv(page, 'mar', '10-13');
    await foto(page, '22-otro-trayecto-mismo-codigo');
    await page.waitForFunction(() => window.__ruvu.cola.pendientes() === 0);
    await ctx.close();
  }

  // 9. Celular con la fecha cambiada (+3 días): la hoja queda con la hora del servidor
  {
    const { ctx, page } = await nuevo(375, 667, () => {
      const Real = Date, corr = 3 * 864e5;
      class Falso extends Real {
        constructor(...a) { if (a.length) super(...a); else super(Real.now() + corr); }
        static now() { return Real.now() + corr; }
      }
      window.Date = Falso;
    });
    await page.goto(BASE + '/?test=1');
    await ir(page, v('plaza-italia'));
    for (const x of ['plaza-moreno', 'micro', '2-3', 'facu', 'si', '900']) await ir(page, v(x));
    await pv(page, 'lun', '7-10'); await ir(page, v('25-34')); await ir(page, '#no-wa');
    await page.waitForFunction(() => window.__ruvu.cola.pendientes() === 0);
    const sid = await page.evaluate(() => window.__ruvu.sesion);
    const relojCel = await page.evaluate(() => new Date().toISOString());
    const d = await (await fetch(BASE + '/__datos')).json();
    const f = d.respuestas.find(x => x.session_id === sid);
    const scan = d.eventos.find(e => e.session_id === sid && e.tipo === 'scan');
    const ar = x => new Date(x).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const filas = [['Reloj del celular (adelantado 3 días)', ar(relojCel)],
      ['respuestas · timestamp_scan', ar(f.timestamp_scan)], ['respuestas · timestamp_inicio', ar(f.timestamp_inicio)],
      ['respuestas · timestamp_fin', ar(f.timestamp_fin)], ['respuestas · actualizado', ar(f.actualizado)],
      ['eventos · timestamp (scan)', ar(scan.timestamp)], ['eventos · datos.hora_cliente', ar(JSON.parse(scan.datos).hora_cliente)]];
    const p = await ctx.newPage();
    await p.setContent(`<meta name="viewport" content="width=device-width"><body style="background:#0B0B0B;color:#fff;font:15px system-ui;padding:16px">
      <h3 style="color:#12E39A;margin:0 0 12px">Hoja simulada · sesión ${sid}</h3>
      <table style="border-collapse:collapse;width:100%">${filas.map(([a, b], i) =>
        `<tr style="background:${i === 0 || i === 6 ? '#3a1a2a' : '#16191A'}"><td style="padding:8px;border:1px solid #2B2F31">${a}</td><td style="padding:8px;border:1px solid #2B2F31;white-space:nowrap">${b}</td></tr>`).join('')}</table>
      <p style="color:#A6ADB0">Hora real del servidor al correr la prueba: ${ar(new Date().toISOString())}</p></body>`);
    await foto(p, '23-fecha-del-celular-mal-hora-del-servidor');
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(`${n} capturas en /capturas`);
  if (desbordes.length) { console.log('✗ Desbordes:\n  ' + desbordes.join('\n  ')); process.exit(1); }
  console.log('✓ Ninguna pantalla se desborda a lo ancho (375 y 320 px)');
})().catch(e => { console.error(e); process.exit(1); });
