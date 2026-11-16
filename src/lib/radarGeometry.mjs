/**
 * Geometría de las teselas del radar (Web Mercator), separada de `endpoints.mjs`
 * porque cambia por otros motivos: aquí se decide qué teselas se piden y dónde se
 * colocan; allí, qué URLs y variables existen.
 *
 * Es JavaScript plano por el mismo motivo que `endpoints.mjs`: la usan el panel y el
 * visor (TypeScript) y el script de verificación (Node puro), y una copia por lado
 * fue lo que rompió el mapa.
 */

import { POINT, RADAR } from "./endpoints.mjs";

/**
 * Lado de una tesela de radar en metros a una latitud dada.
 *
 * Cuidado con el divisor: es `2 ** zoom`, el número de teselas que caben alrededor
 * del mundo, NO `tileSize * 2 ** zoom`, que da metros por PÍXEL. La confusión es
 * fácil porque a zoom 8 los dos coinciden (256 = 2⁸) y el error queda invisible; al
 * bajar a zoom 7 el panel llegó a anunciar "unos 3 km de ancho" en vez de 800.
 */
export function radarTileEdgeMetres(latitude) {
  const equator = 40075016.686;
  return (equator * Math.cos((latitude * Math.PI) / 180)) / 2 ** RADAR.zoom;
}

/**
 * Posición continua de un punto en la rejilla de teselas (Web Mercator), con
 * decimales: la parte entera es la tesela y la fraccionaria, dónde cae dentro de
 * ella. Es la única copia de la fórmula; el visor y el script la usan a través de
 * `radarTileFor` y `radarGrid`.
 */
export function radarTilePosition(latitude, longitude, zoom = RADAR.zoom) {
  const count = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  return {
    zoom,
    x: ((longitude + 180) / 360) * count,
    y:
      ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
      count,
  };
}

/** Coordenada de la tesela (Web Mercator) que contiene un punto. */
export function radarTileFor(latitude, longitude, zoom = RADAR.zoom) {
  const position = radarTilePosition(latitude, longitude, zoom);
  return { zoom, x: Math.floor(position.x), y: Math.floor(position.y) };
}

/**
 * Teselas que llenan un cuadro de `RADAR.columns` × `RADAR.rows` teselas de lado
 * con Ciudad Juárez en el centro exacto.
 *
 * Las teselas son cuadros fijos del mundo, así que el punto casi nunca cae en una
 * frontera entre ellas. Para centrarlo, el cuadro empieza media rejilla antes del
 * punto, con decimales, y las teselas se colocan desplazadas esa fracción. Al
 * desplazarlas se destapa un borde, que se cubre con una columna y una fila de más;
 * lo que sobra lo recorta el contenedor.
 *
 * `left` y `top` son la posición de la esquina de cada tesela dentro del cuadro,
 * medida en teselas: pueden ser negativas o pasar del ancho del cuadro.
 */
export function radarGrid() {
  const position = radarTilePosition(POINT.latitude, POINT.longitude);
  const frameLeft = position.x - RADAR.columns / 2;
  const frameTop = position.y - RADAR.rows / 2;
  const firstX = Math.floor(frameLeft);
  const firstY = Math.floor(frameTop);
  const tiles = [];
  for (let column = 0; column <= RADAR.columns; column += 1) {
    for (let row = 0; row <= RADAR.rows; row += 1) {
      const x = firstX + column;
      const y = firstY + row;
      tiles.push({ zoom: RADAR.zoom, x, y, left: x - frameLeft, top: y - frameTop });
    }
  }
  return tiles;
}
