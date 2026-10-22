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
  SITE_URL: 'https://TODO-usuario.github.io/ruvu-encuesta/',

  /* PIN para entrar al contador (/contador.html) y al panel (/panel.html).
     IMPORTANTE: tiene que ser el mismo que pongas en apps-script/Code.gs. */
  PIN: '2026',

  /* ------------------------------------------------------------------------
     PUNTOS donde se deja el monopatín. Cada uno tiene su QR: <SITE_URL>?p=<slug>
     - slug: identificador corto, sin espacios ni tildes. NO lo cambies una vez
       impresos los carteles (se rompería la medición).
     - lat / lng: TODO. Son aproximadas: reemplazalas por las exactas.
       En Google Maps: clic derecho sobre el lugar → copiás "-34.9xxx, -57.9xxx".
     ------------------------------------------------------------------------ */
  PUNTOS: [
    { slug: 'plaza-san-martin', nombre: 'Plaza San Martín',           lat: -34.9146, lng: -57.9505 }, // TODO coordenadas exactas
    { slug: 'bosque',           nombre: 'Paseo del Bosque',           lat: -34.9105, lng: -57.9325 }, // TODO
    { slug: 'terminal',         nombre: 'Terminal de ómnibus',        lat: -34.9049, lng: -57.9545 }, // TODO
    { slug: 'estacion',         nombre: 'Estación de trenes',         lat: -34.9058, lng: -57.9460 }, // TODO
    { slug: 'plaza-italia',     nombre: 'Plaza Italia',               lat: -34.9104, lng: -57.9565 }, // TODO
    { slug: 'facultad',         nombre: 'Puerta de facultad',         lat: -34.9065, lng: -57.9440 }, // TODO
    { slug: 'control-calle-8',  nombre: 'Calle 8 (punto de control)', lat: -34.9175, lng: -57.9535 }  // TODO
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
