import { describe, expect, it } from "vitest";
import {
  currentDayKey,
  currentHourKey,
  formatDateLong,
  formatDayMonth,
  formatDuration,
  formatRelativeMinutes,
  formatTime,
  formatTimestamp,
  formatWeekdayShort,
  indexOfCurrentDay,
  indexOfCurrentHour,
  nowInJuarez,
  parseWallClock,
} from "@/lib/format";

/**
 * Estas pruebas cubren las dos trampas que tiene mostrar la hora de otra ciudad:
 *
 * 1. Los datos de Open-Meteo llegan como hora de pared SIN desfase. Si se
 *    interpretaran con la zona del navegador, el panel mostraría una hora
 *    distinta según dónde esté quien consulta.
 * 2. Un instante Unix (los fotogramas de radar) SÍ es un momento absoluto y hay
 *    que convertirlo a la zona de Juárez. Tratarlo como hora de pared daría la
 *    hora equivocada por el huso completo.
 */

describe("hora de pared de Open-Meteo", () => {
  it("trata la hora sin desfase como si ya fuera la de Juárez", () => {
    // La prueba clave e independiente de la zona del proceso: los campos UTC del
    // Date resultante son exactamente los números que devolvió la API.
    expect(parseWallClock("2026-10-05T11:30").toISOString()).toBe(
      "2026-10-05T11:30:00.000Z",
    );
  });

  it("acepta fechas sin hora", () => {
    expect(parseWallClock("2026-10-05").toISOString()).toBe(
      "2026-10-05T00:00:00.000Z",
    );
  });

  it("formatea la hora sin desplazarla", () => {
    expect(formatTime("2026-10-05T11:30")).toBe("11:30");
    expect(formatTime("2026-10-05T00:05")).toBe("00:05");
    expect(formatTime("2026-10-05T23:59")).toBe("23:59");
  });

  it("nombra el día de la semana de la fecha pedida", () => {
    // 2026-10-05 es lunes.
    expect(formatWeekdayShort("2026-10-05")).toBe("lun");
    expect(formatDayMonth("2026-10-05")).toBe("5 oct");
    expect(formatDateLong("2026-10-05")).toContain("lunes");
    expect(formatDateLong("2026-10-05")).toContain("2026");
  });

  it("no revienta cuando falta el dato", () => {
    // Sin esto, un `sunrise` ausente lanzaría RangeError y tumbaría el panel.
    expect(formatTime("")).toBe("—");
    expect(formatTime("no-es-una-fecha")).toBe("—");
    expect(formatDateLong("")).toBe("—");
    expect(formatWeekdayShort("")).toBe("—");
    expect(formatDayMonth("")).toBe("—");
  });
});

describe("instantes absolutos", () => {
  it("convierte un instante Unix a la hora de Juárez", () => {
    // 18:00 UTC en octubre es 12:00 en Ciudad Juárez (UTC-6).
    const instant = Date.UTC(2026, 9, 5, 18, 0, 0) / 1000;
    expect(formatTimestamp(instant)).toBe("12:00");
  });

  it("mide el tiempo transcurrido contra el reloj real", () => {
    const now = new Date("2026-10-05T18:30:00.000Z");
    const haceDiezMinutos = new Date("2026-10-05T18:20:00.000Z").getTime() / 1000;
    expect(formatRelativeMinutes(haceDiezMinutos, now)).toBe("hace 10 min");

    const ahora = new Date("2026-10-05T18:30:30.000Z").getTime() / 1000;
    expect(formatRelativeMinutes(ahora, now)).toBe("ahora mismo");
  });

  it("devuelve una marca si el instante no es válido", () => {
    expect(formatTimestamp(Number.NaN)).toBe("—");
  });
});

describe("anclaje al momento actual", () => {
  const now = new Date("2026-10-05T11:30:00.000Z");

  it("construye las claves de hora y día", () => {
    expect(currentHourKey(now)).toBe("2026-10-05T11:00");
    expect(currentDayKey(now)).toBe("2026-10-05");
  });

  it("encuentra la hora en curso en el arreglo de la API", () => {
    const times = [
      "2026-10-05T09:00",
      "2026-10-05T10:00",
      "2026-10-05T11:00",
      "2026-10-05T12:00",
    ];
    expect(indexOfCurrentHour(times, now)).toBe(2);
  });

  it("se ancla a la hora siguiente si el reloj va adelantado", () => {
    const times = ["2026-10-05T09:00", "2026-10-05T10:00"];
    expect(indexOfCurrentHour(times, new Date("2026-10-05T13:40:00.000Z"))).toBe(1);
  });

  it("se ancla a la última hora si el reloj va muy atrasado", () => {
    const times = ["2026-10-05T09:00", "2026-10-05T10:00"];
    expect(indexOfCurrentHour(times, new Date("2026-10-04T01:00:00.000Z"))).toBe(0);
  });

  it("encuentra el día en curso", () => {
    expect(
      indexOfCurrentDay(["2026-10-04", "2026-10-05", "2026-10-06"], now),
    ).toBe(1);
  });

  it("nowInJuarez devuelve campos UTC que son la hora de pared local", () => {
    const real = nowInJuarez();
    // Debe ser un Date válido y no puede ir por delante del reloj real.
    expect(Number.isNaN(real.getTime())).toBe(false);
    expect(real.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe("duraciones", () => {
  it("formatea horas y minutos", () => {
    expect(formatDuration(52320)).toBe("14 h 32 min");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(3600)).toBe("1 h 00 min");
  });

  it("devuelve una marca sin dato", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
});
