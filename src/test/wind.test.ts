import { describe, expect, it } from "vitest";
import {
  COMPASS_POINTS,
  beaufort,
  compassLongLabel,
  compassPoint,
  crosswindLabel,
  windChillCelsius,
} from "@/lib/derive/wind";

const LONG_LABELS = [
  "Norte",
  "Nornoreste",
  "Noreste",
  "Estenoreste",
  "Este",
  "Estesureste",
  "Sureste",
  "Sursureste",
  "Sur",
  "Sursuroeste",
  "Suroeste",
  "Oestesuroeste",
  "Oeste",
  "Oestenoroeste",
  "Noroeste",
  "Nornoroeste",
];

describe("COMPASS_POINTS", () => {
  it("tiene los 16 puntos en español, con O de Oeste", () => {
    expect(COMPASS_POINTS).toEqual([
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSO",
      "SO",
      "OSO",
      "O",
      "ONO",
      "NO",
      "NNO",
    ]);
    expect(COMPASS_POINTS).toHaveLength(16);
    expect(COMPASS_POINTS).not.toContain("W");
  });
});

describe("compassPoint", () => {
  it("devuelve el punto correcto en los 16 sectores", () => {
    for (let i = 0; i < 16; i += 1) {
      expect(compassPoint(i * 22.5)).toBe(COMPASS_POINTS[i]);
    }
  });

  it("resuelve los bordes a favor del punto superior", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(360)).toBe("N");
    expect(compassPoint(348.75)).toBe("N");
    expect(compassPoint(348.74)).toBe("NNO");
    expect(compassPoint(11.25)).toBe("NNE");
    expect(compassPoint(11.24)).toBe("N");
  });

  it("normaliza ángulos fuera de 0..360", () => {
    expect(compassPoint(-45)).toBe("NO");
    expect(compassPoint(765)).toBe("NE");
    expect(compassPoint(-360)).toBe("N");
  });

  it("devuelve la etiqueta neutra sin dato", () => {
    expect(compassPoint(null)).toBe("—");
    expect(compassPoint(undefined)).toBe("—");
    expect(compassPoint(Number.NaN)).toBe("—");
  });
});

describe("compassLongLabel", () => {
  it("nombra los 16 puntos en español", () => {
    for (let i = 0; i < 16; i += 1) {
      expect(compassLongLabel(i * 22.5)).toBe(LONG_LABELS[i]);
    }
  });

  it("ejemplos concretos", () => {
    expect(compassLongLabel(337.5)).toBe("Nornoroeste");
    expect(compassLongLabel(270)).toBe("Oeste");
    expect(compassLongLabel(180)).toBe("Sur");
  });

  it("devuelve la etiqueta neutra sin dato", () => {
    expect(compassLongLabel(null)).toBe("—");
    expect(compassLongLabel(Number.NaN)).toBe("—");
  });
});

describe("crosswindLabel", () => {
  it("arma la frase corrida con ocho rumbos", () => {
    expect(crosswindLabel(0)).toBe("viento del norte");
    expect(crosswindLabel(45)).toBe("viento del noreste");
    expect(crosswindLabel(90)).toBe("viento del este");
    expect(crosswindLabel(135)).toBe("viento del sureste");
    expect(crosswindLabel(180)).toBe("viento del sur");
    expect(crosswindLabel(225)).toBe("viento del suroeste");
    expect(crosswindLabel(270)).toBe("viento del oeste");
    expect(crosswindLabel(315)).toBe("viento del noroeste");
  });

  it("redondea al rumbo más cercano", () => {
    expect(crosswindLabel(20)).toBe("viento del norte");
    expect(crosswindLabel(30)).toBe("viento del noreste");
    expect(crosswindLabel(359)).toBe("viento del norte");
  });

  it("no inventa dirección cuando no hay dato", () => {
    expect(crosswindLabel(null)).toBe("viento sin dirección");
    expect(crosswindLabel(undefined)).toBe("viento sin dirección");
  });
});

describe("windChillCelsius", () => {
  it("reproduce los valores de la tabla de Environment Canada", () => {
    expect(windChillCelsius(0, 20)).toBeCloseTo(-5.24, 1);
    expect(windChillCelsius(-10, 30)).toBeCloseTo(-19.52, 1);
    expect(windChillCelsius(10, 10)).toBeCloseTo(8.63, 1);
  });

  it("solo aplica con temperatura ≤ 10 °C y viento > 4.8 km/h", () => {
    expect(windChillCelsius(5, 4.81)).toBeCloseTo(4.16, 1);
    expect(windChillCelsius(5, 4.8)).toBeNull();
    expect(windChillCelsius(5, 4)).toBeNull();
    expect(windChillCelsius(10, 30)).not.toBeNull();
    expect(windChillCelsius(10.01, 30)).toBeNull();
    expect(windChillCelsius(25, 40)).toBeNull();
  });

  it("devuelve null si falta algún dato", () => {
    expect(windChillCelsius(null, 20)).toBeNull();
    expect(windChillCelsius(0, null)).toBeNull();
    expect(windChillCelsius(undefined, undefined)).toBeNull();
    expect(windChillCelsius(Number.NaN, 20)).toBeNull();
    expect(windChillCelsius(0, Number.NaN)).toBeNull();
  });

  it("nunca da una sensación mayor que la temperatura real", () => {
    for (const wind of [5, 10, 20, 40, 80]) {
      expect(windChillCelsius(-5, wind)!).toBeLessThanOrEqual(-5);
    }
  });
});

describe("beaufort", () => {
  it.each<[number, number, string]>([
    [0, 0, "Calma"],
    [0.9, 0, "Calma"],
    [1, 1, "Ventolina"],
    [5.9, 1, "Ventolina"],
    [6, 2, "Brisa muy débil"],
    [11, 2, "Brisa muy débil"],
    [12, 3, "Brisa débil"],
    [19, 3, "Brisa débil"],
    [20, 4, "Brisa moderada"],
    [28, 4, "Brisa moderada"],
    [29, 5, "Brisa fresca"],
    [38, 5, "Brisa fresca"],
    [39, 6, "Brisa fuerte"],
    [49, 6, "Brisa fuerte"],
    [50, 7, "Viento fuerte"],
    [61, 7, "Viento fuerte"],
    [62, 8, "Viento duro"],
    [74, 8, "Viento duro"],
    [75, 9, "Viento muy duro"],
    [88, 9, "Viento muy duro"],
    [89, 10, "Tempestad"],
    [102, 10, "Tempestad"],
    [103, 11, "Borrasca"],
    [117, 11, "Borrasca"],
    [118, 12, "Huracán"],
    [300, 12, "Huracán"],
  ])("con %f km/h devuelve fuerza %i (%s)", (kmh, force, label) => {
    expect(beaufort(kmh)).toEqual({ force, label });
  });

  it("devuelve null sin dato o con velocidades imposibles", () => {
    expect(beaufort(null)).toBeNull();
    expect(beaufort(undefined)).toBeNull();
    expect(beaufort(Number.NaN)).toBeNull();
    expect(beaufort(-1)).toBeNull();
  });
});
