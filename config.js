/* ==========================================================================
   RUVU · Configuración de la encuesta
   --------------------------------------------------------------------------
   Este es el ÚNICO archivo que tenés que tocar para cambiar puntos, destinos,
   precios, textos de ofertas, la URL del Apps Script y el PIN del equipo.
   Después de editarlo, subí el cambio a GitHub y listo (no hay que compilar).
   ========================================================================== */
window.RUVU_CONFIG = {

  /* URL del Apps Script publicado como Web App (termina en /exec).
     Si la dejás vacía (''), la web funciona en "modo demo": no guarda nada en
     la hoja y muestra los envíos en la consola del navegador. */
  API_URL: '',

  /* URL pública del sitio (con / al final). Se usa para generar los QR.
     Ejemplo GitHub Pages: 'https://tu-usuario.github.io/ruvu-encuesta/' */
  SITE_URL: 'https://ruvu-lp.github.io/',

  /* PIN para entrar al contador (/contador.html) y al panel (/panel.html).
     IMPORTANTE: tiene que ser el mismo que pongas en apps-script/Code.gs. */
  PIN: '2026',

  /* ------------------------------------------------------------------------
     PUNTOS donde se deja el monopatín. Cada uno tiene su QR: <SITE_URL>?p=<slug>
     - slug: identificador corto, sin espacios ni tildes. NO lo cambies una vez
       impresos los carteles (se rompería la medición).
     - lat / lng: TODO. Son aproximadas: reemplazalas por las exactas.
       En Google Maps: clic derecho sobre el lugar → copiás "-34.9xxx, -57.9xxx".
     - parada: id de PARADAS con el que se completa solo "¿En qué parada estás?".
     El QR general (sin ?p=) no tiene punto: ahí la persona escribe la parada.
     ------------------------------------------------------------------------ */
  PUNTOS: [
    { slug: 'plaza-san-martin', nombre: 'Plaza San Martín',           lat: -34.9146, lng: -57.9505, parada: 'plaza-san-martin' }, // TODO coordenadas exactas
    { slug: 'bosque',           nombre: 'Paseo del Bosque',           lat: -34.9105, lng: -57.9325, parada: 'bosque' }, // TODO
    { slug: 'terminal',         nombre: 'Terminal de ómnibus',        lat: -34.9049, lng: -57.9545, parada: 'terminal' }, // TODO
    { slug: 'estacion',         nombre: 'Estación de trenes',         lat: -34.9058, lng: -57.9460, parada: 'estacion' }, // TODO
    { slug: 'plaza-italia',     nombre: 'Plaza Italia',               lat: -34.9104, lng: -57.9565, parada: 'plaza-italia' }, // TODO
    { slug: 'facultad',         nombre: 'Puerta de facultad',         lat: -34.9065, lng: -57.9440 }, // TODO
    { slug: 'control-calle-8',  nombre: 'Calle 8 (punto de control)', lat: -34.9175, lng: -57.9535, parada: 'calle-8' }  // TODO
  ],

  /* ------------------------------------------------------------------------
     DESTINOS de la pregunta 1 ("¿A dónde vas ahora?").
     - ocultarEn: slugs de puntos donde NO se muestra este destino
       (para no ofrecer "Terminal" a alguien que está parado en la Terminal).
     - "Otro" no lleva coordenadas: usa los minutos fijos de TARIFA.otro.
     ------------------------------------------------------------------------ */
  DESTINOS: [
    { id: 'terminal',         nombre: 'Terminal de ómnibus',         lat: -34.9049, lng: -57.9545, ocultarEn: ['terminal'] },         // TODO
    { id: 'estacion',         nombre: 'Estación de trenes',          lat: -34.9058, lng: -57.9460, ocultarEn: ['estacion'] },         // TODO
    { id: 'plaza-moreno',     nombre: 'Plaza Moreno / Municipalidad', lat: -34.9214, lng: -57.9545, ocultarEn: [] },                 // TODO
    { id: 'facultades-bosque', nombre: 'Facultades del Bosque',      lat: -34.9080, lng: -57.9380, ocultarEn: ['bosque', 'facultad'] }, // TODO
    { id: 'rectorado',        nombre: 'Rectorado UNLP (7 y 47)',     lat: -34.9112, lng: -57.9530, ocultarEn: [] },                   // TODO
    { id: 'plaza-italia',     nombre: 'Plaza Italia',                lat: -34.9104, lng: -57.9565, ocultarEn: ['plaza-italia'] },     // TODO
    { id: 'plaza-san-martin', nombre: 'Plaza San Martín',            lat: -34.9146, lng: -57.9505, ocultarEn: ['plaza-san-martin'] }, // TODO
    { id: 'otro',             nombre: 'Otro',                        otro: true }
  ],

  /* ------------------------------------------------------------------------
     PARADAS para "¿En qué parada estás?" (texto libre con autocompletado).
     - claves: palabras que, si la persona las escribe, sugieren esa parada.
       No importan mayúsculas ni tildes: "moreno", "MORENO", "P Moreno" y
       "pza moreno" dan Plaza Moreno. Agregá todas las variantes que quieras.
     - lat / lng: TODO, aproximadas. Se usan como punto de partida para
       calcular minutos y precio. Si no coincide ninguna, se guarda lo que
       escribió y se calcula como "Otro".
     ------------------------------------------------------------------------ */
  PARADAS: [
    { id: 'plaza-moreno',      nombre: 'Plaza Moreno',              lat: -34.9214, lng: -57.9545, claves: ['moreno', 'municipalidad', 'muni', 'catedral', 'palacio municipal'] },
    { id: 'plaza-italia',      nombre: 'Plaza Italia',              lat: -34.9104, lng: -57.9565, claves: ['italia'] },
    { id: 'plaza-san-martin',  nombre: 'Plaza San Martín',          lat: -34.9146, lng: -57.9505, claves: ['san martin', 'legislatura', 'gobernacion', 'pasaje dardo rocha'] },
    { id: 'plaza-malvinas',    nombre: 'Plaza Malvinas',            lat: -34.9290, lng: -57.9620, claves: ['malvinas', 'islas malvinas'] },
    { id: 'plaza-azcuenaga',   nombre: 'Plaza Azcuénaga',           lat: -34.9235, lng: -57.9690, claves: ['azcuenaga', 'azcuénaga'] },
    { id: 'plaza-belgrano',    nombre: 'Plaza Belgrano',            lat: -34.9055, lng: -57.9640, claves: ['belgrano'] },
    { id: 'plaza-rocha',       nombre: 'Plaza Rocha',               lat: -34.9215, lng: -57.9440, claves: ['rocha'] },
    { id: 'plaza-paso',        nombre: 'Plaza Paso',                lat: -34.9135, lng: -57.9640, claves: ['paso', 'plaza paso'] },
    { id: 'plaza-olazabal',    nombre: 'Plaza Olazábal',            lat: -34.9265, lng: -57.9505, claves: ['olazabal'] },
    { id: 'plaza-sarmiento',   nombre: 'Plaza Sarmiento',           lat: -34.9285, lng: -57.9560, claves: ['sarmiento'] },
    { id: 'plaza-rivadavia',   nombre: 'Plaza Rivadavia',           lat: -34.9265, lng: -57.9430, claves: ['rivadavia'] },
    { id: 'plaza-guemes',      nombre: 'Plaza Güemes',              lat: -34.9325, lng: -57.9595, claves: ['guemes', 'güemes'] },
    { id: 'parque-alberti',    nombre: 'Parque Alberti',            lat: -34.9200, lng: -57.9790, claves: ['alberti'] },
    { id: 'parque-san-martin', nombre: 'Parque San Martín',         lat: -34.9340, lng: -57.9700, claves: ['parque san martin', 'pque san martin', 'pq san martin'] },
    { id: 'parque-saavedra',   nombre: 'Parque Saavedra',           lat: -34.9345, lng: -57.9485, claves: ['saavedra'] },
    { id: 'bosque',            nombre: 'Paseo del Bosque',          lat: -34.9105, lng: -57.9325, claves: ['bosque', 'paseo del bosque', 'lago', 'anfiteatro', 'museo', 'zoologico', 'observatorio'] },
    { id: 'cancha-estudiantes', nombre: 'Cancha de Estudiantes',    lat: -34.9142, lng: -57.9384, claves: ['estudiantes', 'cancha de estudiantes', 'pincha', 'uno', '1 y 57', 'estadio uno'] },
    { id: 'cancha-gimnasia',   nombre: 'Cancha de Gimnasia',        lat: -34.9140, lng: -57.9300, claves: ['gimnasia', 'cancha de gimnasia', 'lobo', 'bosque gimnasia', '60 y 118'] },
    { id: 'estadio-unico',     nombre: 'Estadio Único',             lat: -34.9135, lng: -57.9895, claves: ['estadio unico', 'unico', 'unico diego maradona'] },
    { id: 'fac-odontologia',   nombre: 'Facultad de Odontología',   lat: -34.9100, lng: -57.9390, claves: ['odontologia', 'odonto'] },
    { id: 'fac-ingenieria',    nombre: 'Facultad de Ingeniería',    lat: -34.9066, lng: -57.9441, claves: ['ingenieria', 'inge'] },
    { id: 'fac-medicina',      nombre: 'Facultad de Medicina',      lat: -34.9150, lng: -57.9310, claves: ['medicina', 'medi'] },
    { id: 'fac-derecho',       nombre: 'Facultad de Derecho',       lat: -34.9115, lng: -57.9535, claves: ['derecho', 'juridicas'] },
    { id: 'fac-economicas',    nombre: 'Facultad de Económicas',    lat: -34.9100, lng: -57.9500, claves: ['economicas', 'economia', 'ciencias economicas'] },
    { id: 'fac-arquitectura',  nombre: 'Facultad de Arquitectura',  lat: -34.9070, lng: -57.9380, claves: ['arquitectura', 'arqui'] },
    { id: 'fac-periodismo',    nombre: 'Facultad de Periodismo',    lat: -34.9080, lng: -57.9325, claves: ['periodismo', 'perio', 'comunicacion'] },
    { id: 'fac-exactas',       nombre: 'Facultad de Exactas',       lat: -34.9090, lng: -57.9420, claves: ['exactas', 'quimica', 'fisica'] },
    { id: 'fac-veterinaria',   nombre: 'Facultad de Veterinarias',  lat: -34.9125, lng: -57.9310, claves: ['veterinaria', 'veterinarias', 'vete'] },
    { id: 'fac-bellas-artes',  nombre: 'Facultad de Artes',         lat: -34.9225, lng: -57.9530, claves: ['bellas artes', 'artes'] },
    { id: 'rectorado',         nombre: 'Rectorado UNLP',            lat: -34.9112, lng: -57.9530, claves: ['rectorado', 'unlp', 'universidad', '7 y 47'] },
    { id: 'terminal',          nombre: 'Terminal de ómnibus',       lat: -34.9049, lng: -57.9545, claves: ['terminal', 'micro', 'micros', 'omnibus', 'colectivo', 'terminal de micro', 'terminal de omnibus'] },
    { id: 'estacion',          nombre: 'Estación de tren',          lat: -34.9058, lng: -57.9460, claves: ['estacion', 'tren', 'trenes', 'ferrocarril', 'roca', 'estacion de tren'] },
    { id: 'calle-8',           nombre: 'Calle 8',                   lat: -34.9175, lng: -57.9535, claves: ['8', 'calle 8', 'peatonal'] },
    { id: 'calle-12',          nombre: 'Calle 12',                  lat: -34.9200, lng: -57.9575, claves: ['12', 'calle 12', 'torre', 'torres'] },
    { id: 'diagonal-74',       nombre: 'Diagonal 74',               lat: -34.9170, lng: -57.9600, claves: ['74', 'diagonal 74', 'diag 74'] },
    { id: 'hospital-italiano', nombre: 'Hospital Italiano',         lat: -34.9285, lng: -57.9425, claves: ['hospital italiano', 'italiano'] },
    { id: 'hospital-san-martin', nombre: 'Hospital San Martín',     lat: -34.9385, lng: -57.9415, claves: ['hospital san martin', 'policlinico'] },
    { id: 'republica-ninos',   nombre: 'República de los Niños',    lat: -34.8670, lng: -58.0010, claves: ['republica de los ninos', 'republica'] }
  ],

  /* ------------------------------------------------------------------------
     CÁLCULO DE TIEMPOS Y PRECIO (sin APIs de mapas)
     distancia  = línea recta (haversine) × factorGrilla
     monopatín  = distancia / velMonopatin, redondeado hacia arriba, mínimo minMonopatin
     caminando  = distancia / velCaminando, redondeado
     precio     = desbloqueo + porMinuto × minutos + seguro, redondeado hacia arriba a "redondeo"
     ------------------------------------------------------------------------ */
  TARIFA: {
    factorGrilla: 1.25,  // La Plata es cuadrícula + diagonales
    velMonopatin: 15,    // km/h
    velCaminando: 4.5,   // km/h
    minMonopatin: 5,     // minutos mínimos a mostrar
    desbloqueo: 250,     // $
    porMinuto: 80,       // $ por minuto
    seguro: 200,         // $ por viaje
    redondeo: 50,        // redondear hacia arriba a múltiplos de $50
    otro: { monopatin: 10, caminando: 25 } // minutos usados si eligen "Otro"
  },

  /* ------------------------------------------------------------------------
     OFERTAS que se muestran si dicen "Es caro".
     descuentoValle: 0.30 = 30% menos (el precio con descuento se calcula solo).
     ------------------------------------------------------------------------ */
  OFERTAS: {
    pack:   { viajes: 10, minutos: 10, precio: 9900 },
    abono:  { viajes: 20, minutos: 15, precio: 19900 },
    valle:  { descuento: 0.30, desde: 10, hasta: 16 },
    preciosMaximos: [600, 900, 1100] // opciones de "¿Hasta cuánto pagarías?" (+ "Menos de $600")
  },

  /* Código de viaje gratis: RUVU-XXXX con estas letras/números (sin 0, O, 1, I). */
  CODIGO: { prefijo: 'RUVU-', largo: 4, alfabeto: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' },

  /* Mensaje que se abre en WhatsApp al tocar "Invitá a un amigo". {link} se reemplaza. */
  MENSAJE_INVITACION: 'Mirá, llega RUVU a La Plata: monopatines eléctricos compartidos 🛴 Fijate cuánto tardarías vos y llevate un viaje gratis 👉 {link}'
};
