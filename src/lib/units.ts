/**
 * Conversión y presentación de unidades.
 *
 * Los datos siempre viajan en unidades del sistema internacional (la API
 * devuelve °C, km/h, mm, hPa, m). La conversión ocurre solo al pintar, así que la
 * interfaz puede cambiar de unidades sin volver a consultar nada.
 *
 * Ciudad Juárez está en la frontera y mucha gente usa Fahrenheit: por eso el
 * conmutador es prominente y la preferencia se recuerda.
 */

export type TemperatureUnit = "c" | "f";
export type SpeedUnit = "kmh" | "mph" | "ms";
export type PrecipitationUnit = "mm" | "in";
export type PressureUnit = "hpa" | "inhg";
export type DistanceUnit = "m" | "ft";
export type DepthUnit = "cm" | "in";

/**
 * Nombre de la cookie que recuerda la preferencia de unidades.
 *
 * Vive aquí, y no en `preferences.ts`, porque `preferences.ts` importa
 * `next/headers` (solo servidor) y el conmutador es un componente de cliente.
 */
export const UNITS_COOKIE = "clima-unidades";
export type UnitSystemId = "metric" | "imperial";

export interface UnitSystem {
  temperature: TemperatureUnit;
  speed: SpeedUnit;
  precipitation: PrecipitationUnit;
  pressure: PressureUnit;
  distance: DistanceUnit;
  depth: DepthUnit;
}

export const METRIC: UnitSystem = {
  temperature: "c",
  speed: "kmh",
  precipitation: "mm",
  pressure: "hpa",
  distance: "m",
  depth: "cm",
};

export const IMPERIAL: UnitSystem = {
  temperature: "f",
  speed: "mph",
  precipitation: "in",
  pressure: "inhg",
  distance: "ft",
  depth: "in",
};

export const UNIT_LABELS = {
  temperature: { c: "°C", f: "°F" },
  speed: { kmh: "km/h", mph: "mph", ms: "m/s" },
  precipitation: { mm: "mm", in: "in" },
  pressure: { hpa: "hPa", inhg: "inHg" },
  distance: { m: "m", ft: "ft" },
  depth: { cm: "cm", in: "in" },
} as const;

