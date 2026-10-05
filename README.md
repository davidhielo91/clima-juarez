# Clima Ciudad Juárez

Panel del clima **hiperdetallado para Ciudad Juárez, Chihuahua** (31.7384°, −106.4572°,
zona horaria `America/Ciudad_Juarez`), pensado para desplegarse en Vercel.

No usa claves de API ni base de datos: todo sale de fuentes abiertas y gratuitas.

## Qué muestra

| Módulo | Detalle |
| --- | --- |
| **Avisos** | Umbrales locales sobre el pronóstico: calor y frío extremos, tolvaneras, polvo, radiación, aire y arranques de monzón |
| **Ahora mismo** | Temperatura, sensación térmica, viento en la escala Beaufort, humedad, punto de rocío, **presión en la estación y reducida al mar**, visibilidad, nubosidad por pisos, radiación, CAPE, bulbo húmedo, déficit de presión de vapor |
| **Columna vertical** | Nivel de congelación, capa límite mezclada, viento a 10/80/120/180 m y temperatura del suelo a 0/6/18/54 cm |
| **Próximas 2 horas** | Avance cada **15 minutos**: temperatura, probabilidad y acumulado de lluvia, viento |
| **Próximas 168 horas** | Trazo de temperatura, barras de lluvia y tabla hora por hora con 16 variables |
| **Próximos 16 días** | Máximas y mínimas, sensación, lluvia, viento, UV, radiación, ET0, salida y puesta del sol; cada día se despliega a sus 24 horas |
| **Seis modelos** | ECMWF, GFS, ICON, GEM, ARPEGE y UM comparados día por día, con el desacuerdo entre ellos |
| **Ensamble** | 30 miembros del GFS: bandas p10–p90, probabilidad de lluvia y de superar los 35 °C |
| **Calidad del aire** | PM10, PM2.5, CO, NO₂, SO₂, O₃, polvo, aerosoles e índices estadounidense y europeo |
| **Sol y radiación** | Amanecer, atardecer, duración del día, horas de sol, UV, radiación global/directa/difusa/DNI y fase lunar |
| **Suelo** | Temperatura y humedad a cinco profundidades, ET0 y evaporación |
| **Por zonas** | Seis puntos de la ciudad comparados, con la elevación que reporta el modelo |
| **Histórico y clima** | Últimos 14 días y anomalía contra los valores normales de 1995–2024 |
| **Radar** | Fotogramas de RainViewer sobre Juárez–El Paso, con reproducción y deslizador |

Además: instalable como aplicación (PWA), con avisos locales del navegador y unidad
de medida conmutable en °C/°F, km/h/mph/m/s, mm/in, hPa/inHg y m/ft.

## Requisitos

- **Node.js 24** o superior (probado con 24.21.0).
- **pnpm 11** (el `packageManager` del `package.json` fija `pnpm@11.7.0`).

## Correr en local

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Otros comandos:

```bash
pnpm build        # build de producción
pnpm start        # sirve el build
pnpm test         # pruebas de las funciones de cálculo y de formato
pnpm lint         # ESLint
pnpm typecheck    # TypeScript sin emitir
pnpm check:contrast   # contraste de los colores de texto (WCAG AA)
pnpm verify:sources   # comprueba las 9 fuentes contra las APIs reales
```

## Verificación

`pnpm verify:sources` golpea los nueve endpoints con **las mismas URLs que usa la app
en producción** y comprueba que responden y que traen cada variable esperada. Es
deliberadamente ruidoso si Open-Meteo renombra algo: es mejor enterarse aquí que con
la página ya desplegada. Se ejecuta contra la red, así que no forma parte de
`pnpm test`.

Resultado esperado (comprobado):

```
ok   forecast detallado — 408 h × 59 variables, 17 días
ok   pronóstico cada 15 min — 8 pasos
ok   zonas de la ciudad — 6 puntos, elevaciones 1116–1297 m
ok   calidad del aire — 120 h, celda 31.70/-106.50 (~11 km)
ok   seis modelos — 6 modelos × 384 h
ok   ensamble — 30 miembros × 240 h
ok   radar — 13 fotogramas
ok   histórico reciente — 15 días
ok   climatología — 10958 días, 30 años distintos
```

