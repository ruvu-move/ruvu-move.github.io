/**
 * RUVU · backend de la encuesta (Google Apps Script + Google Sheets)
 * ------------------------------------------------------------------
 * - doPost: recibe los eventos de la encuesta y del contador y los guarda.
 * - doGet:  devuelve conteos agregados para el panel (nunca devuelve WhatsApps).
 *
 * Hojas que se crean solas (si no existen):
 *   respuestas → una fila por sesión, se va actualizando a medida que responde
 *   eventos    → log crudo de todo lo que llega
 *   conteo     → toques del contador manual (+1 Pasa / +1 Se frena / deshacer)
 *
 * Cómo publicarlo: ver README.md, sección "Google Sheet y Apps Script".
 */

// Tiene que ser IGUAL al PIN de config.js
var PIN = '2026';

var COLUMNAS = {
  respuestas: [
    'session_id', 'timestamp_scan', 'timestamp_inicio', 'timestamp_fin', 'punto', 'ref',
    'parada', 'parada_texto', 'destino', 'modo_actual', 'frecuencia', 'min_monopatin', 'min_caminando', 'precio_mostrado',
    'usaria', 'motivo_no', 'edad', 'acepta_precio', 'oferta_elegida', 'precio_max',
    'whatsapp', 'consentimiento', 'motivo_viaje', 'vuelta', 'cuadras', 'uso_previo', 'dia_primer_viaje', 'franja_primer_viaje', 'codigo',
    'invito_amigo', 'ultimo_paso', 'completo', 'user_agent', 'actualizado',
    // v2 (agregadas al final; las anteriores no se mueven ni se renombran)
    'test', 'repetido', 'retomada', 'cuadras_estimadas', 'precio_max_v2', 'version'
  ],
  eventos: ['timestamp', 'event_id', 'session_id', 'tipo', 'punto', 'ref', 'ultimo_paso', 'datos', 'user_agent', 'recibido'],
  conteo: ['timestamp', 'tap_id', 'punto', 'accion', 'deshace_tap_id', 'dispositivo', 'recibido']
};

