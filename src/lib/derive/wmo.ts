/**
 * Traducción de los códigos WMO que devuelve Open-Meteo.
 *
 * La API entrega un número (`weather_code`) y la app necesita tres cosas
 * distintas: una etiqueta legible, una clave de icono corta y una gravedad para
 * el color. Aquí se resuelven juntas para que no puedan desincronizarse.
 *
 * Notas de criterio (no venían especificadas y se fijaron aquí):
 *  - `icon` usa solo las diez claves acordadas: "clear", "partly", "overcast",
 *    "fog", "drizzle", "rain", "showers", "snow", "thunder", "freezing". El
 *    código 1 (mayormente despejado) se pinta como "clear" porque el cielo está
 *    mayormente limpio; si se quisiera un icono propio habría que añadir clave.
 *  - `severity` es una escala de gravedad local, no una alerta oficial: la
 *    lluvia ligera es "info", lo que ya obliga a precaución es "caution", lo que
 *    puede causar daño es "warn"/"danger" y lo excepcional es "extreme".
 *  - La lluvia helada y la llovizna helada son las únicas precipitaciones que se
 *    marcan más graves que su equivalente líquido, porque forman hielo en el
 *    suelo y en los cables de la ciudad.
 *  - `isPrecipitation` es `true` para lluvia, llovizna, chubascos, nieve y
 *    tormenta; `false` para niebla, niebla con escarcha y cielo despejado o
 *    nublado. La niebla con escarcha moja poco pero no es precipitación.
 */
import type { Tone } from "./tone";

export interface WeatherInfo {
  code: number | null;
  /** Etiqueta en español, lista para pintar. */
  label: string;
  /** Clave corta de icono. */
  icon: string;
  severity: Tone;
  isPrecipitation: boolean;
}

/** Cielo sin dato o código desconocido. */
const UNKNOWN: WeatherInfo = {
  code: null,
  label: "Sin dato",
  // No hay una clave "desconocido" en el contrato de iconos, así que se usa la
  // más neutra (cielo cubierto) y la etiqueta "Sin dato" carga el significado.
  icon: "overcast",
  severity: "info",
  isPrecipitation: false,
};

type WeatherEntry = readonly [string, string, Tone, boolean];

const TABLE: Record<number, WeatherEntry> = {
  0: ["Despejado", "clear", "good", false],
  1: ["Mayormente despejado", "clear", "good", false],
  2: ["Parcialmente nublado", "partly", "info", false],
  3: ["Nublado", "overcast", "info", false],

  45: ["Niebla", "fog", "caution", false],
  48: ["Niebla con escarcha", "fog", "caution", false],

  51: ["Llovizna ligera", "drizzle", "info", true],
  53: ["Llovizna moderada", "drizzle", "info", true],
  55: ["Llovizna densa", "drizzle", "caution", true],
  56: ["Llovizna helada ligera", "freezing", "caution", true],
  57: ["Llovizna helada densa", "freezing", "warn", true],

  61: ["Lluvia ligera", "rain", "info", true],
  63: ["Lluvia moderada", "rain", "caution", true],
  65: ["Lluvia fuerte", "rain", "warn", true],
  66: ["Lluvia helada ligera", "freezing", "warn", true],
  67: ["Lluvia helada fuerte", "freezing", "danger", true],

  71: ["Nieve ligera", "snow", "caution", true],
  73: ["Nieve moderada", "snow", "warn", true],
  75: ["Nieve fuerte", "snow", "danger", true],
  77: ["Granos de nieve", "snow", "caution", true],

  80: ["Chubascos ligeros", "showers", "info", true],
  81: ["Chubascos moderados", "showers", "caution", true],
  82: ["Chubascos violentos", "showers", "warn", true],

  85: ["Chubascos de nieve ligeros", "snow", "caution", true],
  86: ["Chubascos de nieve fuertes", "snow", "warn", true],

  95: ["Tormenta", "thunder", "warn", true],
  96: ["Tormenta con granizo ligero", "thunder", "danger", true],
  99: ["Tormenta con granizo fuerte", "thunder", "extreme", true],
};

/** Códigos con etiqueta propia (los 28 que usa Open-Meteo). */
export const WMO_CODES: readonly number[] = Object.freeze(
  Object.keys(TABLE)
    .map(Number)
    .sort((a, b) => a - b),
);

export function describeWeather(code: number | null | undefined): WeatherInfo {
  if (typeof code !== "number" || !Number.isFinite(code)) return UNKNOWN;
  const entry = TABLE[code];
  if (!entry) return UNKNOWN;
  return {
    code,
    label: entry[0],
    icon: entry[1],
    severity: entry[2],
    isPrecipitation: entry[3],
  };
}
