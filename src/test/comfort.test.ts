import { describe, expect, it } from "vitest";
import {
  dewPointComfort,
  heatIndexCelsius,
  thermalStress,
  vpdCategory,
  wetBulbCategory,
} from "@/lib/derive/comfort";

describe("heatIndexCelsius", () => {
  it("reproduce el caso conocido de 32 °C con 70 % de humedad", () => {
    // La ecuación de Rothfusz da 40.4 °C (104.7 °F), que es el valor de la tabla
    // del NWS para 90 °F y 70 %; el enunciado lo redondea a "≈ 41 °C".
    expect(heatIndexCelsius(32, 70)).toBeCloseTo(40.41, 1);
    expect(heatIndexCelsius(32, 70)!).toBeGreaterThan(40);
  });

  it("reproduce otros valores de la tabla del NWS", () => {
    // 100 °F con 40 % → 109 °F (42.8 °C). La tabla redondea a grados enteros,
    // así que la comparación se hace con tolerancia de medio grado.
    expect(heatIndexCelsius(37.8, 40)).toBeCloseTo(42.8, 0);
    expect(heatIndexCelsius(37.8, 40)!).toBeCloseTo(43, 0);
    expect(heatIndexCelsius(30, 60)).toBeCloseTo(32.83, 1);
  });

  it("devuelve null por debajo de 27 °C", () => {
    expect(heatIndexCelsius(26.9, 70)).toBeNull();
    expect(heatIndexCelsius(20, 90)).toBeNull();
    expect(heatIndexCelsius(0, 50)).toBeNull();
    expect(heatIndexCelsius(27, 50)).not.toBeNull();
  });

  it("aplica la corrección de aire muy seco", () => {
    // 40 °C con 10 % de humedad: la corrección baja el bochorno aparente.
    expect(heatIndexCelsius(40, 10)).toBeCloseTo(36.71, 1);
  });

  it("aplica la corrección de aire muy húmedo", () => {
    // 29 °C (84.2 °F) con 90 %: la corrección sube el valor respecto de 85 %.
    const withCorrection = heatIndexCelsius(29, 90)!;
    const atThreshold = heatIndexCelsius(29, 85)!;
    expect(withCorrection).toBeCloseTo(37.23, 1);
    expect(atThreshold).toBeCloseTo(35.87, 1);
    expect(withCorrection).toBeGreaterThan(atThreshold);
  });

  it("crece con la humedad a temperatura fija", () => {
    const dry = heatIndexCelsius(32, 30)!;
    const humid = heatIndexCelsius(32, 60)!;
    const wet = heatIndexCelsius(32, 90)!;
    expect(dry).toBeLessThan(humid);
    expect(humid).toBeLessThan(wet);
  });

  it("devuelve null con datos faltantes o humedad imposible", () => {
    expect(heatIndexCelsius(null, 70)).toBeNull();
    expect(heatIndexCelsius(32, null)).toBeNull();
    expect(heatIndexCelsius(undefined, undefined)).toBeNull();
    expect(heatIndexCelsius(Number.NaN, 70)).toBeNull();
    expect(heatIndexCelsius(32, Number.NaN)).toBeNull();
    expect(heatIndexCelsius(32, 101)).toBeNull();
    expect(heatIndexCelsius(32, -1)).toBeNull();
  });
});

describe("dewPointComfort", () => {
  it.each<[number, string, string]>([
    [-5, "Muy seco", "caution"],
    [-0.01, "Muy seco", "caution"],
    [0, "Seco", "good"],
    [6.99, "Seco", "good"],
    [7, "Cómodo", "good"],
    [12.99, "Cómodo", "good"],
    [13, "Algo húmedo", "info"],
    [15.99, "Algo húmedo", "info"],
    [16, "Húmedo", "caution"],
    [17.99, "Húmedo", "caution"],
    [18, "Muy húmedo", "warn"],
    [20.99, "Muy húmedo", "warn"],
    [21, "Opresivo", "danger"],
    [23.99, "Opresivo", "danger"],
    [24, "Insoportable", "extreme"],
    [30, "Insoportable", "extreme"],
  ])("con punto de rocío %f devuelve %s (%s)", (dewPoint, label, tone) => {
    expect(dewPointComfort(dewPoint)).toEqual({ label, tone });
  });

  it("devuelve 'Sin dato' con entradas inválidas", () => {
    for (const value of [null, undefined, Number.NaN]) {
      expect(dewPointComfort(value)).toEqual({ label: "Sin dato", tone: "info" });
    }
  });
});

