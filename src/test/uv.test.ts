import { describe, expect, it } from "vitest";
import { uvCategory } from "@/lib/derive/uv";

describe("uvCategory", () => {
  it.each<[number, string, string]>([
    [0, "Bajo", "good"],
    [1, "Bajo", "good"],
    [2.99, "Bajo", "good"],
    [3, "Moderado", "caution"],
    [5, "Moderado", "caution"],
    [5.99, "Moderado", "caution"],
    [6, "Alto", "warn"],
    [7, "Alto", "warn"],
    [7.99, "Alto", "warn"],
    [8, "Muy alto", "danger"],
    [10, "Muy alto", "danger"],
    [10.99, "Muy alto", "danger"],
    [11, "Extremo", "extreme"],
    [12, "Extremo", "extreme"],
    [16, "Extremo", "extreme"],
  ])("con índice %f devuelve %s (%s)", (index, label, tone) => {
    const category = uvCategory(index);
    expect(category.label).toBe(label);
    expect(category.tone).toBe(tone);
    expect(category.advice.length).toBeGreaterThan(10);
  });

  it("menciona la altitud de la ciudad en los tramos peligrosos", () => {
    // Ciudad Juárez está a 1 130 m: la radiación llega más fuerte que al nivel
    // del mar y los consejos de los tramos altos deben decirlo.
    for (const index of [8, 11]) {
      expect(uvCategory(index).advice).toMatch(/altura|altitud|1 130 m/);
    }
  });

  it("devuelve 'Sin dato' con entradas inválidas", () => {
    for (const value of [null, undefined, Number.NaN, -1]) {
      const category = uvCategory(value);
      expect(category.label).toBe("Sin dato");
      expect(category.tone).toBe("info");
      expect(category.advice.length).toBeGreaterThan(0);
    }
  });
});
