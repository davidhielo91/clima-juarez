/**
 * Estadística sobre series con huecos.
 *
 * Todas las entradas pueden traer `null` (Open-Meteo lo usa cuando un modelo no
 * cubre una hora) y ninguna función debe lanzar por eso: los huecos se ignoran y,
 * si no queda ningún dato, el resultado es `null`.
 *
 * Criterios no especificados que se fijan aquí:
 *  - `percentile` usa interpolación lineal entre los dos valores ordenados que
 *    rodean la posición pedida (el método "linear" de NumPy). Con un solo dato
 *    devuelve ese dato para cualquier `p`.
 *  - `p` fuera de 0..100 se recorta al rango; un `p` no finito devuelve `null`.
 *  - `spread` calcula la desviación estándar **poblacional** (dividiendo entre n),
 *    porque los miembros del ensamble son la población completa de la que se
 *    dispone, no una muestra. Con un solo valor la desviación es 0.
 *  - `countAbove` cuenta como `total` solo a los miembros que tienen dato en esa
 *    posición; si ninguno lo tiene, devuelve `null` en vez de una probabilidad
 *    inventada.
 */

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Valores finitos de una serie, en el orden original. */
function finite(values: Array<number | null> | null | undefined): number[] {
  if (!Array.isArray(values)) return [];
  return values.filter(isNumber);
}

/**
 * Percentil `p` (0..100) con interpolación lineal. Ignora `null` y `NaN`.
 */
export function percentile(values: Array<number | null>, p: number): number | null {
  if (!isNumber(p)) return null;
  const clean = finite(values).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0];

  const clamped = Math.max(0, Math.min(100, p));
  const rank = (clamped / 100) * (clean.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return clean[lower];
  const weight = rank - lower;
  return clean[lower] + weight * (clean[upper] - clean[lower]);
}

/**
 * Aplica `percentile` a CADA serie por separado.
 *
 * OJO CON LA TRANSPOSICIÓN, porque es la trampa de esta función: el resultado
 * tiene la misma longitud que `members`, y cada valor es el percentil de esa serie
 * **a lo largo del tiempo**, no el percentil entre series. Para la banda de un
 * ensamble se necesita lo segundo, así que hay que transponer primero: agrupar por
 * instante (`members.map((miembro) => miembro[hora])`) y pasar esas columnas.
 * `EnsemblePanel` lo hace así y lo documenta en el sitio.
 */
export function percentileSeries(
  members: Array<Array<number | null>>,
  p: number,
): Array<number | null> {
  if (!Array.isArray(members)) return [];
  return members.map((member) => percentile(member, p));
}

/** Media aritmética de los valores finitos, o `null` si no hay ninguno. */
export function mean(values: Array<number | null>): number | null {
  const clean = finite(values);
  if (clean.length === 0) return null;
  let total = 0;
  for (const value of clean) total += value;
  return total / clean.length;
}

/**
 * Dispersión de una serie: mínimo, máximo, rango y desviación estándar
 * poblacional. `null` si no hay ningún valor finito.
 */
export function spread(
  values: Array<number | null>,
): { min: number; max: number; range: number; sd: number } | null {
  const clean = finite(values);
  if (clean.length === 0) return null;

  let min = clean[0];
  let max = clean[0];
  for (const value of clean) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const average = clean.reduce((total, value) => total + value, 0) / clean.length;
  const variance =
    clean.reduce((total, value) => total + (value - average) ** 2, 0) / clean.length;

  return { min, max, range: max - min, sd: Math.sqrt(variance) };
}

/**
 * Cuántos miembros superan el umbral en la posición `index`.
 * `probability` es la fracción 0..1 sobre los miembros con dato.
 */
export function countAbove(
  members: Array<Array<number | null>>,
  index: number,
  threshold: number,
): { count: number; total: number; probability: number } | null {
  if (!Array.isArray(members) || !isNumber(index) || !isNumber(threshold)) return null;
  const position = Math.trunc(index);

  let count = 0;
  let total = 0;
  for (const member of members) {
    if (!Array.isArray(member)) continue;
    const value = member[position];
    if (!isNumber(value)) continue;
    total += 1;
    if (value > threshold) count += 1;
  }

  if (total === 0) return null;
  return { count, total, probability: count / total };
}

/**
 * Extremos por día. El día es la clave de los primeros 10 caracteres de `time`
 * ("2026-10-05T14:00" → "2026-10-05") y el orden de salida es el de aparición.
 * Un día sin ningún valor finito sale con los tres campos en `null`.
 */
export function dailyExtremes(
  time: string[],
  values: Array<number | null>,
): Array<{ date: string; min: number | null; max: number | null; mean: number | null }> {
  if (!Array.isArray(time)) return [];

  const buckets = new Map<string, number[]>();
  for (let i = 0; i < time.length; i += 1) {
    const stamp = time[i];
    if (typeof stamp !== "string") continue;
    const date = stamp.slice(0, 10);
    const bucket = buckets.get(date);
    const value = Array.isArray(values) ? values[i] : null;
    if (bucket) {
      if (isNumber(value)) bucket.push(value);
    } else {
      buckets.set(date, isNumber(value) ? [value] : []);
    }
  }

  const result: Array<{
    date: string;
    min: number | null;
    max: number | null;
    mean: number | null;
  }> = [];

  for (const [date, bucket] of buckets) {
    if (bucket.length === 0) {
      result.push({ date, min: null, max: null, mean: null });
      continue;
    }
    let min = bucket[0];
    let max = bucket[0];
    let total = 0;
    for (const value of bucket) {
      if (value < min) min = value;
      if (value > max) max = value;
      total += value;
    }
    result.push({ date, min, max, mean: total / bucket.length });
  }

  return result;
}
