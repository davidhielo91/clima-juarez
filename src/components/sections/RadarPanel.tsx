import { Caveat, DataState, EmptyNote, Panel } from "@/components/ui/primitives";
import RadarViewer from "@/components/radar/RadarViewer";
import { POINT } from "@/lib/endpoints.mjs";
import { formatTimestamp } from "@/lib/format";
import { getRadar } from "@/lib/sources/radar";
import { formatNumber, type UnitSystem } from "@/lib/units";

/**
 * Radar de lluvia: el único panel que observa en vez de pronosticar.
 *
 * RainViewer publica un catálogo de fotogramas de los últimos minutos, no un
 * pronóstico. Eso lo hace el dato más honesto de la página para la pregunta "¿está
 * lloviendo ahora y hacia dónde va?", y también el más limitado: no dice cuánto va a
 * llover en una hora, y su alcance es regional.
 *
 * El panel no dibuja nada por su cuenta: pide el catálogo, mide el cuadro y se lo
 * pasa todo al visor de cliente, que es quien anima.
 */

/**
 * Lado de una tesela a zoom 8 en esta latitud, en metros: la circunferencia
 * ecuatorial repartida entre las 256 columnas del mundo, corregida por el coseno de
 * la latitud.
 */
const TILE_EDGE_METRES =
  (40075016.686 * Math.cos((POINT.latitude * Math.PI) / 180)) / 256;

/** Ancho del cuadro: tres teselas. El alto son dos, porque las teselas son cuadradas. */
const FRAME_WIDTH_METRES = TILE_EDGE_METRES * 3;

/**
 * Extensión del cuadro en las unidades del usuario.
 *
 * `formatDistance` trabaja en metros y con 400 000 m la cifra pierde toda
 * legibilidad (400,000 m; en pies, 1,312,336 ft), así que la conversión se hace aquí
 * a kilómetros o millas —unidades en las que la gente piensa las distancias
 * regionales— y el número se formatea con `formatNumber`, que sí viene de
 * `src/lib/units.ts`. La cifra es una aproximación: el ancho real depende de la
 * latitud, y a 31.7° cada tesela mide 133 km.
 */
function formatExtent(metres: number, units: UnitSystem): string {
  if (units.distance === "ft") {
    return `unos ${formatNumber(metres / 1609.344, 0)} mi`;
  }
  return `unos ${formatNumber(metres / 1000, 0)} km`;
}

export default async function RadarPanel({ units }: { units: UnitSystem }) {
  const result = await getRadar();

  const frames = result.ok ? result.data.frames : [];
  const first = frames[0];
  const last = frames[frames.length - 1];

  const subtitle =
    first !== undefined && last !== undefined
      ? `${frames.length} fotogramas, de las ${formatTimestamp(first.time)} a las ${formatTimestamp(last.time)} UTC`
      : "Lluvia observada por radar sobre la región";

  const missingHost =
    result.ok && (result.data.host.trim() === "" || result.data.frames.length === 0);

  return (
    <Panel id="radar" title="Radar de lluvia" subtitle={subtitle}>
      <DataState result={result} what="el radar de lluvia">
        {(data) =>
          data.host.trim() === "" || data.frames.length === 0 ? (
            <EmptyNote>
              El catálogo del radar llegó sin host o sin fotogramas, así que no hay
              mosaicos que pedir ni nada que animar. La ausencia de fotogramas no
              significa que no llueva: significa que no hay imagen.
            </EmptyNote>
          ) : (
            <RadarViewer host={data.host} frames={data.frames} />
          )
        }
      </DataState>

      <Caveat>
        El radar muestra lo que ya cayó, no lo que va a caer: es una fotografía de las
        últimas dos horas, y por eso el visor dice siempre la hora del fotograma. Color
        más intenso es más agua por hora, pero la conversión de reflectividad a
        milímetros es aproximada, así que no se puede leer como una cifra. El cuadro
        cubre {formatExtent(FRAME_WIDTH_METRES, units)} de ancho por{" "}
        {formatExtent(FRAME_WIDTH_METRES * (2 / 3), units)} de alto: entra el valle
        completo, El Paso y buena parte del sur de Nuevo México, así que sirve para ver
        de dónde viene la lluvia, no para saber si está cayendo en tu cuadra. La base
        cartográfica es de OpenStreetMap y la lluvia, de RainViewer; ninguna de las dos
        es una medición oficial de Protección Civil.
        {!result.ok ? (
          <>
            {" "}
            Ahora mismo no llegó el catálogo de fotogramas ({result.error}), así que no
            se dibuja el visor.
          </>
        ) : null}
        {missingHost ? (
          <>
            {" "}
            La fuente respondió correctamente pero sin host o sin fotogramas, así que
            tampoco se dibuja el visor: no habría nada que pedir ni que animar.
          </>
        ) : null}
      </Caveat>
    </Panel>
  );
}