// Campos que la encuesta puede escribir en "respuestas"
var CAMPOS_PERMITIDOS = [
  'timestamp_scan', 'timestamp_inicio', 'timestamp_fin', 'parada', 'parada_texto', 'destino', 'modo_actual', 'frecuencia',
  'min_monopatin', 'min_caminando', 'precio_mostrado', 'usaria', 'motivo_no', 'edad',
  'acepta_precio', 'oferta_elegida', 'precio_max', 'whatsapp', 'consentimiento',
  'motivo_viaje', 'vuelta', 'cuadras', 'uso_previo',
  'dia_primer_viaje', 'franja_primer_viaje', 'codigo', 'invito_amigo', 'ultimo_paso', 'completo',
  'cuadras_estimadas', 'precio_max_v2'
];
var CAMPOS_FECHA = { timestamp_scan: 1, timestamp_inicio: 1, timestamp_fin: 1, timestamp: 1, recibido: 1, actualizado: 1 };
var ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/* ======================= Recepción (POST) ======================= */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json({ ok: false, error: 'ocupado' });
  }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var eventos = Array.isArray(body.eventos) ? body.eventos.slice(0, 50) : [];
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ctx = {
      resp: abrirTabla(ss, 'respuestas'),
      eventos: hoja(ss, 'eventos'),
      conteo: hoja(ss, 'conteo'),
      ahora: new Date()
    };
    // event_id (y tap_id del contador) que ya llegaron: un reenvío se ignora
    ctx.vistos = idsExistentes(ctx.eventos, 'event_id');
    var taps = idsExistentes(ctx.conteo, 'tap_id');
    for (var tid in taps) ctx.vistos[tid] = true;
    var resultados = {};
    var filasEventos = [], filasConteo = [];
    eventos.forEach(function (ev) {
      if (!ev || typeof ev !== 'object') return;
      var id = texto(ev.event_id, 40) || ('srv-' + Math.random().toString(36).slice(2));
      try {
        resultados[id] = procesar(ev, ctx, filasEventos, filasConteo);
      } catch (err) {
        resultados[id] = { ok: false, error: String(err && err.message || err) };
      }
    });
    agregarFilas(ctx.eventos, filasEventos);
    agregarFilas(ctx.conteo, filasConteo);
    guardarTabla(ctx.resp);
    return json({ ok: true, resultados: resultados });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function procesar(ev, ctx, filasEventos, filasConteo) {
  var tipo = texto(ev.tipo, 20);
  var datos = (ev.datos && typeof ev.datos === 'object') ? ev.datos : {};
  var ts = fecha(ev.ts) || ctx.ahora;
  var eid = texto(ev.event_id, 40);

  // Reenvío de algo que ya se guardó: no se vuelve a escribir nada.
  if (eid && ctx.vistos[eid]) {
    var dup = { ok: true, duplicado: true };
    var reg = ctx.resp.indice[texto(ev.session_id, 40)];
    if (reg && reg.valores[ctx.resp.col.codigo]) dup.codigo = reg.valores[ctx.resp.col.codigo];
    return dup;
  }
  if (eid) ctx.vistos[eid] = true;

  if (tipo === 'conteo') {
    if (String(ev.pin) !== String(PIN)) return { ok: false, error: 'pin' };
    var accion = texto(ev.accion, 10);
    if (['pasa', 'frena', 'deshacer'].indexOf(accion) < 0) return { ok: false, error: 'accion' };
    filasConteo.push(fila('conteo', {
      timestamp: ts, tap_id: texto(ev.event_id, 40), punto: texto(ev.punto, 40), accion: accion,
      deshace_tap_id: texto(ev.deshace, 40), dispositivo: texto(ev.dispositivo, 40), recibido: ctx.ahora
    }));
    return { ok: true };
  }

  if (['scan', 'respuesta', 'invitacion'].indexOf(tipo) < 0) return { ok: false, error: 'tipo' };
  var sid = texto(ev.session_id, 40);
  if (!sid) return { ok: false, error: 'session_id' };

  filasEventos.push(fila('eventos', {
    timestamp: ts, event_id: texto(ev.event_id, 40), session_id: sid, tipo: tipo,
    punto: texto(ev.punto, 40), ref: texto(ev.ref, 20), ultimo_paso: texto(datos.ultimo_paso, 30),
    datos: JSON.stringify(datos).slice(0, 1000), user_agent: tipo === 'scan' ? texto(ev.ua, 250) : '',
    recibido: ctx.ahora
  }));

  var t = ctx.resp;
  var cambios = {};
  var existente = t.indice[sid];
  if (!existente) {
    cambios.session_id = sid;
    cambios.punto = texto(ev.punto, 40) || 'sin-punto';
    cambios.ref = texto(ev.ref, 20);
    cambios.ultimo_paso = 'inicio';
    cambios.completo = 'no';
  }
  var previo = existente ? existente.valores : null;
  if (ev.ua && (!previo || !previo[t.col.user_agent])) cambios.user_agent = texto(ev.ua, 250);
  if (tipo === 'scan') {
    // Cada escaneo crea su fila. Al retomar una sesión no se pisa la hora original.
    if (!previo || !previo[t.col.timestamp_scan]) cambios.timestamp_scan = fecha(datos.timestamp_scan) || ts;
    if (datos.version === 'v2') {
      cambios.version = 'v2';
      if (datos.test === 'si') cambios.test = 'si';
      if (datos.repetido === 'si') cambios.repetido = 'si';   // "Responder por otro trayecto"
      if (datos.retomada === 'si') cambios.retomada = 'si';
      if (!existente && datos.ultimo_paso) cambios.ultimo_paso = texto(datos.ultimo_paso, 30); // ya_tiene_codigo
    } else if (datos.repetido === 'si' && !existente) {
      cambios.ultimo_paso = 'ya_tiene_codigo'; // encuesta vieja: re-escaneo de quien ya participó
    }
  } else if (tipo === 'invitacion') {
    cambios.invito_amigo = 'si';
  } else {
    CAMPOS_PERMITIDOS.forEach(function (k) {
      if (!(k in datos)) return;
      var v = datos[k];
      if (CAMPOS_FECHA[k]) v = fecha(v) || '';
      else if (typeof v === 'number') v = isFinite(v) ? v : '';
      else v = texto(v, 60);
      cambios[k] = v;
    });
    // Si un dato ya cerrado vuelve a llegar (reintento), no "desmarcar" el completo
    var actual = existente ? existente.valores : null;
    if (actual && actual[t.col.completo] === 'si' && cambios.completo === 'no') delete cambios.completo;
  }
  var res = { ok: true };
  var esOtroTrayecto = cambios.repetido === 'si' || (previo && previo[t.col.repetido] === 'si');
  if (cambios.codigo && esOtroTrayecto) {
    res.codigo = cambios.codigo; // es el mismo código que ya tenía: no se cambia
  } else if (cambios.codigo) {
    cambios.codigo = codigoUnico(t, sid, cambios.codigo);
    res.codigo = cambios.codigo;
  }
  cambios.actualizado = ctx.ahora;
  upsert(t, sid, cambios);
  return res;
}

