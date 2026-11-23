/* RUVU · panel de resultados (lee agregados del Apps Script vía doGet).
   El Apps Script ya excluye sesiones de prueba (test = si) y de computadora, y
   separa la encuesta nueva (v2) de la anterior (v1). */
(function () {
  var R = window.RUVU, C = R.C;
  var datos = null;

  function etiquetasPrecios(lista, ultimoMas) {
    var o = {};
    lista.forEach(function (n, i) {
      if (ultimoMas && i === lista.length - 1) o[n + '+'] = R.pesos(n) + ' o más';
      else o[String(n)] = R.pesos(n);
    });
    return o;
  }

  /* Etiquetas legibles y orden de cada respuesta */
  var ETIQ = {
    modo_actual: { caminando: 'Caminando', micro: 'Micro', bici: 'Bici', uber_remis: 'Uber o remis', auto: 'Auto', moto: 'Moto' },
    frecuencia: { '1_o_menos': '1 o menos', '2-3': '2 a 3', '4_o_mas': '4 o más', todos_los_dias: 'Todos los días' },
    usaria: { si: 'Sí', depende: 'Depende del precio', no: 'No' },
    motivo_no: { prefiero_caminar: 'Prefiero caminar', inseguro: 'No me siento seguro/a', no_se_andar: 'No sé andar', clima: 'Por el clima', otra: 'Otra' },
    edad: { menos_18: 'Menos de 18', '18-24': '18 a 24', '25-34': '25 a 34', '35-44': '35 a 44', '45+': '45 o más' },
    precio_max_v2: (function () { var o = etiquetasPrecios(C.PRECIOS_MAX_V2, true); o.no = 'No lo pagaría'; return o; })(),
    cuadras_estimadas: (function () {
      var o = {}, ops = C.CUADRAS_OPCIONES;
      ops.forEach(function (n, i) { if (i === ops.length - 1) o[n + '+'] = n + ' o más'; else o[String(n)] = n + ' cuadras'; });
      return o;
    })(),
    acepta_precio: { si: 'Sí', caro: 'Es caro', no_pagaria: 'No a ningún precio' },
    oferta_elegida: { pack: 'Pack 10 viajes', abono: 'Abono mensual', valle: 'Horario valle', ninguna: 'Ninguna' },
    precio_max: (function () {
      var o = etiquetasPrecios(C.OFERTAS.preciosMaximos);
      o['menos_' + C.OFERTAS.preciosMaximos[0]] = 'Menos de ' + R.pesos(C.OFERTAS.preciosMaximos[0]);
      return o;
    })(),
    motivo_viaje: { facu: 'Facu', laburo: 'Laburo', tramite_compras: 'Trámite o compras', juntada_paseo: 'Juntada o paseo' },
    vuelta: { si: 'Sí', no: 'No, vuelve de otra forma', depende_horario: 'Depende del horario' },
    cuadras: { '1': '1 cuadra', '2-3': '2 a 3', '4-5': '4 a 5', mas_5: 'Más de 5' },
    uso_previo: { si_compartido: 'Sí, compartido', si_propio: 'Sí, propio o prestado', nunca: 'Nunca' },
    dia_primer_viaje: { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' },
    franja_primer_viaje: { '7-10': '7–10 h', '10-13': '10–13 h', '13-16': '13–16 h', '16-19': '16–19 h', '19-21': '19–21 h' },
    destino: (function () { var o = {}; C.DESTINOS.forEach(function (d) { o[d.id] = d.nombre; }); return o; })(),
    parada: (function () { var o = {}; (C.PARADAS || []).forEach(function (d) { o[d.id] = d.nombre; }); o.otra = 'Otra'; return o; })()
  };
  var TITULOS = {
    parada: '¿Dónde estás?', destino: '¿A dónde vas?', cuadras_estimadas: 'Cuadras estimadas (sin coordenadas)',
    modo_actual: '¿Cómo ibas a ir?', frecuencia: 'Frecuencia semanal', usaria: '¿Lo usarías en vez de caminar?',
    motivo_no: 'Motivo del "No"', precio_max_v2: 'Precio máximo que pagaría (encuesta nueva)', edad: 'Edad',
    motivo_viaje: '¿Para qué es este viaje? (bonus)', dia_primer_viaje: 'Día del primer viaje (bonus)',
    franja_primer_viaje: 'Horario del primer viaje (bonus)',
    acepta_precio: '¿Pagaría el precio? (encuesta anterior)', oferta_elegida: 'Oferta elegida (encuesta anterior)',
    precio_max: 'Precio máximo (encuesta anterior)', vuelta: '¿Lo usaría para volver? (encuesta anterior)',
    cuadras: 'Cuadras que caminaría (encuesta anterior)', uso_previo: '¿Usó un monopatín eléctrico? (encuesta anterior)'
  };
  var ORDEN_DIST = {
    v2: ['parada', 'destino', 'cuadras_estimadas', 'modo_actual', 'frecuencia', 'usaria', 'motivo_no', 'precio_max_v2', 'edad',
      'motivo_viaje', 'dia_primer_viaje', 'franja_primer_viaje'],
    v1: ['parada', 'destino', 'modo_actual', 'frecuencia', 'usaria', 'motivo_no', 'edad', 'acepta_precio', 'oferta_elegida',
      'precio_max', 'motivo_viaje', 'vuelta', 'cuadras', 'uso_previo', 'dia_primer_viaje', 'franja_primer_viaje']
  };
  var PASOS = [
    ['inicio', 'Inicio (escaneó, no empezó)'], ['parada', '¿Dónde estás?'], ['destino', '¿A dónde vas?'], ['cuadras', 'Cuadras'],
    ['modo', 'Cómo iba a ir'], ['frecuencia', 'Frecuencia'], ['usaria', '¿Lo usarías?'], ['motivo_no', 'Por qué no'],
    ['precio', 'Precio'], ['oferta', 'Ofertas (v1)'], ['precio_max', 'Precio máximo (v1)'], ['edad', 'Edad'], ['whatsapp', 'WhatsApp'],
    ['bonus', 'Bonus'], ['extra_motivo', 'Extra: para qué (v1)'], ['extra_vuelta', 'Extra: vuelta (v1)'],
    ['extra_cuadras', 'Extra: cuadras (v1)'], ['extra_uso', 'Extra: uso previo (v1)'], ['primer_viaje', 'Día y horario (v1)']
  ];
  /* [clave, etiqueta, base del %]. La base es el paso anterior, salvo donde el
     flujo se bifurca: el WhatsApp lo ve también quien dijo "No" (que saltea el
     precio), y el código se da con o sin número. */
  var EMBUDO = [
    ['escanean', 'Escanean'], ['empiezan', 'Empiezan', 'escanean'], ['llegan_precio', 'Llegan a precio', 'empiezan'],
    ['llegan_whatsapp', 'Llegan a WhatsApp', 'empiezan'], ['dejan_numero', 'Dejan número', 'llegan_whatsapp'],
    ['ven_codigo', 'Ven el código', 'llegan_whatsapp'], ['responden_bonus', 'Responden bonus', 'ven_codigo'],
    ['invitan', 'Invitan', 'ven_codigo']
  ];
  var BASE_TXT = { empiezan: 'de los que empezaron', llegan_whatsapp: 'de los que llegan a WhatsApp', ven_codigo: 'de los que ven el código' };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function nombrePunto(slug) {
    if (slug === 'total') return 'Total';
    if (slug === 'sin-punto') return 'QR general';
    var p = C.PUNTOS.filter(function (x) { return x.slug === slug; })[0];
    return p ? p.nombre : slug;
  }
  function pct(n, base) { return base ? Math.round(n / base * 100) + '%' : '—'; }
  function version() { return document.getElementById('sel-version').value; }
  function puntosVersion() { return (datos.versiones && datos.versiones[version()] || { puntos: {} }).puntos; }

  /* Fila plana del embudo para un punto */
  function plano(p, conteo) {
    var f = {};
    EMBUDO.forEach(function (e) { f[e[0]] = p.qr[e[0]] || 0; });
    f.usaria_si = p.qr.usaria_si; f.usaria_depende = p.qr.usaria_depende; f.usaria_no = p.qr.usaria_no;
    f.completan = p.qr.completan;
    f.ref_escanean = p.ref.escanean; f.ref_empiezan = p.ref.empiezan; f.ref_dejan_numero = p.ref.dejan_numero;
    f.reescaneos = p.reescaneos; f.retomadas = p.retomadas; f.repetidas = p.repetidas;
    f.pasan = conteo ? conteo.pasan : 0; f.frenan = conteo ? conteo.frenan : 0;
    return f;
  }

  function vacio() {
    var e = {};
    EMBUDO.concat([['usaria_si'], ['usaria_depende'], ['usaria_no'], ['completan']]).forEach(function (x) { e[x[0]] = 0; });
    return { qr: e, ref: JSON.parse(JSON.stringify(e)), reescaneos: 0, retomadas: 0, repetidas: 0, dist: {}, abandono: {} };
  }

  function sumar(puntos) {
    var t = vacio();
    Object.keys(puntos).forEach(function (k) {
      var p = puntos[k];
      ['qr', 'ref'].forEach(function (g) { for (var m in p[g]) t[g][m] = (t[g][m] || 0) + p[g][m]; });
      t.reescaneos += p.reescaneos; t.retomadas += p.retomadas || 0; t.repetidas += p.repetidas || 0;
      for (var d in p.dist) { t.dist[d] = t.dist[d] || {}; for (var v in p.dist[d]) t.dist[d][v] = (t.dist[d][v] || 0) + p.dist[d][v]; }
      for (var a in p.abandono) t.abandono[a] = (t.abandono[a] || 0) + p.abandono[a];
    });
    return t;
  }
  function conteoDe(slug) {
    var c = datos.conteo || {};
    if (slug !== 'total') return c[slug];
    var t = { pasan: 0, frenan: 0 };
    Object.keys(c).forEach(function (k) { t.pasan += c[k].pasan; t.frenan += c[k].frenan; });
    return t;
  }

  function slugsOrdenados() {
    var s = [];
    Object.keys(puntosVersion()).forEach(function (k) { if (s.indexOf(k) < 0) s.push(k); });
    return s.sort(function (a, b) { return a === 'sin-punto' ? -1 : b === 'sin-punto' ? 1 : a.localeCompare(b); });
  }

  function punto(slug) {
    if (slug === 'total') return sumar(puntosVersion());
    return puntosVersion()[slug] || vacio();
  }

  /* ---------- Render ---------- */
  function render() {
    var slugs = slugsOrdenados();
    var ex = datos.excluidas || { test: 0, computadora: 0 };
    document.getElementById('excluidas').textContent = 'No se cuentan: ' + ex.test + ' sesiones de prueba (?test=1) y ' +
      ex.computadora + ' abiertas desde una computadora.';

    // Tabla
    var cab = '<thead><tr><th>Punto</th>' + EMBUDO.map(function (e) { return '<th>' + e[1] + '</th>'; }).join('') +
      '<th>Retomaron</th><th>Otro trayecto</th><th>Ya tenían código</th><th>Referidos</th><th>Pasan / se frenan</th></tr></thead>';
    function filaHtml(slug, clase) {
      var f = plano(punto(slug), conteoDe(slug));
      var celdas = EMBUDO.map(function (e) {
        return '<td>' + f[e[0]] + (e[2] ? '<small>' + pct(f[e[0]], f[e[2]]) + '</small>' : '') + '</td>';
      }).join('');
      return '<tr class="' + (clase || '') + '"><td>' + esc(nombrePunto(slug)) + '</td>' + celdas +
        '<td>' + f.retomadas + '</td><td>' + f.repetidas + '</td><td>' + f.reescaneos + '</td><td>' + f.ref_escanean + '</td>' +
        '<td>' + f.pasan + ' / ' + f.frenan + '</td></tr>';
    }
    document.getElementById('tabla-embudo').innerHTML = cab + '<tbody>' +
      slugs.map(function (s) { return filaHtml(s); }).join('') + filaHtml('total', 'total') + '</tbody>';

    // Punto seleccionado
    var selEl = document.getElementById('sel-punto');
    var actual = selEl.value;
    selEl.innerHTML = '<option value="total">Total</option>' + slugs.map(function (s) {
      return '<option value="' + esc(s) + '">' + esc(nombrePunto(s)) + '</option>';
    }).join('');
    selEl.value = slugs.indexOf(actual) >= 0 ? actual : 'total';
    var sel = selEl.value;
    var p = punto(sel), f = plano(p, conteoDe(sel));
    document.getElementById('titulo-embudo').textContent = 'Embudo · ' + nombrePunto(sel);
    barras('embudo', EMBUDO.map(function (e) {
      return { lbl: e[1], n: f[e[0]], extra: e[2] ? pct(f[e[0]], f[e[2]]) + (BASE_TXT[e[2]] && e[2] !== EMBUDO[EMBUDO.indexOf(e) - 1][0] ? ' ' + BASE_TXT[e[2]] : '') : '' };
    }));
    barras('sesiones', [
      { lbl: 'Retomaron donde dejaron', n: f.retomadas },
      { lbl: 'Respondieron otro trayecto', n: f.repetidas },
      { lbl: 'Volvieron a escanear (ya tenían código)', n: f.reescaneos }
    ]);
    barras('abandono', PASOS.map(function (s) { return { lbl: s[1], n: p.abandono[s[0]] || 0 }; })
      .concat(Object.keys(p.abandono).filter(function (k) { return !PASOS.some(function (s) { return s[0] === k; }); })
        .map(function (k) { return { lbl: k, n: p.abandono[k] }; })), true);
    barras('referidos', [
      { lbl: 'Escanean', n: f.ref_escanean }, { lbl: 'Empiezan', n: f.ref_empiezan, extra: pct(f.ref_empiezan, f.ref_escanean) },
      { lbl: 'Dejan número', n: f.ref_dejan_numero, extra: pct(f.ref_dejan_numero, f.ref_empiezan) }
    ]);

    var orden = ORDEN_DIST[version()];
    var cont = document.getElementById('distribuciones');
    cont.innerHTML = orden.map(function (k) {
      return '<section class="tarjeta"><h2>' + TITULOS[k] + '</h2><p class="nota" id="n-' + k + '"></p><div class="barras" id="d-' + k + '"></div></section>';
    }).join('');
    orden.forEach(function (k) {
      var d = p.dist[k] || {}, et = ETIQ[k] || {};
      var claves = Object.keys(et).concat(Object.keys(d).filter(function (v) { return !(v in et); }));
      // listas largas (paradas, destinos): solo lo que tiene respuestas, de mayor a menor
      if (claves.length > 12) claves = claves.filter(function (v) { return d[v]; }).sort(function (a, b) { return d[b] - d[a]; });
      var total = claves.reduce(function (s, v) { return s + (d[v] || 0); }, 0);
      document.getElementById('n-' + k).textContent = total + ' respuestas';
      barras('d-' + k, claves.map(function (v) { return { lbl: et[v] || v, n: d[v] || 0, extra: pct(d[v] || 0, total) }; }));
    });
    document.getElementById('generado').textContent = 'Datos generados: ' + new Date(datos.generado).toLocaleString('es-AR') +
      (datos.ejemplo ? ' · DATOS DE EJEMPLO' : '');
  }

  function barras(id, filas, ocultarCeros) {
    if (ocultarCeros) filas = filas.filter(function (f) { return f.n > 0; });
    var max = filas.reduce(function (m, f) { return Math.max(m, f.n); }, 0);
    var el = document.getElementById(id);
    if (!filas.length || !max) { el.innerHTML = '<p class="vacio">Sin datos todavía.</p>'; return; }
    el.innerHTML = filas.map(function (f) {
      var tip = f.lbl + ': ' + f.n + (f.extra ? ' (' + f.extra + ')' : '');
      return '<div class="barra-fila" data-tip="' + esc(tip) + '"><span class="lbl">' + esc(f.lbl) + '</span>' +
        '<span class="pista"><span class="relleno" style="width:' + (f.n / max * 78) + '%"></span>' +
        '<span class="val"><b>' + f.n + '</b>' + (f.extra ? ' · ' + f.extra : '') + '</span></span></div>';
    }).join('');
  }

  /* Tooltip */
  var tip = document.getElementById('tip');
  document.addEventListener('mousemove', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.hidden = false;
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8) + 'px';
    tip.style.top = (e.clientY + 16) + 'px';
  });

  /* ---------- CSV (separador ; para Excel en español) ---------- */
  function exportarCsv() {
    if (!datos) return;
    var L = [];
    function linea(arr) {
      L.push(arr.map(function (v) { v = String(v === undefined ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'));
    }
    var desde = document.getElementById('desde').value, hasta = document.getElementById('hasta').value;
    var ex = datos.excluidas || {};
    linea(['RUVU - export del panel', 'version', version(), 'desde', desde || 'inicio', 'hasta', hasta || 'hoy', 'generado', datos.generado]);
    linea(['excluidas_test', ex.test, 'excluidas_computadora', ex.computadora]);
    linea([]);
    linea(['EMBUDO']);
    var cols = EMBUDO.map(function (e) { return e[0]; }).concat(['usaria_si', 'usaria_depende', 'usaria_no', 'completan',
      'retomadas', 'repetidas', 'reescaneos', 'ref_escanean', 'ref_empiezan', 'ref_dejan_numero', 'pasan', 'frenan']);
    linea(['punto'].concat(cols));
    slugsOrdenados().concat(['total']).forEach(function (s) {
      var f = plano(punto(s), conteoDe(s));
      linea([s].concat(cols.map(function (c) { return f[c]; })));
    });
    linea([]);
    linea(['RESPUESTAS']);
    linea(['punto', 'pregunta', 'respuesta', 'cantidad']);
    slugsOrdenados().concat(['total']).forEach(function (s) {
      var p = punto(s);
      ORDEN_DIST[version()].forEach(function (k) {
        var d = p.dist[k] || {};
        Object.keys(d).forEach(function (v) { linea([s, k, (ETIQ[k] || {})[v] || v, d[v]]); });
      });
    });
    linea([]);
    linea(['ABANDONO']);
    linea(['punto', 'ultimo_paso', 'cantidad']);
    slugsOrdenados().concat(['total']).forEach(function (s) {
      var a = punto(s).abandono;
      Object.keys(a).forEach(function (k) { linea([s, k, a[k]]); });
    });
    var blob = new Blob(['﻿' + L.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ruvu-panel-' + version() + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- Carga ---------- */
  function rango() {
    var d = document.getElementById('desde').value, h = document.getElementById('hasta').value;
    var p = { pin: C.PIN };
    if (d) p.desde = new Date(d + 'T00:00:00').toISOString();
    if (h) p.hasta = new Date(h + 'T23:59:59.999').toISOString();
    return p;
  }

  function aviso(html) { document.getElementById('aviso').innerHTML = html ? '<div class="aviso">' + html + '</div>' : ''; }

  function cargar() {
    if (!C.API_URL) {
      aviso('Falta configurar <b>API_URL</b> en config.js, así que no hay datos reales. <button class="btn btn-texto" id="ejemplo" type="button" style="width:auto;min-height:40px;margin-top:8px">Ver con datos de ejemplo</button>');
      document.getElementById('ejemplo').onclick = function () { datos = ejemplo(); aviso(''); render(); };
      datos = { versiones: { v1: { puntos: {} }, v2: { puntos: {} } }, generado: new Date().toISOString() };
      render();
      return;
    }
    var btn = document.getElementById('actualizar');
    btn.disabled = true; btn.textContent = 'Cargando…';
    R.jsonp(rango()).then(function (res) {
      if (!res || !res.ok) throw new Error(res && res.error === 'pin' ? 'El PIN de config.js no coincide con el de Code.gs' : (res && res.error) || 'error');
      if (!res.versiones) throw new Error('el Apps Script publicado es la versión anterior: publicá la nueva versión de Code.gs');
      datos = res;
      aviso('');
      render();
    }).catch(function (e) {
      aviso('No se pudieron leer los datos: ' + esc(e.message) + '. Revisá la URL del Apps Script y que esté publicado con acceso "Cualquier persona".');
    }).then(function () { btn.disabled = false; btn.textContent = 'Actualizar'; });
  }

  /* Datos inventados para ver el panel antes de conectar la planilla */
  function ejemplo() {
    var x = vacio();
    var n = { escanean: 120, empiezan: 70, llegan_precio: 52, llegan_whatsapp: 60, dejan_numero: 31, ven_codigo: 58, responden_bonus: 24, invitan: 9 };
    for (var k in n) x.qr[k] = n[k];
    x.qr.usaria_si = 30; x.qr.usaria_depende = 22; x.qr.usaria_no = 8; x.qr.completan = 58;
    x.ref.escanean = 8; x.ref.empiezan = 6; x.ref.dejan_numero = 3;
    x.retomadas = 6; x.repetidas = 3; x.reescaneos = 11;
    x.dist.precio_max_v2 = { '600': 9, '900': 17, '1200': 12, '1500+': 6, no: 8 };
    x.dist.modo_actual = { caminando: 28, micro: 22, bici: 4, uber_remis: 9, auto: 5, moto: 2 };
    x.abandono = { inicio: 50, parada: 6, destino: 4, usaria: 3, precio: 2, whatsapp: 2 };
    return {
      ok: true, ejemplo: true, generado: new Date().toISOString(), excluidas: { test: 4, computadora: 2 },
      conteo: { 'sin-punto': { pasan: 900, frenan: 140 } },
      versiones: { v1: { puntos: {} }, v2: { puntos: { 'sin-punto': x } } }
    };
  }

  function iniciar() {
    document.getElementById('app').hidden = false;
    document.getElementById('sel-punto').onchange = function () { if (datos) render(); };
    document.getElementById('sel-version').onchange = function () { if (datos) render(); };
    document.getElementById('actualizar').onclick = cargar;
    document.getElementById('csv').onclick = exportarCsv;
    cargar();
  }

  R.pedirPin(iniciar);
})();
