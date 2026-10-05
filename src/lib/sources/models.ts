/**
 * Comparación de los seis modelos globales: temperatura y precipitación de cada
 * uno para las mismas horas.
 *
 * Open-Meteo mete los seis modelos en un solo bloque horario y distingue cada
 * serie con un sufijo (`temperature_2m_gfs_seamless`). Aquí ese bloque se parte
 * en una serie por modelo y se le pega el nombre legible y el origen de `MODELS`,
 * porque la interfaz no tiene por qué saber que GFS significa NOAA.
 *
 * Las seis series comparten el mismo arreglo `time`: los modelos publican a la
 * misma rejilla horaria de la zona pedida, así que un solo eje basta y comparar es
 * recorrer los arreglos en paralelo.
 */

import { MODELS, REVALIDATE, buildModelsUrl } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { ModelSeries, ModelsBundle } from "../types";
import { readBlock, readNumberSeries, readPlace, type RawOmResponse } from "./forecast";

export async function getModels(): Promise<Fetched<ModelsBundle>> {
  const result = await fetchJson<RawOmResponse>(buildModelsUrl(), {
    revalidate: REVALIDATE.models,
    tag: "models",
  });
  if (!result.ok) return result;

  const place = readPlace(result.data);
  if (!place.ok) return place;

  const hourly = readBlock(result.data.hourly);
  if (hourly === null) {
    return { ok: false, error: "La respuesta no trae el bloque hourly con su arreglo time" };
  }

  const models: ModelSeries[] = MODELS.map((model) => ({
    id: model.id,
    name: model.name,
    origin: model.origin,
    time: hourly.time,
    // Si un modelo no aparece en la respuesta, su serie queda toda en `null` en
    // lugar de desaparecer: la interfaz puede decir "sin datos" en su renglón, y
    // el resto de los modelos sigue siendo comparable hora por hora.
    temperature: readNumberSeries(hourly[`temperature_2m_${model.id}`], hourly.time.length),
    precipitation: readNumberSeries(hourly[`precipitation_${model.id}`], hourly.time.length),
  }));

  return { ok: true, data: { place: place.data, models } };
}
