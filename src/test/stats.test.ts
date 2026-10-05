import { describe, expect, it } from "vitest";
import {
  countAbove,
  dailyExtremes,
  mean,
  percentile,
  percentileSeries,
  spread,
} from "@/lib/derive/stats";

describe("percentile", () => {
  it("interpola linealmente sobre un conjunto conocido", () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 25)).toBe(1.75);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 75)).toBe(3.25);
    expect(percentile([1, 2, 3, 4], 100)).toBe(4);
    expect(percentile([10, 20, 30], 33.33)).toBeCloseTo(16.666, 2);
  });

  it("no depende del orden de entrada", () => {
    expect(percentile([4, 1, 3, 2], 50)).toBe(2.5);
    expect(percentile([3, 1, 2], 10)).toBe(percentile([1, 2, 3], 10));
  });

  it("con un solo valor devuelve ese valor para cualquier p", () => {
    expect(percentile([7], 0)).toBe(7);
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 100)).toBe(7);
  });

  it("devuelve null con listas vacías", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([null, null, null], 50)).toBeNull();
  });

  it("ignora los null y los NaN", () => {
    expect(percentile([1, null, 3], 50)).toBe(2);
    expect(percentile([null, 10, Number.NaN, 20], 0)).toBe(10);
    expect(percentile([1, null, 2, 3, 4], 50)).toBe(2.5);
  });

  it("recorta p fuera de 0..100 y rechaza p no finito", () => {
    expect(percentile([1, 2, 3, 4], -20)).toBe(1);
    expect(percentile([1, 2, 3, 4], 200)).toBe(4);
    expect(percentile([1, 2, 3, 4], Number.NaN)).toBeNull();
  });
});

describe("percentileSeries", () => {
  it("devuelve un valor por miembro", () => {
    expect(percentileSeries([[1, 2, 3], [4, 5, 6], [10]], 50)).toEqual([2, 5, 10]);
  });

  it("conserva los huecos como null", () => {
    expect(percentileSeries([[1, 2, 3], [null, null], []], 50)).toEqual([2, null, null]);
  });

  it("devuelve un arreglo vacío sin miembros", () => {
    expect(percentileSeries([], 50)).toEqual([]);
  });
});

describe("mean", () => {
  it("promedia los valores finitos", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([1, null, 3])).toBe(2);
    expect(mean([-5, 5])).toBe(0);
  });

  it("devuelve null sin datos", () => {
    expect(mean([])).toBeNull();
    expect(mean([null, null])).toBeNull();
    expect(mean([Number.NaN])).toBeNull();
  });
});

describe("spread", () => {
  it("calcula mínimo, máximo, rango y desviación poblacional", () => {
    const result = spread([1, 2, 3, 4])!;
    expect(result.min).toBe(1);
    expect(result.max).toBe(4);
    expect(result.range).toBe(3);
    expect(result.sd).toBeCloseTo(1.118, 3);
  });

  it("con un solo valor la desviación es cero", () => {
    expect(spread([5])).toEqual({ min: 5, max: 5, range: 0, sd: 0 });
    expect(spread([null, 5, null])).toEqual({ min: 5, max: 5, range: 0, sd: 0 });
  });

  it("devuelve null sin datos", () => {
    expect(spread([])).toBeNull();
    expect(spread([null, Number.NaN])).toBeNull();
  });
});

describe("countAbove", () => {
  it("cuenta los miembros que superan el umbral en esa posición", () => {
    const members = [
      [1, 5],
      [2, 6],
      [null, 7],
      [8, null],
    ];
    expect(countAbove(members, 1, 5.5)).toEqual({
      count: 2,
      total: 3,
      probability: 2 / 3,
    });
    expect(countAbove(members, 0, 0)).toEqual({ count: 3, total: 3, probability: 1 });
  });

  it("el umbral es estricto", () => {
    expect(countAbove([[0]], 0, 0)).toEqual({ count: 0, total: 1, probability: 0 });
    expect(countAbove([[1]], 0, 1)).toEqual({ count: 0, total: 1, probability: 0 });
  });

  it("ignora los miembros sin dato y devuelve null si no queda ninguno", () => {
    const members = [
      [null, 9],
      [null, null],
      [undefined as unknown as number | null, 1],
    ];
    expect(countAbove(members, 0, 0)).toBeNull();
    expect(countAbove(members, 1, 0)).toEqual({ count: 2, total: 2, probability: 1 });
    expect(countAbove([[null], [null]], 0, 0)).toBeNull();
    expect(countAbove([], 0, 0)).toBeNull();
  });

  it("tolera posiciones fuera del arreglo", () => {
    expect(countAbove([[1, 2]], 99, 0)).toBeNull();
  });
});

describe("dailyExtremes", () => {
  it("agrupa por los primeros 10 caracteres de time", () => {
    const time = [
      "2024-01-01T00:00",
      "2024-01-01T01:00",
      "2024-01-02T00:00",
      "2024-01-02T01:00",
      "2024-01-03T00:00",
    ];
    const values = [1, 3, null, 4, null];
    expect(dailyExtremes(time, values)).toEqual([
      { date: "2024-01-01", min: 1, max: 3, mean: 2 },
      { date: "2024-01-02", min: 4, max: 4, mean: 4 },
      { date: "2024-01-03", min: null, max: null, mean: null },
    ]);
  });

  it("mantiene el orden de aparición de los días", () => {
    const result = dailyExtremes(
      ["2024-03-02T00:00", "2024-03-01T00:00"],
      [1, 2],
    );
    expect(result.map((day) => day.date)).toEqual(["2024-03-02", "2024-03-01"]);
  });

  it("ignora los null dentro del día", () => {
    const result = dailyExtremes(
      ["2024-01-01T00:00", "2024-01-01T01:00", "2024-01-01T02:00"],
      [null, 5, null],
    );
    expect(result).toEqual([{ date: "2024-01-01", min: 5, max: 5, mean: 5 }]);
  });

  it("tolera que values sea más corto que time", () => {
    const result = dailyExtremes(["2024-01-01T00:00", "2024-01-02T00:00"], [3]);
    expect(result).toEqual([
      { date: "2024-01-01", min: 3, max: 3, mean: 3 },
      { date: "2024-01-02", min: null, max: null, mean: null },
    ]);
  });

  it("devuelve un arreglo vacío sin horas", () => {
    expect(dailyExtremes([], [])).toEqual([]);
  });
});
