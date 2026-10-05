"use client";

import { useEffect } from "react";
import { notify } from "./NotificationPermission";

/**
 * Avisa al sistema cuando hay avisos activos y la aplicación deja de estar en
 * primer plano.
 *
 * Sin servidor push, una notificación solo puede emitirse mientras la página
 * vive. El momento útil es justo cuando la persona cambia de ventana o bloquea el
 * teléfono con la app abierta: ahí el aviso del sistema sí aporta algo. Si está
 * mirando el panel, no se emite nada, porque el aviso ya está en pantalla.
 *
 * El `tag` fijo de `notify` hace que cada aviso reemplace al anterior, así que
 * cambiar de ventana varias veces no acumula notificaciones.
 */
export default function AlertNotifier({
  alerts,
}: {
  alerts: Array<{ title: string; detail: string }>;
}) {
  useEffect(() => {
    if (alerts.length === 0) return;

    const maybeNotify = () => {
      if (document.visibilityState === "visible") return;
      const worst = alerts[0];
      const rest = alerts.length - 1;
      notify(
        `Aviso en Ciudad Juárez: ${worst.title}`,
        rest > 0 ? `${worst.detail} (y ${rest} aviso${rest === 1 ? "" : "s"} más)` : worst.detail,
      );
    };

    // Si la página se cargó ya en segundo plano, el aviso sale de inmediato.
    maybeNotify();

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") maybeNotify();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [alerts]);

  return null;
}
