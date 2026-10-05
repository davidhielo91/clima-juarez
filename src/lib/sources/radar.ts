/**
 * Radar de lluvia de RainViewer.
 *
 * No es Open-Meteo y no comparte envoltorio: devuelve el host de los mosaicos
 * (`https://tilecache.rainviewer.com`), el instante de generación y la lista de
 * fotogramas pasados. Cada fotograma es un `path` como `/v2/radar/13b911ff1340`
 * que la interfaz combina con el host para pedir el mosaico.
 *
 * `satellite.infrared` viene vacío en esta fuente y no se usa: sin él, la lluvia
 * se dibuja solo con radar, que es lo que el usuario necesita para saber si le va
 * a caer agua encima. Un fotograma mal formado se descarta en lugar de tumbar la
 * animación completa; si no queda ninguno, se avisa.
 */

import { BASE, REVALIDATE } from "../endpoints.mjs";
import { fetchJson, type Fetched } from "../fetchJson";
import type { RadarBundle, RadarFrame } from "../types";
import { readNumber, readRecord } from "./forecast";

interface RawRadarResponse {
  host?: unknown;
  generated?: unknown;
  radar?: unknown;
}

/** Fotograma crudo → fotograma utilizable, o `null` si le falta el tiempo o la ruta. */
function readFrame(value: unknown): RadarFrame | null {
  const raw = readRecord(value);
  if (raw === null) return null;

  const time = readNumber(raw.time);
  const path = typeof raw.path === "string" ? raw.path : null;
  if (time === null || path === null) return null;

  return { time, path };
}

export async function getRadar(): Promise<Fetched<RadarBundle>> {
  const result = await fetchJson<RawRadarResponse>(BASE.radar, {
    revalidate: REVALIDATE.radar,
    tag: "radar",
  });
  if (!result.ok) return result;

  const host = typeof result.data.host === "string" ? result.data.host : null;
  const generated = readNumber(result.data.generated);
  if (host === null || generated === null) {
    return { ok: false, error: "La respuesta del radar no trae host o generated" };
  }

  const radar = readRecord(result.data.radar);
  const past = radar === null ? null : radar.past;
  const frames = (Array.isArray(past) ? (past as unknown[]) : [])
    .map((frame) => readFrame(frame))
    .filter((frame): frame is RadarFrame => frame !== null);

  if (frames.length === 0) {
    return { ok: false, error: "RainViewer no publicó fotogramas de radar en radar.past" };
  }

  return { ok: true, data: { host, generated, frames } };
}
