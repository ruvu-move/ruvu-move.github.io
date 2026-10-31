/* RUVU · flujo de la encuesta (una pregunta por pantalla). */
(function () {
  var R = window.RUVU, C = R.C;
  var $pantalla = document.getElementById('pantalla');
  var $barra = document.getElementById('barra');
  var $progreso = document.getElementById('progreso');
  var $volver = document.getElementById('volver');

  /* ---------- Contexto de la sesión ---------- */
  var params = new URLSearchParams(location.search);
  var slug = (params.get('p') || '').toLowerCase().trim();
  var punto = C.PUNTOS.filter(function (p) { return p.slug === slug; })[0] || null;
  var puntoSlug = punto ? punto.slug : 'sin-punto';
  var ref = (params.get('ref') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
  var participacion = R.store.get('ruvu_participacion', null);
  if (participacion && ref === participacion.codigo) ref = ''; // se escaneó su propio link

  var sesion = R.uid(16);
  var cola = R.crearCola('ruvu_cola');
  var r = {};        // respuestas de esta sesión
  var historial = []; // pantallas visitadas, para "Volver"

  function enviarEvento(tipo, datos) {
    var id = cola.agregar({
      tipo: tipo,
      session_id: sesion,
      punto: puntoSlug,
      ref: ref,
      ua: navigator.userAgent.slice(0, 250),
      datos: datos || {}
    });
    cola.enviar();
    return id;
  }

  /* Guarda respuestas y deja asentado en qué pantalla quedó la persona. */
  function guardar(campos, siguiente) {
    for (var k in campos) r[k] = campos[k];
    campos.ultimo_paso = siguiente;
    return enviarEvento('respuesta', campos);
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

  /* Trama platense: cuadrícula de La Plata con diagonales y plaza central */
  function trama() {
    return '<svg class="trama" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path d="M50 0V600M100 0V600M150 0V600M200 0V600M250 0V600M300 0V600M350 0V600M400 0V600M450 0V600M500 0V600M550 0V600M0 50H600M0 100H600M0 150H600M0 200H600M0 250H600M0 300H600M0 350H600M0 400H600M0 450H600M0 500H600M0 550H600" stroke="#6B2BD9" stroke-width="2"/>' +
      '<path d="M0 0L600 600M600 0L0 600M300 0L600 300L300 600L0 300Z" fill="none" stroke="#12E39A" stroke-width="7"/>' +
      '<circle cx="300" cy="300" r="24" fill="#FF3D9A"/></svg>';
  }

  /* Búho RUVU arriba del monopatín (ojos de rueda, panza con la trama) */
  function buho() {
    return '<svg class="buho" viewBox="0 0 200 236" role="img" aria-label="Búho RUVU arriba de un monopatín">' +
      '<path d="M40 78 Q40 40 66 32 L56 6 L92 28 Q100 26 108 28 L144 6 L134 32 Q160 40 160 78 L160 150 Q160 205 100 208 Q40 205 40 150 Z" fill="#6B2BD9"/>' +
      '<circle cx="72" cy="88" r="28" fill="#0B0B0B"/><circle cx="72" cy="88" r="19" fill="#2B2F31"/><circle cx="72" cy="88" r="9" fill="#12E39A"/>' +
      '<circle cx="128" cy="88" r="28" fill="#0B0B0B"/><circle cx="128" cy="88" r="19" fill="#2B2F31"/><circle cx="128" cy="88" r="9" fill="#12E39A"/>' +
      '<path d="M92 118 L108 118 L100 134 Z" fill="#FF3D9A"/>' +
      '<path d="M70 150H130M70 170H130M85 140V195M115 140V195M68 140L132 198M132 140L68 198" stroke="#12E39A" stroke-width="3"/>' +
      '<rect x="78" y="202" width="14" height="10" rx="3" fill="#12E39A"/><rect x="108" y="202" width="14" height="10" rx="3" fill="#12E39A"/>' +
      '<rect x="24" y="212" width="152" height="10" rx="5" fill="#FFFFFF"/>' +
      '<circle cx="40" cy="226" r="9" fill="#FFFFFF"/><circle cx="160" cy="226" r="9" fill="#FFFFFF"/></svg>';
  }

  function opciones(lista) {
    return '<div class="opciones">' + lista.map(function (o) {
      return '<button type="button" class="btn btn-opcion" data-v="' + esc(o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- Definición de pantallas ----------
     p: progreso (0-1). html(): contenido. elegir(v): qué hacer al tocar una opción. */
  var P = {};

  P.inicio = {
    html: function () {
      return '<div>' + logo() + '<br>' +
        '<span class="proximamente">Próximamente en La Plata</span>' +
        '<h1>¿Cuánto tardarías en llegar con RUVU?</h1>' +
        '<p class="sub">Te lo calculamos en 1 minuto.</p>' +
        '<span class="tag">Atajá por la diagonal</span></div>' +
        '<div class="empuje empuje-trama">' + trama() + '</div><div class="abajo">' +
        '<button type="button" class="btn btn-verde" id="empezar">Empezar</button>' +
        '<p class="lema">Escaneá. Andá. <b>Dejalo.</b></p></div>';
    },
    clase: 'inicio',
    montar: function () {
      document.getElementById('empezar').onclick = function () {
        guardar({ timestamp_inicio: new Date().toISOString() }, 'parada');
        ir('parada');
      };
    }
  };

  /* Parada: texto libre con autocompletado por palabras clave (config PARADAS).
     Si vino por el QR de un punto, ya aparece completa. */
  var paradaElegida = null; // objeto de PARADAS o null si no coincidió ninguna
  var origen = punto;       // desde dónde se calculan minutos y precio

  function paradaPorId(id) {
    return (C.PARADAS || []).filter(function (p) { return p.id === id; })[0] || null;
  }

  P.parada = {
    p: 0.05,
    html: function () {
      return '<h2>¿Dónde estás?</h2>' +
        '<p class="sub">Escribí la parada o el lugar. Ej: Plaza Moreno, la Terminal, Calle 8.</p>' +
        '<form id="form-parada" novalidate autocomplete="off">' +
        '<div class="campo" id="campo-parada"><label for="parada" class="sr">Dónde estás</label>' +
        '<input id="parada" type="text" inputmode="text" enterkeyhint="next" autocapitalize="words" ' +
        'spellcheck="false" placeholder="Escribí dónde estás" maxlength="60">' +
        '<p class="error" id="err-parada" hidden>Contanos dónde estás para seguir.</p></div>' +
        '<div class="empuje"></div><div class="abajo">' +
        '<button type="submit" class="btn btn-verde" id="siguiente-parada" disabled>Siguiente</button></div></form>';
    },
    montar: function () {
      var input = document.getElementById('parada');
      var btn = document.getElementById('siguiente-parada');
      var err = document.getElementById('err-parada');
      var escrito = ''; // lo que escribió la persona, tal cual (se guarda en parada_texto)

      // Una palabra clave ("moreno", "P Moreno", "tren"...) identifica la parada
      function reconocida(txt) {
        var top = R.buscarParadas(txt, 1)[0];
        return top && top.puntaje >= 80 ? top.parada : null;
      }
      // Autocompletar: el campo pasa a mostrar el nombre completo
      function completar() {
        var p = reconocida(input.value);
        if (p) input.value = p.nombre;
        return p;
      }

      input.addEventListener('input', function () {
        escrito = input.value;
        btn.disabled = input.value.trim().length < 2;
        err.hidden = true;
      });
      input.addEventListener('blur', completar);
      document.getElementById('form-parada').addEventListener('submit', function (e) {
        e.preventDefault();
        if (input.value.trim().length < 2) { err.hidden = false; input.focus(); return; }
        var texto = (escrito || input.value).trim();
        var p = completar();
        paradaElegida = p;
        origen = p && typeof p.lat === 'number' ? p : punto;
        guardar({ parada: p ? p.id : 'otra', parada_texto: texto.slice(0, 60) }, 'destino');
        ir('destino');
      });

      // Volver a esta pantalla o venir de un QR con punto: arranca completo
      var previa = paradaElegida || (punto && paradaPorId(punto.parada));
      if (r.parada_texto) input.value = escrito = r.parada_texto;
      else if (previa) input.value = escrito = previa.nombre;
      completar();
      btn.disabled = input.value.trim().length < 2;
    }
  };

  P.destino = {
    p: 0.1,
    html: function () {
      var lista = C.DESTINOS.filter(function (d) {
        // no ofrecer como destino el mismo lugar donde está (a menos de 300 m)
        if (origen && typeof d.lat === 'number' && R.haversineKm(origen, d) < 0.3) return false;
        return !(origen === punto && (d.ocultarEn || []).some(function (s) { return s === puntoSlug; }));
      }).map(function (d) { return [d.id, esc(d.nombre)]; });
      return '<h2>¿A dónde vas ahora?</h2>' + opciones(lista);
    },
    elegir: function (v) {
      var dest = C.DESTINOS.filter(function (d) { return d.id === v; })[0];
      var viaje = R.calcularViaje(origen, dest);
      guardar({
        destino: v,
        min_monopatin: viaje.minMonopatin,
        min_caminando: viaje.minCaminando,
        precio_mostrado: viaje.precio
      }, 'modo');
      ir('modo');
    }
  };

  P.modo = {
    p: 0.2,
    html: function () {
      return '<h2>¿Cómo ibas a ir?</h2>' + opciones([
        ['caminando', 'Caminando'], ['micro', 'Micro'], ['bici', 'Bici'],
        ['uber_remis', 'Uber o remis'], ['auto', 'Auto'], ['moto', 'Moto']
      ]);
    },
    elegir: function (v) { guardar({ modo_actual: v }, 'frecuencia'); ir('frecuencia'); }
  };

  P.frecuencia = {
    p: 0.3,
    html: function () {
      return '<h2>¿Cuántas veces por semana hacés este trayecto?</h2>' + opciones([
        ['1_o_menos', '1 o menos'], ['2-3', '2 a 3'], ['4_o_mas', '4 o más'], ['todos_los_dias', 'Todos los días']
      ]);
    },
    elegir: function (v) { guardar({ frecuencia: v }, 'usaria'); ir('usaria'); }
  };

  P.usaria = {
    p: 0.4,
    html: function () {
      return '<div class="comparar">' +
        '<div><b class="verde">' + r.min_monopatin + ' min</b><span>con RUVU</span></div>' +
        '<div><b>' + r.min_caminando + ' min</b><span>caminando</span></div></div>' +
        '<h2>Con RUVU llegás en ' + r.min_monopatin + ' min en vez de ' + r.min_caminando +
        ' caminando. ¿Lo usarías en vez de caminar?</h2>' +
        opciones([['si', 'Sí, de una'], ['no', 'No'], ['depende', 'Depende del precio']]);
    },
    elegir: function (v) {
      if (v === 'no') { guardar({ usaria: v }, 'motivo_no'); ir('motivo_no'); }
      else { guardar({ usaria: v, motivo_no: '' }, 'edad'); ir('edad'); }
    }
  };

  P.motivo_no = {
    p: 0.45,
    html: function () {
      return '<h2>¿Por qué no?</h2><p class="sub">Nos sirve un montón saberlo.</p>' + opciones([
        ['prefiero_caminar', 'Prefiero caminar'], ['inseguro', 'No me siento seguro/a'],
        ['no_se_andar', 'No sé andar'], ['clima', 'Por el clima'], ['otra', 'Otra']
      ]);
    },
    elegir: function (v) { guardar({ motivo_no: v }, 'edad'); ir('edad'); }
  };

  P.edad = {
    p: 0.52,
    html: function () {
      return '<h2>¿Qué edad tenés?</h2>' + opciones([
        ['menos_18', 'Menos de 18'], ['18-24', '18 a 24'], ['25-34', '25 a 34'], ['35-44', '35 a 44'], ['45+', '45 o más']
      ]);
    },
    elegir: function (v) {
      if (v === 'menos_18') {
        guardar({ edad: v, completo: 'si', timestamp_fin: new Date().toISOString() }, 'fin_menor');
        marcarParticipacion(null);
        ir('fin_menor', { sinVolver: true });
      } else if (r.usaria === 'no') {
        guardar({ edad: v }, 'whatsapp'); ir('whatsapp');
      } else {
        guardar({ edad: v }, 'precio'); ir('precio');
      }
    }
  };

  P.precio = {
    p: 0.62,
    html: function () {
      return '<p class="sub" style="margin-bottom:4px">Este viaje saldría aprox.</p>' +
        '<div class="precio-grande">' + R.pesos(r.precio_mostrado) + '</div>' +
        '<p class="chica" style="margin:0 0 18px">' + r.min_monopatin + ' min · incluye desbloqueo y seguro</p>' +
        '<h2>¿Lo pagarías?</h2>' + opciones([
          ['si', 'Sí'], ['caro', 'Es caro'], ['no_pagaria', 'No lo pagaría a ningún precio']
        ]);
    },
    elegir: function (v) {
      if (v === 'caro') { guardar({ acepta_precio: v }, 'oferta'); ir('oferta'); }
      else { guardar({ acepta_precio: v, oferta_elegida: '', precio_max: '' }, 'whatsapp'); ir('whatsapp'); }
    }
  };

  P.oferta = {
    p: 0.7,
    html: function () {
      var o = C.OFERTAS;
      var valle = R.redondearPrecio(r.precio_mostrado * (1 - o.valle.descuento));
      return '<h2>¿Alguna de estas te convence?</h2>' + opciones([
        ['pack', 'Pack ' + o.pack.viajes + ' viajes de hasta ' + o.pack.minutos + ' min a ' + R.pesos(o.pack.precio) +
          '<small>' + R.pesos(o.pack.precio / o.pack.viajes) + ' por viaje</small>'],
        ['abono', 'Abono mensual: ' + o.abono.viajes + ' viajes de hasta ' + o.abono.minutos + ' min a ' + R.pesos(o.abono.precio) +
          '<small>' + R.pesos(o.abono.precio / o.abono.viajes) + ' por viaje</small>'],
        ['valle', 'Horario valle: ' + Math.round(o.valle.descuento * 100) + '% menos de ' + o.valle.desde + ' a ' + o.valle.hasta + ' h' +
          '<small>Este viaje te saldría ' + R.pesos(valle) + '</small>'],
        ['ninguna', 'Ninguna']
      ]);
    },
    elegir: function (v) {
      if (v === 'ninguna') { guardar({ oferta_elegida: v }, 'precio_max'); ir('precio_max'); }
      else { guardar({ oferta_elegida: v, precio_max: '' }, 'whatsapp'); ir('whatsapp'); }
    }
  };

  P.precio_max = {
    p: 0.78,
    html: function () {
      var l = C.OFERTAS.preciosMaximos.map(function (n) { return [String(n), R.pesos(n)]; });
      l.push(['menos_' + C.OFERTAS.preciosMaximos[0], 'Menos de ' + R.pesos(C.OFERTAS.preciosMaximos[0])]);
      return '<h2>¿Hasta cuánto pagarías por este viaje?</h2>' + opciones(l);
    },
    elegir: function (v) { guardar({ precio_max: v }, 'whatsapp'); ir('whatsapp'); }
  };

  P.whatsapp = {
    p: 0.88,
    html: function () {
      return '<h2>Dejanos tu WhatsApp y te avisamos el día que arranca RUVU 🎁</h2>' +
        '<p class="sub">Te regalamos un viaje gratis.</p>' +
        '<form id="form-wa" novalidate>' +
        '<div class="campo" id="campo-wa"><label for="wa">Tu WhatsApp</label>' +
        '<input id="wa" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="221 555 1234" maxlength="20">' +
        '<p class="error" id="err-wa" hidden>Revisá el número: característica + número, por ejemplo 221 555 1234.</p></div>' +
        '<label class="check"><input type="checkbox" id="consent">' +
        '<span>Acepto que RUVU me contacte por WhatsApp y guarde mis respuestas para mejorar el servicio (Ley 25.326). ' +
        '<a href="privacidad.html" target="_blank" rel="noopener">Ver política de privacidad</a></span></label>' +
        '<p class="error" id="err-consent" hidden>Para recibir el viaje gratis tenés que aceptar.</p>' +
        '<div class="abajo"><button type="submit" class="btn btn-verde" id="enviar-wa">Quiero mi viaje gratis</button>' +
        '<button type="button" class="btn btn-texto" id="no-wa">Prefiero no dejarlo</button></div></form>';
    },
    montar: function () {
      var form = document.getElementById('form-wa');
      var input = document.getElementById('wa');
      var consent = document.getElementById('consent');
      input.addEventListener('input', function () {
        document.getElementById('campo-wa').classList.remove('con-error');
        document.getElementById('err-wa').hidden = true;
      });
      consent.addEventListener('change', function () { document.getElementById('err-consent').hidden = true; });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var numero = R.normalizarWhatsapp(input.value);
        var ok = true;
        if (!numero) {
          document.getElementById('campo-wa').classList.add('con-error');
          document.getElementById('err-wa').hidden = false;
          ok = false;
        }
        if (!consent.checked) { document.getElementById('err-consent').hidden = false; ok = false; }
        if (!ok) return;
        var btn = document.getElementById('enviar-wa');
        btn.disabled = true;
        btn.textContent = 'Generando tu código…';
        var codigo = (participacion && participacion.codigo) || R.generarCodigo();
        var id = guardar({
          whatsapp: numero, consentimiento: 'si', codigo: codigo, completo: 'si',
          timestamp_fin: new Date().toISOString()
        }, siguienteTrasWhatsapp('primer_viaje'));
        // El servidor verifica que el código no esté repetido; si lo estaba, devuelve otro.
        cola.esperar(id, 5000).then(function (res) {
          if (res && res.codigo) codigo = res.codigo;
          r.codigo = codigo;
          marcarParticipacion(codigo);
          irExtras('primer_viaje');
        });
      });
      document.getElementById('no-wa').onclick = function () {
        guardar({ completo: 'si', timestamp_fin: new Date().toISOString() }, siguienteTrasWhatsapp('fin_sin_whatsapp'));
        marcarParticipacion(null);
        irExtras('fin_sin_whatsapp');
      };
    }
  };

  /* ---------- Preguntas extra (después del WhatsApp, antes del final) ----------
     Las responden todos los que terminan, dejen o no el WhatsApp. Si ya las
     respondió (volvió con "Cambié de idea"), no se repiten. */
  var EXTRAS = ['extra_motivo', 'extra_vuelta', 'extra_cuadras', 'extra_uso'];
  var despuesDeExtras = 'primer_viaje';

  function extrasHechas() { return !!r.uso_previo; }
  function siguienteTrasWhatsapp(despues) { return extrasHechas() ? despues : EXTRAS[0]; }
  function irExtras(despues) {
    despuesDeExtras = despues;
    ir(extrasHechas() ? despues : EXTRAS[0], { sinVolver: true });
  }
  function extra(campo, siguiente) {
    return function (v) {
      var campos = {};
      campos[campo] = v;
      var prox = siguiente || despuesDeExtras;
      guardar(campos, prox);
      ir(prox, siguiente ? {} : { sinVolver: true });
    };
  }

  P.extra_motivo = {
    p: 0.9,
    html: function () {
      return '<p class="etiqueta">Extra 1 de 4</p>' +
        '<h2>¿Para qué es este viaje?</h2>' + opciones([
          ['facu', 'Facu'], ['laburo', 'Laburo'], ['tramite_compras', 'Trámite o compras'], ['juntada_paseo', 'Juntada o paseo']
        ]);
    },
    elegir: extra('motivo_viaje', 'extra_vuelta')
  };

  P.extra_vuelta = {
    p: 0.92,
    html: function () {
      return '<p class="etiqueta">Extra 2 de 4</p>' +
        '<h2>¿Lo usarías también para volver?</h2>' + opciones([
          ['si', 'Sí'], ['no', 'No, vuelvo de otra forma'], ['depende_horario', 'Depende del horario']
        ]);
    },
    elegir: extra('vuelta', 'extra_cuadras')
  };

  P.extra_cuadras = {
    p: 0.94,
    html: function () {
      return '<p class="etiqueta">Extra 3 de 4</p>' +
        '<h2>¿Cuántas cuadras caminarías para buscar un monopatín?</h2>' + opciones([
          ['1', '1 cuadra'], ['2-3', '2 a 3'], ['4-5', '4 a 5'], ['mas_5', 'Más de 5']
        ]);
    },
    elegir: extra('cuadras', 'extra_uso')
  };

  P.extra_uso = {
    p: 0.95,
    html: function () {
      return '<p class="etiqueta">Extra 4 de 4</p>' +
        '<h2>¿Alguna vez usaste un monopatín eléctrico?</h2>' + opciones([
          ['si_compartido', 'Sí, uno compartido (de alquiler)'], ['si_propio', 'Sí, uno propio o prestado'], ['nunca', 'Nunca']
        ]);
    },
    elegir: extra('uso_previo')
  };

  P.primer_viaje = {
    p: 0.97,
    html: function () {
      var dias = [['lun', 'Lun'], ['mar', 'Mar'], ['mie', 'Mié'], ['jue', 'Jue'], ['vie', 'Vie'], ['sab', 'Sáb'], ['dom', 'Dom']];
      var franjas = ['7-10', '10-13', '13-16', '16-19', '19-21'];
      return '<h2>¿Qué día y horario de la primera semana lo usarías?</h2><p class="sub">Elegí un día y un horario, así sabemos dónde tener monopatines.</p>' +
        '<p class="etiqueta">Día</p><div class="chips" data-grupo="dia">' +
        dias.map(function (d) { return '<button type="button" class="chip" aria-pressed="false" data-v="' + d[0] + '">' + d[1] + '</button>'; }).join('') +
        '</div><p class="etiqueta">Horario</p><div class="chips cinco" data-grupo="franja">' +
        franjas.map(function (f) { return '<button type="button" class="chip" aria-pressed="false" data-v="' + f + '">' + f.replace('-', '–') + ' h</button>'; }).join('') +
        '</div><div class="empuje"></div><div class="abajo">' +
        '<p class="chica" id="falta-pv" style="text-align:center;margin:0">Elegí un día y un horario.</p>' +
        '<button type="button" class="btn btn-verde" id="listo-pv" disabled>Listo</button></div>';
    },
    montar: function () {
      var sel = {};
      [].forEach.call(document.querySelectorAll('.chips'), function (g) {
        g.addEventListener('click', function (e) {
          var b = e.target.closest('.chip');
          if (!b) return;
          [].forEach.call(g.querySelectorAll('.chip'), function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
          sel[g.getAttribute('data-grupo')] = b.getAttribute('data-v');
          document.getElementById('listo-pv').disabled = !(sel.dia && sel.franja);
          document.getElementById('falta-pv').hidden = !!(sel.dia && sel.franja);
        });
      });
      document.getElementById('listo-pv').onclick = function () {
        guardar({ dia_primer_viaje: sel.dia, franja_primer_viaje: sel.franja }, 'fin');
        ir('fin', { sinVolver: true });
      };
    }
  };

  function linkInvitacion(codigo) {
    var base = location.origin + location.pathname.replace(/index\.html$/, '');
    return base + '?p=' + encodeURIComponent(puntoSlug) + '&ref=' + encodeURIComponent(codigo);
  }

  function htmlCodigo(titulo, codigo) {
    var msg = C.MENSAJE_INVITACION.replace('{link}', linkInvitacion(codigo));
    return buho() + '<span class="tag">Llegá antes, quedate más.</span><h1>' + titulo + '</h1>' +
      '<p class="sub" style="margin-bottom:0">Tu viaje gratis:</p>' +
      '<div class="codigo" id="codigo">' + esc(codigo) + '</div>' +
      '<p class="chica">Válido para 1 viaje de hasta 10 min en el lanzamiento.<br>Sacale captura a esta pantalla.</p>' +
      '<div class="abajo"><a class="btn btn-verde" id="invitar" target="_blank" rel="noopener" href="https://wa.me/?text=' +
      encodeURIComponent(msg) + '">Invitá a un amigo y sumás otro viaje</a></div>';
  }

  function montarInvitar() {
    var a = document.getElementById('invitar');
    if (a) a.addEventListener('click', function () { enviarEvento('invitacion', { invito_amigo: 'si' }); });
  }

  P.fin = {
    clase: 'final',
    html: function () { return htmlCodigo('¡Listo!', r.codigo); },
    montar: montarInvitar
  };

  P.fin_sin_whatsapp = {
    clase: 'final',
    html: function () {
      return buho() + '<h1>¡Gracias por responder!</h1>' +
        '<p class="sub">Muy pronto vas a ver los monopatines RUVU por La Plata.</p>' +
        '<div class="abajo"><button type="button" class="btn btn-texto" id="cambie">Cambié de idea, quiero mi viaje gratis</button></div>';
    },
    montar: function () {
      document.getElementById('cambie').onclick = function () { ir('whatsapp'); };
    }
  };

  P.fin_menor = {
    clase: 'final',
    html: function () {
      return buho() + '<h1>¡Gracias!</h1>' +
        '<p class="sub">RUVU es para mayores de 18. ¡Gracias por la buena onda!</p>';
    }
  };

  P.ya_participo = {
    clase: 'final',
    html: function () {
      if (participacion && participacion.codigo) return htmlCodigo('Ya participaste', participacion.codigo);
      return buho() + '<h1>Ya participaste, ¡gracias!</h1>' +
        '<p class="sub">Muy pronto vas a ver los monopatines RUVU por La Plata.</p>';
    },
    montar: montarInvitar
  };

  function marcarParticipacion(codigo) {
    participacion = { codigo: codigo, session_id: sesion, ts: new Date().toISOString() };
    R.store.set('ruvu_participacion', participacion);
  }

  /* ---------- Navegación ---------- */
  var actual = null;
  function ir(id, op) {
    op = op || {};
    if (actual && !op.atras) historial.push(actual);
    if (op.sinVolver) historial = [];
    actual = id;
    var def = P[id];
    $pantalla.className = 'pantalla ' + (def.clase || '') + (op.atras ? ' entra-atras' : ' entra');
    $pantalla.setAttribute('data-pantalla', id);
    $pantalla.innerHTML = def.html();
    aplicarLogo();
    var conBarra = typeof def.p === 'number';
    $barra.hidden = !conBarra;
    if (conBarra) {
      $progreso.style.width = Math.round(def.p * 100) + '%';
      $progreso.parentNode.setAttribute('aria-valuenow', Math.round(def.p * 100));
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
    window.scrollTo(0, 0);
    var h = $pantalla.querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  $volver.addEventListener('click', function () {
    var prev = historial.pop();
    if (prev) ir(prev, { atras: true });
  });

  /* ---------- Arranque ---------- */
  var yaParticipo = !!participacion;
  enviarEvento('scan', { repetido: yaParticipo ? 'si' : 'no', timestamp_scan: new Date().toISOString() });
  ir(yaParticipo ? 'ya_participo' : 'inicio');

  // Para las pruebas automáticas
  window.__ruvu = { sesion: sesion, respuestas: r, cola: cola };
})();
