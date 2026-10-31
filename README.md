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
qr/                 QR generados (PNG + SVG por punto)
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
| `respuestas` | Una fila por sesión (`session_id`), que se actualiza con cada respuesta. Columnas: timestamp_scan, timestamp_inicio, timestamp_fin, punto, ref, destino, modo_actual, frecuencia, min_monopatin, min_caminando, precio_mostrado, usaria, motivo_no, edad, acepta_precio, oferta_elegida, precio_max, whatsapp, consentimiento, dia_primer_viaje, franja_primer_viaje, codigo, invito_amigo, ultimo_paso, completo, user_agent. |
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

### Dirección que se ve al escanear: `ruvu-lp.github.io`

Para que al escanear no aparezca el usuario personal, el sitio vive en una **organización** de GitHub (gratis):

1. Crear la organización: https://github.com/account/organizations/new?plan=free → nombre **`ruvu-lp`** (si está tomado, elegí otro y cambiá `SITE_URL` en `config.js` + `npm run qr`).
2. En el repo actual: **Settings → General → Danger Zone → Transfer ownership** → a `ruvu-lp`.
3. Ya en la organización: **Settings → General → Repository name** → **`ruvu-lp.github.io`** → *Rename*.
4. **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → *Save*.
5. En 1–2 minutos queda en **https://ruvu-lp.github.io/** (sin `/ruvu-encuesta`).

Los QR de `/qr` ya apuntan a esa dirección.

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

## Parada ("¿En qué parada estás?")

Primera pregunta después de *Empezar*. Es **una sola pregunta obligatoria**: se ve la lista de `PARADAS` de `config.js` para elegir **una**; arriba hay un campo para buscar o escribir. Si el lugar no está, elige "Otra: «lo que escribió»".

Todas las preguntas son obligatorias y de una sola opción (el primer toque bloquea las demás). Lo único que se puede no dejar es el WhatsApp ("Prefiero no dejarlo"), porque el consentimiento para datos personales tiene que ser libre (Ley 25.326).

El autocompletado usa:
- `claves`: palabras que disparan la sugerencia. No importan mayúsculas, tildes ni "plaza", "pza", "facultad de"…: `moreno`, `MORENO`, `P Moreno` → **Plaza Moreno**; `italia` → **Plaza Italia**; `tren` → **Estación de tren**; `8` → **Calle 8**.
- Si escanea el QR de un punto, la parada ya aparece completa (campo `parada` de cada punto).
- Se guarda `parada` (id reconocido, u `otra`) y `parada_texto` (lo que escribió). Si la parada tiene coordenadas, desde ahí se calculan minutos y precio, y no se ofrece como destino un lugar a menos de 300 m.
- Para sumar una parada o una palabra clave, agregala en `PARADAS` (coordenadas aproximadas: TODO).

## 4. QR y carteles

Requiere [Node.js](https://nodejs.org) (versión 18 o más).

```bash
npm install
npm run qr
```

Genera en `/qr/` un `<slug>.png` (1200 px) y un `<slug>.svg` por punto, más **`general.png/.svg`** (QR sin punto, sirve en cualquier lugar: la persona escribe su parada), negro sobre blanco, con margen y corrección de errores media. Cada QR apunta a `SITE_URL?p=<slug>`. Si `SITE_URL` todavía dice TODO te avisa.

Después subí la carpeta `qr/` a GitHub junto con lo demás y abrí **`carteles.html`** (en tu sitio o local):
- una hoja A5 por punto: PRÓXIMAMENTE · logo · "Escaneá para saber cuánto tardarías" · QR grande · nombre del punto chiquito abajo;
- imprimí con tamaño **A5**, márgenes **ninguno**, escala **100%** (en una hoja A4 podés elegir "2 páginas por hoja");
- está pensado en blanco y negro puro. Probá escanear uno impreso antes de salir.

Ya hay un PDF de ejemplo en `capturas/carteles-A5.pdf` (con la URL provisoria; regeneralo con la real).

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
npm run dev        # http://localhost:8080/?p=plaza-san-martin   (simula el Apps Script en memoria)
npm test           # simula 20 sesiones de punta a punta y verifica hoja + panel
npm run capturas   # regenera /capturas (360 px y 320 px) y el PDF de carteles
```

`npm test` recorre con un navegador real los caminos: sí, depende, es caro (pack / abono / valle / ninguna + precio máximo), no lo pagaría, "No" (sin mostrar precio), menores de 18, abandonos a mitad, solo escaneo, sin `?p=`, referido, re-escaneo ("Ya participaste") y corte de conexión a mitad de la encuesta. Después verifica fila por fila la hoja `respuestas`, los conteos del `doGet`, el contador (incluido "deshacer"), la fila Total del panel, el CSV y el filtro de fechas.

---

## Pendientes (TODO)

- [ ] Coordenadas exactas de puntos y destinos (`config.js`).
- [ ] (Opcional) Logo SVG en `assets/` si querés reemplazar el wordmark de texto.
- [ ] `SITE_URL` real → `npm run qr` → imprimir carteles.
- [ ] Email de contacto y razón social en `privacidad.html`.
- [ ] Cambiar el PIN `2026` (en `config.js` y `Code.gs`).
