import { describe, expect, it } from "vitest";
import {
  dominantPollutant,
  europeanAqiCategory,
  usAqiCategory,
} from "@/lib/derive/aqi";

describe("usAqiCategory", () => {
  it.each<[number, string, string]>([
    [0, "Buena", "good"],
    [50, "Buena", "good"],
    [51, "Moderada", "info"],
    [100, "Moderada", "info"],
    [101, "Dañina para grupos sensibles", "caution"],
    [150, "Dañina para grupos sensibles", "caution"],
    [151, "Dañina", "warn"],
    [200, "Dañina", "warn"],
    [201, "Muy dañina", "danger"],
    [300, "Muy dañina", "danger"],
    [301, "Peligrosa", "extreme"],
    [500, "Peligrosa", "extreme"],
  ])("con US AQI %i devuelve %s (%s)", (aqi, label, tone) => {
    expect(usAqiCategory(aqi).label).toBe(label);
    expect(usAqiCategory(aqi).tone).toBe(tone);
    expect(usAqiCategory(aqi).advice.length).toBeGreaterThan(10);
  });

  it("devuelve 'Sin dato' con entradas inválidas", () => {
    for (const value of [null, undefined, Number.NaN, -3]) {
      expect(usAqiCategory(value).label).toBe("Sin dato");
      expect(usAqiCategory(value).tone).toBe("info");
    }
  });
});

describe("europeanAqiCategory", () => {
  it.each<[number, string, string]>([
    [0, "Buena", "good"],
    [20, "Buena", "good"],
    [21, "Aceptable", "info"],
    [40, "Aceptable", "info"],
    [41, "Moderada", "caution"],
    [60, "Moderada", "caution"],
    [61, "Mala", "warn"],
    [80, "Mala", "warn"],
    [81, "Muy mala", "danger"],
    [100, "Muy mala", "danger"],
    [100.1, "Extremadamente mala", "extreme"],
    [200, "Extremadamente mala", "extreme"],
  ])("con EAQI %f devuelve %s (%s)", (aqi, label, tone) => {
    expect(europeanAqiCategory(aqi).label).toBe(label);
    expect(europeanAqiCategory(aqi).tone).toBe(tone);
  });

  it("devuelve 'Sin dato' con entradas inválidas", () => {
    for (const value of [null, undefined, Number.NaN, -1]) {
      expect(europeanAqiCategory(value).label).toBe("Sin dato");
    }
  });
});

describe("dominantPollutant", () => {
  it("elige el contaminante con el valor más alto", () => {
    expect(dominantPollutant({ pm2_5: 12, pm10: 40, ozone: 80 })).toEqual({
      key: "ozone",
      label: "Ozono",
    });
    expect(dominantPollutant({ pm2_5: 90, pm10: 40 })).toEqual({
      key: "pm2_5",
      label: "PM2.5",
    });
  });

  it("nombra en español las claves de Open-Meteo", () => {
    expect(dominantPollutant({ pm10: 1 })?.label).toBe("PM10");
    expect(dominantPollutant({ nitrogen_dioxide: 1 })?.label).toBe("Dióxido de nitrógeno");
    expect(dominantPollutant({ sulphur_dioxide: 1 })?.label).toBe("Dióxido de azufre");
    expect(dominantPollutant({ carbon_monoxide: 1 })?.label).toBe("Monóxido de carbono");
    expect(dominantPollutant({ ammonia: 1 })?.label).toBe("Amoniaco");
    expect(dominantPollutant({ aerosol_optical_depth: 1 })?.label).toBe(
      "Espesor óptico de aerosoles",
    );
  });

  it("ignora null, undefined y NaN", () => {
    expect(
      dominantPollutant({ pm2_5: null, pm10: undefined, ozone: Number.NaN, dust: 5 }),
    ).toEqual({ key: "dust", label: "Polvo" });
  });

  it("devuelve null cuando no hay ningún valor utilizable", () => {
    expect(dominantPollutant({})).toBeNull();
    expect(dominantPollutant({ pm2_5: null, pm10: null })).toBeNull();
    expect(dominantPollutant({ pm2_5: Number.NaN })).toBeNull();
  });

  it("en empate conserva la primera clave", () => {
    expect(dominantPollutant({ pm2_5: 30, pm10: 30 })?.key).toBe("pm2_5");
  });

  it("usa la clave tal cual si no conoce el contaminante", () => {
    expect(dominantPollutant({ something_new: 7 })).toEqual({
      key: "something_new",
      label: "something_new",
    });
  });
});
