/**
 * Derivaciones de viento: rosa de los vientos, sensación por frío y escala
 * Beaufort.
 *
 * Criterios no especificados que se fijan aquí:
 *  - La rosa usa 16 puntos con O de Oeste (O, ONO, OSO...) y no W, porque toda
 *    la interfaz está en español.
 *  - `crosswindLabel` usa 8 puntos y no 16: "viento del nornoreste" no se dice
 *    en español; con 8 puntos la frase queda natural: "viento del noreste".
 *  - `beaufort` usa los cortes clásicos en km/h de la escala, que son los que
 *    publica la escala oficial; los extremos (0 y 12) incluyen todo lo que queda
 *    fuera del rango medible normal.
 */

/** Los 16 puntos de la rosa, en español y en sentido horario desde el norte. */
export const COMPASS_POINTS: readonly string[] = Object.freeze([
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSO",
  "SO",
  "OSO",
  "O",
  "ONO",
  "NO",
  "NNO",
]);

/** Nombre largo de cada punto, alineado uno a uno con `COMPASS_POINTS`. */
const COMPASS_LONG: readonly string[] = Object.freeze([
  "Norte",
  "Nornoreste",
  "Noreste",
  "Estenoreste",
  "Este",
  "Estesureste",
  "Sureste",
  "Sursureste",
  "Sur",
  "Sursuroeste",
  "Suroeste",
  "Oestesuroeste",
  "Oeste",
  "Oestenoroeste",
  "Noroeste",
  "Nornoroeste",
]);

/** Los 8 rumbos con nombre corriente, para frases corridas. */
const COMPASS_WORD: readonly string[] = Object.freeze([
  "norte",
  "noreste",
  "este",
  "sureste",
  "sur",
  "suroeste",
  "oeste",
  "noroeste",
]);

/** Etiqueta neutra cuando no hay dirección. */
export const NO_DIRECTION = "—";

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Normaliza cualquier ángulo a [0, 360). */
function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Punto de la rosa (16 puntos). Los bordes caen en el punto superior: 11.25 es
 * NNE y 348.75 vuelve a ser N, que es la convención de los sectores de 22.5°.
 */
export function compassPoint(degrees: number | null | undefined): string {
  if (!isNumber(degrees)) return NO_DIRECTION;
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return COMPASS_POINTS[index];
}

/** Nombre largo del punto: "NNO" → "Nornoroeste". */
export function compassLongLabel(degrees: number | null | undefined): string {
  if (!isNumber(degrees)) return NO_DIRECTION;
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return COMPASS_LONG[index];
}

/**
 * Frase corrida para el viento que viene de esa dirección: "viento del norte".
 * Se redondea a 8 rumbos y se respeta el género: "del norte" pero "del este".
 */
export function crosswindLabel(fromDegrees: number | null | undefined): string {
  if (!isNumber(fromDegrees)) return "viento sin dirección";
  const index = Math.round(normalizeDegrees(fromDegrees) / 45) % 8;
  return `viento del ${COMPASS_WORD[index]}`;
}

/**
 * Sensación térmica por viento (fórmula de Environment Canada, la del índice de
 * enfriamiento del aire):
 *
 *   ST = 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16
 *
 * con T en °C y V en km/h. La fórmula solo está validada para T ≤ 10 °C y
 * V > 4.8 km/h; fuera de ahí devuelve `null` porque extrapolarla da valores sin
 * sentido (con viento en calma "sentiría" más frío que sin viento).
 */
export function windChillCelsius(
  temperatureC: number | null | undefined,
  windKmh: number | null | undefined,
): number | null {
  if (!isNumber(temperatureC) || !isNumber(windKmh)) return null;
  if (temperatureC > 10 || windKmh <= 4.8) return null;
  const v = Math.pow(windKmh, 0.16);
  return 13.12 + 0.6215 * temperatureC - 11.37 * v + 0.3965 * temperatureC * v;
}

/** Cortes superiores en km/h de cada fuerza: por debajo del corte va esa fuerza. */
const BEAUFORT_LIMITS: readonly number[] = Object.freeze([
  1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118,
]);

const BEAUFORT_LABELS: readonly string[] = Object.freeze([
  "Calma",
  "Ventolina",
  "Brisa muy débil",
  "Brisa débil",
  "Brisa moderada",
  "Brisa fresca",
  "Brisa fuerte",
  "Viento fuerte",
  "Viento duro",
  "Viento muy duro",
  "Tempestad",
  "Borrasca",
  "Huracán",
]);

/**
 * Fuerza Beaufort (0–12) con su nombre en español. El cálculo es escalonado:
 * `kmh` menor que el corte de la fuerza se queda en esa fuerza.
 */
export function beaufort(
  kmh: number | null | undefined,
): { force: number; label: string } | null {
  if (!isNumber(kmh) || kmh < 0) return null;
  let force = BEAUFORT_LIMITS.length;
  for (let i = 0; i < BEAUFORT_LIMITS.length; i += 1) {
    if (kmh < BEAUFORT_LIMITS[i]) {
      force = i;
      break;
    }
  }
  return { force, label: BEAUFORT_LABELS[force] };
}
