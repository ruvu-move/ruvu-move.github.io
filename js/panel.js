/* RUVU · panel de resultados (lee agregados del Apps Script vía doGet). */
(function () {
  var R = window.RUVU, C = R.C;
  var datos = null;

  /* Etiquetas legibles y orden de cada respuesta */
  var ETIQ = {
    modo_actual: { caminando: 'Caminando', micro: 'Micro', bici: 'Bici', uber_remis: 'Uber o remis', auto: 'Auto', moto: 'Moto' },
    frecuencia: { '1_o_menos': '1 o menos', '2-3': '2 a 3', '4_o_mas': '4 o más', todos_los_dias: 'Todos los días' },
    usaria: { si: 'Sí', depende: 'Depende del precio', no: 'No' },
    motivo_no: { prefiero_caminar: 'Prefiero caminar', inseguro: 'No me siento seguro/a', no_se_andar: 'No sé andar', clima: 'Por el clima', otra: 'Otra' },
    edad: { menos_18: 'Menos de 18', '18-24': '18 a 24', '25-34': '25 a 34', '35-44': '35 a 44', '45+': '45 o más' },
    acepta_precio: { si: 'Sí', caro: 'Es caro', no_pagaria: 'No a ningún precio' },
    oferta_elegida: { pack: 'Pack 10 viajes', abono: 'Abono mensual', valle: 'Horario valle', ninguna: 'Ninguna' },
    precio_max: (function () {
      var o = {};
      C.OFERTAS.preciosMaximos.forEach(function (n) { o[String(n)] = R.pesos(n); });
      o['menos_' + C.OFERTAS.preciosMaximos[0]] = 'Menos de ' + R.pesos(C.OFERTAS.preciosMaximos[0]);
      return o;
    })(),
    dia_primer_viaje: { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' },
    franja_primer_viaje: { '7-10': '7–10 h', '10-13': '10–13 h', '13-16': '13–16 h', '16-19': '16–19 h', '19-21': '19–21 h' },
    destino: (function () { var o = {}; C.DESTINOS.forEach(function (d) { o[d.id] = d.nombre; }); return o; })()
  };
  var TITULOS = {
    modo_actual: '¿Cómo ibas a ir?', frecuencia: 'Frecuencia semanal', edad: 'Edad', usaria: '¿Lo usarías en vez de caminar?',
    motivo_no: 'Motivo del "No"', acepta_precio: '¿Pagaría el precio?', oferta_elegida: 'Oferta elegida (dijeron "es caro")',
    precio_max: 'Precio máximo (ninguna oferta)', destino: 'Destino', dia_primer_viaje: 'Día del primer viaje',
    franja_primer_viaje: 'Horario del primer viaje'
  };
  var ORDEN_DIST = ['modo_actual', 'frecuencia', 'edad', 'oferta_elegida', 'precio_max', 'usaria', 'motivo_no',
    'acepta_precio', 'destino', 'dia_primer_viaje', 'franja_primer_viaje'];
  var PASOS = [
    ['inicio', 'Inicio (escaneó, no empezó)'], ['destino', 'Destino'], ['modo', 'Cómo iba a ir'], ['frecuencia', 'Frecuencia'],
    ['usaria', 'Tiempo / ¿lo usarías?'], ['motivo_no', 'Por qué no'], ['edad', 'Edad'], ['precio', 'Precio'],
    ['oferta', 'Ofertas'], ['precio_max', 'Precio máximo'], ['whatsapp', 'WhatsApp']
  ];
  /* [clave, etiqueta, base del %]. La base es el paso anterior, salvo donde el
     flujo se bifurca: el precio solo lo ven los que dijeron "sí" o "depende",
     y el WhatsApp se pide a todos los que terminan (también a los del "No"). */
  var EMBUDO = [
    ['pasan', 'Pasan'], ['frenan', 'Se frenan', 'pasan'], ['escanean', 'Escanean', 'frenan'], ['empiezan', 'Empiezan', 'escanean'],
    ['usaria_si', 'Usaría: sí', 'empiezan'], ['acepta_precio', 'Acepta el precio', 'vieron_precio'],
    ['whatsapp', 'Dejan WhatsApp', 'empiezan'], ['invitan', 'Invitan a un amigo', 'whatsapp']
  ];
  var BASE_TXT = { vieron_precio: 'de sí + depende', empiezan: 'de los que empezaron' };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function nombrePunto(slug) {
    if (slug === 'total') return 'Total';
    if (slug === 'sin-punto') return 'Sin punto (link sin ?p=)';
    var p = C.PUNTOS.filter(function (x) { return x.slug === slug; })[0];
    return p ? p.nombre : slug;
  }
  function pct(n, base) { return base ? Math.round(n / base * 100) + '%' : '—'; }

  /* Fila plana del embudo para un punto */
  function plano(p) {
    return {
      pasan: p.conteo.pasan, frenan: p.conteo.frenan,
      escanean: p.qr.escanean, empiezan: p.qr.empiezan, usaria_si: p.qr.usaria_si, usaria_depende: p.qr.usaria_depende,
      acepta_precio: p.qr.acepta_precio, acepta_oferta: p.qr.acepta_oferta, whatsapp: p.qr.whatsapp, invitan: p.qr.invitan,
      completan: p.qr.completan, vieron_precio: p.qr.usaria_si + p.qr.usaria_depende, ref_escanean: p.ref.escanean, ref_empiezan: p.ref.empiezan, ref_whatsapp: p.ref.whatsapp,
      reescaneos: p.reescaneos
    };
  }

  function sumar(puntos) {
    var t = null;
    Object.keys(puntos).forEach(function (k) {
      var p = puntos[k];
      if (!t) { t = JSON.parse(JSON.stringify(p)); return; }
      ['conteo', 'qr', 'ref'].forEach(function (g) { for (var m in p[g]) t[g][m] = (t[g][m] || 0) + p[g][m]; });
      t.reescaneos += p.reescaneos;
      for (var d in p.dist) { t.dist[d] = t.dist[d] || {}; for (var v in p.dist[d]) t.dist[d][v] = (t.dist[d][v] || 0) + p.dist[d][v]; }
      for (var a in p.abandono) t.abandono[a] = (t.abandono[a] || 0) + p.abandono[a];
    });
    return t;
  }

  function slugsOrdenados() {
    var s = C.PUNTOS.map(function (p) { return p.slug; });
    Object.keys(datos.puntos).forEach(function (k) { if (s.indexOf(k) < 0) s.push(k); });
    return s;
  }

  function vacio() {
    var dist = {};
    ORDEN_DIST.forEach(function (k) { dist[k] = {}; });
    var e = { escanean: 0, empiezan: 0, usaria_si: 0, usaria_depende: 0, usaria_no: 0, menores: 0, acepta_precio: 0, acepta_oferta: 0, completan: 0, whatsapp: 0, invitan: 0 };
    return { conteo: { pasan: 0, frenan: 0 }, qr: e, ref: JSON.parse(JSON.stringify(e)), reescaneos: 0, dist: dist, abandono: {} };
  }
  function punto(slug) {
    if (slug === 'total') return sumar(datos.puntos) || vacio();
    return datos.puntos[slug] || vacio();
  }

  /* ---------- Render ---------- */
  function render() {
    var slugs = slugsOrdenados();
    // Tabla
    var cab = '<thead><tr><th>Punto</th>' + EMBUDO.map(function (e) { return '<th>' + e[1] + '</th>'; }).join('') +
      '<th>Depende del precio</th><th>Acepta con oferta</th><th>Referidos escanean</th><th>Re-escaneos</th></tr></thead>';
    function filaHtml(slug, clase) {
      var f = plano(punto(slug));
      var celdas = EMBUDO.map(function (e, i) {
        return '<td>' + f[e[0]] + (e[2] ? '<small>' + pct(f[e[0]], f[e[2]]) + '</small>' : '') + '</td>';
      }).join('');
      return '<tr class="' + (clase || '') + '"><td>' + esc(nombrePunto(slug)) + '</td>' + celdas +
        '<td>' + f.usaria_depende + '</td><td>' + f.acepta_oferta + '</td><td>' + f.ref_escanean + '</td><td>' + f.reescaneos + '</td></tr>';
    }
    document.getElementById('tabla-embudo').innerHTML = cab + '<tbody>' +
      slugs.map(function (s) { return filaHtml(s); }).join('') + filaHtml('total', 'total') + '</tbody>';

    // Punto seleccionado
    var sel = document.getElementById('sel-punto').value;
    var p = punto(sel), f = plano(p);
    document.getElementById('titulo-embudo').textContent = 'Embudo · ' + nombrePunto(sel);
    barras('embudo', EMBUDO.map(function (e) {
      return { lbl: e[1], n: f[e[0]], extra: e[2] ? pct(f[e[0]], f[e[2]]) + (BASE_TXT[e[2]] && e[0] !== 'usaria_si' ? ' ' + BASE_TXT[e[2]] : '') : '' };
    }));
    barras('abandono', PASOS.map(function (s) { return { lbl: s[1], n: p.abandono[s[0]] || 0 }; })
      .concat(Object.keys(p.abandono).filter(function (k) { return !PASOS.some(function (s) { return s[0] === k; }); })
        .map(function (k) { return { lbl: k, n: p.abandono[k] }; })), true);
    barras('referidos', [
      { lbl: 'Escanean', n: f.ref_escanean }, { lbl: 'Empiezan', n: f.ref_empiezan, extra: pct(f.ref_empiezan, f.ref_escanean) },
      { lbl: 'Dejan WhatsApp', n: f.ref_whatsapp, extra: pct(f.ref_whatsapp, f.ref_empiezan) }
    ]);

    var cont = document.getElementById('distribuciones');
    cont.innerHTML = ORDEN_DIST.map(function (k) {
      return '<section class="tarjeta"><h2>' + TITULOS[k] + '</h2><p class="nota" id="n-' + k + '"></p><div class="barras" id="d-' + k + '"></div></section>';
    }).join('');
    ORDEN_DIST.forEach(function (k) {
      var d = p.dist[k] || {}, et = ETIQ[k] || {};
      var claves = Object.keys(et).concat(Object.keys(d).filter(function (v) { return !(v in et); }));
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
    linea(['RUVU - export del panel', 'desde', desde || 'inicio', 'hasta', hasta || 'hoy', 'generado', datos.generado]);
    linea([]);
    linea(['EMBUDO']);
    var cols = ['pasan', 'frenan', 'escanean', 'empiezan', 'usaria_si', 'usaria_depende', 'acepta_precio', 'acepta_oferta',
      'whatsapp', 'invitan', 'completan', 'ref_escanean', 'ref_empiezan', 'ref_whatsapp', 'reescaneos'];
    linea(['punto'].concat(cols));
    slugsOrdenados().concat(['total']).forEach(function (s) {
      var f = plano(punto(s));
      linea([s].concat(cols.map(function (c) { return f[c]; })));
    });
    linea([]);
    linea(['RESPUESTAS']);
    linea(['punto', 'pregunta', 'respuesta', 'cantidad']);
    slugsOrdenados().concat(['total']).forEach(function (s) {
      var p = punto(s);
      ORDEN_DIST.forEach(function (k) {
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
    a.download = 'ruvu-panel-' + new Date().toISOString().slice(0, 10) + '.csv';
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
      datos = { puntos: {}, generado: new Date().toISOString() };
      render();
      return;
    }
    var btn = document.getElementById('actualizar');
    btn.disabled = true; btn.textContent = 'Cargando…';
    R.jsonp(rango()).then(function (res) {
      if (!res || !res.ok) throw new Error(res && res.error === 'pin' ? 'El PIN de config.js no coincide con el de Code.gs' : (res && res.error) || 'error');
      datos = res;
      aviso('');
      render();
    }).catch(function (e) {
      aviso('No se pudieron leer los datos: ' + esc(e.message) + '. Revisá la URL del Apps Script y que esté publicado con acceso "Cualquier persona".');
    }).then(function () { btn.disabled = false; btn.textContent = 'Actualizar'; });
  }

  /* Datos inventados para ver el panel antes de conectar la planilla */
  function ejemplo() {
    var puntos = {};
    C.PUNTOS.forEach(function (p, i) {
      var x = vacio(), k = 1 + (i % 3) * 0.5;
      x.conteo.pasan = Math.round(420 * k); x.conteo.frenan = Math.round(60 * k);
      x.qr.escanean = Math.round(31 * k); x.qr.empiezan = Math.round(26 * k); x.qr.usaria_si = Math.round(12 * k);
      x.qr.usaria_depende = Math.round(7 * k); x.qr.acepta_precio = Math.round(8 * k); x.qr.acepta_oferta = Math.round(4 * k);
      x.qr.whatsapp = Math.round(15 * k); x.qr.invitan = Math.round(5 * k); x.qr.completan = Math.round(19 * k);
      x.ref.escanean = Math.round(4 * k); x.ref.empiezan = Math.round(3 * k); x.ref.whatsapp = Math.round(2 * k);
      x.reescaneos = i;
      x.dist.modo_actual = { caminando: Math.round(14 * k), micro: Math.round(6 * k), bici: 1, uber_remis: 2, auto: 2, moto: 1 };
      x.dist.frecuencia = { '1_o_menos': 5, '2-3': 8, '4_o_mas': 6, todos_los_dias: Math.round(7 * k) };
      x.dist.edad = { menos_18: 2, '18-24': Math.round(11 * k), '25-34': 7, '35-44': 3, '45+': 2 };
      x.dist.oferta_elegida = { pack: 2, abono: 1, valle: 1, ninguna: 2 };
      x.dist.precio_max = { '600': 1, '900': 1, '1100': 0, menos_600: 0 };
      x.dist.usaria = { si: x.qr.usaria_si, depende: x.qr.usaria_depende, no: 6 };
      x.abandono = { inicio: 5, destino: 2, usaria: 1, precio: 2, whatsapp: 1 };
      puntos[p.slug] = x;
    });
    return { ok: true, ejemplo: true, generado: new Date().toISOString(), puntos: puntos };
  }

  function iniciar() {
    document.getElementById('app').hidden = false;
    var sel = document.getElementById('sel-punto');
    sel.innerHTML = '<option value="total">Total</option>' + C.PUNTOS.map(function (p) {
      return '<option value="' + p.slug + '">' + esc(p.nombre) + '</option>';
    }).join('') + '<option value="sin-punto">Sin punto</option>';
    sel.onchange = function () { if (datos) render(); };
    document.getElementById('actualizar').onclick = cargar;
    document.getElementById('csv').onclick = exportarCsv;
    cargar();
  }

  R.pedirPin(iniciar);
})();
