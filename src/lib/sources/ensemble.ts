/**
 * Ensamble de 30 miembros del GFS: la dispersión entre miembros es la medida de
 * cuánta confianza merece el pronóstico.
 *
 * Las claves de los miembros vienen numeradas en texto (`temperature_2m_member07`),
 * así que ordenarlas como cadenas funciona de casualidad hasta que pasan de 09.
 * Aquí se ordenan por el número del sufijo, con la seguridad de que el miembro 10
 * va después del 9 y no después del 1.
 */

import { REVALIDATE, buildEnsembleUrl } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { EnsembleBundle, OmBlock } from "../types";
import { readBlock, readPlace, readUnits, type RawOmResponse } from "./forecast";

/**
 * Claves de miembro de una variable, ordenadas por su número.
 *
 * El control (`temperature_2m`, sin sufijo) no entra: no es un miembro más, es la
 * corrida determinista del mismo modelo y mezclarlo en el conteo de la dispersión
 * sesgaría la estadística.
 */
function memberKeys(block: OmBlock, variable: string): string[] {
  const pattern = new RegExp(`^${variable}_member(\\d+)$`);
  const numbered = new Map<string, number>();

  for (const key of Object.keys(block)) {
    const match = pattern.exec(key);
    if (match === null) continue;
    numbered.set(key, Number(match[1]));
  }

  return [...numbered.entries()].sort((a, b) => a[1] - b[1]).map(([key]) => key);
}

export async function getEnsemble(): Promise<Fetched<EnsembleBundle>> {
  const result = await fetchJson<RawOmResponse>(buildEnsembleUrl(), {
    revalidate: REVALIDATE.ensemble,
    tag: "ensemble",
  });
  if (!result.ok) return result;

  const place = readPlace(result.data);
  if (!place.ok) return place;

  const hourly = readBlock(result.data.hourly);
  if (hourly === null) {
    return { ok: false, error: "La respuesta no trae el bloque hourly con su arreglo time" };
  }

  const temperatureMembers = memberKeys(hourly, "temperature_2m");
  const precipitationMembers = memberKeys(hourly, "precipitation");

  // Se exige al menos un miembro de cada variable: sin ellos la respuesta no es
  // un ensamble y es mejor decirlo que pintar una gráfica vacía. Si llegan menos
  // de los 30 contratados se pasan los que haya, sin rellenar con el control:
  // la interfaz puede avisar del hueco y la dispersión seguirá siendo real.
  if (temperatureMembers.length === 0 || precipitationMembers.length === 0) {
    return {
      ok: false,
      error: `El ensamble llegó incompleto: ${temperatureMembers.length} miembros de temperatura, ${precipitationMembers.length} de precipitación`,
    };
  }

  return {
    ok: true,
    data: {
      place: place.data,
      hourly,
      hourlyUnits: readUnits(result.data.hourly_units),
      temperatureMembers,
      precipitationMembers,
    },
  };
}
