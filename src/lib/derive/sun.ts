/**
 * Astronomía local: fase lunar, posición del sol y duración del día.
 *
 * Advertencia de zona horaria: `date` se interpreta como instante absoluto. La
 * app construye sus fechas con la hora de pared de Juárez tratada como UTC (ver
 * `src/lib/format.ts`), y ese mismo criterio hace que estas funciones den la
 * posición correcta del sol sobre Juárez sin necesitar la zona horaria.
 *
 * Criterios no especificados que se fijan aquí:
 *  - La fase lunar usa la edad sinódica desde la luna nueva conocida del
 *    2000-01-06 18:14 UTC con el mes sinódico de Meeus (29.530588853 días). No se
 *    aplican las correcciones periódicas de Meeus (las "fases" de segundo orden):
 *    para dibujar un icono el error de unas horas es irrelevante.
 *  - `illumination` es la fracción iluminada del disco, (1 − cos(2π·fase)) / 2.
 *  - `sunPosition` usa las ecuaciones de baja precisión del Almanaque
 *    Astronómico (declinación, ascensión recta y ángulo horario) y **no** aplica
 *    refracción atmosférica: devuelve la posición geométrica, que es la que
 *    sirve para dibujar. El azimut se mide desde el norte hacia el este y se
 *    normaliza a [0, 360).
 *  - Esto es solo para pintar el sol en su arco. Para decidir si es de día o de
 *    noche, la app usa el campo `is_day` de la API y no esta función.
 */

/** Mes sinódico en días (Meeus, valor medio). */
export const SYNODIC_MONTH_DAYS = 29.530588853;

/** Luna nueva de referencia: 2000-01-06 18:14 UTC. */
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

const MS_PER_DAY = 86_400_000;

const DEG = Math.PI / 180;

/** Los ocho nombres de fase, en orden desde luna nueva. */
export const MOON_PHASE_NAMES: readonly string[] = Object.freeze([
  "Luna nueva",
  "Luna creciente",
  "Cuarto creciente",
  "Gibosa creciente",
  "Luna llena",
  "Gibosa menguante",
  "Cuarto menguante",
  "Luna menguante",
]);

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Fase lunar para un instante dado.
 *
 * `fraction` es la edad dentro del ciclo en [0, 1): 0 es luna nueva, 0.5 luna
 * llena. `illumination` va de 0 (disco oscuro) a 1 (disco completo).
 */
export function moonPhase(date: Date): {
  fraction: number;
  name: string;
  illumination: number;
} {
  const time = date instanceof Date ? date.getTime() : Number.NaN;
  if (!Number.isFinite(time)) {
    return { fraction: 0, name: "Sin dato", illumination: 0 };
  }

  const days = (time - KNOWN_NEW_MOON_MS) / MS_PER_DAY;
  const age = ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const fraction = age / SYNODIC_MONTH_DAYS;

  // Ocho tramos de 1/8 centrados en cada fase: el índice más cercano.
  const index = Math.floor(fraction * 8 + 0.5) % 8;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;

  return { fraction, name: MOON_PHASE_NAMES[index], illumination };
}

/**
 * Posición del sol (altitud y azimut en grados) para un instante y un punto.
 * La altitud es negativa cuando el sol está bajo el horizonte.
 */
export function sunPosition(
  date: Date,
  latitude: number,
  longitude: number,
): { altitude: number; azimuth: number } {
  const time = date instanceof Date ? date.getTime() : Number.NaN;
  if (!Number.isFinite(time) || !isNumber(latitude) || !isNumber(longitude)) {
    return { altitude: 0, azimuth: 0 };
  }

  // Día juliano y días desde J2000.0.
  const julianDay = time / MS_PER_DAY + 2440587.5;
  const n = julianDay - 2451545.0;

  // Longitud media, anomalía media y longitud eclíptica del sol.
  const meanLongitude = normalizeDegrees(280.46 + 0.9856474 * n);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * n);
  const eclipticLongitude = normalizeDegrees(
    meanLongitude +
      1.915 * Math.sin(meanAnomaly * DEG) +
      0.02 * Math.sin(2 * meanAnomaly * DEG),
  );

  // Oblicuidad de la eclíptica.
  const obliquity = 23.439 - 0.0000004 * n;

  // Declinación y ascensión recta.
  const sinDeclination =
    Math.sin(obliquity * DEG) * Math.sin(eclipticLongitude * DEG);
  const declination = Math.asin(Math.max(-1, Math.min(1, sinDeclination)));
  const rightAscension = Math.atan2(
    Math.cos(obliquity * DEG) * Math.sin(eclipticLongitude * DEG),
    Math.cos(eclipticLongitude * DEG),
  );

  // Tiempo sidéreo medio de Greenwich, en grados, más la longitud (este positivo).
  const gmst = normalizeDegrees(280.46061837 + 360.98564736629 * n);
  let hourAngle = normalizeDegrees(gmst + longitude - rightAscension / DEG);
  if (hourAngle > 180) hourAngle -= 360;

  const h = hourAngle * DEG;
  const lat = latitude * DEG;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosDec = Math.cos(declination);
  const sinDec = Math.sin(declination);

  // Vector horizontal: x al este, y al norte, z al cenit.
  const x = -cosDec * Math.sin(h);
  const y = sinDec * cosLat - cosDec * Math.cos(h) * sinLat;
  const z = sinDec * sinLat + cosDec * Math.cos(h) * cosLat;

  const altitude = Math.asin(Math.max(-1, Math.min(1, z))) / DEG;
  const azimuth = normalizeDegrees(Math.atan2(x, y) / DEG);

  return { altitude, azimuth };
}

/**
 * Duración legible: "14 h 32 min". Acepta segundos nulos o no finitos y devuelve
 * "—". Los minutos se rellenan a dos dígitos para que las columnas de la interfaz
 * no bailen, igual que en `src/lib/format.ts`.
 */
export function formatDaylightLong(seconds: number | null | undefined): string {
  if (!isNumber(seconds) || seconds < 0) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}
