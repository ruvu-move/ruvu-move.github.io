# RUVU · Encuesta pretotipo

Web mobile para validar la demanda de RUVU (monopatines eléctricos compartidos en La Plata). Se deja un monopatín ploteado en un punto con un cartel y un QR; quien lo escanea hace una encuesta de 1 minuto desde el navegador. No hay que descargar nada y no se cobra nada.

Todo es gratis: sitio estático en **GitHub Pages** y datos en **Google Sheets** a través de un **Apps Script**.

```
index.html          Encuesta (lo que abre el QR: ?p=<punto>)
privacidad.html     Texto breve de privacidad (Ley 25.326)
contador.html       Contador manual para el equipo (+1 Pasa / +1 Se frena), con PIN
panel.html          Embudo y resultados, con PIN
carteles.html       Carteles A5 para imprimir, uno por punto
config.js           ← TODO lo editable: puntos, destinos, tarifas, ofertas, URL, PIN
css/estilos.css     Estilos (colores de marca arriba de todo)
js/                 Lógica (comun.js, encuesta.js, contador.js, panel.js)
apps-script/Code.gs Backend para pegar en Google Apps Script
scripts/generar-qr.js  Genera los QR (npm run qr)
qr/                 QR general (PNG + SVG): uno solo para todas las ubicaciones
tests/              Servidor local, simulación de 20 sesiones y capturas
capturas/           Capturas mobile de cada pantalla + carteles-A5.pdf
```

---

## 1. Google Sheet y Apps Script

> **Atajo:** en `planilla/RUVU-respuestas.xlsx` está la planilla lista (hojas `respuestas`, `eventos`, `conteo`, un `Resumen` con fórmulas y la lista de `Paradas`). Subila a Google Drive → *Abrir con Hojas de cálculo de Google* → *Archivo → Guardar como Hojas de cálculo de Google*, y seguí desde el paso 2. La hoja *Instrucciones* repite estos pasos.

