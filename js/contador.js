/* RUVU · contador manual (+1 Pasa / +1 Se frena / deshacer). */
(function () {
  var R = window.RUVU, C = R.C;
  var cola = R.crearCola('ruvu_cola_conteo');
  var dispositivo = R.store.get('ruvu_dispositivo') || R.uid(8);
  R.store.set('ruvu_dispositivo', dispositivo);

  var $punto = document.getElementById('punto');
  var $estado = document.getElementById('estado');

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  // historial local de toques de hoy: [{id, punto, accion}]
  function toques() {
    var h = R.store.get('ruvu_toques', { dia: hoy(), lista: [] });
    if (h.dia !== hoy()) h = { dia: hoy(), lista: [] };
    return h;
  }

  function pintar() {
    var p = $punto.value, n = { pasa: 0, frena: 0 };
    toques().lista.forEach(function (t) { if (t.punto === p) n[t.accion]++; });
    document.getElementById('n-pasa').textContent = n.pasa;
    document.getElementById('n-frena').textContent = n.frena;
    var pend = cola.pendientes();
    $estado.className = 'estado' + (pend ? ' pend' : '');
    $estado.textContent = pend ? '⏳ ' + pend + ' sin enviar (se reintenta solo)' : (C.API_URL ? '✓ Todo guardado' : 'Modo demo: falta API_URL en config.js');
  }

  function enviar(accion, deshace) {
    var id = cola.agregar({
      tipo: 'conteo', pin: C.PIN, punto: $punto.value, accion: accion,
      deshace: deshace || '', dispositivo: dispositivo
    });
    cola.enviar().then(pintar);
    return id;
  }

  function tocar(accion, btn) {
    var id = enviar(accion);
    var h = toques();
    h.lista.push({ id: id, punto: $punto.value, accion: accion });
    R.store.set('ruvu_toques', h);
    if (navigator.vibrate) navigator.vibrate(25);
    btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash');
    pintar();
  }

  function deshacer() {
    var h = toques();
    // último toque de este punto
    for (var i = h.lista.length - 1; i >= 0; i--) {
      if (h.lista[i].punto === $punto.value) {
        enviar('deshacer', h.lista[i].id);
        h.lista.splice(i, 1);
        R.store.set('ruvu_toques', h);
        if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
        break;
      }
    }
    pintar();
  }

  function iniciar() {
    document.getElementById('app').hidden = false;
    C.PUNTOS.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.slug;
      o.textContent = p.nombre;
      $punto.appendChild(o);
    });
    $punto.value = R.store.get('ruvu_contador_punto') || C.PUNTOS[0].slug;
    $punto.onchange = function () { R.store.set('ruvu_contador_punto', $punto.value); pintar(); };
    var $pasa = document.getElementById('pasa'), $frena = document.getElementById('frena');
    $pasa.onclick = function () { tocar('pasa', $pasa); };
    $frena.onclick = function () { tocar('frena', $frena); };
    document.getElementById('deshacer').onclick = deshacer;
    cola.enviar().then(pintar);
    setInterval(pintar, 5000);
    pintar();
  }

  R.pedirPin(iniciar);
})();
