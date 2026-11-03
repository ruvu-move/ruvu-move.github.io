/* RUVU · utilidades compartidas: almacenamiento seguro, cálculo de viaje y
   cola de envíos al Apps Script con reintentos. */
(function () {
  var C = window.RUVU_CONFIG;

  /* ---------- localStorage envuelto en try/catch ---------- */
  var memoria = {};
  var store = {
    get: function (k, def) {
      try {
        var v = window.localStorage.getItem(k);
        return v === null ? def : JSON.parse(v);
      } catch (e) {
        return k in memoria ? memoria[k] : def;
      }
    },
    set: function (k, v) {
      memoria[k] = v;
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ }
    },
    del: function (k) {
      delete memoria[k];
      try { window.localStorage.removeItem(k); } catch (e) { /* nada */ }
    }
  };

  function uid(n) {
    var a = 'abcdefghijkmnpqrstuvwxyz23456789', s = '';
    var r = new Uint8Array(n || 12);
    (window.crypto || window.msCrypto).getRandomValues(r);
    for (var i = 0; i < r.length; i++) s += a[r[i] % a.length];
    return s;
  }

  function generarCodigo() {
    var cfg = C.CODIGO, s = '';
    var r = new Uint8Array(cfg.largo);
    window.crypto.getRandomValues(r);
    for (var i = 0; i < cfg.largo; i++) s += cfg.alfabeto[r[i] % cfg.alfabeto.length];
    return cfg.prefijo + s;
  }

  /* ---------- Cálculo de tiempo y precio ---------- */
  function haversineKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function precioPorMinutos(min) {
    var t = C.TARIFA;
    var p = t.desbloqueo + t.porMinuto * min + t.seguro;
    return Math.ceil(p / t.redondeo) * t.redondeo;
  }

  function redondearPrecio(p) {
    return Math.ceil(p / C.TARIFA.redondeo) * C.TARIFA.redondeo;
  }

  /* punto y destino: objetos de config. Si falta alguna coordenada se usa "Otro". */
  function calcularViaje(punto, destino) {
    var t = C.TARIFA, mono, cam, km = null;
    var ok = punto && destino && !destino.otro &&
      typeof punto.lat === 'number' && typeof destino.lat === 'number';
    if (ok) {
      km = haversineKm(punto, destino) * t.factorGrilla;
      mono = Math.max(t.minMonopatin, Math.ceil(km / t.velMonopatin * 60));
      cam = Math.max(1, Math.round(km / t.velCaminando * 60));
    } else {
      mono = t.otro.monopatin;
      cam = t.otro.caminando;
    }
    return { km: km, minMonopatin: mono, minCaminando: cam, precio: precioPorMinutos(mono) };
  }

  /* ---------- Paradas: autocompletado por palabras clave ----------
     "moreno", "MORENO", "P Moreno" o "pza. moreno" → Plaza Moreno.
     Sin mayúsculas, tildes ni palabras de relleno ("plaza", "facultad de"...). */
  var RELLENO = { plaza: 1, pza: 1, plz: 1, pl: 1, p: 1, estoy: 1, en: 1, la: 1, el: 1, de: 1, del: 1,
    los: 1, las: 1, facultad: 1, fac: 1, facu: 1, frente: 1, a: 1, al: 1 };

  function normalizar(txt) {
    return String(txt || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
      .filter(function (w) { return w && !RELLENO[w]; }).join(' ');
  }

  function puntaje(q, c) {
    if (!q || !c) return 0;
    if (q === c) return 100;
    if ((' ' + q + ' ').indexOf(' ' + c + ' ') >= 0) return 80 + c.length / 100;
    if (q.length >= 3 && c.indexOf(q) === 0) return 60;
    if (q.length >= 3 && (' ' + c).indexOf(' ' + q) >= 0) return 55;
    if (q.length >= 4 && c.indexOf(q) >= 0) return 40;
    return 0;
  }

  /* Devuelve [{parada, puntaje}] ordenado de mejor a peor. */
  function buscarParadas(texto, max) {
    var q = normalizar(texto);
    if (!q) return [];
    return (C.PARADAS || []).map(function (p) {
      var mejor = 0;
      [p.nombre].concat(p.claves || []).forEach(function (c) {
        mejor = Math.max(mejor, puntaje(q, normalizar(c)));
      });
      return { parada: p, puntaje: mejor };
    }).filter(function (r) { return r.puntaje > 0; })
      .sort(function (a, b) { return b.puntaje - a.puntaje; })
      .slice(0, max || 4);
  }

  function pesos(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ---------- WhatsApp argentino ----------
     Acepta: 221 555 1234 · 0221 15 555-1234 · +54 9 221 555 1234 · 11 5555 5555
     Devuelve +549XXXXXXXXXX (10 dígitos: característica + número) o null. */
  function normalizarWhatsapp(txt) {
    var d = String(txt || '').replace(/\D/g, '');
    if (d.indexOf('54') === 0 && d.length >= 12) d = d.slice(2);
    if (d.charAt(0) === '9' && d.length === 11) d = d.slice(1);
    if (d.charAt(0) === '0') d = d.slice(1);
    if (d.length === 12) { // tiene el "15" después de la característica
      var largos = [3, 2, 4];
      for (var i = 0; i < largos.length; i++) {
        if (d.substr(largos[i], 2) === '15') { d = d.slice(0, largos[i]) + d.slice(largos[i] + 2); break; }
      }
    }
    if (d.length !== 10 || !/^[123]/.test(d)) return null;
    return '+549' + d;
  }

  /* ---------- Cola de envíos ----------
     Todo lo que se manda al Apps Script pasa por acá. Los eventos se guardan en
     localStorage hasta que el servidor confirma; si no hay conexión se reintenta
     con espera creciente, al volver la conexión y al reabrir la página. */
  function crearCola(clave) {
    var cola = store.get(clave, []);
    var enviando = false, espera = 2000, timer = null, oyentes = {};

    function guardar() { store.set(clave, cola); }

    function agregar(ev) {
      ev.event_id = ev.event_id || uid(14);
      ev.ts = ev.ts || new Date().toISOString();
      cola.push(ev);
      guardar();
      return ev.event_id;
    }

    function programar() {
      clearTimeout(timer);
      timer = setTimeout(enviar, espera);
      espera = Math.min(espera * 2, 60000);
    }

    function enviar(opciones) {
      if (enviando || !cola.length) return Promise.resolve();
      if (!C.API_URL) { // modo demo: no hay backend
        if (window.console) console.info('[RUVU demo] envío', JSON.parse(JSON.stringify(cola)));
        var lote0 = cola.splice(0, cola.length);
        guardar();
        lote0.forEach(function (ev) { avisar(ev.event_id, { ok: true, demo: true }); });
        return Promise.resolve();
      }
      enviando = true;
      var lote = cola.slice(0, 25);
      return fetch(C.API_URL, {
        method: 'POST',
        // text/plain evita el "preflight" CORS que Apps Script no soporta
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ eventos: lote }),
        keepalive: !!(opciones && opciones.keepalive)
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || 'respuesta inválida');
        var ids = {};
        lote.forEach(function (ev) { ids[ev.event_id] = true; });
        cola = cola.filter(function (ev) { return !ids[ev.event_id]; });
        guardar();
        espera = 2000;
        var resultados = res.resultados || {};
        lote.forEach(function (ev) { avisar(ev.event_id, resultados[ev.event_id] || { ok: true }); });
        enviando = false;
        if (cola.length) return enviar();
      }).catch(function (err) {
        enviando = false;
        lote.forEach(function (ev) { ev.intentos = (ev.intentos || 0) + 1; });
        // descartar eventos que fallan una y otra vez (por ejemplo, datos corruptos)
        cola = cola.filter(function (ev) { return (ev.intentos || 0) < 40; });
        guardar();
        if (window.console) console.warn('[RUVU] sin conexión, reintento', err && err.message);
        programar();
      });
    }

    function avisar(id, res) {
      if (oyentes[id]) { oyentes[id](res); delete oyentes[id]; }
    }

    /* Espera la confirmación de un evento puntual (o null si vence el tiempo). */
    function esperar(id, ms) {
      return new Promise(function (resolve) {
        var t = setTimeout(function () { delete oyentes[id]; resolve(null); }, ms);
        oyentes[id] = function (res) { clearTimeout(t); resolve(res); };
      });
    }

    window.addEventListener('online', function () { espera = 2000; enviar(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') enviar({ keepalive: true });
    });
    setInterval(function () { if (cola.length && !enviando) enviar(); }, 15000);

    return {
      agregar: agregar,
      enviar: enviar,
      esperar: esperar,
      pendientes: function () { return cola.length; }
    };
  }

  /* ---------- JSONP para leer del Apps Script (doGet) ---------- */
  /* Lectura de datos para el panel. Primero con fetch SIN cookies: así anda aunque
     el navegador tenga varias cuentas de Google abiertas (con JSONP fallaba).
     El Apps Script puede tardar 20-40 s en calcular el resumen: esperamos hasta 60 s. */
  function jsonp(params, ms) {
    ms = ms || 60000;
    var q = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var url = C.API_URL + (C.API_URL.indexOf('?') >= 0 ? '&' : '?') + q;
    if (!window.fetch) return jsonpScript(params, ms);
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, { credentials: 'omit', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(t); return r.json(); })
      .catch(function (err) {
        clearTimeout(t);
        if (err && err.name === 'AbortError') throw new Error('tiempo agotado');
        return jsonpScript(params, ms); // plan B: el método viejo
      });
  }

  function jsonpScript(params, ms) {
    return new Promise(function (resolve, reject) {
      var cb = 'ruvu_cb_' + uid(8);
      var s = document.createElement('script');
      var t = setTimeout(function () { limpiar(); reject(new Error('tiempo agotado')); }, ms || 60000);
      function limpiar() { clearTimeout(t); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function (data) { limpiar(); resolve(data); };
      var q = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      s.src = C.API_URL + (C.API_URL.indexOf('?') >= 0 ? '&' : '?') + q + '&callback=' + cb;
      s.onerror = function () { limpiar(); reject(new Error('no se pudo conectar')); };
      document.head.appendChild(s);
    });
  }

  /* ---------- PIN del equipo (contador y panel) ---------- */
  function pedirPin(alOk) {
    if (store.get('ruvu_pin_ok') === C.PIN) { alOk(); return; }
    var caja = document.getElementById('pin');
    var form = caja.querySelector('form');
    var input = caja.querySelector('input');
    var err = caja.querySelector('.pin-error');
    caja.hidden = false;
    input.focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value.trim() === String(C.PIN)) {
        store.set('ruvu_pin_ok', C.PIN);
        caja.hidden = true;
        alOk();
      } else {
        err.hidden = false;
        input.value = '';
        input.focus();
      }
    });
  }

  window.RUVU = {
    C: C,
    store: store,
    uid: uid,
    generarCodigo: generarCodigo,
    calcularViaje: calcularViaje,
    haversineKm: haversineKm,
    buscarParadas: buscarParadas,
    normalizar: normalizar,
    precioPorMinutos: precioPorMinutos,
    redondearPrecio: redondearPrecio,
    pesos: pesos,
    normalizarWhatsapp: normalizarWhatsapp,
    crearCola: crearCola,
    jsonp: jsonp,
    pedirPin: pedirPin
  };
})();