## Qué está comprobado, y cómo

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Cálculo y formato | `pnpm test` | **278 pruebas en 11 archivos**, todas en verde |
| Tipos | `pnpm typecheck` | sin errores |
| Estilo | `pnpm lint` | sin errores |
| Contraste de color | `pnpm check:contrast` | los 11 colores de texto superan **4.5:1** (WCAG AA) sobre las superficies donde se usan; el mínimo medido es 5.03:1 |
| Fuentes en vivo | `pnpm verify:sources` | 9 endpoints, todas las variables presentes |
| Construcción | `pnpm build` | compila, pasa lint y tipos, y genera las páginas |
| Render con datos reales | servidor de producción + inspección del HTML | los **14 módulos** se pintan; **cero** `undefined`, `NaN`, `null` ni mensajes de error en el texto visible |
| Peso de la página | — | 2.3 MB de HTML que quedan en **134 KB comprimidos** |
| Teselas del radar y del mapa base | `pnpm verify:sources` | el zoom configurado devuelve **lluvia real y no la imagen de error** de RainViewer (543 B frente a 1370 B); la rejilla 3×2 cubre 799 × 533 km |

Esa comprobación de las teselas nació de un fallo real: el radar pedía un zoom que
RainViewer no sirve, y como la respuesta llegaba con código 200, una verificación que
solo mirara el estado la daba por buena. El mapa salía cubierto de carteles de «Zoom
Level Not Supported». Ahora se compara el archivo real con el de error.

Lo que **no** se puede comprobar sin un dispositivo real: la instalación como
aplicación en Android e iOS, la emisión de `beforeinstallprompt` y la aparición de
las notificaciones del sistema. Todo eso exige HTTPS y un navegador de verdad.

## Desplegar en Vercel

El inicio de sesión de Vercel es interactivo en tu navegador, así que hazlo tú:

```bash
pnpm exec vercel login
pnpm exec vercel link      # crea el proyecto
pnpm exec vercel --prod    # despliega a producción
```

No hace falta configurar **ninguna variable de entorno**. El proyecto no toca
secretos.

Si prefieres desplegar desde Git, sube el repositorio a GitHub y conéctalo en el panel
de Vercel: detecta Next.js y usa `pnpm install` y `pnpm build` sin ajustes.

Opcional: si quieres mover las funciones a otra región (por omisión Vercel usa
Washington D. C.), cámbialo en *Settings → Functions → Region*. Para una audiencia en
Juárez y El Paso, Dallas o Los Ángeles acercan la respuesta. No se fija en el
repositorio a propósito, porque algunas regiones solo están disponibles en planes de
pago y un valor fijo rompería el despliegue en el plan gratuito.

## Arquitectura

```
src/
├─ app/
│  ├─ layout.tsx            tipografías, metadatos, idioma es-MX
│  ├─ page.tsx              la hoja de registro, con Suspense por módulo
│  └─ globals.css           tokens de color y retícula del papel de registrador
├─ components/
│  ├─ ui/                   primitivas, gráficas SVG, iconos del tiempo
│  ├─ sections/             un componente de servidor por módulo
│  ├─ shell/                cabecera y pie
│  ├─ units/                conmutador de unidades
│  ├─ radar/                visor de radar (único componente de cliente con lógica)
│  └─ pwa/                  service worker, instalación y permiso de avisos
├─ lib/
│  ├─ endpoints.mjs         FUENTE ÚNICA DE VERDAD de URLs y variables
│  ├─ types.ts              tipos normalizados
│  ├─ fetchJson.ts          la única puerta a la red; nunca lanza
│  ├─ sources/              clientes de cada API, uno por endpoint
│  ├─ derive/               funciones puras de cálculo (con pruebas)
│  ├─ units.ts, format.ts   conversión y fechas en hora de Juárez
│  └─ preferences.ts        unidades guardadas en cookie
└─ test/                    pruebas de las funciones puras
scripts/
└─ verify-sources.mjs       comprobación de las fuentes
```

