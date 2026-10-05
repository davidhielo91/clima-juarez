/**
 * Las seis zonas de la ciudad en una sola petición multi-ubicación.
 *
 * La API responde un ARREGLO con una entrada por coordenada pedida y en el mismo
 * orden, pero sin ningún identificador. Por eso el emparejamiento es por índice
 * contra `ZONES` y por eso se exige que el número de entradas coincida: si la API
 * devolviera cinco entradas para seis zonas, emparejar por índice pondría el
 * clima de Anapra en el Centro y nadie lo notaría mirando la pantalla.
 */

import { REVALIDATE, ZONES, buildZonesUrl } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { ZoneReading } from "../types";
import { readCurrent, readNumber, readRecord } from "./forecast";

export async function getZones(): Promise<Fetched<ZoneReading[]>> {
  const result = await fetchJson<unknown>(buildZonesUrl(), {
    revalidate: REVALIDATE.zones,
    tag: "zones",
  });
  if (!result.ok) return result;

  if (!Array.isArray(result.data)) {
    return { ok: false, error: "Se esperaba un arreglo con una entrada por zona" };
  }

  const entries = result.data as unknown[];
  if (entries.length !== ZONES.length) {
    return {
      ok: false,
      error: `Llegaron ${entries.length} ubicaciones y se pidieron ${ZONES.length}: no se pueden emparejar por índice con ZONES`,
    };
  }

  const readings: ZoneReading[] = [];

  for (let index = 0; index < ZONES.length; index += 1) {
    const zone = ZONES[index];
    const raw = readRecord(entries[index]);
    const current = raw === null ? null : readCurrent(raw.current);

    // La celda del modelo y su elevación son lo único que distingue una zona de
    // otra en los datos, y el tipo las declara obligatorias: sin ellas se avisa
    // en vez de caer a la coordenada pedida, que es una celda distinta.
    const modelLatitude = readNumber(raw?.latitude);
    const modelLongitude = readNumber(raw?.longitude);
    const elevation = readNumber(raw?.elevation);

    if (current === null || modelLatitude === null || modelLongitude === null || elevation === null) {
      return {
        ok: false,
        error: `La zona ${zone.id} llegó sin su celda de modelo (latitude, longitude, elevation) o sin el bloque current`,
      };
    }

    readings.push({
      id: zone.id,
      name: zone.name,
      detail: zone.detail,
      // Coordenada pedida, para poder decir en la interfaz cuánto se movió la
      // celda del modelo respecto al punto que se quiso consultar.
      latitude: zone.latitude,
      longitude: zone.longitude,
      modelLatitude,
      modelLongitude,
      elevation,
      // Los nombres de la API no se filtran a la interfaz: se traducen una vez
      // aquí y así una variable nueva solo se toca en este archivo.
      temperature: readNumber(current.temperature_2m),
      apparentTemperature: readNumber(current.apparent_temperature),
      windSpeed: readNumber(current.wind_speed_10m),
      windGusts: readNumber(current.wind_gusts_10m),
      windDirection: readNumber(current.wind_direction_10m),
      precipitation: readNumber(current.precipitation),
      weatherCode: readNumber(current.weather_code),
    });
  }

  return { ok: true, data: readings };
}
