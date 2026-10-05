/*
 * Service worker de "Clima Ciudad Juárez".
 *
 * Escrito a mano: sin dependencias, sin paso de compilación y sin
 * importScripts de terceros. Vive en /sw.js para que su ámbito sea la raíz.
 *
 * Regla de oro de esta app: el clima es dato en vivo. Cachear las respuestas
 * de /api/ (o de cualquier dominio ajeno) serviría temperaturas viejas como si
 * fueran actuales, así que esas peticiones se dejan pasar intactas al navegador.
 * Solo se cachea el armazón de la aplicación y sus recursos estáticos.
 */

/** Versión explícita de la caché: súbela para invalidar todo lo guardado. */
const CACHE_VERSION = "clima-juarez-v1";

/** Mínimo imprescindible para abrir la app sin conexión. */
const PRECACHE_URLS = ["/", "/manifest.webmanifest"];

/** Página de respaldo si ni la red ni la caché tienen la navegación pedida. */
const OFFLINE_HTML = `<!doctype html>
<html lang="es-MX">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sin conexión · Clima Ciudad Juárez</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 2rem;
        background: #12141c;
        color: #e8e3d9;
        font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
        text-align: center;
      }
      h1 { font-size: 1.25rem; margin: 0; }
      p { margin: 0; color: #b3ada0; max-width: 28rem; line-height: 1.5; }
      a {
        margin-top: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 9999px;
        background: #e0a44f;
        color: #12141c;
        font-weight: 600;
        text-decoration: none;
      }
      a:focus-visible { outline: 2px solid #e0a44f; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <h1>Sin conexión</h1>
    <p>
      No se pudo contactar al servidor y esta pantalla todavía no está guardada.
      Los datos del clima siempre se piden en vivo, así que necesitas conexión
      para verlos.
    </p>
    <a href="/">Reintentar</a>
  </body>
</html>`;

/**
 * Un fallo de precarga nunca debe romper la instalación del worker.
 * `addAll` es todo-o-nada, por eso además se reintenta recurso por recurso.
 */
async function precache(cache) {
  try {
    await cache.addAll(PRECACHE_URLS);
  } catch (error) {
    console.warn("[sw] Precarga completa falló; se reintenta por recurso", error);
    await Promise.all(
      PRECACHE_URLS.map((url) =>
        cache.add(url).catch((cause) => {
          console.warn("[sw] No se pudo precachear", url, cause);
        }),
      ),
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await precache(cache);
      // La versión nueva toma el control sin esperar a que se cierren las
      // pestañas viejas.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Respuesta válida y del mismo origen que se puede guardar en caché. */
function isCacheable(response) {
  return (
    response &&
    response.status === 200 &&
    response.type === "basic" &&
    !response.headers.get("Cache-Control")?.includes("no-store")
  );
}

/** Revalidación en segundo plano: la copia guardada se devuelve ya. */
function revalidate(request, cache) {
  fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        return cache.put(request, response.clone());
      }
      return undefined;
    })
    .catch(() => {
      // Sin conexión: se conserva la copia que ya teníamos.
    });
}

/** Navegaciones: red primero, caché después y, si no hay nada, aviso propio. */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ??
      (await cache.match("/", { ignoreSearch: true }));
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      status: 503,
      statusText: "Sin conexión",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}

/** Recursos estáticos: caché primero con revalidación en segundo plano. */
async function handleStatic(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) {
    revalidate(request, cache);
    return cached;
  }
  try {
    const response = await fetch(request);
    // isCacheable ya descarta las respuestas parciales (206) y las opacas.
    if (isCacheable(response)) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response("", {
      status: 504,
      statusText: "Sin conexión",
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET del mismo origen. Cualquier otra cosa (POST, otro dominio) sigue
  // su curso normal: no la tocamos.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Los datos del clima son en vivo: cachearlos mostraría información vieja.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleStatic(request));
});
