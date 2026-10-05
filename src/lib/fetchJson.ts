/**
 * Única puerta de salida hacia las APIs externas.
 *
 * Solo se importa desde componentes y módulos de servidor: los datos se piden
 * en el servidor y se cachean en el edge, nunca desde el navegador.
 *
 * Todo el resto del código asume que una fuente puede fallar. Por eso esta
 * función nunca lanza: devuelve un resultado discriminado y cada módulo decide
 * qué pintar cuando no hay datos. Un endpoint caído no debe tumbar la página.
 */

export type Fetched<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const TIMEOUT_MS = 8000;

/** Forma de error documentada por Open-Meteo: `{"error": true, "reason": "..."}`. */
interface OpenMeteoError {
  error?: boolean;
  reason?: string;
}

export async function fetchJson<T>(
  url: string,
  options: { revalidate: number; tag?: string; attempts?: number },
): Promise<Fetched<T>> {
  const attempts = options.attempts ?? 2;
  let lastError = "Error desconocido";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: {
          revalidate: options.revalidate,
          tags: options.tag ? [options.tag] : undefined,
        },
      });

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        // Un 4xx significa que la petición está mal construida: reintentar no
        // ayuda y solo gasta cuota.
        if (response.status >= 400 && response.status < 500) break;
        continue;
      }

      const payload = (await response.json()) as T & OpenMeteoError;

      if (payload && typeof payload === "object" && payload.error === true) {
        lastError = payload.reason ?? "La fuente devolvió un error";
        break;
      }

      return { ok: true, data: payload };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { ok: false, error: lastError };
}