/* Si el código ya lo tiene otra sesión, genera uno nuevo que no exista. */
function codigoUnico(t, sid, codigo) {
  codigo = String(codigo).toUpperCase();
  var usados = {};
  t.filas.forEach(function (f) {
    var c = f[t.col.codigo], s = f[t.col.session_id];
    if (c && s !== sid) usados[c] = true;
  });
  while (!codigo || usados[codigo]) {
    var s = 'RUVU-';
    for (var i = 0; i < 4; i++) s += ALFABETO_CODIGO.charAt(Math.floor(Math.random() * ALFABETO_CODIGO.length));
    codigo = s;
  }
  return codigo;
}

/* ======================= Lectura (GET, para el panel) ======================= */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var cb = /^[A-Za-z_$][\w$.]*$/.test(p.callback || '') ? p.callback : null;
  var salida;
  if (p.accion === 'ping') salida = { ok: true, ping: 'pong' };
  else if (String(p.pin) !== String(PIN)) salida = { ok: false, error: 'pin' };
  else {
    try {
      salida = agregados(fecha(p.desde), fecha(p.hasta));
    } catch (err) {
      salida = { ok: false, error: String(err && err.message || err) };
    }
  }
  var txt = JSON.stringify(salida);
  if (cb) return ContentService.createTextOutput(cb + '(' + txt + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

var DISTRIBUCIONES = ['parada', 'destino', 'cuadras_estimadas', 'modo_actual', 'frecuencia', 'usaria', 'motivo_no', 'edad',
  'precio_max_v2', 'acepta_precio', 'oferta_elegida', 'precio_max', 'motivo_viaje', 'vuelta', 'cuadras', 'uso_previo',
  'dia_primer_viaje', 'franja_primer_viaje'];

// Pantallas finales: quien quedó ahí no abandonó
var FINALES = { fin: 1, fin_sin_whatsapp: 1, fin_menor: 1, codigo: 1, fin_bonus: 1, bonus_saltado: 1, ya_tiene_codigo: 1 };
// Pantallas a las que se llega después (o en) la del WhatsApp
var DESDE_WHATSAPP = { whatsapp: 1, codigo: 1, fin_bonus: 1, bonus_saltado: 1, extra_motivo: 1, extra_vuelta: 1,
  extra_cuadras: 1, extra_uso: 1, primer_viaje: 1, fin: 1, fin_sin_whatsapp: 1 };

function esCelular(ua) {
  return /Mobile|iPhone|Android/i.test(String(ua || ''));
}

/* Agregados para el panel. Excluye sesiones de prueba (test = si) y de
   computadora (user agent sin Mobile/iPhone/Android). Separa la encuesta
   nueva (v2) de la anterior (v1). */
function agregados(desde, hasta) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d0 = desde ? desde.getTime() : -Infinity;
  var d1 = hasta ? hasta.getTime() : Infinity;
  function enRango(v) {
    var f = fecha(v);
    if (!f) return false;
    var t = f.getTime();
    return t >= d0 && t <= d1;
  }
  var salida = {
    ok: true, generado: new Date().toISOString(),
    excluidas: { test: 0, computadora: 0 },
    conteo: {},
    versiones: { v1: { puntos: {} }, v2: { puntos: {} } }
  };
  function P(ver, slug) {
    var puntos = salida.versiones[ver].puntos;
    slug = slug || 'sin-punto';
    if (!puntos[slug]) {
      puntos[slug] = { qr: embudoVacio(), ref: embudoVacio(), reescaneos: 0, retomadas: 0, repetidas: 0, dist: {}, abandono: {} };
      DISTRIBUCIONES.forEach(function (k) { puntos[slug].dist[k] = {}; });
    }
    return puntos[slug];
  }

  // --- respuestas
  var t = abrirTabla(ss, 'respuestas');
  var c = t.col;
  t.filas.forEach(function (f) {
    if (!enRango(f[c.timestamp_scan] || f[c.timestamp_inicio])) return;
    if (f[c.test] === 'si') { salida.excluidas.test++; return; }
    if (!esCelular(f[c.user_agent])) { salida.excluidas.computadora++; return; }
    var ver = f[c.version] === 'v2' ? 'v2' : 'v1';
    var p = P(ver, f[c.punto]);
    var paso = f[c.ultimo_paso] || 'inicio';
    if (paso === 'ya_tiene_codigo') { p.reescaneos++; return; } // ya participó: no es una sesión nueva
    if (f[c.retomada] === 'si') p.retomadas++;
    if (f[c.repetido] === 'si') p.repetidas++;
    var e = f[c.ref] ? p.ref : p.qr;
    e.escanean++;
    if (f[c.timestamp_inicio]) e.empiezan++;
    var llegaPrecio = ver === 'v2'
      ? !!f[c.precio_max_v2] || paso === 'precio'
      : !!f[c.acepta_precio] || paso === 'precio' || paso === 'oferta' || paso === 'precio_max';
    if (llegaPrecio) e.llegan_precio++;
    if (f[c.whatsapp] || f[c.codigo] || DESDE_WHATSAPP[paso]) e.llegan_whatsapp++;
    if (f[c.whatsapp]) { e.dejan_numero++; e.whatsapp++; }
    if (f[c.codigo]) e.ven_codigo++;
    if (ver === 'v2' && (f[c.motivo_viaje] || f[c.dia_primer_viaje] || f[c.franja_primer_viaje])) e.responden_bonus++;
    if (f[c.invito_amigo] === 'si') e.invitan++;
    if (f[c.usaria] === 'si') e.usaria_si++;
    if (f[c.usaria] === 'depende') e.usaria_depende++;
    if (f[c.usaria] === 'no') e.usaria_no++;
    if (f[c.edad] === 'menos_18') e.menores++;
    if (f[c.acepta_precio] === 'si') e.acepta_precio++;
    if (f[c.acepta_precio] === 'caro' && f[c.oferta_elegida] && f[c.oferta_elegida] !== 'ninguna') e.acepta_oferta++;
    if (f[c.completo] === 'si') e.completan++;
    DISTRIBUCIONES.forEach(function (k) {
      if (c[k] === undefined) return;
      var v = f[c[k]];
      if (v !== '' && v !== null && v !== undefined) p.dist[k][v] = (p.dist[k][v] || 0) + 1;
    });
    if (!FINALES[paso]) p.abandono[paso] = (p.abandono[paso] || 0) + 1;
  });

  // --- re-escaneos de la encuesta vieja que no tienen fila (antes no se creaba)
  var ev = abrirTabla(ss, 'eventos');
  var contados = {};
  ev.filas.forEach(function (f) {
    var sid = f[ev.col.session_id];
    if (f[ev.col.tipo] !== 'scan' || t.indice[sid] || contados[sid] || !enRango(f[ev.col.timestamp])) return;
    if (String(f[ev.col.datos]).indexOf('"repetido":"si"') < 0) return;
    contados[sid] = true;
    P('v1', f[ev.col.punto]).reescaneos++;
  });

  // --- conteo manual (cada tap_id cuenta una vez; los "deshacer" lo anulan)
  var co = abrirTabla(ss, 'conteo');
  var anulados = {}, vistos = {};
  co.filas.forEach(function (f) {
    if (f[co.col.accion] === 'deshacer') anulados[f[co.col.deshace_tap_id]] = true;
  });
  co.filas.forEach(function (f) {
    var a = f[co.col.accion], id = f[co.col.tap_id];
    if (a === 'deshacer' || anulados[id] || vistos[id] || !enRango(f[co.col.timestamp])) return;
    vistos[id] = true;
    var slug = f[co.col.punto] || 'sin-punto';
    var k = salida.conteo[slug] = salida.conteo[slug] || { pasan: 0, frenan: 0 };
    k.pasan++;               // quien se frena también pasó
    if (a === 'frena') k.frenan++;
  });

  return salida;
}

