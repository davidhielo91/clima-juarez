import { describe, expect, it } from "vitest";
import {
  MOON_PHASE_NAMES,
  SYNODIC_MONTH_DAYS,
  formatDaylightLong,
  moonPhase,
  sunPosition,
} from "@/lib/derive/sun";

const JUAREZ = { latitude: 31.7384, longitude: -106.4572 };

describe("moonPhase", () => {
  it("da luna llena el 2024-01-25", () => {
    // Luna llena real: 2024-01-25 17:54 UTC.
    const phase = moonPhase(new Date("2024-01-25T17:54:00Z"));
    expect(phase.name).toBe("Luna llena");
    expect(Math.abs(phase.fraction - 0.5)).toBeLessThan(0.05);
    expect(phase.illumination).toBeGreaterThan(0.95);
    expect(phase.illumination).toBeLessThanOrEqual(1);
  });

  it("da luna nueva el 2024-01-11", () => {
    // Luna nueva real: 2024-01-11 11:57 UTC.
    const phase = moonPhase(new Date("2024-01-11T11:57:00Z"));
    expect(phase.name).toBe("Luna nueva");
    expect(phase.fraction).toBeLessThan(0.05);
    expect(phase.illumination).toBeLessThan(0.02);
  });

  it("clava la luna nueva de referencia del 2000-01-06 18:14 UTC", () => {
    const phase = moonPhase(new Date("2000-01-06T18:14:00Z"));
    expect(phase.fraction).toBeCloseTo(0, 6);
    expect(phase.illumination).toBeCloseTo(0, 6);
    expect(phase.name).toBe("Luna nueva");
  });

  it("acierta los cuartos creciente y menguante", () => {
    expect(moonPhase(new Date("2024-01-18T03:52:00Z")).name).toBe("Cuarto creciente");
    expect(moonPhase(new Date("2024-02-02T23:18:00Z")).name).toBe("Cuarto menguante");
  });

  it("recorre los ocho nombres en un ciclo sinóptico", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const day = new Date(Date.UTC(2024, 0, 11, 12, 0, 0) + i * (SYNODIC_MONTH_DAYS / 8) * 86400000);
      seen.add(moonPhase(day).name);
    }
    expect(seen.size).toBe(8);
    expect([...seen].sort()).toEqual([...MOON_PHASE_NAMES].sort());
  });

  it("mantiene fraction en [0,1) e illumination en [0,1]", () => {
    for (let day = 0; day < 60; day += 1) {
      const date = new Date(Date.UTC(2023, 0, 1) + day * 86400000);
      const phase = moonPhase(date);
      expect(phase.fraction).toBeGreaterThanOrEqual(0);
      expect(phase.fraction).toBeLessThan(1);
      expect(phase.illumination).toBeGreaterThanOrEqual(0);
      expect(phase.illumination).toBeLessThanOrEqual(1);
    }
  });

  it("no lanza con una fecha inválida", () => {
    expect(moonPhase(new Date("no es fecha")).name).toBe("Sin dato");
  });
});

describe("sunPosition", () => {
  it("coloca el sol a la altura del solsticio de verano", () => {
    // 19:00 UTC ≈ 13:00 local, casi el mediodía solar de Juárez.
    const { altitude, azimuth } = sunPosition(
      new Date("2024-06-21T19:00:00Z"),
      JUAREZ.latitude,
      JUAREZ.longitude,
    );
    // Altura máxima teórica: 90 − 31.74 + 23.44 = 81.7°.
    expect(altitude).toBeCloseTo(81.5, 0);
    expect(azimuth).toBeGreaterThan(150);
    expect(azimuth).toBeLessThan(190);
  });

  it("coloca el sol a la altura del solsticio de invierno", () => {
    const { altitude, azimuth } = sunPosition(
      new Date("2024-12-21T19:00:00Z"),
      JUAREZ.latitude,
      JUAREZ.longitude,
    );
    // Altura máxima teórica: 90 − 31.74 − 23.44 = 34.8°.
    expect(altitude).toBeCloseTo(34.8, 0);
    expect(azimuth).toBeGreaterThan(150);
    expect(azimuth).toBeLessThan(210);
  });

  it("deja el sol bajo el horizonte en la madrugada y en la noche", () => {
    const sunrise = sunPosition(new Date("2024-06-21T12:00:00Z"), JUAREZ.latitude, JUAREZ.longitude);
    expect(sunrise.altitude).toBeLessThan(0);
    const midnight = sunPosition(new Date("2024-06-21T06:00:00Z"), JUAREZ.latitude, JUAREZ.longitude);
    expect(midnight.altitude).toBeLessThan(-20);
  });

  it("devuelve el azimut en [0,360) y la altitud en [-90,90] todo el día", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const { altitude, azimuth } = sunPosition(
        new Date(Date.UTC(2024, 5, 21, hour)),
        JUAREZ.latitude,
        JUAREZ.longitude,
      );
      expect(azimuth).toBeGreaterThanOrEqual(0);
      expect(azimuth).toBeLessThan(360);
      expect(altitude).toBeGreaterThanOrEqual(-90);
      expect(altitude).toBeLessThanOrEqual(90);
    }
  });

  it("manda el sol al este por la mañana y al oeste por la tarde", () => {
    const morning = sunPosition(new Date("2024-06-21T13:00:00Z"), JUAREZ.latitude, JUAREZ.longitude);
    const afternoon = sunPosition(new Date("2024-06-22T00:00:00Z"), JUAREZ.latitude, JUAREZ.longitude);
    expect(morning.azimuth).toBeLessThan(180);
    expect(afternoon.azimuth).toBeGreaterThan(180);
  });

  it("no lanza con entradas inválidas", () => {
    expect(sunPosition(new Date("no es fecha"), 31.7, -106.4)).toEqual({
      altitude: 0,
      azimuth: 0,
    });
    expect(sunPosition(new Date("2024-06-21T19:00:00Z"), Number.NaN, -106.4)).toEqual({
      altitude: 0,
      azimuth: 0,
    });
    expect(sunPosition(new Date("2024-06-21T19:00:00Z"), 31.7, Number.NaN)).toEqual({
      altitude: 0,
      azimuth: 0,
    });
  });
});

describe("formatDaylightLong", () => {
  it("formatea duraciones en horas y minutos", () => {
    expect(formatDaylightLong(52320)).toBe("14 h 32 min");
    expect(formatDaylightLong(3600)).toBe("1 h 00 min");
    expect(formatDaylightLong(5400)).toBe("1 h 30 min");
    expect(formatDaylightLong(3599)).toBe("1 h 00 min");
    expect(formatDaylightLong(600)).toBe("10 min");
    expect(formatDaylightLong(0)).toBe("0 min");
  });

  it("devuelve '—' sin dato o con valores imposibles", () => {
    expect(formatDaylightLong(null)).toBe("—");
    expect(formatDaylightLong(undefined)).toBe("—");
    expect(formatDaylightLong(Number.NaN)).toBe("—");
    expect(formatDaylightLong(-5)).toBe("—");
  });
});
