/**
 * Avisos locales calculados en el navegador.
 *
 * La app no depende de que alguien emita una alerta oficial: recorre la serie
 * horaria del pronóstico y avisa cuando se cruza un umbral. Son avisos
 * informativos, no sustituyen a Protección Civil.
 *
 * Decisiones que no venían especificadas (todas viven en `ALERT_THRESHOLDS`):
 *  - Cada regla produce **como máximo un aviso**, aunque el umbral se cruce en
 *    varias horas sueltas. `startsAt` es la primera hora que cumple y `endsAt` la
 *    última; si la condición sigue en la última hora del periodo, `endsAt` es
 *    `null` porque no se sabe cuándo termina. El rango puede abarcar horas
 *    intermedias que no cumplen por sí solas: se reporta la envolvente.
 *  - El detalle que se muestra es el de la hora más grave de la regla.
 *  - Los tonos de cada escalón se fijaron para que "caution" sea "hay que estar
 *    atento", "warn" "hay que actuar", "danger" "puede causar daño" y "extreme"
 *    "situación excepcional". No hay avisos de tono "good".
 *  - Las horas se devuelven tal cual llegan en `input.time` (ISO local de Juárez
 *    sin desfase, como las entrega Open-Meteo).
 *  - Orden final: de mayor a menor gravedad; a igual gravedad, primero el que
 *    empieza antes y, si tampoco, el `id` para que el orden sea estable.
 */
import { usAqiCategory } from "./aqi";
import { TONE_RANK, type Tone } from "./tone";

export type AlertSeverity = Exclude<Tone, "good">;

export interface AlertInput {
  time: string[];
  temperature: Array<number | null>;
  apparent: Array<number | null>;
  windSpeed: Array<number | null>;
  windGusts: Array<number | null>;
  precipitationProbability: Array<number | null>;
  precipitation: Array<number | null>;
  snowfall: Array<number | null>;
  visibility: Array<number | null>;
  pm10: Array<number | null>;
  usAqi: Array<number | null>;
  uvIndex: Array<number | null>;
  cape: Array<number | null>;
  liftedIndex: Array<number | null>;
  weatherCode: Array<number | null>;
}

export interface LocalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  /** Primera hora en que se cumple la condición, ISO local de Juárez. */
  startsAt: string | null;
  /** Última hora en que se cumple, o null si sigue al final del periodo. */
  endsAt: string | null;
}

/**
 * Umbrales de los avisos. Están juntos y comentados a propósito: son los números
 * que se van a querer ajustar, y escondidos entre la lógica sería fácil que dos
 * reglas se contradijeran.
 */
export const ALERT_THRESHOLDS = {
  /**
   * Calor. Los cortes de temperatura son los de aviso meteorológico para el
   * desierto de Chihuahua: 38 °C ya es calor peligroso para trabajo al sol,
   * 40 °C es el umbral de aviso por calor extremo y 43 °C el de emergencia.
   * La sensación térmica usa los cortes del índice de calor del NWS: 41 °C es
   * "peligro" y 54 °C "peligro extremo".
   */
  heat: {
    temperature: [38, 40, 43],
    apparent: [41, 54],
  },
  /**
   * Frío. 5 °C es el umbral de aviso por helada ligera, 0 °C el de helada
   * (daño a cultivos y tuberías expuestas) y −5 °C el de frío intenso, que en
   * Juárez ocurre casi todos los inviernos.
   */
  cold: {
    temperature: [5, 0, -5],
  },
  /**
   * Viento. 40 km/h sostenido ya levanta polvo en el valle; 60 km/h de racha es
   * el umbral de aviso y 80 km/h el de daño a láminas y anuncios.
   */
  wind: {
    sustained: 40,
    gusts: [60, 80],
  },
  /**
   * Polvo. 150 µg/m³ de PM10 es el límite diario mexicano para protección a la
   * salud y 250 µg/m³ el de contingencia ambiental. Además, visibilidad menor a
   * 5 km con viento de 30 km/h o más es la firma de una tolvanera, aunque el
   * sensor de PM10 todavía no la registre.
   */
  dust: {
    pm10: [150, 250],
    visibility: 5000,
    visibilityWind: 30,
  },
  /** UV: 8 es "muy alto" y 11 "extremo" en la escala internacional. */
  uv: [8, 11],
  /** US AQI: 101, 151 y 201 son los cortes de la EPA. */
  aqi: [101, 151, 201],
  /**
   * Monzón de verano. 1 500 J/kg de CAPE con índice elevado ≤ −3 es convección
   * capaz de granizo y ráfagas; 60 % de probabilidad basta para avisar de lluvia
   * y 5 mm en una hora ya es lluvia que inunda calles en Juárez.
   */
  monsoon: {
    cape: 1500,
    liftedIndex: -3,
    probability: 60,
    precipitation: 5,
  },
  /**
   * Nieve o hielo: cualquier acumulación, o los códigos WMO de nieve y de
   * precipitación helada. La lluvia helada (56, 57, 66, 67) es más grave que la
   * nieve porque forma una capa de hielo en el pavimento.
   */
  snowIce: {
    codes: [56, 57, 66, 67, 71, 73, 75, 77, 85, 86],
    freezingCodes: [56, 57, 66, 67],
    heavySnowCodes: [75, 86],
  },
} as const;