function embudoVacio() {
  return {
    escanean: 0, empiezan: 0, llegan_precio: 0, llegan_whatsapp: 0, dejan_numero: 0, ven_codigo: 0,
    responden_bonus: 0, invitan: 0,
    usaria_si: 0, usaria_depende: 0, usaria_no: 0, menores: 0, completan: 0,
    acepta_precio: 0, acepta_oferta: 0, whatsapp: 0
  };
}

/* ids de una columna (event_id / tap_id) como objeto { id: true } */
function idsExistentes(sh, columna) {
  var ids = {};
  var n = sh.getLastRow() - 1;
  if (n < 1) return ids;
  var enc = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  var i = enc.indexOf(columna);
  if (i < 0) return ids;
  sh.getRange(2, i + 1, n, 1).getValues().forEach(function (f) { if (f[0]) ids[f[0]] = true; });
  return ids;
}

/* ======================= Utilidades de hoja ======================= */

function hoja(ss, nombre) {
  var sh = ss.getSheetByName(nombre);
  var cols = COLUMNAS[nombre];
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.setFrozenRows(1);
    return sh;
  }
  // Si agregaste columnas nuevas en el código, se suman al final
  var ultima = Math.max(sh.getLastColumn(), 1);
  var actuales = sh.getRange(1, 1, 1, ultima).getValues()[0];
  var faltan = cols.filter(function (c) { return actuales.indexOf(c) < 0; });
  if (faltan.length) sh.getRange(1, actuales.filter(String).length + 1, 1, faltan.length).setValues([faltan]);
  return sh;
}

