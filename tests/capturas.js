/* Saca capturas mobile (360 × 740) de cada pantalla en /capturas y verifica
   que nada se desborde a 320 px de ancho.  Uso: npm run capturas */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { iniciar } = require('./servidor-local');

const PUERTO = 8098;
const BASE = `http://localhost:${PUERTO}`;
const OUT = path.join(__dirname, '..', 'capturas');

/* Carga respuestas variadas para que el panel tenga algo que mostrar */
async function sembrar() {
  const elegir = a => a[Math.floor(Math.random() * a.length)];
  const puntos = ['plaza-san-martin', 'bosque', 'terminal', 'estacion', 'plaza-italia', 'facultad', 'control-calle-8'];
  const eventos = [];
  for (let i = 0; i < 90; i++) {
    const sid = 'demo' + i, punto = elegir(puntos), ref = i % 9 === 0 ? 'RUVU-DEMO' : '';
    const ev = (tipo, datos) => eventos.push({ event_id: sid + eventos.length, tipo, session_id: sid, punto, ref, datos });
    ev('scan', { repetido: 'no' });
    if (Math.random() < 0.15) continue;
    ev('respuesta', { timestamp_inicio: new Date().toISOString(), ultimo_paso: 'destino' });
    if (Math.random() < 0.08) continue;
    ev('respuesta', { destino: elegir(['terminal', 'estacion', 'plaza-moreno', 'rectorado']), modo_actual: elegir(['caminando', 'caminando', 'micro', 'bici', 'uber_remis', 'auto']),
      frecuencia: elegir(['1_o_menos', '2-3', '4_o_mas', 'todos_los_dias']), ultimo_paso: 'usaria' });
    if (Math.random() < 0.06) continue;
    const usaria = elegir(['si', 'si', 'depende', 'no']);
    ev('respuesta', { usaria, motivo_no: usaria === 'no' ? elegir(['prefiero_caminar', 'inseguro', 'clima']) : '', ultimo_paso: 'edad' });
    const edad = elegir(['18-24', '18-24', '25-34', '35-44', '45+', 'menos_18']);
    if (edad === 'menos_18') { ev('respuesta', { edad, completo: 'si', ultimo_paso: 'fin_menor' }); continue; }
    ev('respuesta', { edad, ultimo_paso: usaria === 'no' ? 'whatsapp' : 'precio' });
    if (usaria !== 'no') {
      if (Math.random() < 0.08) continue;
      const ap = elegir(['si', 'caro', 'caro', 'no_pagaria']);
      const oferta = ap === 'caro' ? elegir(['pack', 'abono', 'valle', 'ninguna']) : '';
      ev('respuesta', { acepta_precio: ap, oferta_elegida: oferta, precio_max: oferta === 'ninguna' ? elegir(['600', '900', 'menos_600']) : '', ultimo_paso: 'whatsapp' });
    }
    if (Math.random() < 0.1) continue;
    if (Math.random() < 0.75) {
      ev('respuesta', { whatsapp: '+549221555' + (1000 + i), consentimiento: 'si', codigo: 'RUVU-' + (1000 + i), completo: 'si', ultimo_paso: 'fin',
        dia_primer_viaje: elegir(['lun', 'mar', 'vie']), franja_primer_viaje: elegir(['7-10', '16-19']) });
      if (Math.random() < 0.3) ev('invitacion', { invito_amigo: 'si' });
    } else ev('respuesta', { completo: 'si', ultimo_paso: 'fin_sin_whatsapp' });
  }
  for (let i = 0; i < eventos.length; i += 40) {
    await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: eventos.slice(i, i + 40) }) });
  }
  const conteo = [];
  puntos.forEach((p, j) => {
    for (let i = 0; i < 300 + j * 40; i++) conteo.push({ event_id: p + i, tipo: 'conteo', pin: '2026', punto: p, accion: i % 7 === 0 ? 'frena' : 'pasa' });
  });
  for (let i = 0; i < conteo.length; i += 50) {
    await fetch(BASE + '/api', { method: 'POST', body: JSON.stringify({ eventos: conteo.slice(i, i + 50) }) });
  }
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const server = await iniciar(PUERTO);
  const browser = await chromium.launch();
  let n = 0;
  const desbordes = [];

  async function nuevo(w = 360) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.route(/wa\.me/, r => r.abort());
    return { ctx, page: await ctx.newPage() };
  }
  async function foto(page, nombre, full) {
    await page.waitForTimeout(450);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ancho > 0) desbordes.push(`${nombre} (${page.viewportSize().width}px): ${ancho}px de más`);
    await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}-${nombre}.png`), fullPage: !!full });
  }
  const ir = async (page, sel) => {
    const antes = await page.getAttribute('#pantalla', 'data-pantalla');
    await page.click(sel);
    await page.waitForFunction(a => document.getElementById('pantalla').getAttribute('data-pantalla') !== a, antes);
  };

  // Camino completo, a 360 px y a 320 px
  for (const w of [360, 320]) {
    const { ctx, page } = await nuevo(w);
    const s = w === 320 ? '-320' : '';
    await page.goto(BASE + '/?p=plaza-san-martin');
    await foto(page, 'inicio' + s);
    await ir(page, '#empezar'); await foto(page, 'parada-desde-qr' + s);
    await ir(page, '#siguiente-parada'); await foto(page, 'destino' + s);
    await ir(page, '[data-v="terminal"]'); await foto(page, 'modo' + s);
    await ir(page, '[data-v="caminando"]'); await foto(page, 'frecuencia' + s);
    await ir(page, '[data-v="2-3"]'); await foto(page, 'usaria' + s);
    await ir(page, '[data-v="depende"]'); await foto(page, 'edad' + s);
    await ir(page, '[data-v="18-24"]'); await foto(page, 'precio' + s);
    await ir(page, '[data-v="caro"]'); await foto(page, 'ofertas' + s);
    await ir(page, '[data-v="ninguna"]'); await foto(page, 'precio-maximo' + s);
    await ir(page, '[data-v="900"]'); await foto(page, 'whatsapp' + s);
    if (!s) { await page.fill('#wa', '12'); await page.click('#enviar-wa'); await foto(page, 'whatsapp-errores'); }
    await page.fill('#wa', '221 555 1234'); await page.check('#consent');
    await ir(page, '#enviar-wa'); await foto(page, 'primer-viaje' + s);
    await page.click('[data-v="vie"]'); await page.click('[data-v="16-19"]');
    if (!s) await foto(page, 'primer-viaje-elegido');
    await ir(page, '#listo-pv'); await foto(page, 'final-codigo' + s);
    await page.goto(BASE + '/?p=plaza-san-martin'); await page.waitForSelector('#codigo');
    await foto(page, 'ya-participaste' + s);
    await ctx.close();
  }

  // QR general: la persona escribe la parada y se autocompleta
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/');
    await ir(page, '#empezar'); await foto(page, 'parada-vacia');
    await page.type('#parada', 'san mar'); await foto(page, 'parada-escribiendo');
    await page.fill('#parada', ''); await page.type('#parada', 'P Moreno'); await foto(page, 'parada-autocompletada');
    await ir(page, '#siguiente-parada'); await foto(page, 'destino-desde-plaza-moreno');
    await ctx.close();
  }

  // Camino del "No"
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/?p=bosque');
    await ir(page, '#empezar'); await ir(page, '#siguiente-parada'); await ir(page, '[data-v="plaza-moreno"]'); await ir(page, '[data-v="caminando"]'); await ir(page, '[data-v="2-3"]');
    await ir(page, '[data-v="no"]'); await foto(page, 'motivo-no');
    await ir(page, '[data-v="clima"]'); await ir(page, '[data-v="25-34"]');
    await ir(page, '#no-wa'); await foto(page, 'final-sin-whatsapp');
    await ctx.close();
  }
  // Menor de 18
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/?p=terminal');
    await ir(page, '#empezar'); await ir(page, '#siguiente-parada'); await ir(page, '[data-v="plaza-moreno"]'); await ir(page, '[data-v="micro"]'); await ir(page, '[data-v="2-3"]');
    await ir(page, '[data-v="si"]'); await ir(page, '[data-v="menos_18"]'); await foto(page, 'final-menor');
    await page.goto(BASE + '/privacidad.html'); await foto(page, 'privacidad', true);
    await ctx.close();
  }

  // Contador y panel
  await sembrar();
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/contador.html'); await foto(page, 'pin');
    await page.fill('#pin input', '2026'); await page.click('#pin button');
    for (let i = 0; i < 7; i++) await page.click('#pasa');
    await page.click('#frena'); await page.click('#frena');
    await page.waitForTimeout(800);
    await foto(page, 'contador');
    await page.goto(BASE + '/panel.html');
    await page.waitForSelector('#tabla-embudo tr.total');
    await foto(page, 'panel-mobile', true);
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.reload(); await page.waitForSelector('#tabla-embudo tr.total');
    await foto(page, 'panel-escritorio', true);
    await page.goto(BASE + '/carteles.html');
    await page.setViewportSize({ width: 700, height: 1000 });
    await foto(page, 'carteles-pantalla');
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(OUT, 'carteles-A5.pdf'), preferCSSPageSize: true, printBackground: true });
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(`${n} capturas en /capturas + carteles-A5.pdf`);
  console.log(desbordes.length ? 'Desbordes horizontales:\n' + desbordes.join('\n') : 'Sin desbordes horizontales (360 y 320 px).');
})().catch(e => { console.error(e); process.exit(1); });