const EMPTY = "—";

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Número con separadores en es-MX, o "—" si no hay dato. */
export function formatNumber(
  value: number | null | undefined,
  digits = 0,
): string {
  if (!isNumber(value)) return EMPTY;
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Ventana corta y explícita para valores con signo, como las anomalías. */
export function formatSigned(value: number | null | undefined, digits = 1): string {
  if (!isNumber(value)) return EMPTY;
  const formatted = formatNumber(Math.abs(value), digits);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function convertTemperature(celsius: number, unit: TemperatureUnit): number {
  return unit === "f" ? (celsius * 9) / 5 + 32 : celsius;
}

export function formatTemperature(
  celsius: number | null | undefined,
  units: UnitSystem,
  options: { digits?: number; withUnit?: boolean } = {},
): string {
  if (!isNumber(celsius)) return EMPTY;
  const digits = options.digits ?? 0;
  const value = formatNumber(convertTemperature(celsius, units.temperature), digits);
  return options.withUnit ? `${value} ${UNIT_LABELS.temperature[units.temperature]}` : value;
}

export function convertSpeed(kmh: number, unit: SpeedUnit): number {
  if (unit === "mph") return kmh * 0.621371;
  if (unit === "ms") return kmh / 3.6;
  return kmh;
}

export function formatSpeed(
  kmh: number | null | undefined,
  units: UnitSystem,
  options: { digits?: number; withUnit?: boolean } = {},
): string {
  if (!isNumber(kmh)) return EMPTY;
  const digits = options.digits ?? 0;
  const value = formatNumber(convertSpeed(kmh, units.speed), digits);
  return options.withUnit ? `${value} ${UNIT_LABELS.speed[units.speed]}` : value;
}

export function convertPrecipitation(mm: number, unit: PrecipitationUnit): number {
  return unit === "in" ? mm / 25.4 : mm;
}

export function formatPrecipitation(
  mm: number | null | undefined,
  units: UnitSystem,
  options: { digits?: number; withUnit?: boolean } = {},
): string {
  if (!isNumber(mm)) return EMPTY;
  // Con pulgadas hacen falta más decimales para que 0.2 mm no se lea como "0".
  const digits = options.digits ?? (units.precipitation === "in" ? 2 : 1);
  const value = formatNumber(convertPrecipitation(mm, units.precipitation), digits);
  return options.withUnit
    ? `${value} ${UNIT_LABELS.precipitation[units.precipitation]}`
    : value;
}

export function convertPressure(hpa: number, unit: PressureUnit): number {
  return unit === "inhg" ? hpa * 0.0295299830714 : hpa;
}

export function formatPressure(
  hpa: number | null | undefined,
  units: UnitSystem,
  options: { digits?: number; withUnit?: boolean } = {},
): string {
  if (!isNumber(hpa)) return EMPTY;
  const digits = options.digits ?? (units.pressure === "inhg" ? 2 : 1);
  const value = formatNumber(convertPressure(hpa, units.pressure), digits);
  return options.withUnit ? `${value} ${UNIT_LABELS.pressure[units.pressure]}` : value;
}

export function convertDistance(meters: number, unit: DistanceUnit): number {
  return unit === "ft" ? meters * 3.280839895 : meters;
}

export function formatDistance(
  meters: number | null | undefined,
  units: UnitSystem,
  options: { digits?: number; withUnit?: boolean } = {},
): string {
  if (!isNumber(meters)) return EMPTY;
  const converted = convertDistance(meters, units.distance);
  // Con metros y valores grandes no tiene sentido mostrar decimales.
  const digits = options.digits ?? (units.distance === "ft" ? 0 : converted >= 100 ? 0 : 1);
  const value = formatNumber(converted, digits);
  return options.withUnit ? `${value} ${UNIT_LABELS.distance[units.distance]}` : value;
}

export function convertDepth(cm: number, unit: DepthUnit): number {
  return unit === "in" ? cm / 2.54 : cm;
}

export function formatDepth(
  cm: number | null | undefined,
  units: UnitSystem,
  options: { digits?: number; withUnit?: boolean } = {},
): string {
  if (!isNumber(cm)) return EMPTY;
  const digits = options.digits ?? (units.depth === "in" ? 2 : 1);
  const value = formatNumber(convertDepth(cm, units.depth), digits);
  return options.withUnit ? `${value} ${UNIT_LABELS.depth[units.depth]}` : value;
}

export function formatPercent(
  value: number | null | undefined,
  digits = 0,
): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatNumber(value, digits)} %`;
}

export function formatHumidity(value: number | null | undefined): string {
  return formatPercent(value, 0);
}

/** Radiación: siempre W/m². */
export function formatRadiation(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatNumber(value, 0)} W/m²`;
}

/** Concentración de contaminantes: siempre µg/m³. */
export function formatConcentration(value: number | null | undefined, digits = 1): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatNumber(value, digits)} µg/m³`;
}

/** Índices adimensionales (UV, AQI, CAPE lleva unidad propia). */
export function formatIndex(value: number | null | undefined, digits = 0): string {
  return formatNumber(value, digits);
}

export function formatCape(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatNumber(value, 0)} J/kg`;
}

export function formatLiftedIndex(value: number | null | undefined): string {
  return formatNumber(value, 1);
}

export function formatSoilMoisture(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatNumber(value * 100, 0)} % vol`;
}

export function formatVpd(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY;
  return `${formatNumber(value, 2)} kPa`;
}

export function formatSolarDuration(seconds: number | null | undefined): string {
  if (!isNumber(seconds)) return EMPTY;
  return `${formatNumber(seconds / 3600, 1)} h`;
}
