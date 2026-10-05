/**
 * Pronóstico detallado: 59 variables horarias, 26 diarias y 19 de "ahora mismo"
 * para el centro de Ciudad Juárez.
 *
 * Este módulo también aloja los lectores de la forma cruda de Open-Meteo porque
 * el pronóstico es el envoltorio que comparten casi todos los endpoints. Si cada
 * fuente llevara su propia copia, el día que la API renombre un bloque habría que
 * corregir nueve archivos en lugar de uno.
 *
 * Regla de la casa: un valor ausente se queda en `null`. Nunca se convierte en 0
 * (que afirmaría que no llueve o que hace 0 °C sin saberlo) ni en `NaN` (que se
 * cuela en cualquier promedio sin avisar).
 */

import { POINT, REVALIDATE, buildDetailedForecastUrl } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { ForecastBundle, OmBlock, Place } from "../types";

/**
 * Forma cruda (y sin validar) de las respuestas de Open-Meteo que comparten
 * envoltorio. Todo es `unknown` a propósito: obliga a pasar por los lectores de
 * abajo en vez de confiar en que la API siga mandando lo mismo.
 */
export interface RawOmResponse {
  latitude?: unknown;
  longitude?: unknown;
  elevation?: unknown;
  timezone?: unknown;
  utc_offset_seconds?: unknown;
  current?: unknown;
  current_units?: unknown;
  hourly?: unknown;
  hourly_units?: unknown;
  daily?: unknown;
  daily_units?: unknown;
  minutely_15?: unknown;
  minutely_15_units?: unknown;
}

/** Objeto crudo, o `null` si lo que llegó fue un arreglo, una cadena o nada. */
export function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Número finito del JSON crudo; `null` si falta o no es numérico. */
export function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Bloque vacío: la forma que la interfaz lee como "esta fuente no cubre el dato". */
export function emptyBlock(): OmBlock {
  return { time: [] };
}

/**
 * Serie cruda → serie de `OmBlock`. Se conservan los `null` y también las
 * cadenas (el tipo las admite), pero un número no finito se normaliza a `null`:
 * un `NaN` que llegue de la API debe ser "no hay dato", no un valor contagioso.
 */
export function readSeries(series: unknown[]): Array<string | number | null> {
  return series.map((item) => {
    if (item === null) return null;
    if (typeof item === "number") return Number.isFinite(item) ? item : null;
    if (typeof item === "string") return item;
    return null;
  });
}

/**
 * Serie reducida a números, alineada a `length` posiciones.
 *
 * Se rellena con `null` si la API no mandó la serie (un modelo retirado, por
 * ejemplo) o si mandó menos valores de los esperados: la interfaz usa el mismo
 * índice para la hora y para el valor, así que una serie corta desalinearía
 * todas las gráficas siguientes en lugar de mostrar un hueco.
 */
export function readNumberSeries(value: unknown, length: number): Array<number | null> {
  const source = Array.isArray(value) ? (value as unknown[]) : [];
  const series = source.slice(0, length).map((item) => readNumber(item));
  while (series.length < length) series.push(null);
  return series;
}

/**
 * Bloque crudo (`hourly`, `daily`, `minutely_15`) → `OmBlock`.
 *
 * Devuelve `null` si no es un objeto con arreglo `time`: sin `time` no hay nada
 * con qué alinear las series y la interfaz pintaría filas huérfanas.
 */
export function readBlock(value: unknown): OmBlock | null {
  const raw = readRecord(value);
  if (raw === null || !Array.isArray(raw.time)) return null;

  const block: OmBlock = {
    time: (raw.time as unknown[]).map((item) => String(item)),
  };
  for (const key of Object.keys(raw)) {
    if (key === "time") continue;
    const series = raw[key];
    if (!Array.isArray(series)) continue;
    block[key] = readSeries(series as unknown[]);
  }
  return block;
}

