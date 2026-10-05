"use client";

import { useCallback, useEffect, useState } from "react";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

/** Estado actual del permiso, sin asumir que la API existe. */
function readPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  const { permission } = Notification;
  if (permission === "granted" || permission === "denied") return permission;
  // "default" (y el antiguo "prompt" de Safari) significa "todavía no se pide".
  return "default";
}

/**
 * Envía un aviso local (API `Notification`), sin servidor push, sin
 * suscripciones y sin claves VAPID.
 *
 * Solo se emite si el permiso ya está concedido **y la app no está en primer
 * plano**: si la persona está mirando el panel, ya ve el aviso escrito en la
 * pantalla y una notificación del sistema sería un duplicado molesto. El `tag`
 * fijo hace que un aviso reemplace al anterior en lugar de acumularse. Devuelve
 * `true` si el aviso se llegó a emitir.
 */
export function notify(title: string, body: string): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  if (document.visibilityState === "visible") return false;

  const options: NotificationOptions = {
    body,
    lang: "es-MX",
    icon: "/icons/icon-192.png",
    tag: "clima-juarez",
  };

  // En móviles (sobre todo Android) el constructor `Notification` no está
  // permitido: hay que pasar por el registro del service worker.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (registration) return registration.showNotification(title, options);
        new Notification(title, options);
        return undefined;
      })
      .catch((error: unknown) => {
        console.warn("[pwa] No se pudo mostrar la notificación", error);
      });
    return true;
  }

  try {
    new Notification(title, options);
    return true;
  } catch (error: unknown) {
    console.warn("[pwa] No se pudo mostrar la notificación", error);
    return false;
  }
}

const ACTION_PRIMARY =
  "bg-amber px-3.5 py-1.5 text-[12px] font-semibold text-night-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const ACTION_GHOST =
  "border border-rule px-3 py-1.5 text-[12px] text-ink-soft transition-colors hover:border-rule-strong hover:text-ink";

/**
 * Botón para activar los avisos del clima.
 *
 * El permiso se pide **solo al hacer clic**: pedirlo al cargar quema la
 * pregunta una sola vez —el navegador no la vuelve a mostrar— y la mayoría de
 * las visitas se pierde para siempre.
 */
export default function NotificationPermission() {
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(readPermission());
    // El usuario puede cambiar el permiso desde los ajustes del sitio: al
    // volver a la pestaña se relee el estado real.
    const syncPermission = () => setPermission(readPermission());
    document.addEventListener("visibilitychange", syncPermission);
    return () =>
      document.removeEventListener("visibilitychange", syncPermission);
  }, []);

  const handleRequest = useCallback(async () => {
    if (!("Notification" in window)) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(
        result === "granted"
          ? "granted"
          : result === "denied"
            ? "denied"
            : "default",
      );
    } catch (error: unknown) {
      console.warn("[pwa] No se pudo pedir el permiso de notificaciones", error);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleTest = useCallback(() => {
    notify(
      "Clima Ciudad Juárez",
      "Avisos locales activados. Así se verán los avisos del clima.",
    );
  }, []);

  return (
    <section
      aria-labelledby="pwa-avisos-titulo"
      className="border border-rule bg-night-900 p-3"
    >
      <h2 id="pwa-avisos-titulo" className="eyebrow text-[11px] text-ink">
        Avisos del clima
      </h2>

      <p
        aria-live="polite"
        className="mt-1.5 text-[11px] leading-relaxed text-ink-soft"
      >
        {permission === "unsupported" &&
          "Este navegador no admite notificaciones."}
        {permission === "default" &&
          "Avisos locales para cambios bruscos: sin servidores ni suscripciones."}
        {permission === "granted" && "Avisos activados en este dispositivo."}
        {permission === "denied" &&
          "Los avisos están bloqueados. Para revertirlo, abre el candado de la barra de direcciones (o los ajustes del sitio) y vuelve a permitir las notificaciones."}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {(permission === "default" || permission === "denied") && (
          <button
            type="button"
            onClick={handleRequest}
            disabled={busy}
            aria-label="Activar los avisos del clima"
            className={ACTION_PRIMARY}
          >
            {busy ? "Pidiendo permiso…" : "Activar avisos"}
          </button>
        )}

        {permission === "granted" && (
          <button
            type="button"
            onClick={handleTest}
            aria-label="Enviar un aviso de prueba"
            className={ACTION_GHOST}
          >
            Enviar aviso de prueba
          </button>
        )}
      </div>
    </section>
  );
}
