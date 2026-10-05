/**
 * Pronóstico cada 15 minutos: dos horas hacia adelante, que es lo que sirve para
 * decidir si conviene salir ahora o esperar a que pase la lluvia.
 *
 * Comparte el envoltorio `ForecastBundle` con el pronóstico detallado para que la
 * interfaz tenga un solo tipo con el que trabajar. Los bloques que este endpoint
 * no pide (`current`, `hourly`, `daily`) se devuelven vacíos, no rellenados con
 * datos de otra fuente: un bloque con `time: []` es una respuesta honesta a
 * "aquí no hay serie", mientras que una serie inventada se vería igual que un
 * pronóstico real.
 */

import { REVALIDATE, buildMinutelyUrl } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { ForecastBundle } from "../types";
import { emptyBlock, readBlock, readPlace, readUnits, type RawOmResponse } from "./forecast";

export async function getMinutely(): Promise<Fetched<ForecastBundle>> {
  const result = await fetchJson<RawOmResponse>(buildMinutelyUrl(), {
    revalidate: REVALIDATE.minutely,
    tag: "minutely",
  });
  if (!result.ok) return result;

  const place = readPlace(result.data);
  if (!place.ok) return place;

  // Ojo con el nombre: la API manda `minutely_15`, el tipo normalizado lo llama
  // `minutely15`. El guion bajo no debe sobrevivir a la normalización.
  const minutely15 = readBlock(result.data.minutely_15);
  if (minutely15 === null) {
    return {
      ok: false,
      error: "La respuesta no trae el bloque minutely_15 con su arreglo time",
    };
  }

  return {
    ok: true,
    data: {
      place: place.data,
      current: {},
      currentUnits: {},
      minutely15,
      minutely15Units: readUnits(result.data.minutely_15_units),
      hourly: emptyBlock(),
      hourlyUnits: {},
      daily: emptyBlock(),
      dailyUnits: {},
    },
  };
}