1. Entrá a [sheets.new](https://sheets.new) y creá una planilla, por ejemplo **"RUVU encuesta"**.
2. En la planilla: **Extensiones → Apps Script**.
3. Borrá lo que haya en `Código.gs` y pegá todo el contenido de [`apps-script/Code.gs`](apps-script/Code.gs).
4. En la línea `var PIN = '2026';` poné el PIN del equipo (el **mismo** que en `config.js`). Guardá (💾).
5. Arriba, elegí la función **`configurarHojas`** y tocá **▶ Ejecutar**. La primera vez Google pide permisos:
   *Revisar permisos → tu cuenta → Configuración avanzada → Ir a (no seguro) → Permitir*. Es tu propio script, es normal.
   Se crean las hojas `respuestas`, `eventos` y `conteo`.
6. **Implementar → Nueva implementación** → engranaje ⚙ → **Aplicación web**:
   - Descripción: `v1`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
   - **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
7. Pegala en `config.js` → `API_URL: 'https://script.google.com/macros/s/…/exec'`.
8. Prueba rápida: abrí `<URL>/exec?accion=ping` en el navegador. Tiene que decir `{"ok":true,"ping":"pong"}`.

> **Si cambiás `Code.gs` después**: *Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar*. Así la URL sigue siendo la misma. Si hacés "Nueva implementación" cambia la URL y hay que actualizar `config.js`.

### Qué se guarda

| Hoja | Contenido |
|---|---|
| `respuestas` | Una fila por sesión (`session_id`), que se actualiza con cada respuesta. Columnas: timestamp_scan, timestamp_inicio, timestamp_fin, punto, ref, destino, modo_actual, frecuencia, min_monopatin, min_caminando, precio_mostrado, usaria, motivo_no, edad, acepta_precio, oferta_elegida, precio_max, whatsapp, consentimiento, motivo_viaje, vuelta, cuadras, uso_previo, dia_primer_viaje, franja_primer_viaje, codigo, invito_amigo, ultimo_paso, completo, user_agent. |
| `eventos` | Log crudo: cada scan, cada respuesta y cada invitación, con su JSON. |
| `conteo` | Cada toque del contador (`pasa`, `frena`, `deshacer`) con hora y punto. |

- **`ultimo_paso`** es la pantalla en la que está (o quedó) la persona: `inicio`, `destino`, `modo`, `frecuencia`, `usaria`, `motivo_no`, `edad`, `precio`, `oferta`, `precio_max`, `whatsapp`, `primer_viaje`, y los finales `fin`, `fin_sin_whatsapp`, `fin_menor`.
- **`completo = si`** cuando llegó al final de la encuesta (dejó WhatsApp, eligió "Prefiero no dejarlo" o es menor).
- **`ref`** tiene el código del amigo que lo invitó. Para dar el "viaje extra" a quien invitó: filtrá `ref = RUVU-XXXX` y `completo = si`.
- Re-escaneos de alguien que ya participó quedan solo en `eventos` (no generan fila nueva).
- Si se corta Internet, los envíos quedan en el celular y se reintentan solos.
- El código RUVU-XXXX lo valida el servidor: si saliera repetido, le asigna otro antes de mostrarlo.

---

## 2. Publicar en GitHub Pages

### Dirección que se ve al escanear: `ruvu-move.github.io`

El sitio vive en la **organización** de GitHub `ruvu-move` (gratis), así al escanear no aparece el usuario personal:

- Repo: https://github.com/ruvu-move/ruvu-move.github.io
- **Settings → Pages** → *Deploy from a branch* → `main` / `(root)`.
- Sitio: **https://ruvu-move.github.io/**

Los QR de `/qr` y los carteles ya apuntan a esa dirección. Si algún día cambia, editá `SITE_URL` en `config.js` y corré `npm run qr`.

### Pasos generales

1. Creá una cuenta en [github.com](https://github.com) si no tenés.
2. **New repository** → nombre `ruvu-encuesta` → **Public** → *Create repository*.
3. Subí los archivos de esta carpeta:
   - Con la terminal (desde esta carpeta):
     ```bash
     git remote add origin https://github.com/<tu-usuario>/ruvu-encuesta.git
     git push -u origin main
     ```
   - O sin terminal: en el repo vacío, *uploading an existing file* y arrastrá todo (menos `node_modules`).
4. En el repo: **Settings → Pages** → *Source: Deploy from a branch* → Branch **main** / **(root)** → *Save*.
5. En 1–2 minutos queda en `https://<tu-usuario>.github.io/ruvu-encuesta/`.
6. Poné esa URL en `config.js` → `SITE_URL` y volvé a generar los QR (paso 4).

**Alternativa Netlify:** entrá a [app.netlify.com/drop](https://app.netlify.com/drop) y arrastrá la carpeta. Te da una URL `https://xxxx.netlify.app/` (usala en `SITE_URL`).

> Ojo: el PIN está en `config.js`, que es público. Sirve para que un curioso no entre al contador/panel, no es seguridad fuerte. El panel **nunca** muestra WhatsApps (solo conteos); los números quedan únicamente en tu Google Sheet.

---

## 3. Cambiar puntos, precios y colores

Todo en **`config.js`** (está comentado línea por línea):

- **Puntos** (`PUNTOS`): `slug` (lo que va en el QR, sin espacios ni tildes), `nombre`, `lat`, `lng`.
  Las coordenadas actuales son **aproximadas (TODO)**: en Google Maps, clic derecho sobre el lugar → copiás `-34.9xxx, -57.9xxx`.
  ⚠️ No cambies un `slug` una vez impresos los carteles.
- **Destinos** (`DESTINOS`): igual; `ocultarEn` indica en qué puntos no se ofrece ese destino.
- **Tarifas** (`TARIFA`): velocidades, factor de grilla (1,25), desbloqueo $250, $80/min, seguro $200, redondeo a $50, y los minutos de "Otro".
- **Ofertas** (`OFERTAS`): pack, abono, % de horario valle y opciones de precio máximo.
- **PIN**: en `config.js` **y** en `Code.gs` (tienen que coincidir).

**Diseño**: sigue la identidad visual "RUVU — Identidad visual / Marca 2.0":
- Tipografías: **Unbounded** (logo, títulos, precios, código), **Manrope** (textos) y **Permanent Marker** solo para las frases tipo grafiti ("Atajá por la diagonal", "Llegá antes, quedate más."). Se cargan de Google Fonts; Permanent Marker se baja recortada a esas letras.
- Logo "RUVU." en Unbounded 900 con el punto verde, trama platense (cuadrícula + diagonales + plaza) en la pantalla de inicio y el búho en las pantallas finales.
- Violeta y magenta son decoración: nunca en botones ni en textos importantes.

**Colores**: arriba de todo en `css/estilos.css`:
```css
--ruvu-verde: #12E39A;   /* Verde RUVU */
--ruvu-negro: #0B0B0B;   /* Negro asfalto */
--ruvu-blanco: #FFFFFF;
--grafito: #2B2F31;
--gris-plaza: #A6ADB0;
--violeta: #6B2BD9;      /* Violeta Diagonal (solo decoración) */
--magenta: #FF3D9A;      /* Magenta Plaza (solo decoración) */
```
(El búho y la trama tienen los colores escritos en `js/encuesta.js`, funciones `buho()` y `trama()`.)

**Logo**: si ponés `assets/logo-ruvu.svg` (versión clara, para fondo negro) se usa en la encuesta en lugar del texto "RUVU.". Para los carteles impresos poné además `assets/logo-ruvu-negro.svg` (versión negra).

Cómo se calcula el viaje:
- distancia = línea recta (haversine) × 1,25
- monopatín = distancia ÷ 15 km/h, redondeado hacia arriba, mínimo 5 min
- caminando = distancia ÷ 4,5 km/h, redondeado
- precio = 250 + 80 × min + 200, redondeado hacia arriba a $50 (ej.: 6 min → $950; "Otro" 10 min → $1.250)

---

## Encuesta v2.1 (flujo actual)

Una pregunta por pantalla y **todas obligatorias** (salvo el WhatsApp). No hay bienvenida: al escanear se ve directo **¿Dónde estás?** con un encabezado corto ("RUVU llega a La Plata 🛴 Todavía no anda: respondé 9 preguntas y te regalamos tu primer viaje."; si llega con `?ref=`: "Te invitaron a RUVU 🛴 …"). Hasta que toque una opción, la fila queda en `ultimo_paso = inicio`; el primer toque marca `timestamp_inicio`.

Arriba, una barra con un 🎁 al final muestra cuánto falta para el viaje gratis. Cuenta las 9 preguntas del recorrido (8 si dice "No" y saltea el precio); las condicionales (cuadras, motivo del No) no suman.

1. **¿Dónde estás?** (`parada`) Botones de `DONDE_ESTAS` (`config.js`, en dos columnas) + "Otra", que abre un campo obligatorio de 3 letras o más ("Contanos dónde estás para calcular tu viaje").
2. **¿A dónde vas?** (`destino`)
   - 2b. **¿Más o menos cuántas cuadras son?** (`cuadras`) Solo si la parada es "Otra" o el destino es "Otro". 1 cuadra = `TARIFA.cuadraKm` (0,13 km). Se guarda en `cuadras_estimadas`.
3. **¿Cómo ibas a ir?** (`modo`) 4. **¿Cuántas veces por semana?** (`frecuencia`)
5. **¿Para qué es este viaje?** (`motivo`) → `motivo_viaje`.
6. **¿Lo usarías?** (`usaria`) "No" → **¿Por qué no?** (`motivo_no`) y saltea el precio.
7. **¿Cuánto pagarías como máximo?** (`precio`) → `precio_max_v2`.
8. **¿Qué días y horarios lo usarías?** (`primer_viaje`) Opción múltiple: *Siguiente* se habilita con al menos un día y un horario. Se guardan separados por coma en `dia_primer_viaje` y `franja_primer_viaje` (ej. `lun,mie` · `7-10,16-19`); el panel cuenta cada uno por separado.
9. **Edad** (menos de 18 corta, sin código).
10. **WhatsApp** (opcional): *Activar mi viaje* o *Seguir sin dejar mi número* (mismo tamaño). Si escribe un número, el número válido y el consentimiento son obligatorios.
11. **Código** (`completo = si`): código + "Sacale captura" o "Te lo mandamos por WhatsApp" + invitar. Sin número: *Mejor quiero dejar mi número*.

Si vuelve atrás y cambia una respuesta, se guarda la nueva y se recalcula lo que depende de ella (minutos y precio si cambia el destino; si pasa de "No" a "Sí" se borra el motivo del No, y al revés se borra el precio).

**Si vuelve a escanear:**
- No terminó → retoma en la **primera pregunta sin responder**, con el mismo `session_id` y todo lo anterior cargado ("Seguí donde dejaste" · *Empezar de nuevo*). Columna `retomada = si`. Si abrió y no tocó nada, no hay nada que retomar.
- Ya participó (tiene `ruvu_participacion`) → toda sesión de ese celular se guarda con `repetido = si` desde el primer `scan`. Ve su código (`ultimo_paso = ya_tiene_codigo`) y puede tocar *Responder por otro trayecto*: **se reutiliza esa misma sesión**, arranca en ¿A dónde vas? (sin ¿Dónde estás?, así que pregunta las cuadras), saltea edad y WhatsApp y al final muestra **el mismo código**.

**Horas:** `timestamp_scan`, `timestamp_inicio` y `timestamp_fin` (y la columna `timestamp` de `eventos`) son la hora del **servidor** al llegar cada evento. La hora del celular queda solo en `eventos.datos` como `hora_cliente`. La planilla muestra las horas en su zona (*Archivo → Configuración → Zona horaria*: Buenos Aires).

**Modo prueba:** abrí la encuesta con `?test=1` (por ejemplo `https://ruvu-move.github.io/?test=1`). Esas sesiones quedan con `test = si` y el panel no las cuenta. El panel tampoco cuenta sesiones abiertas desde una computadora.

### Columnas nuevas de `respuestas` (al final, en este orden)

`test` · `repetido` · `retomada` · `cuadras_estimadas` · `precio_max_v2` · `version`

Ninguna columna existente se mueve ni se renombra. `acepta_precio`, `oferta_elegida`, `precio_max`, `vuelta`, `cuadras` y `uso_previo` quedan vacías en las sesiones nuevas.

### Publicar una nueva versión del Apps Script (sin cambiar la URL)

1. En la planilla: *Extensiones → Apps Script* → reemplazá todo `Código.gs` por `apps-script/Code.gs` → Guardar.
2. **Implementar → Administrar implementaciones → ✏️ (Editar) → Versión: Nueva versión → Implementar.**
3. **Nunca** "Nueva implementación": genera otra URL `/exec` y la encuesta deja de guardar.
4. Probá `<URL>/exec?accion=ping` → `{"ok":true,"ping":"pong"}`.

### Duplicados viejos en `eventos`

El Apps Script nuevo ignora cualquier `event_id` que ya exista, así que no se generan más. Para borrar los viejos (una sola vez):
1. Hacé una copia de la planilla (*Archivo → Crear una copia*).
2. En Apps Script elegí `contarDuplicados` → ▶ Ejecutar → mirá el registro (dice cuántas filas borraría).
3. Elegí `limpiarDuplicados` → ▶ Ejecutar. Deja la primera fila de cada `event_id` y borra las repetidas. No toca `respuestas`.

## 4. QR y carteles

Requiere [Node.js](https://nodejs.org) (versión 18 o más).

```bash
npm install
npm run qr
```

Genera en `/qr/` **un solo QR**, `general.png` (1200 px) y `general.svg`, que apunta a `SITE_URL` y sirve para todas las ubicaciones: la persona escribe en qué parada está. Negro sobre blanco, con margen y corrección de errores media. (Los links `SITE_URL?p=<slug>` de `PUNTOS` siguen funcionando si algún día querés un QR por punto.)

Después subí la carpeta `qr/` a GitHub junto con lo demás y abrí **`carteles.html`** (en tu sitio o local):
- una hoja A5 por punto: PRÓXIMAMENTE · logo · "Escaneá para saber cuánto tardarías" · QR grande · nombre del punto chiquito abajo;
- imprimí con tamaño **A5**, márgenes **ninguno**, escala **100%** (en una hoja A4 podés elegir "2 páginas por hoja");
- está pensado en blanco y negro puro. Probá escanear uno impreso antes de salir.

El PDF listo para imprimir (1 cartel A5 con el QR único) está en `qr/carteles-A5.pdf` y en `capturas/carteles-A5.pdf`.

---

## 5. Usar el contador y el panel

- **`/contador.html`**: PIN → elegís el punto → **+1 Pasa** (pasó sin mirar) o **+1 Se frena a mirar** (ya cuenta también como "pasa"). **Deshacer** borra el último toque de ese punto. Abajo dice si hay envíos pendientes; si no hay señal, se guardan y se mandan solos después.
- **`/panel.html`**: mismo PIN. Muestra por punto y en total el embudo
  **Pasan → Se frenan → Escanean → Empiezan → Usaría: sí → Acepta el precio → Dejan WhatsApp → Invitan**, con el % respecto del paso anterior (salvo "Acepta el precio", sobre los que dijeron sí o depende, que son los únicos que ven el precio, y "Dejan WhatsApp", sobre los que empezaron, porque se le pide a todos). También muestra los referidos, distribuciones de cada respuesta, el abandono por paso y un filtro por fechas. **Exportar CSV** baja todo con `;` como separador (abre directo en Excel en español).
- El embudo cuenta solo a la gente que llegó por el QR del punto. Los que llegan por el link de un amigo van en "Referidos".
- Sin `API_URL`, el panel ofrece **"Ver con datos de ejemplo"** para que veas cómo queda.

---

## 6. Probar en tu compu

```bash
npm install
npm run dev        # http://localhost:8080/   (simula el Apps Script en memoria)
npm test           # simula sesiones de punta a punta y verifica hoja + panel
npm run capturas   # regenera /capturas (375 × 667 y 320 px)
```

`npm test` recorre con un navegador real (vista de celular): completa con número, sin número (+ "Mejor quiero dejar mi número"), parada "Otra" + destino "Otro" con cuadras (y verifica minutos y precio), "No" que saltea el precio, menor de 18, abandono y retomar con el mismo `session_id`, "Empezar de nuevo", ya completó + otro trayecto sin código nuevo, participante de la encuesta vieja, corte de conexión y **respuestas perdidas** (el servidor guarda pero el celular no se entera: lo que generaba los duplicados) sin un solo `event_id` repetido, modo prueba, computadora, y los totales del doGet y del panel.

---

## Pendientes (TODO)

- [ ] Coordenadas exactas de puntos y destinos (`config.js`).
- [ ] (Opcional) Logo SVG en `assets/` si querés reemplazar el wordmark de texto.
- [ ] `SITE_URL` real → `npm run qr` → imprimir carteles.
- [ ] Email de contacto y razón social en `privacidad.html`.
- [ ] Cambiar el PIN `2026` (en `config.js` y `Code.gs`).

## Búho RUVU

La mascota aparece animada a mitad de la encuesta (pantalla de edad) con un globo de texto, para que la persona siga respondiendo. Archivos: `assets/buho.webp` (animado, con transparencia), `assets/buho.gif` (respaldo) y `assets/buho.png` (fijo). Para cambiar el texto, buscá `buho(` en `js/encuesta.js`.