interface Tier {
  at: number;
  severity: AlertSeverity;
}

/** Escalones de calor por temperatura y por sensación térmica. */
const HEAT_TEMPERATURE_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.heat.temperature[0], severity: "warn" },
  { at: ALERT_THRESHOLDS.heat.temperature[1], severity: "danger" },
  { at: ALERT_THRESHOLDS.heat.temperature[2], severity: "extreme" },
];

const HEAT_APPARENT_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.heat.apparent[0], severity: "danger" },
  { at: ALERT_THRESHOLDS.heat.apparent[1], severity: "extreme" },
];

const COLD_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.cold.temperature[0], severity: "caution" },
  { at: ALERT_THRESHOLDS.cold.temperature[1], severity: "warn" },
  { at: ALERT_THRESHOLDS.cold.temperature[2], severity: "danger" },
];

const WIND_SUSTAINED_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.wind.sustained, severity: "warn" },
];

const WIND_GUST_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.wind.gusts[0], severity: "warn" },
  { at: ALERT_THRESHOLDS.wind.gusts[1], severity: "danger" },
];

const SNOW_ICE_CODES: readonly number[] = ALERT_THRESHOLDS.snowIce.codes;
const FREEZING_CODES: readonly number[] = ALERT_THRESHOLDS.snowIce.freezingCodes;
const HEAVY_SNOW_CODES: readonly number[] = ALERT_THRESHOLDS.snowIce.heavySnowCodes;

const DUST_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.dust.pm10[0], severity: "warn" },
  { at: ALERT_THRESHOLDS.dust.pm10[1], severity: "danger" },
];

const UV_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.uv[0], severity: "warn" },
  { at: ALERT_THRESHOLDS.uv[1], severity: "danger" },
];

const AQI_TIERS: readonly Tier[] = [
  { at: ALERT_THRESHOLDS.aqi[0], severity: "caution" },
  { at: ALERT_THRESHOLDS.aqi[1], severity: "warn" },
  { at: ALERT_THRESHOLDS.aqi[2], severity: "danger" },
];

