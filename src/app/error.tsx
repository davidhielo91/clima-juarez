"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Frontera de error de la aplicación.
 *
 * Un panel del clima puede fallar por muchas razones ajenas (una fuente caída, una
 * corrida de modelo a medias). Cada módulo ya se protege por su cuenta con su
 * propio `DataState`; esto cubre lo que se escape de ahí, y ofrece la única acción
 * que sirve de verdad: volver a intentarlo.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[clima] falló el renderizado del panel", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="eyebrow text-[11px] text-tone-warn">
        Estación de campo · falla
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
        No se pudo armar el panel
      </h1>
      <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-soft">
        Algo se rompió al leer o al dibujar los datos del clima. No es tu conexión
        necesariamente: puede ser una fuente que respondió con un formato distinto al
        esperado.
      </p>
      {error.digest ? (
        <p className="numeric mt-3 text-[11px] text-ink-dim">
          Referencia del error: {error.digest}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-amber px-4 py-2 text-[13px] font-semibold text-night-950 transition-opacity hover:opacity-90"
        >
          Volver a intentar
        </button>
        <Link
          href="/"
          className="border border-rule px-4 py-2 text-[13px] text-ink-soft transition-colors hover:border-rule-strong hover:text-ink"
        >
          Recargar el panel completo
        </Link>
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-ink-dim">
        Si el problema sigue, las fuentes de datos se pueden comprobar por separado
        con <code className="numeric">pnpm verify:sources</code>, que reporta cuál
        endpoint está fallando y qué variable falta.
      </p>
    </main>
  );
}
