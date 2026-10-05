"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (`/sw.js`) una sola vez, del lado del cliente.
 *
 * Decisiones no obvias:
 * - Solo en producción. En desarrollo el worker interceptaría las peticiones
 *   del servidor de Next y pelearía con el recargado en caliente (HMR), que
 *   sirve módulos con URLs cambiantes.
 * - El registro no es crítico: si falla, la app sigue funcionando en línea, así
 *   que se avisa con un `console.warn` y nada más.
 * - Se registra al evento `load` para no competir con la descarga de los
 *   recursos que sí son visibles para el usuario.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("[pwa] No se pudo registrar el service worker", error);
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