const MONSOON_CAPE_SEVERITY: AlertSeverity = "warn";
const MONSOON_PROBABILITY_SEVERITY: AlertSeverity = "caution";
const MONSOON_PRECIPITATION_SEVERITY: AlertSeverity = "warn";

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Lee una serie con tolerancia: fuera de rango o no numérico → `null`. */
function at(
  series: Array<number | null> | null | undefined,
  index: number,
): number | null {
  if (!Array.isArray(series)) return null;
  const value = series[index];
  return isNumber(value) ? value : null;
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Escalón más grave que cumple el valor. `mode` "min" compara ≥ (más es peor) y
 * "max" compara ≤ (menos es peor); los escalones van de leve a grave.
 */
function tierFor(
  value: number | null,
  tiers: readonly Tier[],
  mode: "min" | "max",
): Tier | null {
  if (value === null) return null;
  let found: Tier | null = null;
  for (const tier of tiers) {
    const hit = mode === "min" ? value >= tier.at : value <= tier.at;
    if (hit) found = tier;
  }
  return found;
}

/** El escalón más grave entre varios. */
function worst(...tiers: Array<Tier | null>): Tier | null {
  let found: Tier | null = null;
  for (const tier of tiers) {
    if (!tier) continue;
    if (!found || TONE_RANK[tier.severity] > TONE_RANK[found.severity]) found = tier;
  }
  return found;
}

interface RuleHit {
  severity: AlertSeverity;
  detail: string;
}

interface Rule {
  id: string;
  title: string;
  evaluate: (input: AlertInput, index: number) => RuleHit | null;
}

const RULES: readonly Rule[] = [
  {
    id: "heat",
    title: "Calor extremo",
    evaluate: (input, index) => {
      const temperature = at(input.temperature, index);
      const apparent = at(input.apparent, index);
      const byTemperature = tierFor(temperature, HEAT_TEMPERATURE_TIERS, "min");
      const byApparent = tierFor(apparent, HEAT_APPARENT_TIERS, "min");
      const top = worst(byTemperature, byApparent);
      if (!top) return null;

      const parts: string[] = [];
      if (temperature !== null) parts.push(`temperatura de ${round(temperature)} °C`);
      if (apparent !== null && byApparent) {
        parts.push(`sensación de ${round(apparent)} °C`);
      }
      return {
        severity: top.severity,
        detail: `${parts.join(" con ")}. Toma agua aunque no tengas sed, evita el sol de 11 a 17 h y no dejes a nadie dentro de un auto.`,
      };
    },
  },
  {
    id: "cold",
    title: "Frío",
    evaluate: (input, index) => {
      const temperature = at(input.temperature, index);
      const tier = tierFor(temperature, COLD_TIERS, "max");
      if (!tier || temperature === null) return null;
      return {
        severity: tier.severity,
        detail: `Temperatura de ${round(temperature)} °C. Abrígate en capas, protege tuberías y plantas, y revisa a menores y adultos mayores.`,
      };
    },
  },
  {
    id: "wind",
    title: "Viento y tolvanera",
    evaluate: (input, index) => {
      const speed = at(input.windSpeed, index);
      const gusts = at(input.windGusts, index);
      const top = worst(
        tierFor(speed, WIND_SUSTAINED_TIERS, "min"),
        tierFor(gusts, WIND_GUST_TIERS, "min"),
      );
      if (!top) return null;

      const parts: string[] = [];
      if (speed !== null) parts.push(`viento sostenido de ${round(speed)} km/h`);
      if (gusts !== null) parts.push(`rachas de ${round(gusts)} km/h`);
      return {
        severity: top.severity,
        detail: `${parts.join(" y ")}. Asegura láminas, lonas y anuncios; en la carretera y los puentes el viento cruzado desestabiliza.`,
      };
    },
  },
  {
    id: "dust",
    title: "Polvo en suspensión",
    evaluate: (input, index) => {
      const pm10 = at(input.pm10, index);
      const visibility = at(input.visibility, index);
      const speed = at(input.windSpeed, index);

      const byPm10 = tierFor(pm10, DUST_TIERS, "min");
      const blowingDust =
        visibility !== null &&
        visibility < ALERT_THRESHOLDS.dust.visibility &&
        speed !== null &&
        speed >= ALERT_THRESHOLDS.dust.visibilityWind;

      if (!byPm10 && !blowingDust) return null;

      const severity: AlertSeverity = byPm10 ? byPm10.severity : "warn";
      const parts: string[] = [];
      if (pm10 !== null) parts.push(`PM10 de ${round(pm10)} µg/m³`);
      if (blowingDust && visibility !== null && speed !== null) {
        parts.push(
          `visibilidad de ${round(visibility / 1000, 1)} km con viento de ${round(speed)} km/h`,
        );
      }
      return {
        severity,
        detail: `${parts.join("; ")}. Cierra ventanas, usa cubrebocas y evita ejercicio al aire libre.`,
      };
    },
  },
  {
    id: "uv",
    title: "Radiación UV",
    evaluate: (input, index) => {
      const uv = at(input.uvIndex, index);
      const tier = tierFor(uv, UV_TIERS, "min");
      if (!tier || uv === null) return null;
      return {
        severity: tier.severity,
        detail: `Índice UV de ${round(uv)}. Protector SPF 50+, sombrero y gafas; a 1 130 m de altitud la piel se quema más rápido.`,
      };
    },
  },
  {
    id: "aqi",
    title: "Mala calidad del aire",
    evaluate: (input, index) => {
      const aqi = at(input.usAqi, index);
      const tier = tierFor(aqi, AQI_TIERS, "min");
      if (!tier || aqi === null) return null;
      const category = usAqiCategory(aqi);
      return {
        severity: tier.severity,
        detail: `US AQI de ${round(aqi)} (${category.label}). ${category.advice}`,
      };
    },
  },
  {
    id: "monsoon",
    title: "Actividad de monzón",
    evaluate: (input, index) => {
      const cape = at(input.cape, index);
      const lifted = at(input.liftedIndex, index);
      const probability = at(input.precipitationProbability, index);
      const precipitation = at(input.precipitation, index);

      const convective =
        cape !== null &&
        cape >= ALERT_THRESHOLDS.monsoon.cape &&
        lifted !== null &&
        lifted <= ALERT_THRESHOLDS.monsoon.liftedIndex;
      const likelyRain =
        probability !== null &&
        probability >= ALERT_THRESHOLDS.monsoon.probability;
      const heavyRain =
        precipitation !== null &&
        precipitation >= ALERT_THRESHOLDS.monsoon.precipitation;

      if (!convective && !likelyRain && !heavyRain) return null;

      // Gana el escalón más grave de los que se cumplan; la lista nunca queda
      // vacía porque justo arriba se descartó ese caso.
      const severities: AlertSeverity[] = [];
      if (convective) severities.push(MONSOON_CAPE_SEVERITY);
      if (likelyRain) severities.push(MONSOON_PROBABILITY_SEVERITY);
      if (heavyRain) severities.push(MONSOON_PRECIPITATION_SEVERITY);
      const severity = severities.reduce((best, current) =>
        TONE_RANK[current] > TONE_RANK[best] ? current : best,
      );

      const parts: string[] = [];
      if (convective && cape !== null && lifted !== null) {
        parts.push(`CAPE de ${round(cape)} J/kg con índice elevado de ${round(lifted)}`);
      }
      if (likelyRain && probability !== null) {
        parts.push(`probabilidad de lluvia de ${round(probability)} %`);
      }
      if (heavyRain && precipitation !== null) {
        parts.push(`${round(precipitation, 1)} mm de lluvia en una hora`);
      }
      return {
        severity,
        detail: `${parts.join(", ")}. En el monzón las tormentas de Juárez crecen rápido: busca refugio bajo techo y no cruces arroyos ni pasos a desnivel.`,
      };
    },
  },
  {
    id: "snow-ice",
    title: "Nieve o hielo",
    evaluate: (input, index) => {
      const snowfall = at(input.snowfall, index);
      const code = at(input.weatherCode, index);
      const hasSnow = snowfall !== null && snowfall > 0;
      const isSnowCode = code !== null && SNOW_ICE_CODES.includes(code);
      if (!hasSnow && !isSnowCode) return null;

      const freezing = code !== null && FREEZING_CODES.includes(code);
      const heavy = code !== null && HEAVY_SNOW_CODES.includes(code);

      const severity: AlertSeverity = freezing || heavy ? "warn" : "caution";
      const parts: string[] = [];
      if (hasSnow && snowfall !== null) {
        parts.push(`acumulación de ${round(snowfall, 1)} cm de nieve`);
      }
      if (freezing) parts.push("precipitación helada que forma hielo en el pavimento");
      else if (heavy) parts.push("nieve intensa");
      else if (isSnowCode && !hasSnow) parts.push("nieve en el pronóstico");

      return {
        severity,
        detail: `${parts.join(" y ")}. Maneja despacio, con distancia y sin frenazos; abrígate y protege a quienes duermen en la calle.`,
      };
    },
  },
];

/**
 * Recorre la serie hora por hora y devuelve un aviso por regla como máximo,
 * ordenados de mayor a menor gravedad. Un arreglo vacío significa "sin avisos".
 */
export function evaluateAlerts(input: AlertInput): LocalAlert[] {
  if (!input || !Array.isArray(input.time) || input.time.length === 0) return [];

  const total = input.time.length;
  const alerts: LocalAlert[] = [];

  for (const rule of RULES) {
    let first: number | null = null;
    let last: number | null = null;
    let best: RuleHit | null = null;

    for (let i = 0; i < total; i += 1) {
      const hit = rule.evaluate(input, i);
      if (!hit) continue;
      if (first === null) first = i;
      last = i;
      if (!best || TONE_RANK[hit.severity] > TONE_RANK[best.severity]) best = hit;
    }

    if (first === null || last === null || !best) continue;

    alerts.push({
      id: rule.id,
      severity: best.severity,
      title: rule.title,
      detail: best.detail,
      startsAt: input.time[first] ?? null,
      // Si la condición sigue en la última hora del periodo no se sabe cuándo
      // termina: se deja abierto en vez de inventar un final.
      endsAt: last === total - 1 ? null : (input.time[last] ?? null),
    });
  }

  alerts.sort((a, b) => {
    const bySeverity = TONE_RANK[b.severity] - TONE_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    const aStart = a.startsAt ?? "";
    const bStart = b.startsAt ?? "";
    if (aStart !== bStart) return aStart < bStart ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return alerts;
}
