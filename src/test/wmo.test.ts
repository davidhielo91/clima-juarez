import { describe, expect, it } from "vitest";
import { WMO_CODES, describeWeather } from "@/lib/derive/wmo";
import type { Tone } from "@/lib/derive/tone";

const ICONS = [
  "clear",
  "partly",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "showers",
  "snow",
  "thunder",
  "freezing",
];

/** Los 28 códigos que documenta Open-Meteo, con la etiqueta esperada. */
const EXPECTED: Array<[number, string, string, Tone, boolean]> = [
  [0, "Despejado", "clear", "good", false],
  [1, "Mayormente despejado", "clear", "good", false],
  [2, "Parcialmente nublado", "partly", "info", false],
  [3, "Nublado", "overcast", "info", false],
  [45, "Niebla", "fog", "caution", false],
  [48, "Niebla con escarcha", "fog", "caution", false],
  [51, "Llovizna ligera", "drizzle", "info", true],
  [53, "Llovizna moderada", "drizzle", "info", true],
  [55, "Llovizna densa", "drizzle", "caution", true],
  [56, "Llovizna helada ligera", "freezing", "caution", true],
  [57, "Llovizna helada densa", "freezing", "warn", true],
  [61, "Lluvia ligera", "rain", "info", true],
  [63, "Lluvia moderada", "rain", "caution", true],
  [65, "Lluvia fuerte", "rain", "warn", true],
  [66, "Lluvia helada ligera", "freezing", "warn", true],
  [67, "Lluvia helada fuerte", "freezing", "danger", true],
  [71, "Nieve ligera", "snow", "caution", true],
  [73, "Nieve moderada", "snow", "warn", true],
  [75, "Nieve fuerte", "snow", "danger", true],
  [77, "Granos de nieve", "snow", "caution", true],
  [80, "Chubascos ligeros", "showers", "info", true],
  [81, "Chubascos moderados", "showers", "caution", true],
  [82, "Chubascos violentos", "showers", "warn", true],
  [85, "Chubascos de nieve ligeros", "snow", "caution", true],
  [86, "Chubascos de nieve fuertes", "snow", "warn", true],
  [95, "Tormenta", "thunder", "warn", true],
  [96, "Tormenta con granizo ligero", "thunder", "danger", true],
  [99, "Tormenta con granizo fuerte", "thunder", "extreme", true],
];

describe("describeWeather", () => {
  it("cubre exactamente los 28 códigos WMO de Open-Meteo", () => {
    expect(EXPECTED).toHaveLength(28);
    expect(WMO_CODES).toHaveLength(28);
    expect([...WMO_CODES].sort((a, b) => a - b)).toEqual(
      EXPECTED.map(([code]) => code).sort((a, b) => a - b),
    );
  });

  it.each(EXPECTED)(
    "traduce el código %i como %s",
    (code, label, icon, severity, isPrecipitation) => {
      const info = describeWeather(code);
      expect(info).toEqual({ code, label, icon, severity, isPrecipitation });
    },
  );

  it("usa claves de icono del catálogo acordado", () => {
    for (const code of WMO_CODES) expect(ICONS).toContain(describeWeather(code).icon);
  });

  it("marca como precipitación la lluvia, la nieve y la tormenta, y no la niebla", () => {
    for (const code of [51, 61, 71, 80, 85, 95, 99]) {
      expect(describeWeather(code).isPrecipitation).toBe(true);
    }
    for (const code of [0, 2, 3, 45, 48]) {
      expect(describeWeather(code).isPrecipitation).toBe(false);
    }
  });

  it.each<[string, number | null | undefined]>([
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["código inexistente 4", 4],
    ["código inexistente 100", 100],
  ])("devuelve 'Sin dato' con %s", (_name, code) => {
    expect(describeWeather(code)).toEqual({
      code: null,
      label: "Sin dato",
      icon: "overcast",
      severity: "info",
      isPrecipitation: false,
    });
  });
});
