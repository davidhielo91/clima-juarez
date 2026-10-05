/**
 * Climatología: comparar el día de hoy con los valores normales del periodo de
 * referencia (1995–2024) y resumir esa referencia por mes.
 *
 * `ClimateNormals.byDayOfYear` ya viene promediado por `MM-DD`, así que aquí no
 * se promedia el clima: se busca la fecha y se resta.
 *
 * Criterios no especificados que se fijan aquí:
 *  - `dayOfYearKey` solo acepta el formato ISO `YYYY-MM-DD`; cualquier otra cosa
 *    (incluido un `Date` convertido a cadena localizada) devuelve `""`, que nunca
 *    coincide con una clave y por tanto deja las anomalías en `null`.
 *  - `monthlyNormals` promedia sin ponderar por `years`: cada fecha del mes pesa
 *    igual. Es lo que se pidió y evita que un año con más cobertura cargue el
 *    resultado.
 *  - En `monthlyNormals` los campos son `number | null` y no `number`: un mes sin
 *    ninguna fecha con dato no puede promediarse, y devolver `NaN` obligaría a la
 *    interfaz a defenderse de él. Se prefiere `null` explícito.
 *  - `extremeSummary` no estaba definido con precisión. Se interpreta como los
 *    extremos de la **normales del mismo mes** de la fecha pedida: el día más
 *    cálido del mes en promedio (`warmest`, sobre `tMax`), el más frío
 *    (`coolest`, sobre `tMin`) y el más lluvioso (`wettest`, sobre
 *    `precipitation`). Sirve para decir "este día es el más caluroso que suele
 *    tener enero".
 */
import type { ClimateNormals } from "../types";

/** Meses en español, índice 0 = enero. */
export const MONTH_LABELS: readonly string[] = Object.freeze([
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]);

export interface MonthlyNormal {
  month: number;
  label: string;
  tMax: number | null;
  tMin: number | null;
  tMean: number | null;
  precipitation: number | null;
}

export interface DailyAnomaly {
  tMaxNormal: number | null;
  tMinNormal: number | null;
  tMaxAnomaly: number | null;
  tMinAnomaly: number | null;
  years: number;
}

export interface ExtremeSummary {
  warmest: number | null;
  coolest: number | null;
  wettest: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** "2026-10-05T14:00" → "10-05". Cadena vacía si no es una fecha ISO. */
export function dayOfYearKey(isoDate: string): string {
  if (typeof isoDate !== "string" || !ISO_DATE.test(isoDate)) return "";
  return isoDate.slice(5, 10);
}

/**
 * Anomalías del día respecto a los valores normales de esa fecha (`MM-DD`).
 * Devuelve `null` si no hay normales para la fecha; las anomalías individuales
 * quedan en `null` cuando falta el dato observado o el normal.
 */
export function anomalyForDate(
  normals: ClimateNormals | null | undefined,
  isoDate: string,
  tMax: number | null | undefined,
  tMin: number | null | undefined,
): DailyAnomaly | null {
  const key = dayOfYearKey(isoDate);
  if (!key || !normals || typeof normals !== "object") return null;

  const byDay = normals.byDayOfYear;
  if (!byDay || typeof byDay !== "object") return null;
  const normal = byDay[key];
  if (!normal) return null;

  const tMaxNormal = isNumber(normal.tMax) ? normal.tMax : null;
  const tMinNormal = isNumber(normal.tMin) ? normal.tMin : null;

  return {
    tMaxNormal,
    tMinNormal,
    tMaxAnomaly: isNumber(tMax) && tMaxNormal !== null ? tMax - tMaxNormal : null,
    tMinAnomaly: isNumber(tMin) && tMinNormal !== null ? tMin - tMinNormal : null,
    years: isNumber(normal.years) ? normal.years : 0,
  };
}

/** Promedio de las normales de cada mes: 12 entradas, enero primero. */
export function monthlyNormals(
  normals: ClimateNormals | null | undefined,
): MonthlyNormal[] {
  const sums = Array.from({ length: 12 }, () => ({
    tMax: 0,
    tMin: 0,
    tMean: 0,
    precipitation: 0,
    tMaxCount: 0,
    tMinCount: 0,
    tMeanCount: 0,
    precipitationCount: 0,
  }));

  const byDay = normals && typeof normals === "object" ? normals.byDayOfYear : null;
  if (byDay && typeof byDay === "object") {
    for (const [key, value] of Object.entries(byDay)) {
      if (!value || typeof value !== "object") continue;
      const month = Number(key.slice(0, 2));
      if (!Number.isInteger(month) || month < 1 || month > 12) continue;
      const bucket = sums[month - 1];

      if (isNumber(value.tMax)) {
        bucket.tMax += value.tMax;
        bucket.tMaxCount += 1;
      }
      if (isNumber(value.tMin)) {
        bucket.tMin += value.tMin;
        bucket.tMinCount += 1;
      }
      if (isNumber(value.tMean)) {
        bucket.tMean += value.tMean;
        bucket.tMeanCount += 1;
      }
      if (isNumber(value.precipitation)) {
        bucket.precipitation += value.precipitation;
        bucket.precipitationCount += 1;
      }
    }
  }

  return sums.map((bucket, index) => ({
    month: index + 1,
    label: MONTH_LABELS[index],
    tMax: bucket.tMaxCount > 0 ? bucket.tMax / bucket.tMaxCount : null,
    tMin: bucket.tMinCount > 0 ? bucket.tMin / bucket.tMinCount : null,
    tMean: bucket.tMeanCount > 0 ? bucket.tMean / bucket.tMeanCount : null,
    precipitation:
      bucket.precipitationCount > 0
        ? bucket.precipitation / bucket.precipitationCount
        : null,
  }));
}

/**
 * Extremos de las normales del mismo mes que `isoDate`: el día más cálido, el
 * más frío y el más lluvioso en promedio. Todo `null` si no hay datos del mes.
 */
export function extremeSummary(
  normals: ClimateNormals | null | undefined,
  isoDate: string,
): ExtremeSummary {
  const empty: ExtremeSummary = { warmest: null, coolest: null, wettest: null };
  const key = dayOfYearKey(isoDate);
  if (!key || !normals || typeof normals !== "object") return empty;

  const byDay = normals.byDayOfYear;
  if (!byDay || typeof byDay !== "object") return empty;
  const monthPrefix = key.slice(0, 2);

  let warmest: number | null = null;
  let coolest: number | null = null;
  let wettest: number | null = null;

  for (const [dayKey, value] of Object.entries(byDay)) {
    if (!dayKey.startsWith(monthPrefix) || !value || typeof value !== "object") continue;
    if (isNumber(value.tMax) && (warmest === null || value.tMax > warmest)) {
      warmest = value.tMax;
    }
    if (isNumber(value.tMin) && (coolest === null || value.tMin < coolest)) {
      coolest = value.tMin;
    }
    if (
      isNumber(value.precipitation) &&
      (wettest === null || value.precipitation > wettest)
    ) {
      wettest = value.precipitation;
    }
  }

  return { warmest, coolest, wettest };
}
