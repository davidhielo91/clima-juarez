import { describe, expect, it } from "vitest";
import { POINT, RADAR, RADAR_IMPOSSIBLE_ZOOM } from "@/lib/endpoints.mjs";
import {
  radarGrid,
  radarTileEdgeMetres,
  radarTileFor,
  radarTilePosition,
} from "@/lib/radarGeometry.mjs";

/** Circunferencia ecuatorial de la Tierra en el elipsoide WGS 84, en metros. */
const EQUATOR_METRES = 40075016.686;

describe("radarTileEdgeMetres", () => {
  it("en el ecuador divide la circunferencia entre el número de teselas del zoom", () => {
    expect(radarTileEdgeMetres(0)).toBeCloseTo(EQUATOR_METRES / 2 ** RADAR.zoom, 3);
  });

  it("en Juárez, a zoom 7, una tesela mide unos 266 km", () => {
    const metres = radarTileEdgeMetres(POINT.latitude);
    expect(metres).toBeGreaterThan(265_000);
    expect(metres).toBeLessThan(267_000);
  });

  it("el cuadro de 3 × 2 teselas cubre cientos de kilómetros, no unos pocos", () => {
    // Regresión: dividir entre `tileSize * 2 ** zoom` da metros por píxel, y el
    // panel llegó a anunciar "unos 3 km de ancho" en lugar de ~800 km.
    const width = radarTileEdgeMetres(POINT.latitude) * RADAR.columns;
    expect(width).toBeGreaterThan(790_000);
    expect(width).toBeLessThan(810_000);
  });

  it("se encoge con el coseno de la latitud", () => {
    expect(radarTileEdgeMetres(60)).toBeCloseTo(radarTileEdgeMetres(0) / 2, 3);
    expect(radarTileEdgeMetres(-31.7384)).toBeCloseTo(
      radarTileEdgeMetres(31.7384),
      6,
    );
  });
});

describe("radarTileFor", () => {
  it("ubica Juárez en la tesela 26/52 del zoom 7", () => {
    expect(radarTileFor(POINT.latitude, POINT.longitude, 7)).toEqual({
      zoom: 7,
      x: 26,
      y: 52,
    });
  });

  it("usa el zoom configurado en RADAR cuando no se pasa uno", () => {
    expect(radarTileFor(POINT.latitude, POINT.longitude)).toEqual(
      radarTileFor(POINT.latitude, POINT.longitude, RADAR.zoom),
    );
  });

  it("a zoom 0 todo el mundo cabe en la tesela 0/0", () => {
    expect(radarTileFor(POINT.latitude, POINT.longitude, 0)).toEqual({
      zoom: 0,
      x: 0,
      y: 0,
    });
  });

  it("a zoom 1 reparte los cuadrantes: x crece al este, y crece al sur", () => {
    expect(radarTileFor(45, -90, 1)).toMatchObject({ x: 0, y: 0 });
    expect(radarTileFor(45, 90, 1)).toMatchObject({ x: 1, y: 0 });
    expect(radarTileFor(-45, -90, 1)).toMatchObject({ x: 0, y: 1 });
    expect(radarTileFor(-45, 90, 1)).toMatchObject({ x: 1, y: 1 });
  });

  it("en los bordes del mapa queda dentro del rango 0 … 2^zoom − 1", () => {
    expect(radarTileFor(85, -180, 3)).toMatchObject({ x: 0, y: 0 });
    expect(radarTileFor(-85, 179.99, 3)).toMatchObject({ x: 7, y: 7 });
  });

  it("al subir un zoom, la tesela hija está dentro de la madre", () => {
    const parent = radarTileFor(POINT.latitude, POINT.longitude, 7);
    const child = radarTileFor(POINT.latitude, POINT.longitude, 8);
    expect(Math.floor(child.x / 2)).toBe(parent.x);
    expect(Math.floor(child.y / 2)).toBe(parent.y);
  });

  it("el zoom imposible del script pide una tesela distinta de la configurada", () => {
    const configured = radarTileFor(POINT.latitude, POINT.longitude);
    const impossible = radarTileFor(POINT.latitude, POINT.longitude, RADAR_IMPOSSIBLE_ZOOM);
    expect(impossible.zoom).toBe(RADAR_IMPOSSIBLE_ZOOM);
    expect(impossible).not.toEqual(configured);
    // Lo bastante lejos del tope de RainViewer (7) para no empezar a servirse nunca.
    expect(RADAR_IMPOSSIBLE_ZOOM).toBeGreaterThan(RADAR.zoom + 10);
  });

  it("es la parte entera de la posición continua", () => {
    const position = radarTilePosition(POINT.latitude, POINT.longitude);
    expect(radarTileFor(POINT.latitude, POINT.longitude)).toEqual({
      zoom: position.zoom,
      x: Math.floor(position.x),
      y: Math.floor(position.y),
    });
  });
});

