import { describe, expect, it } from "vitest";
import {
  MONTH_LABELS,
  anomalyForDate,
  dayOfYearKey,
  extremeSummary,
  monthlyNormals,
} from "@/lib/derive/climate";
import type { ClimateNormals } from "@/lib/types";

const NORMALS: ClimateNormals = {
  byDayOfYear: {
    "01-05": { tMax: 15, tMin: 2, tMean: 8.5, precipitation: 0.4, years: 30 },
    "01-20": { tMax: 17, tMin: 3, tMean: 10, precipitation: 1.2, years: 28 },
    "07-10": { tMax: 36, tMin: 22, tMean: 29, precipitation: 1.5, years: 30 },
    "07-25": { tMax: 34, tMin: 21, tMean: 27.5, precipitation: 2.6, years: 30 },
  },
  periodStart: "1995-01-01",
  periodEnd: "2024-12-31",
  daysWithData: 4,
};

describe("dayOfYearKey", () => {
  it("devuelve MM-DD", () => {
    expect(dayOfYearKey("2024-01-05")).toBe("01-05");
    expect(dayOfYearKey("2026-10-05T14:00")).toBe("10-05");
    expect(dayOfYearKey("1995-12-31")).toBe("12-31");
  });

  it("devuelve cadena vacía si no es una fecha ISO", () => {
    expect(dayOfYearKey("")).toBe("");
    expect(dayOfYearKey("2024-1-5")).toBe("");
    expect(dayOfYearKey("05/10/2026")).toBe("");
    expect(dayOfYearKey("no es fecha")).toBe("");
  });
});

describe("anomalyForDate", () => {
  it("calcula la anomalía contra la normal de esa fecha", () => {
    expect(anomalyForDate(NORMALS, "2026-01-05", 20, -1)).toEqual({
      tMaxNormal: 15,
      tMinNormal: 2,
      tMaxAnomaly: 5,
      tMinAnomaly: -3,
      years: 30,
    });
  });

  it("devuelve anomalías negativas y positivas según el día", () => {
    const cold = anomalyForDate(NORMALS, "2026-07-10", 30, 18)!;
    expect(cold.tMaxAnomaly).toBe(-6);
    expect(cold.tMinAnomaly).toBe(-4);
    expect(cold.years).toBe(30);
  });

  it("deja en null la anomalía que no se puede calcular", () => {
    expect(anomalyForDate(NORMALS, "2026-01-05", null, 5)).toEqual({
      tMaxNormal: 15,
      tMinNormal: 2,
      tMaxAnomaly: null,
      tMinAnomaly: 3,
      years: 30,
    });
    expect(anomalyForDate(NORMALS, "2026-01-05", Number.NaN, undefined)).toEqual({
      tMaxNormal: 15,
      tMinNormal: 2,
      tMaxAnomaly: null,
      tMinAnomaly: null,
      years: 30,
    });
  });

  it("devuelve null si no hay normales para esa fecha", () => {
    expect(anomalyForDate(NORMALS, "2026-03-15", 25, 10)).toBeNull();
    expect(anomalyForDate(NORMALS, "2026-02-30", 25, 10)).toBeNull();
  });

  it("devuelve null sin normales o con una fecha inválida", () => {
    expect(anomalyForDate(null, "2026-01-05", 20, 5)).toBeNull();
    expect(anomalyForDate(undefined, "2026-01-05", 20, 5)).toBeNull();
    expect(anomalyForDate(NORMALS, "", 20, 5)).toBeNull();
    expect(anomalyForDate(NORMALS, "2026-01-05T14:00", 20, 5)).not.toBeNull();
  });
});

describe("monthlyNormals", () => {
  it("devuelve 12 meses con nombre en español", () => {
    const months = monthlyNormals(NORMALS);
    expect(months).toHaveLength(12);
    expect(months[0].label).toBe("Enero");
    expect(months[11].label).toBe("Diciembre");
    expect(months.map((month) => month.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(MONTH_LABELS).toHaveLength(12);
  });

  it("promedia las fechas de cada mes", () => {
    const months = monthlyNormals(NORMALS);
    const january = months[0];
    expect(january.tMax).toBeCloseTo(16, 6);
    expect(january.tMin).toBeCloseTo(2.5, 6);
    expect(january.tMean).toBeCloseTo(9.25, 6);
    expect(january.precipitation).toBeCloseTo(0.8, 6);

    const july = months[6];
    expect(july.tMax).toBeCloseTo(35, 6);
    expect(july.tMin).toBeCloseTo(21.5, 6);
    expect(july.tMean).toBeCloseTo(28.25, 6);
    expect(july.precipitation).toBeCloseTo(2.05, 6);
  });

  it("deja en null los meses sin datos", () => {
    const february = monthlyNormals(NORMALS)[1];
    expect(february.tMax).toBeNull();
    expect(february.tMin).toBeNull();
    expect(february.tMean).toBeNull();
    expect(february.precipitation).toBeNull();
  });

  it("sin normales devuelve 12 meses vacíos", () => {
    for (const months of [monthlyNormals(null), monthlyNormals(undefined)]) {
      expect(months).toHaveLength(12);
      expect(months.every((month) => month.tMax === null)).toBe(true);
      expect(months[5].label).toBe("Junio");
    }
  });
});

describe("extremeSummary", () => {
  it("resume los extremos de las normales del mismo mes", () => {
    expect(extremeSummary(NORMALS, "2026-01-05")).toEqual({
      warmest: 17,
      coolest: 2,
      wettest: 1.2,
    });
    expect(extremeSummary(NORMALS, "2026-07-10")).toEqual({
      warmest: 36,
      coolest: 21,
      wettest: 2.6,
    });
  });

  it("devuelve todo en null si el mes no tiene datos", () => {
    expect(extremeSummary(NORMALS, "2026-03-01")).toEqual({
      warmest: null,
      coolest: null,
      wettest: null,
    });
  });

  it("devuelve todo en null sin normales o con fecha inválida", () => {
    const empty = { warmest: null, coolest: null, wettest: null };
    expect(extremeSummary(null, "2026-01-05")).toEqual(empty);
    expect(extremeSummary(undefined, "2026-01-05")).toEqual(empty);
    expect(extremeSummary(NORMALS, "")).toEqual(empty);
  });
});
