/* Capturas mobile (360 × 740) de cada pantalla de la encuesta v2 en /capturas,
   y control de que nada se desborde a 320 px.  Uso: npm run capturas */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { iniciar } = require('./servidor-local');

const PUERTO = 8098;
const BASE = `http://localhost:${PUERTO}`;
const OUT = path.join(__dirname, '..', 'capturas');
const UA_MOVIL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const server = await iniciar(PUERTO);
  const browser = await chromium.launch();
  let n = 0;
  const desbordes = [];

  async function nuevo(w = 360) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_MOVIL });
    await ctx.route(/wa\.me/, r => r.abort());
    return { ctx, page: await ctx.newPage() };
  }
  async function foto(page, nombre, full) {
    await page.waitForTimeout(500);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ancho > 0) desbordes.push(`${nombre} (${page.viewportSize().width}px): ${ancho}px de más`);
    await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}-${nombre}.png`), fullPage: !!full });
  }
  const ir = async (page, sel) => {
    const antes = await page.getAttribute('#pantalla', 'data-pantalla');
    await page.click(sel);
    await page.waitForFunction(a => document.getElementById('pantalla').getAttribute('data-pantalla') !== a, antes);
  };
  const v = x => `#pantalla [data-v="${x}"]`;

  // Camino completo con número (360 y 320 px)
  for (const w of [360, 320]) {
    const { ctx, page } = await nuevo(w);
    const s = w === 320 ? '-320' : '';
    await page.goto(BASE + '/');
    await foto(page, 'inicio' + s);
    await ir(page, '#empezar'); await foto(page, '1-donde-estas' + s);
    await ir(page, v('plaza-moreno')); await foto(page, '2-a-donde-vas' + s);
    await ir(page, v('terminal')); await foto(page, '3-como-ibas' + s);
    await ir(page, v('caminando')); await foto(page, '4-frecuencia' + s);
    await ir(page, v('2-3')); await foto(page, '5-lo-usarias' + s);
    await ir(page, v('si')); await foto(page, '6-precio-maximo' + s);
    await ir(page, v('900')); await foto(page, '7-edad' + s);
    await ir(page, v('25-34')); await foto(page, '8-whatsapp' + s);
    if (!s) {
      await page.fill('#wa', '221 555'); await page.click('#enviar-wa');
      await foto(page, '8-whatsapp-con-numero-y-errores');
    }
    await page.fill('#wa', '221 555 1234'); await page.check('#consent');
    await ir(page, '#enviar-wa'); await foto(page, '9-codigo-con-numero' + s, true);
    await ir(page, '#ir-bonus'); await foto(page, '10-bonus' + s, true);
    await page.click('[data-grupo="motivo_viaje"] [data-v="facu"]');
    await page.click('[data-grupo="dia_primer_viaje"] [data-v="vie"]');
    await page.click('[data-grupo="franja_primer_viaje"] [data-v="16-19"]');
    if (!s) await foto(page, '10-bonus-elegido', true);
    await ir(page, '#listo-bonus'); await foto(page, '11-gracias' + s);
    await page.goto(BASE + '/'); await page.waitForSelector('#codigo');
    await foto(page, '12-ya-tenes-codigo' + s, true);
    await ctx.close();
  }

  // Sin número + "Mejor dejame mi número"
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/');
    for (const x of ['#empezar', v('bosque'), v('plaza-moreno'), v('micro'), v('4_o_mas'), v('depende'), v('1200'), v('18-24'), '#no-wa']) await ir(page, x);
    await foto(page, '9-codigo-sin-numero', true);
    await ctx.close();
  }

  // Parada "Otra" + destino "Otro" → cuadras
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/');
    await ir(page, '#empezar');
    await page.click(v('otra')); await page.fill('#parada-otra', '7 y 50');
    await foto(page, '1-donde-estas-otra');
    await ir(page, '#siguiente-otra'); await ir(page, v('otro'));
    await foto(page, '2b-cuantas-cuadras');
    await ir(page, v('20')); await ir(page, v('caminando')); await ir(page, v('2-3'));
    await foto(page, '5-lo-usarias-con-20-cuadras');
    await ir(page, v('no')); await foto(page, '5b-por-que-no');
    await ctx.close();
  }

  // Retomar
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/');
    for (const x of ['#empezar', v('terminal'), v('plaza-moreno'), v('bici')]) await ir(page, x);
    await page.close();
    const p2 = await ctx.newPage();
    await p2.goto(BASE + '/'); await p2.waitForSelector('.retomar');
    await foto(p2, '4-frecuencia-retomada');
    await ctx.close();
  }

  // Menor de 18
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/');
    for (const x of ['#empezar', v('plaza-italia'), v('terminal'), v('micro'), v('2-3'), v('si'), v('600'), v('menos_18')]) await ir(page, x);
    await foto(page, '7b-menor-de-18');
    await ctx.close();
  }

  // Panel
  {
    const { ctx, page } = await nuevo();
    await page.goto(BASE + '/panel.html');
    await page.fill('#pin input', '2026'); await page.click('#pin button');
    await page.waitForSelector('#tabla-embudo tr.total');
    await page.setViewportSize({ width: 1200, height: 900 });
    await foto(page, 'panel-escritorio', true);
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(`${n} capturas en /capturas`);
  console.log(desbordes.length ? 'Desbordes horizontales:\n' + desbordes.join('\n') : 'Sin desbordes horizontales (360 y 320 px).');
})().catch(e => { console.error(e); process.exit(1); });
