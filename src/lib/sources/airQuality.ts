/**
 * Calidad del aire: 13 contaminantes e índices, "ahora mismo" y por hora.
 *
 * La API responde con una celda de ~11 km (31.70/-106.50), más gruesa que la del
 * pronóstico, así que estos números describen la cuenca de Juárez y El Paso, no
 * la cuadra. La interfaz lo advierte; aquí solo se normaliza.
 *
 * `ammonia` llega nula en toda la región: se conserva como `null` para que la
 * interfaz pueda ocultarla en lugar de pintar un cero que parecería una medición.
 */

import { REVALIDATE, buildAirQualityUrl } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { AirQualityBundle } from "../types";
import { readBlock, readCurrent, readPlace, readUnits, type RawOmResponse } from "./forecast";

export async function getAirQuality(): Promise<Fetched<AirQualityBundle>> {
  const result = await fetchJson<RawOmResponse>(buildAirQualityUrl(), {
    revalidate: REVALIDATE.airQuality,
    tag: "air",
  });
  if (!result.ok) return result;

  const place = readPlace(result.data);
  if (!place.ok) return place;

  const current = readCurrent(result.data.current);
  if (current === null) {
    return { ok: false, error: "La respuesta no trae el bloque current de calidad del aire" };
  }

  const hourly = readBlock(result.data.hourly);
  if (hourly === null) {
    return { ok: false, error: "La respuesta no trae el bloque hourly con su arreglo time" };
  }

  return {
    ok: true,
    data: {
      place: place.data,
      current,
      currentUnits: readUnits(result.data.current_units),
      hourly,
      hourlyUnits: readUnits(result.data.hourly_units),
    },
  };
}
