/**
 * Normales climatológicas de 1995-2024, calculadas a partir del archivo ERA5.
 *
 * Se piden tres fragmentos (décadas) EN PARALELO, porque un solo rango de 30 años
 * es una respuesta demasiado grande para una sola llamada. Ese paralelismo es
 * también la razón de la regla dura de este módulo: si un fragmento falla, se
 * devuelve error y NO un promedio parcial. Un normal de agosto calculado con 20
 * años en lugar de 30 se parece mucho al correcto y nadie lo notaría en pantalla,
 * que es exactamente la clase de dato silenciosamente equivocado que hay que
 * evitar.
 *
 * El resultado se indexa por `MM-DD` y no por fecha completa: la pregunta que
 * responde es "¿qué es normal para un 5 de octubre en Juárez?", y eso se compara
 * contra el pronóstico del día en curso. Las fechas del archivo vienen en orden
 * cronológico, así que las claves quedan en orden de calendario.
 */

import {
  CLIMATE_CHUNKS,
  CLIMATE_PERIOD_END,
  CLIMATE_PERIOD_START,
  REVALIDATE,
  buildClimateUrl,
} from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { ClimateNormals, OmBlock } from "../types";
import { readBlock, readNumber, type RawOmResponse } from "./forecast";

/** Las cuatro variables que se promedian; los nombres son los del tipo de salida. */
const VARIABLES = ["tMax", "tMin", "tMean", "precipitation"] as const;
type ClimateVariable = (typeof VARIABLES)[number];

/** Nombre de la variable en el bloque crudo de Open-Meteo. */
const SOURCE_KEY: Record<ClimateVariable, string> = {
  tMax: "temperature_2m_max",
  tMin: "temperature_2m_min",
  tMean: "temperature_2m_mean",
  precipitation: "precipitation_sum",
};

interface DayAccumulator {
  /** Años distintos que aportaron algún dato a esta fecha. */
  years: Set<string>;
  /** Suma de los valores no nulos, por variable. */
  sums: Record<ClimateVariable, number>;
  /** Cuántos valores no nulos entraron en la suma; es el divisor del promedio. */
  samples: Record<ClimateVariable, number>;
}

function createAccumulator(): DayAccumulator {
  return {
    years: new Set<string>(),
    sums: { tMax: 0, tMin: 0, tMean: 0, precipitation: 0 },
    samples: { tMax: 0, tMin: 0, tMean: 0, precipitation: 0 },
  };
}

/** Valor numérico de una serie en una posición; `null` si es nulo o no numérico. */
function valueAt(series: Array<string | number | null> | undefined, index: number): number | null {
  if (series === undefined) return null;
  return readNumber(series[index]);
}

export async function getClimateNormals(): Promise<Fetched<ClimateNormals>> {
  const results = await Promise.all(
    CLIMATE_CHUNKS.map((chunk) =>
      fetchJson<RawOmResponse>(buildClimateUrl(chunk.startDate, chunk.endDate), {
        revalidate: REVALIDATE.climate,
        tag: "climate",
      }),
    ),
  );

  const failures: string[] = [];
  const blocks: OmBlock[] = [];

  results.forEach((result, index) => {
    const chunk = CLIMATE_CHUNKS[index];
    const label = `${chunk.startDate}..${chunk.endDate}`;
    if (!result.ok) {
      failures.push(`${label} (${result.error})`);
      return;
    }
    const daily = readBlock(result.data.daily);
    if (daily === null) {
      failures.push(`${label} (sin bloque daily)`);
      return;
    }
    blocks.push(daily);
  });

  if (failures.length > 0) {
    return { ok: false, error: `Climatología incompleta: ${failures.join(", ")}` };
  }

  const byKey = new Map<string, DayAccumulator>();
  let daysWithData = 0;

  for (const daily of blocks) {
    for (let index = 0; index < daily.time.length; index += 1) {
      const date = daily.time[index];
      // El archivo siempre manda "AAAA-MM-DD"; cualquier otra cosa no se puede
      // indexar por mes-día sin adivinar.
      if (date.length < 10) continue;

      const values: Record<ClimateVariable, number | null> = {
        tMax: valueAt(daily[SOURCE_KEY.tMax], index),
        tMin: valueAt(daily[SOURCE_KEY.tMin], index),
        tMean: valueAt(daily[SOURCE_KEY.tMean], index),
        precipitation: valueAt(daily[SOURCE_KEY.precipitation], index),
      };

      // Un día sin ningún dato no aporta a ningún promedio y no debe contar como
      // cobertura: inflarlo haría creer que el periodo está más completo de lo que está.
      if (!VARIABLES.some((variable) => values[variable] !== null)) continue;
      daysWithData += 1;

      const key = date.slice(5, 10);
      let accumulator = byKey.get(key);
      if (accumulator === undefined) {
        accumulator = createAccumulator();
        byKey.set(key, accumulator);
      }
      accumulator.years.add(date.slice(0, 4));

      for (const variable of VARIABLES) {
        const value = values[variable];
        if (value === null) continue;
        accumulator.sums[variable] += value;
        accumulator.samples[variable] += 1;
      }
    }
  }

  const byDayOfYear: ClimateNormals["byDayOfYear"] = {};

  for (const [key, accumulator] of byKey) {
    // Se publica una fecha solo si las cuatro variables tienen muestra. Un
    // promedio de una sola variable no es comparable con el resto del calendario,
    // y rellenar la que falta con 0 (por ejemplo, "precipitación normal: 0 mm")
    // sería afirmar algo que los datos no dicen.
    if (VARIABLES.some((variable) => accumulator.samples[variable] === 0)) continue;

    byDayOfYear[key] = {
      tMax: accumulator.sums.tMax / accumulator.samples.tMax,
      tMin: accumulator.sums.tMin / accumulator.samples.tMin,
      tMean: accumulator.sums.tMean / accumulator.samples.tMean,
      precipitation: accumulator.sums.precipitation / accumulator.samples.precipitation,
      years: accumulator.years.size,
    };
  }

  return {
    ok: true,
    data: {
      byDayOfYear,
      periodStart: `${CLIMATE_PERIOD_START}-01-01`,
      periodEnd: `${CLIMATE_PERIOD_END}-12-31`,
      daysWithData,
    },
  };
}