/* Lee una hoja entera a memoria con índice por session_id. */
function abrirTabla(ss, nombre) {
  var sh = hoja(ss, nombre);
  var datos = sh.getDataRange().getValues();
  var enc = datos[0];
  var col = {};
  enc.forEach(function (h, i) { if (h) col[h] = i; });
  var t = { sh: sh, nombre: nombre, enc: enc, col: col, filas: datos.slice(1), indice: {}, sucias: {}, nuevas: [] };
  if (nombre === 'respuestas') {
    t.filas.forEach(function (f, i) { t.indice[f[col.session_id]] = { i: i, valores: f }; });
  }
  return t;
}

function upsert(t, sid, cambios) {
  var reg = t.indice[sid];
  if (!reg) {
    var f = t.enc.map(function () { return ''; });
    t.filas.push(f);
    reg = t.indice[sid] = { i: t.filas.length - 1, valores: f, nueva: true };
    t.nuevas.push(reg.i);
  }
  for (var k in cambios) if (k in t.col) reg.valores[t.col[k]] = cambios[k];
  if (!reg.nueva) t.sucias[reg.i] = true;
}

function guardarTabla(t) {
  var ancho = t.enc.length;
  Object.keys(t.sucias).forEach(function (i) {
    i = Number(i);
    t.sh.getRange(i + 2, 1, 1, ancho).setValues([t.filas[i].map(celda)]);
  });
  if (t.nuevas.length) {
    var filas = t.nuevas.map(function (i) { return t.filas[i].map(celda); });
    t.sh.getRange(t.sh.getLastRow() + 1, 1, filas.length, ancho).setValues(filas);
  }
}

function fila(nombre, obj) {
  return COLUMNAS[nombre].map(function (k) { return k in obj ? obj[k] : ''; });
}

