import { describe, expect, it } from "vitest";
import {
  POINT,
  RADAR,
  radarGrid,
  radarTileEdgeMetres,
  radarTileFor,
  radarTilePosition,
} from "@/lib/endpoints.mjs";

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
    const impossible = radarTileFor(POINT.latitude, POINT.longitude, 20);
    expect(impossible.zoom).toBe(20);
    expect(impossible).not.toEqual(configured);
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

  it("arma la misma rejilla de 3 × 2 teselas que pedía el visor", () => {
    // Valor tomado del visor antes de unificar la fórmula: si cambia, el mapa se
    // mueve, y eso tiene que ser una decisión, no un efecto secundario.
    expect(grid.map(({ x, y, column, row }) => `${x}/${y}@${column},${row}`)).toEqual([
      "24/51@0,0",
      "24/52@0,1",
      "25/51@1,0",
      "25/52@1,1",
      "26/51@2,0",
      "26/52@2,1",
    ]);
  });

  it("tiene RADAR.columns × RADAR.rows teselas, todas del zoom configurado", () => {
    expect(grid).toHaveLength(RADAR.columns * RADAR.rows);
    expect(grid.every((tile) => tile.zoom === RADAR.zoom)).toBe(true);
  });

  it("es contigua: cada columna y fila avanza una tesela", () => {
    const [origin] = grid;
    for (const tile of grid) {
      expect(tile.x - origin.x).toBe(tile.column);
      expect(tile.y - origin.y).toBe(tile.row);
    }
  });

  it("incluye la tesela que contiene Juárez", () => {
    const home = radarTileFor(POINT.latitude, POINT.longitude);
    expect(grid.some((tile) => tile.x === home.x && tile.y === home.y)).toBe(true);
  });
});