Decisiones que conviene conocer antes de tocar el código:

- **`src/lib/endpoints.mjs` manda.** Está en JavaScript plano para que la app
  (TypeScript) y el script de verificación (Node puro) construyan exactamente las
  mismas URLs. Si añades una variable, añádela ahí y vuelve a correr
  `pnpm verify:sources`.
- **Las horas se muestran siempre en hora de Juárez.** Open-Meteo devuelve la hora
  local sin desfase; si se interpretara con la zona del navegador, quien consulta
  desde Madrid vería otra hora. La hora de pared se trata como UTC y todo se formatea
  con `timeZone: "UTC"` (ver `src/lib/format.ts`).
- **Las unidades se resuelven en el servidor** con una cookie, así que el HTML llega
  con los números ya convertidos y sin parpadeo.
- **Los datos en vivo nunca se cachean en el service worker.** Solo se guarda la
  última página para poder abrirla sin conexión; un pronóstico viejo presentado como
  actual sería peor que no mostrar nada.

## Fuentes y consumo de cuota

| Fuente | Uso | Frecuencia de refresco |
| --- | --- | --- |
| `api.open-meteo.com/v1/forecast` | Pronóstico detallado (17 días, 59 variables) | 15 min |
| el mismo, multi-ubicación | Seis zonas de la ciudad en una sola petición | 15 min |
| el mismo, `minutely_15` | Detalle de 2 horas | 5 min |
| el mismo, `models` | Seis modelos globales | 30 min |
| `ensemble-api.open-meteo.com` | 30 miembros del GFS | 1 h |
| `air-quality-api.open-meteo.com` | Contaminantes (CAMS) | 30 min |
| `archive-api.open-meteo.com` | Climatología 1995–2024, por décadas | 24 h |
| `api.rainviewer.com` | Fotogramas de radar | 5 min |

Con tráfico continuo son unas **900 peticiones al día**, muy por debajo del límite no
comercial de Open-Meteo (unas 10 000). El cálculo asume que cada respuesta se reutiliza
durante su intervalo (`next: { revalidate }`), no una petición por visita.

## Límites, dichos en la propia interfaz

- El pronóstico viene de una **malla de modelo**: al pedir una coordenada, la API
  responde con la celda más cercana (en la práctica, 31.7448° / −106.4693°). Las
  "zonas" comparan celdas de modelo, no sensores por colonia.
- La **calidad del aire** usa una celda de unos 11 km y la cuenca atmosférica es
  compartida con El Paso: el valor es regional.
- La API **no publica amoníaco** en esta región (llega nulo) y el **radar de RainViewer
  no tiene canal infrarrojo**; ambos casos se manejan sin inventar datos.
- Pasados siete días la incertidumbre crece: para eso están los paneles de modelos y
  de ensamble, que la muestran en lugar de esconderla.
- Los avisos son **umbrales propios** calculados sobre el pronóstico. No son avisos
  oficiales.

## Notas sobre el entorno de desarrollo en Windows

`pnpm-workspace.yaml` fija `nodeLinker: hoisted`. El instalador aislado por omisión
crea uniones de directorio que en Windows impiden a Node resolver las dependencias
internas de Next (`styled-jsx`, `@swc/helpers`) al cargar el runtime del enrutador de
páginas, y el build falla con `Cannot find module 'styled-jsx'`. Con la carpeta plana
la resolución es idéntica en Windows, Linux y Vercel. También habilita los scripts de
instalación de `esbuild` y `unrs-resolver`, que pnpm bloquea por omisión y que Vitest
y ESLint necesitan.

Si tu entorno permite crear procesos hijos con normalidad, `pnpm build` funciona tal
cual; no hay nada más que ajustar.
