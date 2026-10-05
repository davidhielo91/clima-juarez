import { describe, expect, it } from "vitest";
import {
  ALERT_THRESHOLDS,
  evaluateAlerts,
  type AlertInput,
} from "@/lib/derive/alerts";

const TIMES = [
  "2026-07-10T00:00",
  "2026-07-10T01:00",
  "2026-07-10T02:00",
  "2026-07-10T03:00",
  "2026-07-10T04:00",
  "2026-07-10T05:00",
];

/** Entrada benigna: cualquier aviso que aparezca viene de lo que se sobrescriba. */
function base(overrides: Partial<AlertInput> = {}): AlertInput {
  const time = overrides.time ?? TIMES;
  const fill = (value: number) => time.map(() => value);
  return {
    time,
    temperature: fill(25),
    apparent: fill(25),
    windSpeed: fill(10),
    windGusts: fill(20),
    precipitationProbability: fill(0),
    precipitation: fill(0),
    snowfall: fill(0),
    visibility: fill(20000),
    pm10: fill(30),
    usAqi: fill(40),
    uvIndex: fill(2),
    cape: fill(100),
    liftedIndex: fill(2),
    weatherCode: fill(0),
    ...overrides,
  };
}

describe("ALERT_THRESHOLDS", () => {
  it("expone los umbrales acordados", () => {
    expect(ALERT_THRESHOLDS.heat.temperature).toEqual([38, 40, 43]);
    expect(ALERT_THRESHOLDS.heat.apparent).toEqual([41, 54]);
    expect(ALERT_THRESHOLDS.cold.temperature).toEqual([5, 0, -5]);
    expect(ALERT_THRESHOLDS.wind.sustained).toBe(40);
    expect(ALERT_THRESHOLDS.wind.gusts).toEqual([60, 80]);
    expect(ALERT_THRESHOLDS.dust.pm10).toEqual([150, 250]);
    expect(ALERT_THRESHOLDS.dust.visibility).toBe(5000);
    expect(ALERT_THRESHOLDS.dust.visibilityWind).toBe(30);
    expect(ALERT_THRESHOLDS.uv).toEqual([8, 11]);
    expect(ALERT_THRESHOLDS.aqi).toEqual([101, 151, 201]);
    expect(ALERT_THRESHOLDS.monsoon).toEqual({
      cape: 1500,
      liftedIndex: -3,
      probability: 60,
      precipitation: 5,
    });
    expect(ALERT_THRESHOLDS.snowIce.codes).toEqual([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
  });
});

describe("evaluateAlerts", () => {
  it("un día tranquilo no produce avisos", () => {
    expect(evaluateAlerts(base())).toEqual([]);
  });

  it("un día caluroso avisa de calor extremo", () => {
    const alerts = evaluateAlerts(
      base({
        temperature: [36, 38, 41, 43, 40, 35],
        apparent: [37, 41, 45, 50, 44, 36],
      }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("heat");
    expect(alerts[0].title).toBe("Calor extremo");
    expect(alerts[0].severity).toBe("extreme");
    expect(alerts[0].startsAt).toBe(TIMES[1]);
    expect(alerts[0].endsAt).toBe(TIMES[4]);
    expect(alerts[0].detail).toContain("43 °C");
    expect(alerts[0].detail).toContain("sensación de 50 °C");
  });

  it("deja endsAt en null si la condición sigue al final del periodo", () => {
    const alerts = evaluateAlerts(
      base({ temperature: [30, 39, 41, 42, 44, 45], apparent: [30, 40, 43, 46, 48, 50] }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].startsAt).toBe(TIMES[1]);
    expect(alerts[0].endsAt).toBeNull();
  });

  it("junta en un solo aviso dos tramos separados de la misma regla", () => {
    const alerts = evaluateAlerts(base({ temperature: [39, 25, 25, 39, 25, 25] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].startsAt).toBe(TIMES[0]);
    expect(alerts[0].endsAt).toBe(TIMES[3]);
  });

  it("un día con tolvanera avisa de viento y de polvo", () => {
    const alerts = evaluateAlerts(
      base({
        windSpeed: [25, 35, 45, 50, 30, 20],
        windGusts: [40, 55, 70, 85, 45, 30],
        pm10: [60, 120, 180, 300, 140, 80],
        visibility: [10000, 8000, 4000, 1500, 5000, 12000],
      }),
    );
    expect(alerts.map((alert) => alert.id)).toEqual(["dust", "wind"]);
    for (const alert of alerts) {
      expect(alert.severity).toBe("danger");
      expect(alert.startsAt).toBe(TIMES[2]);
      expect(alert.endsAt).toBe(TIMES[3]);
    }
    const wind = alerts.find((alert) => alert.id === "wind")!;
    expect(wind.detail).toContain("rachas de 85 km/h");
    const dust = alerts.find((alert) => alert.id === "dust")!;
    expect(dust.detail).toContain("PM10 de 300 µg/m³");
    expect(dust.detail).toContain("visibilidad de 1.5 km");
  });

  it("un día con mala calidad del aire avisa por US AQI", () => {
    const alerts = evaluateAlerts(base({ usAqi: [80, 120, 160, 210, 180, 90] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("aqi");
    expect(alerts[0].severity).toBe("danger");
    expect(alerts[0].startsAt).toBe(TIMES[1]);
    expect(alerts[0].endsAt).toBe(TIMES[4]);
    expect(alerts[0].detail).toContain("US AQI de 210");
    expect(alerts[0].detail).toContain("Muy dañina");
  });

  it("avisa de frío con la temperatura más baja del periodo", () => {
    const alerts = evaluateAlerts(base({ temperature: [8, 4, -1, -6, -2, 3] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("cold");
    expect(alerts[0].severity).toBe("danger");
    expect(alerts[0].startsAt).toBe(TIMES[1]);
    expect(alerts[0].endsAt).toBeNull();
    expect(alerts[0].detail).toContain("-6 °C");
  });

  it("avisa de radiación UV alta", () => {
    const alerts = evaluateAlerts(base({ uvIndex: [5, 9, 12, 12, 9, 5] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("uv");
    expect(alerts[0].severity).toBe("danger");
    expect(alerts[0].startsAt).toBe(TIMES[1]);
    expect(alerts[0].endsAt).toBe(TIMES[4]);
    expect(alerts[0].detail).toContain("Índice UV de 12");
  });

  it("junta la convección, la probabilidad y la lluvia del monzón en un aviso", () => {
    const alerts = evaluateAlerts(
      base({
        cape: [100, 100, 1800, 100, 100, 100],
        liftedIndex: [2, 2, -4, 2, 2, 2],
        precipitationProbability: [0, 0, 0, 70, 0, 0],
        precipitation: [0, 0, 0, 0, 6, 0],
      }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("monsoon");
    expect(alerts[0].severity).toBe("warn");
    expect(alerts[0].startsAt).toBe(TIMES[2]);
    expect(alerts[0].endsAt).toBe(TIMES[4]);
    expect(alerts[0].detail).toContain("CAPE de 1800 J/kg");
  });

  it("con solo probabilidad de lluvia el aviso de monzón es preventivo", () => {
    const alerts = evaluateAlerts(base({ precipitationProbability: [0, 0, 70, 0, 0, 0] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("monsoon");
    expect(alerts[0].severity).toBe("caution");
    expect(alerts[0].startsAt).toBe(TIMES[2]);
    expect(alerts[0].endsAt).toBe(TIMES[2]);
    expect(alerts[0].detail).toContain("probabilidad de lluvia de 70 %");
  });

  it("no avisa de monzón con CAPE alto pero sin inestabilidad suficiente", () => {
    // 1 800 J/kg con índice elevado de +1 no es convección organizada.
    const alerts = evaluateAlerts(base({ cape: [1800, 1800, 1800, 1800, 1800, 1800] }));
    expect(alerts).toEqual([]);
  });

  it("avisa de nieve o hielo según el código WMO", () => {
    const snow = evaluateAlerts(
      base({
        snowfall: [0, 0, 1.5, 0, 0, 0],
        weatherCode: [0, 0, 71, 0, 0, 0],
      }),
    );
    expect(snow).toHaveLength(1);
    expect(snow[0].id).toBe("snow-ice");
    expect(snow[0].severity).toBe("caution");
    expect(snow[0].detail).toContain("1.5 cm de nieve");

    const ice = evaluateAlerts(base({ weatherCode: [0, 0, 66, 0, 0, 0] }));
    expect(ice).toHaveLength(1);
    expect(ice[0].id).toBe("snow-ice");
    expect(ice[0].severity).toBe("warn");
    expect(ice[0].detail).toContain("hielo en el pavimento");

    const heavy = evaluateAlerts(base({ weatherCode: [0, 0, 75, 0, 0, 0] }));
    expect(heavy[0].severity).toBe("warn");
  });

  it("ordena de mayor a menor gravedad", () => {
    const alerts = evaluateAlerts(
      base({
        temperature: [40, 40, 40, 40, 40, 40],
        apparent: [45, 45, 45, 45, 45, 45],
        usAqi: [120, 120, 120, 120, 120, 120],
        uvIndex: [12, 12, 12, 12, 12, 12],
      }),
    );
    expect(alerts.map((alert) => alert.id)).toEqual(["heat", "uv", "aqi"]);
    expect(alerts.map((alert) => alert.severity)).toEqual(["danger", "danger", "caution"]);
  });

  it("no avisa si el dato falta, en vez de inventar un valor", () => {
    const alerts = evaluateAlerts(
      base({
        temperature: [null, null, null, null, null, null],
        apparent: [null, null, null, null, null, null],
        windSpeed: [null, null, null, null, null, null],
        windGusts: [null, null, null, null, null, null],
        pm10: [null, null, null, null, null, null],
        usAqi: [null, null, null, null, null, null],
        uvIndex: [null, null, null, null, null, null],
        cape: [null, null, null, null, null, null],
        liftedIndex: [null, null, null, null, null, null],
        weatherCode: [null, null, null, null, null, null],
      }),
    );
    expect(alerts).toEqual([]);
  });

  it("tolera series más cortas que time", () => {
    const alerts = evaluateAlerts(
      base({ temperature: [40, 41], apparent: [45, 46], windSpeed: [] }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("heat");
    expect(alerts[0].startsAt).toBe(TIMES[0]);
    expect(alerts[0].endsAt).toBe(TIMES[1]);
  });

  it("devuelve un arreglo vacío sin horas o sin entrada", () => {
    expect(evaluateAlerts(base({ time: [] }))).toEqual([]);
    // Tolerancia en tiempo de ejecución: una entrada incompleta no debe lanzar.
    expect(evaluateAlerts({} as AlertInput)).toEqual([]);
  });
});
