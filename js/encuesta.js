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

  var VERSION = 'v2';
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
      test: esTest, repetido: !!op.repetido, ref: ref, punto: puntoSlug, ts: new Date().toISOString()
    };
    r = S.r;
    historial = S.historial;
    var datos = { version: VERSION, timestamp_scan: new Date().toISOString() };
    if (S.test) datos.test = 'si';
    if (S.repetido) datos.repetido = 'si';
    if (op.ultimo_paso) datos.ultimo_paso = op.ultimo_paso;
    enviarEvento('scan', datos);
  }

  function guardarSesion() {
    if (!S) return;
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

  /* Trama platense: cuadrícula de La Plata con diagonales y plaza central */
  function trama() {
    return '<svg class="trama" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path d="M50 0V600M100 0V600M150 0V600M200 0V600M250 0V600M300 0V600M350 0V600M400 0V600M450 0V600M500 0V600M550 0V600M0 50H600M0 100H600M0 150H600M0 200H600M0 250H600M0 300H600M0 350H600M0 400H600M0 450H600M0 500H600M0 550H600" stroke="#6B2BD9" stroke-width="2"/>' +
      '<path d="M0 0L600 600M600 0L0 600M300 0L600 300L300 600L0 300Z" fill="none" stroke="#12E39A" stroke-width="7"/>' +
      '<circle cx="300" cy="300" r="24" fill="#FF3D9A"/></svg>';
  }

  function opciones(lista) {
    return '<div class="opciones">' + lista.map(function (o) {
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
     Cuenta las preguntas obligatorias del recorrido de cada persona (7, o 6 si
     dijo "No" y saltea el precio). Las condicionales (cuadras, motivo del No) no
     suman. Debajo de la barra dice cuántas faltan para el viaje gratis. */
  var CONTADAS = ['parada', 'destino', 'modo', 'frecuencia', 'usaria', 'precio', 'edad'];
  var DESPUES_DE = { cuadras: 'destino', motivo_no: 'usaria' }; // condicionales: van después de esta
  function recorrido() {
    return CONTADAS.filter(function (id) { return !(id === 'precio' && r.usaria === 'no'); });
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
    if (faltan === 0) return '¡Llegaste! Activá tu <b>viaje gratis</b>';
    if (faltan === 1) return '¡Última pregunta para tu <b>viaje gratis</b>!';
    return 'Te faltan ' + faltan + ' preguntas para tu <b>viaje gratis</b>';
  }

  /* ---------- Definición de pantallas ----------
     html(): contenido. elegir(v): qué hacer al tocar una opción (una sola). */
  var P = {};

  P.inicio = {
    clase: 'inicio',
    html: function () {
      return '<div>' + logo() +
        '<h1 class="titulo-inicio">RUVU llega a La Plata 🛴</h1>' +
        '<p class="sub">Monopatines eléctricos para moverte por la ciudad cuando quieras: sin esperar el micro y sin caminar 30 cuadras.</p>' +
        '<div class="todavia">' +
        '<p class="todavia-no"><b>Todavía no estamos andando</b><span>, pero gracias a tus respuestas, vamos a llegar más rápido.</span></p>' +
        '</div></div>' +
        '<div class="empuje empuje-trama">' + trama() + '</div><div class="abajo">' +
        '<button type="button" class="btn btn-verde" id="empezar">Quiero mi viaje gratis</button></div>';
    },
    montar: function () {
      document.getElementById('empezar').onclick = function () {
        guardar({ timestamp_inicio: new Date().toISOString() }, 'parada');
        ir('parada');
      };
    }
  };

  /* 1. ¿Dónde estás? Botones con los lugares; "Otra" abre un campo opcional. */
  P.parada = {
    html: function () {
      var lista = (C.DONDE_ESTAS || []).map(paradaPorId).filter(Boolean).map(function (p) {
        return [p.id, esc(p.nombre)];
      });
      lista.push(['otra', 'Otra']);
      return '<h2>¿Dónde estás?</h2>' + opciones(lista) +
        '<form id="form-otra" class="otra-parada" novalidate autocomplete="off" hidden>' +
        '<div class="campo"><label for="parada-otra">¿Dónde? <span class="chica">(opcional)</span></label>' +
        '<input id="parada-otra" type="text" enterkeyhint="next" maxlength="60" placeholder="Ej: 7 y 50"></div>' +
        '<button type="submit" class="btn btn-verde" id="siguiente-otra">Siguiente</button></form>';
    },
    montar: function () {
      var botones = [].slice.call($pantalla.querySelectorAll('.btn-opcion'));
      var form = document.getElementById('form-otra');
      var input = document.getElementById('parada-otra');
      var listo = false;
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
            form.hidden = false;
            input.focus({ preventScroll: true });
            form.scrollIntoView({ block: 'end', behavior: 'smooth' });
            return;
          }
          form.hidden = true;
          listo = true;
          botones.forEach(function (o) { o.disabled = o !== b; });
          setTimeout(function () { guardar({ parada: v }, 'destino'); ir('destino'); }, 140);
        });
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (listo) return;
        listo = true;
        var campos = { parada: 'otra' };
        var t = input.value.trim().replace(/\s+/g, ' ');
        if (t) campos.parada_texto = t.slice(0, 60);
        guardar(campos, 'destino');
        ir('destino');
      });
      // al volver atrás: queda marcado lo que había elegido
      if (r.parada === 'otra') {
        marcar(botones[botones.length - 1]);
        form.hidden = false;
        input.value = r.parada_texto || '';
      } else if (r.parada) {
        marcar(botones.filter(function (b) { return b.getAttribute('data-v') === r.parada; })[0]);
      }
    }
  };

  /* 2. ¿A dónde vas? */
  P.destino = {
    html: function () {
      var o = origen();
      var lista = C.DESTINOS.filter(function (d) {
        // no ofrecer como destino el mismo lugar donde está (a menos de 300 m)
        return !(o && typeof d.lat === 'number' && R.haversineKm(o, d) < 0.3);
      }).map(function (d) { return [d.id, esc(d.nombre)]; });
      return '<h2>¿A dónde vas?</h2>' + opciones(lista);
    },
    elegir: function (v) {
      var viaje = R.calcularViaje(origen(), destinoPorId(v));
      if (!viaje) { guardar({ destino: v }, 'cuadras'); ir('cuadras'); return; }
      guardar({
        destino: v, min_monopatin: viaje.minMonopatin, min_caminando: viaje.minCaminando, precio_mostrado: viaje.precio
      }, 'modo');
      ir('modo');
    }
  };

  /* 2b. Solo si no hay coordenadas (parada "Otra" o destino "Otro"). */
  P.cuadras = {
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
    html: function () {
      return '<h2>¿Cuántas veces por semana hacés este trayecto?</h2>' + opciones([
        ['1_o_menos', '1 o menos'], ['2-3', '2 a 3'], ['4_o_mas', '4 o más'], ['todos_los_dias', 'Todos los días']
      ]);
    },
    elegir: function (v) { guardar({ frecuencia: v }, 'usaria'); ir('usaria'); }
  };

  /* 5. ¿Lo usarías? */
  P.usaria = {
    html: function () {
      return '<div class="comparar">' +
        '<div><b class="verde">' + r.min_monopatin + ' min</b><span>con RUVU</span></div>' +
        '<div><b>' + r.min_caminando + ' min</b><span>caminando</span></div></div>' +
        '<h2>Con RUVU llegás en ' + r.min_monopatin + ' min en vez de ' + r.min_caminando +
        ' caminando. ¿Lo usarías en vez de caminar?</h2>' +
        opciones([['si', 'Sí, de una'], ['depende', 'Depende del precio'], ['no', 'No']]);
    },
    elegir: function (v) {
      if (v === 'no') { guardar({ usaria: v }, 'motivo_no'); ir('motivo_no'); }
      else { guardar({ usaria: v }, 'precio'); ir('precio'); }
    }
  };

  P.motivo_no = {
    html: function () {
      return '<h2>¿Por qué no?</h2><p class="sub">Nos sirve un montón saberlo.</p>' + opciones([
        ['prefiero_caminar', 'Prefiero caminar'], ['inseguro', 'No me siento seguro/a'],
        ['no_se_andar', 'No sé andar'], ['clima', 'Por el clima'], ['otra', 'Otra']
      ]);
    },
    elegir: function (v) { guardar({ motivo_no: v }, 'edad'); ir('edad'); }
  };

  /* 6. Precio máximo (si respondió "No" en el 5, no se muestra). */
  P.precio = {
    html: function () {
      var ops = C.PRECIOS_MAX_V2;
      var lista = ops.map(function (n, i) {
        return i === ops.length - 1 ? [n + '+', R.pesos(n) + ' o más'] : [String(n), R.pesos(n)];
      });
      lista.push(['no', 'No lo pagaría']);
      return '<h2>¿Cuánto pagarías como máximo por este viaje de ' + r.min_monopatin + ' min?</h2>' + opciones(lista);
    },
    elegir: function (v) { guardar({ precio_max_v2: v }, 'edad'); ir('edad'); }
  };

  /* 7. Edad. Menos de 18 corta acá, sin código. */
  P.edad = {
    html: function () {
      return buho('¡Ya casi! Respondé esta y te damos tu <b>viaje gratis</b> 🎁') +
        '<h2>¿Qué edad tenés?</h2>' + opciones([
          ['menos_18', 'Menos de 18'], ['18-24', '18 a 24'], ['25-34', '25 a 34'], ['35-44', '35 a 44'], ['45+', '45 o más']
        ]);
    },
    elegir: function (v) {
      if (v === 'menos_18') {
        guardar({ edad: v, completo: 'si', timestamp_fin: new Date().toISOString() }, 'fin_menor');
        marcarParticipacion({ menor: true });
        ir('fin_menor', { sinVolver: true });
      } else if (S.repetido && tieneNumero()) {
        // otro trayecto de alguien que ya dejó su número: directo al código
        guardar({ edad: v }, 'codigo');
        entregarCodigo({});
      } else {
        guardar({ edad: v }, 'whatsapp');
        ir('whatsapp');
      }
    }
  };

  /* 8. WhatsApp. El consentimiento aparece (y es obligatorio) solo si escribió un número.
     S.agregarNumero: vino desde la pantalla del código con "Mejor dejame mi número". */
  P.whatsapp = {
    html: function () {
      return '<h2>¿A qué número te mandamos tu viaje gratis?</h2>' +
        '<p class="sub">Lo usamos solo para activar tu código y avisarte el día que arrancamos. No hacemos spam y no compartimos tu número.</p>' +
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
    return '<a class="btn btn-verde" id="invitar" target="_blank" rel="noopener" href="https://wa.me/?text=' +
      encodeURIComponent(msg) + '">Invitá a un amigo y sumás otro viaje</a>';
  }

  function montarInvitar() {
    var a = document.getElementById('invitar');
    if (a) a.addEventListener('click', function () { enviarEvento('invitacion', { invito_amigo: 'si' }); });
  }

  function cajaCodigo(codigo) {
    return '<div class="codigo" id="codigo">' + esc(codigo) + '</div>';
  }

  /* 9. Pantalla del código (completo = si se marca al llegar acá). */
  P.codigo = {
    clase: 'final',
    html: function () {
      var conNumero = tieneNumero();
      var bonusHecho = r.motivo_viaje || r.dia_primer_viaje || r.franja_primer_viaje;
      return buho() + '<h1>¡Listo!</h1>' +
        '<p class="sub" style="margin-bottom:0">Tu viaje gratis:</p>' + cajaCodigo(r.codigo) +
        (conNumero
          ? '<p class="nota-codigo">Te lo mandamos por WhatsApp el día que arrancamos.</p>'
          : '<p class="nota-codigo">Sacale captura para no perderlo.</p>' +
            '<button type="button" class="btn-link" id="dejar-numero">Mejor dejame mi número</button>') +
        '<p class="chica">Válido para 1 viaje de hasta 10 min en el lanzamiento.</p>' +
        '<div class="abajo">' + botonInvitar(r.codigo) + '</div>' +
        (bonusHecho ? '' :
          '<div class="bonus-card"><p><b>¿Nos ayudás con 2 más?</b> <span class="chica">(opcional)</span></p>' +
          '<button type="button" class="btn btn-secundario" id="ir-bonus">Dale</button></div>');
    },
    montar: function () {
      montarInvitar();
      var d = document.getElementById('dejar-numero');
      if (d) d.onclick = function () { S.agregarNumero = true; ir('whatsapp'); };
      var b = document.getElementById('ir-bonus');
      if (b) b.onclick = function () { ir('bonus'); };
    }
  };

  /* 10. Bonus opcional: motivo + día y franja. */
  P.bonus = {
    html: function () {
      var motivos = [['facu', 'Facu'], ['laburo', 'Laburo'], ['tramite_compras', 'Trámite o compras'], ['juntada_paseo', 'Juntada o paseo']];
      var dias = [['lun', 'Lun'], ['mar', 'Mar'], ['mie', 'Mié'], ['jue', 'Jue'], ['vie', 'Vie'], ['sab', 'Sáb'], ['dom', 'Dom']];
      var franjas = ['7-10', '10-13', '13-16', '16-19', '19-21'];
      function chips(grupo, lista, clase) {
        return '<div class="chips ' + (clase || '') + '" data-grupo="' + grupo + '">' + lista.map(function (o) {
          return '<button type="button" class="chip" aria-pressed="false" data-v="' + o[0] + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      }
      return '<h2>¿Nos ayudás con 2 más?</h2><p class="sub">Son opcionales.</p>' +
        '<p class="etiqueta">1. ¿Para qué ibas a hacer este viaje?</p>' + chips('motivo_viaje', motivos, 'dos') +
        '<p class="etiqueta">2. ¿Qué día y horario de la primera semana lo usarías?</p>' + chips('dia_primer_viaje', dias) +
        chips('franja_primer_viaje', franjas.map(function (f) { return [f, f.replace('-', '–') + ' h']; }), 'cinco') +
        '<div class="abajo"><button type="button" class="btn btn-verde" id="listo-bonus" disabled>Listo</button>' +
        '<button type="button" class="btn btn-secundario" id="saltar-bonus">Saltar</button></div>';
    },
    montar: function () {
      var sel = {};
      [].forEach.call($pantalla.querySelectorAll('.chips'), function (g) {
        g.addEventListener('click', function (e) {
          var b = e.target.closest('.chip');
          if (!b) return;
          var grupo = g.getAttribute('data-grupo'), v = b.getAttribute('data-v');
          var ya = sel[grupo] === v; // tocar de nuevo la misma la desmarca
          [].forEach.call(g.querySelectorAll('.chip'), function (c) { c.setAttribute('aria-pressed', !ya && c === b ? 'true' : 'false'); });
          if (ya) delete sel[grupo]; else sel[grupo] = v;
          document.getElementById('listo-bonus').disabled = !Object.keys(sel).length;
        });
      });
      document.getElementById('listo-bonus').onclick = function () {
        guardar(sel, 'fin_bonus');
        ir('fin_bonus', { sinVolver: true });
      };
      document.getElementById('saltar-bonus').onclick = function () {
        guardar({}, 'bonus_saltado');
        ir('fin_bonus', { sinVolver: true });
      };
    }
  };

  P.fin_bonus = {
    clase: 'final',
    html: function () {
      return buho() + '<h1>¡Gracias!</h1>' +
        '<p class="sub" style="margin-bottom:0">Tu viaje gratis:</p>' + cajaCodigo(r.codigo) +
        '<div class="abajo">' + botonInvitar(r.codigo) + '</div>';
    },
    montar: montarInvitar
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
        return buho() + '<h1>Ya respondiste, ¡gracias!</h1>' +
          '<p class="sub">Si querés, contanos otro trayecto y te damos tu viaje gratis.</p>' +
          '<div class="abajo">' + otro + '</div>';
      }
      return buho() + '<h1>Ya tenés tu viaje gratis</h1>' + cajaCodigo(participacion.codigo) +
        '<p class="nota-codigo">' + (tieneNumero()
          ? 'Te lo mandamos por WhatsApp el día que arrancamos.'
          : 'Sacale captura para no perderlo.') + '</p>' +
        '<div class="abajo">' + botonInvitar(participacion.codigo) + otro + '</div>';
    },
    montar: function () {
      montarInvitar();
      var b = document.getElementById('otro-trayecto');
      if (b) b.onclick = function () {
        nuevaSesion({ repetido: true });
        guardar({ timestamp_inicio: new Date().toISOString() }, 'parada');
        ir('parada', { sinVolver: true });
      };
    }
  };

  /* Pantallas donde la sesión ya no se retoma (terminó o es solo informativa). */
  var NO_RETOMAR = { inicio: 1, codigo: 1, bonus: 1, fin_bonus: 1, fin_menor: 1, ya_tiene_codigo: 1 };

  /* ---------- Navegación ---------- */
  var actual = null;
  function ir(id, op) {
    op = op || {};
    if (actual && !op.atras && !op.retomando) historial.push(actual);
    if (op.sinVolver) historial.length = 0;
    actual = id;
    S.paso = id;
    if (NO_RETOMAR[id] && id !== 'inicio') R.store.del(CLAVE_SESION);
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
      $volver.hidden = !historial.length || historial[historial.length - 1] === 'inicio';
    }
    if (def.elegir) {
      var respondida = false;
      $pantalla.querySelectorAll('.btn-opcion').forEach(function (b) {
        b.addEventListener('click', function () {
          if (respondida) return;
          respondida = true;
          $pantalla.querySelectorAll('.btn-opcion').forEach(function (o) {
            o.disabled = o !== b;
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
      var eraRepetido = S.repetido;
      actual = null;
      nuevaSesion({ repetido: eraRepetido });
      guardar({ timestamp_inicio: new Date().toISOString() }, 'parada');
      ir('parada', { sinVolver: true });
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
    var edad = Date.now() - Date.parse(g.ts || 0);
    if (!(edad >= 0 && edad < DIAS_PARA_RETOMAR * 864e5)) return null;
    return g;
  }

  var guardada = sesionParaRetomar();
  if (guardada) {
    S = guardada;
    if (esTest) S.test = true;
    r = S.r = S.r || {};
    historial = S.historial = S.historial || [];
    var datosScan = { version: VERSION, retomada: 'si', timestamp_scan: new Date().toISOString() };
    if (S.test) datosScan.test = 'si';
    if (S.repetido) datosScan.repetido = 'si';
    enviarEvento('scan', datosScan);
    ir(S.paso, { retomando: true });
  } else if (participacion) {
    nuevaSesion({ ultimo_paso: 'ya_tiene_codigo' });
    ir('ya_tiene_codigo');
  } else {
    nuevaSesion();
    ir('inicio');
  }

  // Para las pruebas automáticas
  window.__ruvu = {
    get sesion() { return S.session_id; },
    get respuestas() { return r; },
    cola: cola
  };
})();
