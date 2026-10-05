/**
 * Histórico reciente: los últimos 14 días más hoy, para poder comparar "esto ya
 * pasó" contra el pronóstico.
 *
 * Se pide a la API de pronóstico con `past_days`, no al archivo histórico: el
 * archivo de ERA5 llega con días de retraso y aquí se necesita lo de anteayer.
 * Solo se normaliza el bloque diario; el horario que también viaja en la misma
 * respuesta no forma parte de `HistoryBundle`, así que se descarta al leer.
 */

import { REVALIDATE, buildHistoryUrl } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { HistoryBundle } from "../types";
import { readBlock, readPlace, readUnits, type RawOmResponse } from "./forecast";

export async function getHistory(): Promise<Fetched<HistoryBundle>> {
  const result = await fetchJson<RawOmResponse>(buildHistoryUrl(), {
    revalidate: REVALIDATE.history,
    tag: "history",
  });
  if (!result.ok) return result;

  const place = readPlace(result.data);
  if (!place.ok) return place;

  const daily = readBlock(result.data.daily);
  if (daily === null) {
    return { ok: false, error: "La respuesta no trae el bloque daily con su arreglo time" };
  }

  return {
    ok: true,
    data: {
      place: place.data,
      daily,
      dailyUnits: readUnits(result.data.daily_units),
    },
  };
}