/**
 * Bloque `current` crudo → mapa de variable a número.
 *
 * Se descarta `time`: el contrato de `ForecastBundle.current` es
 * `Record<string, number | null>` porque quien lo consume quiere poder operar
 * con todos los valores; una cadena suelta ahí dentro rompería esa promesa.
 * `interval` sí se conserva, que es numérico.
 */
export function readCurrent(value: unknown): Record<string, number | null> | null {
  const raw = readRecord(value);
  if (raw === null) return null;

  const current: Record<string, number | null> = {};
  for (const key of Object.keys(raw)) {
    if (key === "time") continue;
    const item = raw[key];
    if (item === null) current[key] = null;
    else if (typeof item === "number" && Number.isFinite(item)) current[key] = item;
  }
  return current;
}

/** Bloque `*_units` crudo → mapa de variable a unidad; solo se copian cadenas. */
export function readUnits(value: unknown): Record<string, string> {
  const raw = readRecord(value);
  if (raw === null) return {};

  const units: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    const unit = raw[key];
    if (typeof unit === "string") units[key] = unit;
  }
  return units;
}

/**
 * Ubicación normalizada.
 *
 * `name`, `admin` y `country` no vienen de la API: se toman de `POINT`, que es la
 * coordenada que de verdad se pidió. Open-Meteo responde con la celda del modelo
 * y ese nombre inventado ("31.7448, -106.4693") no le dice nada a nadie.
 *
 * Los cinco campos escalares son obligatorios: sin ellos no se puede ni situar el
 * dato ni interpretar la hora local, así que se devuelve error en vez de rellenar
 * con la coordenada pedida, que sería una celda que no es la que respondió.
 */
export function readPlace(value: unknown): Fetched<Place> {
  const raw = readRecord(value);
  const latitude = readNumber(raw?.latitude);
  const longitude = readNumber(raw?.longitude);
  const elevation = readNumber(raw?.elevation);
  const utcOffsetSeconds = readNumber(raw?.utc_offset_seconds);
  const timezone = typeof raw?.timezone === "string" ? raw.timezone : null;

  if (
    latitude === null ||
    longitude === null ||
    elevation === null ||
    utcOffsetSeconds === null ||
    timezone === null
  ) {
    return {
      ok: false,
      error:
        "La respuesta no trae la ubicación: falta latitude, longitude, elevation, timezone o utc_offset_seconds",
    };
  }

  return {
    ok: true,
    data: {
      name: POINT.name,
      admin: POINT.admin,
      country: POINT.country,
      latitude,
      longitude,
      elevation,
      timezone,
      utcOffsetSeconds,
    },
  };
}

export async function getForecast(): Promise<Fetched<ForecastBundle>> {
  const result = await fetchJson<RawOmResponse>(buildDetailedForecastUrl(), {
    revalidate: REVALIDATE.detailed,
    tag: "forecast",
  });
  if (!result.ok) return result;

  const place = readPlace(result.data);
  if (!place.ok) return place;

  // `current` es la temperatura que se ve de un vistazo: si falta, la portada no
  // tiene sentido, así que se avisa en lugar de enseñar un hueco.
  const current = readCurrent(result.data.current);
  if (current === null) {
    return { ok: false, error: "La respuesta no trae el bloque current" };
  }

  const hourly = readBlock(result.data.hourly);
  if (hourly === null) {
    return { ok: false, error: "La respuesta no trae el bloque hourly con su arreglo time" };
  }

  const daily = readBlock(result.data.daily);
  if (daily === null) {
    return { ok: false, error: "La respuesta no trae el bloque daily con su arreglo time" };
  }

  // Este endpoint no pide `minutely_15`; ese bloque lo llena getMinutely().
  return {
    ok: true,
    data: {
      place: place.data,
      current,
      currentUnits: readUnits(result.data.current_units),
      minutely15: emptyBlock(),
      minutely15Units: {},
      hourly,
      hourlyUnits: readUnits(result.data.hourly_units),
      daily,
      dailyUnits: readUnits(result.data.daily_units),
    },
  };
}
