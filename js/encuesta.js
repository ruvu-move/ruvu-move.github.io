/* RUVU · flujo de la encuesta v2 (una pregunta por pantalla).
   - La sesión en curso se guarda en localStorage ("ruvu_sesion") para poder
     retomarla si la persona se va y vuelve a escanear.
   - Quien ya terminó ("ruvu_participacion", la misma clave de siempre) ve su
     código y puede responder por otro trayecto sin generar otro código.
   - ?test=1 marca la sesión como prueba (el panel la excluye). */
(function () {
  var R = window.RUVU, C = R.C;
  var $pantalla = document.getElementById('pantalla');
  var $barra = document.getElementById('barra');
  var $progreso = document.getElementById('progreso');
  var $volver = document.getElementById('volver');
  var $falta = document.getElementById('falta');

  /* ---------- Contexto ---------- */
  var params = new URLSearchParams(location.search);
  var slug = (params.get('p') || '').toLowerCase().trim();
  var puntoQr = C.PUNTOS.filter(function (p) { return p.slug === slug; })[0] || null;
  var puntoSlug = puntoQr ? puntoQr.slug : 'sin-punto';
  var esTest = params.get('test') === '1';
  var ref = (params.get('ref') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
  var participacion = R.store.get('ruvu_participacion', null);
  if (participacion && ref === participacion.codigo) ref = ''; // se escaneó su propio link

  var VERSION = 'v2.1';
  var CLAVE_SESION = 'ruvu_sesion';
  var DIAS_PARA_RETOMAR = 3;
  var cola = R.crearCola('ruvu_cola');

  var S = null;      // sesión en curso: { session_id, r, paso, historial, test, repetido, ... }
  var r = {};        // respuestas de esta sesión (S.r)
  var historial = []; // pantallas visitadas, para "Volver"

  function nuevaSesion(op) {
    op = op || {};
    S = {
      v: 2, session_id: R.uid(16), r: {}, paso: null, historial: [],
      // repetido: el celular ya participó (tiene "ruvu_participacion"), desde el primer evento
      test: esTest, repetido: !!op.repetido || !!participacion, ref: ref, punto: puntoSlug,
      empezo: false, otroTrayecto: false, ts: new Date().toISOString()
    };
    r = S.r;
    historial = S.historial;
    var datos = { version: VERSION, timestamp_scan: new Date().toISOString() };
    if (S.test) datos.test = 'si';
    if (S.repetido) datos.repetido = 'si';
    if (op.ultimo_paso) datos.ultimo_paso = op.ultimo_paso;
    enviarEvento('scan', datos);
  }

  /* El primer toque en una respuesta marca el inicio (el servidor pone la hora). */
  function conInicio(campos) {
    if (!S.empezo) { S.empezo = true; campos.timestamp_inicio = new Date().toISOString(); }
    return campos;
  }

  function guardarSesion() {
    if (!S || !S.empezo) return; // sin tocar nada no hay nada que retomar
    S.ts = new Date().toISOString();
    R.store.set(CLAVE_SESION, S);
  }

  function enviarEvento(tipo, datos) {
    var id = cola.agregar({
      tipo: tipo,
      session_id: S.session_id,
      punto: S.punto,
      ref: S.ref,
      ua: navigator.userAgent.slice(0, 250),
      datos: datos || {}
    });
    cola.enviar();
    return id;
  }

  /* Manda SOLO los campos de la pantalla actual (nunca valores vacíos de otras)
     y deja asentado en qué pantalla quedó la persona. */
  function guardar(campos, siguiente) {
    for (var k in campos) r[k] = campos[k];
    var datos = {};
    for (var j in campos) datos[j] = campos[j];
    datos.ultimo_paso = siguiente;
    return enviarEvento('respuesta', datos);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function logo(clase) {
    return '<span class="logo ' + (clase || '') + '" data-logo>RUVU<span class="punto-logo">.</span></span>';
  }
  /* Si existe assets/logo-ruvu.svg se usa; si no, queda el wordmark de texto. */
  var logoImg = null;
  (function () {
    var img = new Image();
    img.onload = function () { logoImg = 'assets/logo-ruvu.svg'; aplicarLogo(); };
    img.src = 'assets/logo-ruvu.svg';
  })();
  function aplicarLogo() {
    if (!logoImg) return;
    [].forEach.call(document.querySelectorAll('[data-logo]'), function (el) {
      el.innerHTML = '<img src="' + logoImg + '" alt="RUVU">';
    });
  }

  /* Búho RUVU (mascota) animado. Con texto aparece con un globo; sin texto,
     grande y centrado (pantallas finales). */
  function buho(texto) {
    var img = '<picture><source srcset="assets/buho.webp" type="image/webp">' +
      '<img src="assets/buho.gif" alt="Búho RUVU" width="300" height="390" decoding="async"></picture>';
    if (!texto) return '<div class="buho buho-grande">' + img + '</div>';
    return '<div class="buho">' + img + '<p class="globo">' + texto + '</p></div>';
  }
  (function () { var i = new Image(); i.src = 'assets/buho.webp'; })();

  /* Búho RUVU que llega en monopatín (pantallas finales). */
  function buhoMonopatin() {
    var ruedaRayos = function (cx) {
      return '<g class="rueda"><circle cx="' + cx + '" cy="92" r="15" fill="#0B0B0B" stroke="#12E39A" stroke-width="4"/>' +
        '<path d="M' + (cx - 11) + ' 92H' + (cx + 11) + 'M' + cx + ' 81V103" stroke="#FF3D9A" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="' + cx + '" cy="92" r="3" fill="#FF3D9A"/></g>';
    };
    var moto = '<svg class="moto" viewBox="0 0 200 110" aria-hidden="true">' +
      '<path class="estela" d="M-40 60H-8M-52 74H-14M-36 88H-6" stroke="#12E39A" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M150 82L162 10" stroke="#F4F4F4" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M162 10L170 92" stroke="#F4F4F4" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M146 9H176" stroke="#0B0B0B" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M146 9H153M169 9H176" stroke="#FF3D9A" stroke-width="8" stroke-linecap="round"/>' +
      '<rect x="22" y="76" width="134" height="11" rx="5.5" fill="#12E39A"/>' +
      '<path d="M30 81L22 92" stroke="#F4F4F4" stroke-width="5" stroke-linecap="round"/>' +
      '<text x="88" y="85" text-anchor="middle" font-family="Unbounded, Arial, sans-serif" font-weight="900" font-size="8" fill="#0B0B0B">RUVU</text>' +
      ruedaRayos(26) + ruedaRayos(170) + '</svg>';
    return '<div class="buho-moto" role="img" aria-label="El búho RUVU llega en monopatín">' +
      '<picture><source srcset="assets/buho.webp" type="image/webp">' +
      '<img src="assets/buho.gif" alt="" width="300" height="390" decoding="async"></picture>' + moto + '</div>';
  }
  /* Trama platense: cuadrícula de La Plata con diagonales y plaza central */
  function trama() {
    return '<svg class="trama" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path d="M50 0V600M100 0V600M150 0V600M200 0V600M250 0V600M300 0V600M350 0V600M400 0V600M450 0V600M500 0V600M550 0V600M0 50H600M0 100H600M0 150H600M0 200H600M0 250H600M0 300H600M0 350H600M0 400H600M0 450H600M0 500H600M0 550H600" stroke="#6B2BD9" stroke-width="2"/>' +
      '<path d="M0 0L600 600M600 0L0 600M300 0L600 300L300 600L0 300Z" fill="none" stroke="#12E39A" stroke-width="7"/>' +
      '<circle cx="300" cy="300" r="24" fill="#FF3D9A"/></svg>';
  }

  function opciones(lista, clase) {
    return '<div class="opciones' + (clase ? ' ' + clase : '') + '">' + lista.map(function (o) {
      return '<button type="button" class="btn btn-opcion" data-v="' + esc(o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function paradaPorId(id) {
    return (C.PARADAS || []).filter(function (p) { return p.id === id; })[0] || null;
  }
  function destinoPorId(id) {
    return C.DESTINOS.filter(function (d) { return d.id === id; })[0] || null;
  }
  /* Desde dónde se calculan minutos y precio: la parada elegida (si no es "Otra"). */
  function origen() {
    var p = r.parada && r.parada !== 'otra' ? paradaPorId(r.parada) : null;
    return p && typeof p.lat === 'number' ? p : null;
  }

  /* ¿Ya dejó su número (en esta o en una participación anterior)? */
  function tieneNumero() {
    if (r.whatsapp) return true;
    if (!participacion) return false;
    if (typeof participacion.whatsapp === 'boolean') return participacion.whatsapp;
    return !!participacion.codigo; // en la versión vieja solo había código si dejaban el número
  }

  function marcarParticipacion(datos) {
    participacion = {
      codigo: datos.codigo || null, whatsapp: !!datos.whatsapp, menor: !!datos.menor,
      session_id: S.session_id, ts: new Date().toISOString()
    };
    R.store.set('ruvu_participacion', participacion);
  }

  /* ---------- Barra de progreso hacia el viaje gratis ----------
     Cuenta las preguntas del recorrido de cada persona (9, u 8 si dijo "No" y
     saltea el precio; en "otro trayecto" no van ¿Dónde estás? ni la edad). Las condicionales (cuadras, motivo del No) no
     suman. Debajo de la barra dice cuántas faltan para el viaje gratis. */
  var CONTADAS = ['parada', 'destino', 'modo', 'frecuencia', 'motivo', 'usaria', 'precio', 'primer_viaje', 'edad'];
  var DESPUES_DE = { cuadras: 'destino', motivo_no: 'usaria' }; // condicionales: van después de esta
  function recorrido() {
    return CONTADAS.filter(function (id) {
      if (id === 'precio' && r.usaria === 'no') return false;
      if (S.otroTrayecto && (id === 'parada' || id === 'edad')) return false;
      return true;
    });
  }
  /* { pct, faltan } o null si la pantalla no lleva barra */
  function progreso(id) {
    var lista = recorrido();
    if (id === 'whatsapp') return { pct: 1, faltan: 0 };
    var i = lista.indexOf(id), condicional = DESPUES_DE[id];
    if (condicional) i = lista.indexOf(condicional) + 1;   // ya respondió la anterior
    else if (i < 0) return null;
    var faltan = lista.length - i + (condicional ? 1 : 0);  // incluye la pantalla actual
    return { pct: Math.max(0.04, i / lista.length), faltan: faltan };
  }
  function textoFalta(faltan) {
    if (faltan === 0) return '¡Llegaste a tu <b>viaje gratis</b>!';
    if (faltan === 1) return '¡Última pregunta!';
    return 'Te faltan ' + faltan + ' para tu <b>viaje gratis</b>';
  }

  /* ---------- Definición de pantallas ----------
     html(): contenido. elegir(v): qué hacer al tocar una opción (una sola).
     campo: dónde queda la respuesta (para marcarla al volver atrás). */
  var P = {};

  /* Encabezado corto arriba de la primera pregunta (reemplaza la bienvenida). */
  function encabezado() {
    var n = CONTADAS.length;
    if (ref) {
      return '<header class="encabezado"><p class="enc-titulo">Te invitaron a RUVU 🛴</p>' +
        '<p class="enc-sub">Respondé ' + n + ' preguntas y tenés tu primer viaje gratis.</p></header>';
    }
    return '<header class="encabezado"><p class="enc-titulo">RUVU llega a La Plata 🛴</p>' +
      '<p class="enc-sub">Todavía no anda: respondé ' + n + ' preguntas y te regalamos tu primer viaje.</p></header>';
  }

  /* 1. ¿Dónde estás? Es lo primero que se ve. Botones con los lugares; "Otra" abre
     un campo obligatorio (mínimo 3 letras). Hasta que toque algo, ultimo_paso = inicio. */
  var MIN_OTRA = 3;
  P.parada = {
    html: function () {
      var lista = (C.DONDE_ESTAS || []).map(paradaPorId).filter(Boolean).map(function (p) {
        return [p.id, esc(p.nombre)];
      });
      lista.push(['otra', 'Otra']);
      return encabezado() + '<h2>¿Dónde estás?</h2>' + opciones(lista, 'dos') +
        '<form id="form-otra" class="otra-parada" novalidate autocomplete="off" hidden>' +
        '<div class="campo"><label for="parada-otra">¿Dónde?</label>' +
        '<input id="parada-otra" type="text" enterkeyhint="next" maxlength="60" placeholder="Ej: 7 y 50, Plaza Rocha" required>' +
        '<p class="error" id="err-otra" hidden>Contanos dónde estás para calcular tu viaje</p></div>' +
        '<button type="submit" class="btn btn-verde" id="siguiente-otra" disabled>Siguiente</button></form>';
    },
    montar: function () {
      var botones = [].slice.call($pantalla.querySelectorAll('.btn-opcion'));
      var form = document.getElementById('form-otra');
      var input = document.getElementById('parada-otra');
      var listo = false;
      var btnOtra = document.getElementById('siguiente-otra');
      var errOtra = document.getElementById('err-otra');
      function textoOtra() { return input.value.trim().replace(/\s+/g, ' '); }
      function revisar() {
        var ok = textoOtra().length >= MIN_OTRA;
        btnOtra.disabled = !ok;
        errOtra.hidden = ok;   // el mensaje queda a la vista mientras falte el texto
      }
      input.addEventListener('input', revisar);
      function marcar(b) {
        botones.forEach(function (o) {
          o.classList.toggle('elegida', o === b);
          o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
        });
      }
      botones.forEach(function (b) {
        b.addEventListener('click', function () {
          if (listo) return;
          var v = b.getAttribute('data-v');
          marcar(b);
          if (v === 'otra') {
            if (!S.empezo) guardar(conInicio({}), 'parada'); // el primer toque ya cuenta como "empezó"
            form.hidden = false;
            revisar();
            input.focus({ preventScroll: true });
            form.scrollIntoView({ block: 'end', behavior: 'smooth' });
            return;
          }
          form.hidden = true;
          listo = true;
          botones.forEach(function (o) { o.disabled = o !== b; });
          setTimeout(function () { guardar(conInicio({ parada: v, parada_texto: '' }), 'destino'); ir('destino'); }, 140);
        });
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (listo) return;
        var t = textoOtra();
        if (t.length < MIN_OTRA) { revisar(); input.focus(); return; } // obligatorio
        listo = true;
        guardar(conInicio({ parada: 'otra', parada_texto: t.slice(0, 60) }), 'destino');
        ir('destino');
      });
      // al volver atrás: queda marcado lo que había elegido
      if (r.parada === 'otra') {
        marcar(botones[botones.length - 1]);
        form.hidden = false;
        input.value = r.parada_texto || '';
        revisar();
      } else if (r.parada) {
        marcar(botones.filter(function (b) { return b.getAttribute('data-v') === r.parada; })[0]);
      }
    }
  };

  /* 2. ¿A dónde vas? En "otro trayecto" es la primera pantalla. */
  P.destino = {
    campo: 'destino',
    html: function () {
      var o = origen();
      var lista = C.DESTINOS.filter(function (d) {
        // no ofrecer como destino el mismo lugar donde está (a menos de 300 m)
        return !(o && typeof d.lat === 'number' && R.haversineKm(o, d) < 0.3);
      }).map(function (d) { return [d.id, esc(d.nombre)]; });
      return (S.otroTrayecto ? '<p class="chica otro-tray">Otro trayecto</p>' : '') + '<h2>¿A dónde vas?</h2>' + opciones(lista);
    },
    elegir: function (v) {
      var viaje = R.calcularViaje(origen(), destinoPorId(v));
      var campos = conInicio({ destino: v });
      if (!viaje) {
        // sin coordenadas: los minutos se calculan con las cuadras (pantalla siguiente)
        campos.min_monopatin = ''; campos.min_caminando = ''; campos.precio_mostrado = '';
        r.min_monopatin = null;
        guardar(campos, 'cuadras'); ir('cuadras'); return;
      }
      campos.min_monopatin = viaje.minMonopatin; campos.min_caminando = viaje.minCaminando;
      campos.precio_mostrado = viaje.precio; campos.cuadras_estimadas = '';
      guardar(campos, 'modo');
      ir('modo');
    }
  };

  /* 2b. Solo si no hay coordenadas (parada "Otra" o destino "Otro"). */
  P.cuadras = {
    campo: 'cuadras_estimadas',
    html: function () {
      var ops = C.CUADRAS_OPCIONES;
      var lista = ops.map(function (n, i) {
        return i === ops.length - 1 ? [n + '+', n + ' o más'] : [String(n), n + ' cuadras'];
      });
      return '<h2>¿Más o menos cuántas cuadras son?</h2>' +
        '<p class="sub">Desde donde estás hasta donde vas.</p>' + opciones(lista);
    },
    elegir: function (v) {
      var viaje = R.calcularViajeCuadras(parseInt(v, 10));
      guardar({
        cuadras_estimadas: v, min_monopatin: viaje.minMonopatin, min_caminando: viaje.minCaminando, precio_mostrado: viaje.precio
      }, 'modo');
      ir('modo');
    }
  };

  /* 3. ¿Cómo ibas a ir? */
  P.modo = {
    campo: 'modo_actual',
    html: function () {
      return '<h2>¿Cómo ibas a ir?</h2>' + opciones([
        ['caminando', 'Caminando'], ['micro', 'Micro'], ['bici', 'Bici'],
        ['uber_remis', 'Uber o remis'], ['auto', 'Auto'], ['moto', 'Moto']
      ]);
    },
    elegir: function (v) { guardar({ modo_actual: v }, 'frecuencia'); ir('frecuencia'); }
  };

  /* 4. ¿Cuántas veces por semana? */
  P.frecuencia = {
    campo: 'frecuencia',
    html: function () {
      return '<h2>¿Cuántas veces por semana hacés este trayecto?</h2>' + opciones([
        ['1_o_menos', '1 o menos'], ['2-3', '2 a 3'], ['4_o_mas', '4 o más'], ['todos_los_dias', 'Todos los días']
      ]);
    },
    elegir: function (v) { guardar({ frecuencia: v }, 'motivo'); ir('motivo'); }
  };

  /* 5. ¿Para qué es este viaje? (antes era bonus) */
  P.motivo = {
    campo: 'motivo_viaje',
    html: function () {
      return '<h2>¿Para qué es este viaje?</h2>' + opciones([
        ['facu', 'Facu'], ['laburo', 'Laburo'], ['tramite_compras', 'Trámite o compras'], ['juntada_paseo', 'Juntada o paseo']
      ]);
    },
    elegir: function (v) { guardar({ motivo_viaje: v }, 'usaria'); ir('usaria'); }
  };

  /* 6. ¿Lo usarías? Si cambia la respuesta al volver atrás, se borra la que ya no corresponde. */
  P.usaria = {
    campo: 'usaria',
    html: function () {
      return '<div class="comparar">' +
        '<div><b class="verde">' + r.min_monopatin + ' min</b><span>con RUVU</span></div>' +
        '<div><b>' + r.min_caminando + ' min</b><span>caminando</span></div></div>' +
        '<h2>¿Lo usarías en vez de caminar?</h2>' +
        opciones([['si', 'Sí, de una'], ['depende', 'Depende del precio'], ['no', 'No']]);
    },
    elegir: function (v) {
      if (v === 'no') { guardar({ usaria: v, precio_max_v2: '' }, 'motivo_no'); ir('motivo_no'); }
      else { guardar({ usaria: v, motivo_no: '' }, 'precio'); ir('precio'); }
    }
  };

  P.motivo_no = {
    campo: 'motivo_no',
    html: function () {
      return '<h2>¿Por qué no?</h2>' + opciones([
        ['prefiero_caminar', 'Prefiero caminar'], ['inseguro', 'No me siento seguro/a'],
        ['no_se_andar', 'No sé andar'], ['clima', 'Por el clima'], ['otra', 'Otra']
      ]);
    },
    elegir: function (v) { guardar({ motivo_no: v }, 'primer_viaje'); ir('primer_viaje'); }
  };

  /* 7. Precio máximo (si respondió "No" en la 6, no se muestra). */
  P.precio = {
    campo: 'precio_max_v2',
    html: function () {
      var ops = C.PRECIOS_MAX_V2;
      var lista = ops.map(function (n, i) {
        return i === ops.length - 1 ? [n + '+', R.pesos(n) + ' o más'] : [String(n), R.pesos(n)];
      });
      lista.push(['no', 'No lo pagaría']);
      return '<h2>¿Cuánto pagarías como máximo por este viaje de ' + r.min_monopatin + ' min?</h2>' + opciones(lista);
    },
    elegir: function (v) { guardar({ precio_max_v2: v }, 'primer_viaje'); ir('primer_viaje'); }
  };

  /* 8. Día y franja del primer viaje: las dos obligatorias; "Siguiente" se habilita con las dos. */
  P.primer_viaje = {
    html: function () {
      var dias = [['lun', 'Lun'], ['mar', 'Mar'], ['mie', 'Mié'], ['jue', 'Jue'], ['vie', 'Vie'], ['sab', 'Sáb'], ['dom', 'Dom']];
      var franjas = ['7-10', '10-13', '13-16', '16-19', '19-21'];
      function chips(grupo, lista, clase) {
        return '<div class="chips ' + (clase || '') + '" data-grupo="' + grupo + '" role="group">' + lista.map(function (o) {
          var on = r[grupo] === o[0];
          return '<button type="button" class="chip" aria-pressed="' + on + '" data-v="' + o[0] + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      }
      return '<h2>¿Qué día y horario de la primera semana lo usarías?</h2>' +
        '<p class="etiqueta">Día</p>' + chips('dia_primer_viaje', dias) +
        '<p class="etiqueta">Horario</p>' +
        chips('franja_primer_viaje', franjas.map(function (f) { return [f, f.replace('-', '–') + ' h']; }), 'cinco') +
        '<div class="abajo"><button type="button" class="btn btn-verde" id="siguiente-pv" disabled>Siguiente</button></div>';
    },
    montar: function () {
      var sel = { dia_primer_viaje: r.dia_primer_viaje, franja_primer_viaje: r.franja_primer_viaje };
      var btn = document.getElementById('siguiente-pv');
      function revisar() { btn.disabled = !(sel.dia_primer_viaje && sel.franja_primer_viaje); }
      [].forEach.call($pantalla.querySelectorAll('.chips'), function (g) {
        g.addEventListener('click', function (e) {
          var b = e.target.closest('.chip');
          if (!b) return;
          var grupo = g.getAttribute('data-grupo');
          sel[grupo] = b.getAttribute('data-v'); // una por grupo; tocar otra la cambia
          [].forEach.call(g.querySelectorAll('.chip'), function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
          revisar();
        });
      });
      revisar();
      var listo = false;
      btn.onclick = function () {
        if (listo || btn.disabled) return;
        listo = true;
        btn.disabled = true;
        var campos = { dia_primer_viaje: sel.dia_primer_viaje, franja_primer_viaje: sel.franja_primer_viaje };
        if (S.otroTrayecto) { entregarCodigo(campos); return; } // ya tenemos edad y WhatsApp
        guardar(campos, 'edad');
        ir('edad');
      };
    }
  };

  /* 9. Edad. Menos de 18 corta acá, sin código. */
  P.edad = {
    campo: 'edad',
    html: function () {
      return buho('¡Ya casi! 🎁') +
        '<h2>¿Qué edad tenés?</h2>' + opciones([
          ['menos_18', 'Menos de 18'], ['18-24', '18 a 24'], ['25-34', '25 a 34'], ['35-44', '35 a 44'], ['45+', '45 o más']
        ]);
    },
    elegir: function (v) {
      if (v === 'menos_18') {
        guardar({ edad: v, completo: 'si', timestamp_fin: new Date().toISOString() }, 'fin_menor');
        marcarParticipacion({ menor: true });
        ir('fin_menor', { sinVolver: true });
      } else {
        guardar({ edad: v }, 'whatsapp');
        ir('whatsapp');
      }
    }
  };

  /* 10. WhatsApp. El consentimiento aparece (y es obligatorio) solo si escribió un número.
     S.agregarNumero: vino desde la pantalla del código con "Mejor quiero dejar mi número". */
  P.whatsapp = {
    html: function () {
      return '<h2>¿A qué número te mandamos tu viaje gratis?</h2>' +
        '<p class="sub">Solo para activar tu código y avisarte cuando arranquemos. Sin spam.</p>' +
        '<form id="form-wa" novalidate>' +
        '<div class="campo" id="campo-wa"><label for="wa">Tu WhatsApp</label>' +
        '<input id="wa" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="221 555 1234" maxlength="20">' +
        '<p class="error" id="err-wa" hidden></p></div>' +
        '<div id="caja-consent" hidden><label class="check"><input type="checkbox" id="consent">' +
        '<span>Acepto que RUVU me contacte por WhatsApp y guarde mis respuestas para mejorar el servicio (Ley 25.326). ' +
        '<a href="privacidad.html" target="_blank" rel="noopener">Ver política de privacidad</a></span></label>' +
        '<p class="error" id="err-consent" hidden>Para activar tu viaje con tu número tenés que aceptar.</p></div>' +
        '<div class="abajo botones-wa"><button type="submit" class="btn btn-verde" id="enviar-wa">Activar mi viaje</button>' +
        '<button type="button" class="btn btn-secundario" id="no-wa">Seguir sin dejar mi número</button></div></form>';
    },
    montar: function () {
      var form = document.getElementById('form-wa');
      var input = document.getElementById('wa');
      var consent = document.getElementById('consent');
      var cajaConsent = document.getElementById('caja-consent');
      var errWa = document.getElementById('err-wa');
      function errorWa(msg) {
        document.getElementById('campo-wa').classList.toggle('con-error', !!msg);
        errWa.textContent = msg || '';
        errWa.hidden = !msg;
      }
      input.addEventListener('input', function () {
        errorWa('');
        cajaConsent.hidden = !/\d/.test(input.value);
      });
      consent.addEventListener('change', function () { document.getElementById('err-consent').hidden = true; });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!/\d/.test(input.value)) {
          errorWa('Escribí tu número o tocá "Seguir sin dejar mi número".');
          return;
        }
        var numero = R.normalizarWhatsapp(input.value);
        var ok = true;
        if (!numero) { errorWa('Revisá el número: característica + número, por ejemplo 221 555 1234.'); ok = false; }
        if (!consent.checked) { document.getElementById('err-consent').hidden = false; ok = false; }
        if (!ok) return; // nunca se borra lo que escribió
        bloquear('Activando tu viaje…');
        if (S.agregarNumero) {
          guardar({ whatsapp: numero, consentimiento: 'si' }, 'codigo');
          S.agregarNumero = false;
          marcarParticipacion({ codigo: r.codigo, whatsapp: true });
          ir('codigo', { sinVolver: true });
        } else {
          entregarCodigo({ whatsapp: numero, consentimiento: 'si' });
        }
      });
      document.getElementById('no-wa').onclick = function () {
        if (S.agregarNumero) { S.agregarNumero = false; ir('codigo', { sinVolver: true }); return; }
        bloquear();
        entregarCodigo({});
      };
      function bloquear(texto) {
        var b = document.getElementById('enviar-wa');
        b.disabled = true;
        document.getElementById('no-wa').disabled = true;
        if (texto) b.textContent = texto;
      }
    }
  };

  /* Código para todos los mayores de 18 (con o sin número). Si ya tenía uno
     (otro trayecto), se usa el mismo. El servidor verifica que no esté repetido. */
  function entregarCodigo(extra) {
    var codigo = (participacion && participacion.codigo) || r.codigo || R.generarCodigo();
    var campos = { codigo: codigo, completo: 'si', timestamp_fin: new Date().toISOString() };
    for (var k in extra) campos[k] = extra[k];
    var id = guardar(campos, 'codigo');
    cola.esperar(id, 5000).then(function (res) {
      if (res && res.codigo) codigo = res.codigo;
      r.codigo = codigo;
      marcarParticipacion({ codigo: codigo, whatsapp: !!extra.whatsapp || tieneNumero() });
      ir('codigo', { sinVolver: true });
    });
  }

  function linkInvitacion(codigo) {
    var base = location.origin + location.pathname.replace(/index\.html$/, '');
    return base + '?p=' + encodeURIComponent(puntoSlug) + '&ref=' + encodeURIComponent(codigo);
  }

  function botonInvitar(codigo) {
    var msg = C.MENSAJE_INVITACION.replace('{link}', linkInvitacion(codigo));
    return '<div class="compartir"><p>¿Sabés de alguien que también quiere llegar más rápido?</p>' +
      '<a class="btn btn-verde" id="invitar" target="_blank" rel="noopener" href="https://wa.me/?text=' +
      encodeURIComponent(msg) + '">Compartile</a></div>';
  }

  function montarInvitar() {
    var a = document.getElementById('invitar');
    if (a) a.addEventListener('click', function () { enviarEvento('invitacion', { invito_amigo: 'si' }); });
  }

  /* El código como ticket: etiqueta, código y validez en una sola tarjeta. */
  function cajaCodigo(codigo) {
    return '<div class="ticket"><span class="ticket-label">🎁 Tu viaje gratis</span>' +
      '<div class="codigo" id="codigo">' + esc(codigo) + '</div>' +
      '<span class="ticket-sub">1 viaje de hasta 10 min en el lanzamiento</span></div>';
  }
  function notaCodigo(conNumero) {
    return conNumero
      ? '<p class="nota-codigo">📲 Te lo mandamos por WhatsApp</p>'
      : '<p class="nota-codigo">📸 Sacale captura para no perderlo</p>';
  }

  /* 11. Pantalla del código (completo = si se marca al llegar acá): código, captura o
     WhatsApp, e invitar. Ya no hay preguntas abajo. */
  P.codigo = {
    clase: 'final',
    html: function () {
      var conNumero = tieneNumero();
      // se ganó el viaje: el búho llega en monopatín
      return buhoMonopatin() + '<h1>¡Listo!</h1>' + cajaCodigo(r.codigo) + notaCodigo(conNumero) +
        botonInvitar(r.codigo) +
        (conNumero ? '' : '<button type="button" class="btn-link" id="dejar-numero">Mejor quiero dejar mi número</button>');
    },
    montar: function () {
      montarInvitar();
      var d = document.getElementById('dejar-numero');
      if (d) d.onclick = function () { S.agregarNumero = true; ir('whatsapp'); };
    }
  };

  P.fin_menor = {
    clase: 'final',
    html: function () {
      return buho() + '<h1>¡Gracias!</h1>' +
        '<p class="sub">RUVU es para mayores de 18. ¡Gracias por la buena onda!</p>';
    }
  };

  /* Ya terminó antes: ve su código y puede responder por otro trayecto. */
  P.ya_tiene_codigo = {
    clase: 'final',
    html: function () {
      if (participacion.menor) {
        return buho() + '<h1>¡Gracias!</h1><p class="sub">RUVU es para mayores de 18. ¡Gracias por la buena onda!</p>';
      }
      var otro = '<button type="button" class="btn btn-secundario" id="otro-trayecto">Responder por otro trayecto</button>';
      if (!participacion.codigo) {
        return buho() + '<h1>Ya respondiste 🙌</h1>' +
          '<p class="sub">Contanos otro trayecto y llevate tu viaje gratis.</p>' +
          '<div class="abajo">' + otro + '</div>';
      }
      return buho() + '<h1>¡Ya participaste!</h1>' + cajaCodigo(participacion.codigo) +
        notaCodigo(tieneNumero()) + botonInvitar(participacion.codigo) + '<div class="abajo">' + otro + '</div>';
    },
    montar: function () {
      montarInvitar();
      var b = document.getElementById('otro-trayecto');
      if (b) b.onclick = function () {
        // reutiliza la sesión de este escaneo (ya marcada repetido = si) y arranca en el destino
        S.otroTrayecto = true;
        S.repetido = true;
        guardar(conInicio({}), 'destino');
        ir('destino', { sinVolver: true });
      };
    }
  };

  /* Pantallas donde la sesión ya no se retoma (terminó o es solo informativa). */
  var NO_RETOMAR = { inicio: 1, codigo: 1, bonus: 1, fin_bonus: 1, fin_menor: 1, ya_tiene_codigo: 1 };

  /* Primera pregunta sin responder, en el orden actual (para retomar). */
  function primeraSinResponder() {
    if (!S.otroTrayecto && !r.parada) return 'parada';
    if (!r.destino) return 'destino';
    if (!r.min_monopatin) return 'cuadras';
    if (!r.modo_actual) return 'modo';
    if (!r.frecuencia) return 'frecuencia';
    if (!r.motivo_viaje) return 'motivo';
    if (!r.usaria) return 'usaria';
    if (r.usaria === 'no' && !r.motivo_no) return 'motivo_no';
    if (r.usaria !== 'no' && !r.precio_max_v2) return 'precio';
    if (!r.dia_primer_viaje || !r.franja_primer_viaje) return 'primer_viaje';
    if (S.otroTrayecto) return 'primer_viaje';
    if (!r.edad) return 'edad';
    return 'whatsapp';
  }
  /* Pantallas ya respondidas antes de "hasta", en orden (para "Volver" al retomar). */
  function caminoHasta(hasta) {
    var orden = [];
    if (!S.otroTrayecto) orden.push('parada');
    orden.push('destino');
    if (r.cuadras_estimadas) orden.push('cuadras');
    orden.push('modo', 'frecuencia', 'motivo', 'usaria', r.usaria === 'no' ? 'motivo_no' : 'precio', 'primer_viaje');
    if (!S.otroTrayecto) orden.push('edad');
    var i = orden.indexOf(hasta);
    return i < 0 ? orden : orden.slice(0, i);
  }

  /* ---------- Navegación ---------- */
  var actual = null;
  function ir(id, op) {
    op = op || {};
    if (actual && !op.atras && !op.retomando) historial.push(actual);
    if (op.sinVolver) historial.length = 0;
    actual = id;
    S.paso = id;
    if (NO_RETOMAR[id]) R.store.del(CLAVE_SESION);
    else guardarSesion();

    var def = P[id];
    $pantalla.className = 'pantalla ' + (def.clase || '') + (op.atras ? ' entra-atras' : ' entra');
    $pantalla.setAttribute('data-pantalla', id);
    var html = def.html();
    if (op.retomando) {
      html = '<div class="retomar"><span>Seguí donde dejaste</span>' +
        '<button type="button" class="btn-link" id="de-nuevo">Empezar de nuevo</button></div>' + html;
    }
    $pantalla.innerHTML = html;
    aplicarLogo();
    var pr = progreso(id);
    $barra.hidden = pr === null;
    if (pr !== null) {
      $progreso.style.width = Math.round(pr.pct * 100) + '%';
      $progreso.parentNode.setAttribute('aria-valuenow', Math.round(pr.pct * 100));
      $falta.innerHTML = textoFalta(pr.faltan);
      $barra.classList.toggle('llego', pr.faltan === 0);
      $volver.hidden = !historial.length;
    }
    if (def.campo && r[def.campo]) { // al volver atrás se ve lo que había elegido
      [].forEach.call($pantalla.querySelectorAll('.btn-opcion'), function (b) {
        if (b.getAttribute('data-v') === String(r[def.campo])) { b.classList.add('elegida'); b.setAttribute('aria-pressed', 'true'); }
      });
    }
    if (def.elegir) {
      var respondida = false;
      $pantalla.querySelectorAll('.btn-opcion').forEach(function (b) {
        b.addEventListener('click', function () {
          if (respondida) return;
          respondida = true;
          $pantalla.querySelectorAll('.btn-opcion').forEach(function (o) {
            o.disabled = o !== b;
            o.classList.remove('elegida');
            o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
          });
          b.classList.add('elegida');
          var v = b.getAttribute('data-v');
          setTimeout(function () { def.elegir(v); }, 140);
        });
      });
    }
    if (def.montar) def.montar();
    var dn = document.getElementById('de-nuevo');
    if (dn) dn.onclick = function () {
      R.store.del(CLAVE_SESION);
      var eraRepetido = S.repetido, eraOtro = S.otroTrayecto;
      actual = null;
      nuevaSesion({ repetido: eraRepetido });
      if (eraOtro) {
        S.otroTrayecto = true;
        guardar(conInicio({}), 'destino');
        ir('destino', { sinVolver: true });
      } else {
        ir('parada', { sinVolver: true }); // "empezó" recién cuando toque una opción
      }
    };
    window.scrollTo(0, 0);
    var h = $pantalla.querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  $volver.addEventListener('click', function () {
    var prev = historial.pop();
    if (prev) ir(prev, { atras: true });
  });

  /* ---------- Arranque ---------- */
  function sesionParaRetomar() {
    var g = R.store.get(CLAVE_SESION, null);
    if (!g || g.v !== 2 || !g.session_id || !g.paso || NO_RETOMAR[g.paso] || !P[g.paso]) return null;
    if (g.empezo === false) return null; // abrió pero nunca tocó nada
    var edad = Date.now() - Date.parse(g.ts || 0);
    if (!(edad >= 0 && edad < DIAS_PARA_RETOMAR * 864e5)) return null;
    return g;
  }

  var guardada = sesionParaRetomar();
  if (guardada) {
    S = guardada;
    if (esTest) S.test = true;
    S.empezo = true;
    r = S.r = S.r || {};
    // solo pantallas que siguen existiendo (la bienvenida ya no está)
    var pendiente = primeraSinResponder();
    historial = S.historial = caminoHasta(pendiente);
    var datosScan = { version: VERSION, retomada: 'si', timestamp_scan: new Date().toISOString() };
    if (S.test) datosScan.test = 'si';
    if (S.repetido) datosScan.repetido = 'si';
    enviarEvento('scan', datosScan);
    ir(pendiente, { retomando: true });
  } else if (participacion) {
    nuevaSesion({ ultimo_paso: 'ya_tiene_codigo' });
    ir('ya_tiene_codigo');
  } else {
    nuevaSesion();
    ir('parada'); // directo a la primera pregunta: ultimo_paso sigue en "inicio" hasta que toque algo
  }

  // Para las pruebas automáticas
  window.__ruvu = {
    get sesion() { return S.session_id; },
    get respuestas() { return r; },
    cola: cola
  };
})();
