"use client";

import { useCallback, useEffect, useState } from "react";

/** Marca en `localStorage` que el usuario ya descartó la tarjeta. */
const DISMISS_STORAGE_KEY = "clima-juarez:pwa-install-dismissed";

/**
 * `beforeinstallprompt` todavía no está en los tipos del DOM, así que se
 * declara la forma mínima que usamos (nada de `any`).
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

/** ¿La app ya corre instalada como PWA? */
function isStandalone(): boolean {
  const displayMode =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // iOS Safari no soporta display-mode: expone navigator.standalone.
  const legacyNavigator = window.navigator as Navigator & {
    standalone?: boolean;
  };
  return displayMode || legacyNavigator.standalone === true;
}

/** iPadOS 13+ se anuncia como "Macintosh", pero tiene pantalla táctil. */
function isIosDevice(): boolean {
  const { userAgent } = window.navigator;
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && "ontouchend" in document)
  );
}

const ACTION_PRIMARY =
  "bg-amber px-3.5 py-1.5 text-[12px] font-semibold text-night-950 transition-opacity hover:opacity-90";

const ACTION_GHOST =
  "border border-rule px-3 py-1.5 text-[12px] text-ink-soft transition-colors hover:border-rule-strong hover:text-ink";

const ACTION_QUIET =
  "px-2.5 py-1.5 text-[12px] text-ink-soft transition-colors hover:text-ink";

/**
 * Tarjeta discreta para instalar la app.
 *
 * Reglas:
 * - Nunca aparece si ya está instalada ni si el usuario la descartó antes.
 * - El evento `beforeinstallprompt` puede no llegar nunca (Safari siempre):
 *   en iOS se explica el camino manual desde el menú Compartir; en el resto de
 *   los navegadores simplemente no se muestra nada, sin inventar un botón que
 *   no haría nada.
 */
export default function InstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1") return;
    } catch {
      // Almacenamiento bloqueado (modo privado): se decide en memoria.
    }

    // `promptArrived` distingue "el navegador no ofrece instalación" de
    // "todavía no ha contestado".
    let promptArrived = false;

    const handleBeforeInstallPrompt = (event: Event) => {
      // Sin preventDefault, Chrome muestra su propio mini-infobar.
      event.preventDefault();
      promptArrived = true;
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowCard(true);
    };

    const handleInstalled = () => {
      setShowCard(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    // iOS jamás emite el evento: se da un margen corto y, si no llegó, se
    // muestra la nota de "Añadir a pantalla de inicio".
    const iosTimer = isIosDevice()
      ? window.setTimeout(() => {
          if (!promptArrived) setShowIosHint(true);
        }, 2500)
      : undefined;

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
      if (iosTimer !== undefined) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setShowCard(false);
    setShowIosHint(false);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {
      // Si no se puede guardar, al menos no vuelve a aparecer en esta sesión.
    }
  }, []);

  // Cierre con Escape, como cualquier diálogo no modal.
  useEffect(() => {
    if (!showCard && !showIosHint) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCard, showIosHint, dismiss]);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    // El evento es de un solo uso: se consume antes de esperar la elección.
    setInstallEvent(null);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setShowCard(false);
      } else {
        // El usuario dijo que no: no se vuelve a insistir.
        dismiss();
      }
    } catch (error: unknown) {
      console.warn("[pwa] La instalación no se pudo completar", error);
      setShowCard(false);
    }
  }, [installEvent, dismiss]);

  if (!showCard && !showIosHint) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 border border-rule-strong bg-night-900/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:right-4 sm:w-[21rem]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {showCard ? (
            <>
              <p className="eyebrow text-[11px] text-ink">Instala Clima Juárez</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                Acceso directo desde la pantalla de inicio, a pantalla completa
                y con los datos del clima siempre en vivo.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow text-[11px] text-ink">
                Añádela a tu pantalla de inicio
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                En iPhone o iPad: toca el botón Compartir y elige «Añadir a
                pantalla de inicio».
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Descartar el aviso de instalación"
          className="shrink-0 border border-rule px-1.5 py-1 text-[11px] leading-none text-ink-soft transition-colors hover:border-rule-strong hover:text-ink"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {showCard ? (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            aria-label="Instalar la aplicación Clima Ciudad Juárez"
            className={ACTION_PRIMARY}
          >
            Instalar
          </button>
          <button type="button" onClick={dismiss} className={ACTION_QUIET}>
            Ahora no
          </button>
        </div>
      ) : (
        <div className="mt-2.5">
          <button type="button" onClick={dismiss} className={ACTION_GHOST}>
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}