describe("vpdCategory", () => {
  it.each<[number, string, string]>([
    [0, "Bajo", "info"],
    [0.39, "Bajo", "info"],
    [0.4, "Moderado", "good"],
    [0.79, "Moderado", "good"],
    [0.8, "Alto", "caution"],
    [1.59, "Alto", "caution"],
    [1.6, "Muy alto", "warn"],
    [2.4, "Muy alto", "warn"],
    [2.41, "Extremo", "danger"],
    [5, "Extremo", "danger"],
  ])("con VPD %f kPa devuelve %s (%s)", (vpd, label, tone) => {
    const category = vpdCategory(vpd);
    expect(category.label).toBe(label);
    expect(category.tone).toBe(tone);
    expect(category.advice.length).toBeGreaterThan(10);
  });

  it("devuelve 'Sin dato' con entradas inválidas", () => {
    for (const value of [null, undefined, Number.NaN, -0.1]) {
      expect(vpdCategory(value).label).toBe("Sin dato");
      expect(vpdCategory(value).tone).toBe("info");
    }
  });
});

describe("wetBulbCategory", () => {
  it.each<[number, string, string]>([
    [0, "Sin riesgo", "good"],
    [26.99, "Sin riesgo", "good"],
    [27, "Riesgo", "caution"],
    [30.99, "Riesgo", "caution"],
    [31, "Peligro", "danger"],
    [34.99, "Peligro", "danger"],
    [35, "Letal", "extreme"],
    [40, "Letal", "extreme"],
  ])("con bulbo húmedo %f °C devuelve %s (%s)", (wetBulb, label, tone) => {
    const category = wetBulbCategory(wetBulb);
    expect(category.label).toBe(label);
    expect(category.tone).toBe(tone);
  });

  it("explica el límite de supervivencia en el tramo letal", () => {
    expect(wetBulbCategory(35).advice).toMatch(/no puede enfriarse|aire acondicionado/);
  });

  it("devuelve 'Sin dato' con entradas inválidas", () => {
    for (const value of [null, undefined, Number.NaN]) {
      expect(wetBulbCategory(value).label).toBe("Sin dato");
    }
  });
});

describe("thermalStress", () => {
  it.each<[number, string, string]>([
    [-20, "Frío extremo", "extreme"],
    [-10.01, "Frío extremo", "extreme"],
    [-10, "Frío intenso", "danger"],
    [-0.01, "Frío intenso", "danger"],
    [0, "Frío", "warn"],
    [9.99, "Frío", "warn"],
    [10, "Fresco", "info"],
    [17.99, "Fresco", "info"],
    [18, "Confortable", "good"],
    [26.99, "Confortable", "good"],
    [27, "Calor", "caution"],
    [31.99, "Calor", "caution"],
    [32, "Calor fuerte", "warn"],
    [37.99, "Calor fuerte", "warn"],
    [38, "Calor muy fuerte", "danger"],
    [42.99, "Calor muy fuerte", "danger"],
    [43, "Calor extremo", "extreme"],
    [50, "Calor extremo", "extreme"],
  ])("con sensación %f °C devuelve %s (%s)", (apparent, label, tone) => {
    const category = thermalStress(apparent);
    expect(category.label).toBe(label);
    expect(category.tone).toBe(tone);
    expect(category.advice.length).toBeGreaterThan(10);
  });

  it("devuelve 'Sin dato' con entradas inválidas", () => {
    for (const value of [null, undefined, Number.NaN]) {
      expect(thermalStress(value).label).toBe("Sin dato");
      expect(thermalStress(value).tone).toBe("info");
    }
  });
});