function agregarFilas(sh, filas) {
  if (!filas.length) return;
  var ultima = Math.max(sh.getLastColumn(), filas[0].length);
  var enc = sh.getRange(1, 1, 1, ultima).getValues()[0];
  var nombre = sh.getName();
  // reordenar según el encabezado real de la hoja (por si alguien movió columnas)
  var orden = COLUMNAS[nombre];
  var datos = filas.map(function (f) {
    return enc.map(function (h) { var i = orden.indexOf(h); return i < 0 ? '' : celda(f[i]); });
  });
  sh.getRange(sh.getLastRow() + 1, 1, datos.length, enc.length).setValues(datos);
}

/* Fuerza texto en las celdas: evita que Sheets convierta "7-10" en fecha,
   "+549…" en número o "=…" en fórmula. */
function celda(v) {
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v === null || v === undefined || v === '') return '';
  return "'" + String(v);
}

function texto(v, max) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 100);
}

function fecha(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================= Ayudas para el editor ======================= */

/** Ejecutalo una vez desde el editor (botón ▶) para crear las 3 hojas. */
function configurarHojas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(COLUMNAS).forEach(function (n) {
    var sh = hoja(ss, n);
    sh.getRange(1, 1, 1, COLUMNAS[n].length).setFontWeight('bold');
  });
  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 1 && hoja1.getLastRow() === 0) ss.deleteSheet(hoja1);
}

/** Prueba rápida: simula una sesión y muestra el resultado en el registro. */
function probar() {
  var sid = 'prueba-' + Date.now();
  var r = doPost({ postData: { contents: JSON.stringify({ eventos: [
    { event_id: sid + '-1', tipo: 'scan', session_id: sid, punto: 'plaza-san-martin', datos: { repetido: 'no' } },
    { event_id: sid + '-2', tipo: 'respuesta', session_id: sid, punto: 'plaza-san-martin', datos: { destino: 'terminal', ultimo_paso: 'modo' } }
  ] }) } });
  Logger.log(r.getContent());
  Logger.log(doGet({ parameter: { pin: PIN } }).getContent());
}

/* ======================= Limpieza de duplicados (correr a mano UNA vez) =======================
   1. Elegí "contarDuplicados" y tocá ▶ Ejecutar: en el registro dice cuántas filas borraría.
   2. Hacé una copia de la planilla (Archivo → Crear una copia), por las dudas.
   3. Elegí "limpiarDuplicados" y tocá ▶ Ejecutar. Deja la PRIMERA fila de cada event_id
      (y de cada tap_id en "conteo") y borra las repetidas. No toca "respuestas". */
function contarDuplicados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var msg = ['eventos', 'conteo'].map(function (n) {
    var r = filasDuplicadas(ss.getSheetByName(n), n === 'eventos' ? 'event_id' : 'tap_id');
    return n + ': ' + r.length + ' filas repetidas para borrar';
  }).join(' · ');
  Logger.log(msg);
  return msg;
}

function limpiarDuplicados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // que no entre ninguna respuesta mientras se borra
  try {
    var msg = ['eventos', 'conteo'].map(function (n) {
      var sh = ss.getSheetByName(n);
      var filas = filasDuplicadas(sh, n === 'eventos' ? 'event_id' : 'tap_id');
      // de abajo hacia arriba, agrupando filas seguidas, para no correr los números
      for (var i = filas.length - 1; i >= 0;) {
        var fin = filas[i], ini = fin;
        while (i > 0 && filas[i - 1] === ini - 1) { i--; ini--; }
        sh.deleteRows(ini, fin - ini + 1);
        i--;
      }
      return n + ': ' + filas.length + ' filas repetidas borradas';
    }).join(' · ');
    Logger.log(msg);
    return msg;
  } finally {
    lock.releaseLock();
  }
}

/* Números de fila (1 = encabezado) que repiten un id ya visto más arriba. */
function filasDuplicadas(sh, columna) {
  if (!sh || sh.getLastRow() < 2) return [];
  var enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var i = enc.indexOf(columna);
  if (i < 0) return [];
  var vistos = {}, filas = [];
  sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getValues().forEach(function (f, k) {
    var id = f[0];
    if (!id) return;
    if (vistos[id]) filas.push(k + 2);
    else vistos[id] = true;
  });
  return filas;
}