describe("radarTilePosition", () => {
  it("en Juárez, a zoom 7, cae en 26.15 / 52.09", () => {
    const position = radarTilePosition(POINT.latitude, POINT.longitude, 7);
    expect(position.zoom).toBe(7);
    expect(position.x).toBeCloseTo(26.1486, 4);
    expect(position.y).toBeCloseTo(52.0895, 4);
  });

  it("el cruce del ecuador y Greenwich queda en el centro del mundo", () => {
    expect(radarTilePosition(0, 0, 3)).toMatchObject({ x: 4, y: 4 });
  });
});

describe("radarGrid", () => {
  const grid = radarGrid();

  it("pide las teselas 24–27 × 51–53 del zoom 7", () => {
    // Si cambia, el mapa se mueve: eso tiene que ser una decisión, no un efecto
    // secundario.
    const xs = [...new Set(grid.map((tile) => tile.x))];
    const ys = [...new Set(grid.map((tile) => tile.y))];
    expect(xs).toEqual([24, 25, 26, 27]);
    expect(ys).toEqual([51, 52, 53]);
  });

  it("tiene una columna y una fila de más, todas del zoom configurado", () => {
    expect(grid).toHaveLength((RADAR.columns + 1) * (RADAR.rows + 1));
    expect(grid.every((tile) => tile.zoom === RADAR.zoom)).toBe(true);
  });

  it("pone a Juárez en el centro exacto del cuadro", () => {
    // El centro del cuadro se lleva de vuelta a grados con la fórmula INVERSA de
    // Mercator, que no comparte código con `radarTilePosition`: si la rejilla se
    // coloca mal, el centro deja de caer sobre Juárez y esta prueba lo ve.
    const count = 2 ** RADAR.zoom;
    for (const tile of grid) {
      const centreX = tile.x - tile.left + RADAR.columns / 2;
      const centreY = tile.y - tile.top + RADAR.rows / 2;
      const longitude = (centreX / count) * 360 - 180;
      const latitude =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * centreY) / count))) * 180) / Math.PI;
      expect(longitude).toBeCloseTo(POINT.longitude, 6);
      expect(latitude).toBeCloseTo(POINT.latitude, 6);
    }
  });

  it("cubre el cuadro entero, sin huecos en los bordes", () => {
    const lefts = grid.map((tile) => tile.left);
    const tops = grid.map((tile) => tile.top);
    expect(Math.min(...lefts)).toBeLessThanOrEqual(0);
    expect(Math.max(...lefts) + 1).toBeGreaterThanOrEqual(RADAR.columns);
    expect(Math.min(...tops)).toBeLessThanOrEqual(0);
    expect(Math.max(...tops) + 1).toBeGreaterThanOrEqual(RADAR.rows);
  });

  it("desplaza la primera tesela 0.649 a la izquierda y 0.090 hacia arriba", () => {
    // Juárez cae en 26.149 / 52.090; el cuadro de 3 × 2 empieza 1.5 y 1 teselas
    // antes, en 24.649 / 51.090, así que la tesela 24/51 asoma por fuera esa fracción.
    const first = grid.find((tile) => tile.x === 24 && tile.y === 51);
    expect(first?.left).toBeCloseTo(-0.6486, 4);
    expect(first?.top).toBeCloseTo(-0.0895, 4);
  });
});
