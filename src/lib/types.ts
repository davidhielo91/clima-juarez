/**
 * Tipos de los datos ya normalizados. Ninguna parte de la interfaz lee el JSON
 * crudo de Open-Meteo: los módulos de `src/lib/sources` traducen la respuesta a
 * estas formas.
 */

/**
 * Bloque de Open-Meteo: un arreglo `time` compartido más un arreglo por variable.
 * Los valores pueden ser `null` (la API lo usa cuando un modelo no cubre el dato).
 */
export interface OmBlock {
  time: string[];
  [variable: string]: Array<string | number | null>;
}

export interface Place {
  name: string;
  admin: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  utcOffsetSeconds: number;
}

export interface ForecastBundle {
  place: Place;
  current: Record<string, number | null>;
  currentUnits: Record<string, string>;
  minutely15: OmBlock;
  minutely15Units: Record<string, string>;
  hourly: OmBlock;
  hourlyUnits: Record<string, string>;
  daily: OmBlock;
  dailyUnits: Record<string, string>;
}

export interface AirQualityBundle {
  place: Place;
  current: Record<string, number | null>;
  currentUnits: Record<string, string>;
  hourly: OmBlock;
  hourlyUnits: Record<string, string>;
}

export interface EnsembleBundle {
  place: Place;
  hourly: OmBlock;
  hourlyUnits: Record<string, string>;
  /** Claves de los miembros, por ejemplo `temperature_2m_member01`. */
  temperatureMembers: string[];
  precipitationMembers: string[];
}

export interface ModelSeries {
  id: string;
  name: string;
  origin: string;
  time: string[];
  temperature: Array<number | null>;
  precipitation: Array<number | null>;
}

export interface ModelsBundle {
  place: Place;
  models: ModelSeries[];
}

export interface ZoneReading {
  id: string;
  name: string;
  detail: string;
  /** Coordenada solicitada. */
  latitude: number;
  longitude: number;
  /** Coordenada de la celda del modelo que respondió. */
  modelLatitude: number;
  modelLongitude: number;
  elevation: number;
  temperature: number | null;
  apparentTemperature: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  windDirection: number | null;
  precipitation: number | null;
  weatherCode: number | null;
}

export interface RadarFrame {
  time: number;
  path: string;
}

export interface RadarBundle {
  host: string;
  generated: number;
  frames: RadarFrame[];
}

export interface HistoryBundle {
  place: Place;
  daily: OmBlock;
  dailyUnits: Record<string, string>;
}

export interface ClimateDay {
  tMax: number;
  tMin: number;
  tMean: number;
  precipitation: number;
}

export interface ClimateNormals {
  /** Clave `MM-DD`; promedios de esa fecha en el periodo de referencia. */
  byDayOfYear: Record<
    string,
    { tMax: number; tMin: number; tMean: number; precipitation: number; years: number }
  >;
  periodStart: string;
  periodEnd: string;
  /** Días con dato, para poder auditar la cobertura. */
  daysWithData: number;
}
