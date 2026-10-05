/**
 * Fuente única de verdad de las URLs y las variables de Open-Meteo.
 *
 * Está en JavaScript plano a propósito: la app (TypeScript) y el script de
 * verificación `scripts/verify-sources.mjs` (Node puro) construyen exactamente
 * las mismas URLs. Si Open-Meteo renombra o retira una variable, la verificación
 * falla antes de desplegar en vez de romper la página en producción.
 *
 * Todas las variables de estas listas se comprobaron contra la API real para las
 * coordenadas de Ciudad Juárez: responden HTTP 200 y traen sus unidades.
 *
 * Límites conocidos y comprobados de la fuente:
 *  - Open-Meteo ajusta la coordenada a su celda de modelo (31.7384/-106.4572 se
 *    convierte en 31.7448/-106.4693) y la calidad del aire a una celda de ~11 km
 *    (31.70/-106.50). La interfaz lo advierte.
 *  - `ammonia` y `lightning_potential` llegan `null` en esta región: la interfaz
 *    oculta los nulos en vez de mostrar un número inventado.
 */

/** Punto de referencia: centro de Ciudad Juárez. */
export const POINT = {
  name: "Ciudad Juárez",
  admin: "Chihuahua",
  country: "México",
  latitude: 31.7384,
  longitude: -106.4572,
  timezone: "America/Ciudad_Juarez",
};

/**
 * Zonas de la ciudad. Se piden en una sola petición multi-ubicación, así que
 * añadir una zona no añade una llamada a la API.
 *
 * La ciudad se extiende por un valle con desniveles de más de 100 m entre el
 * norte y el sur, y eso se ve en los datos. Aun así, cada zona es la celda del
 * modelo más cercana, no una medición de esa colonia.
 */
export const ZONES = [
  {
    id: "centro",
    name: "Centro",
    detail: "Zona Centro y Pronaf",
    latitude: 31.7384,
    longitude: -106.4572,
  },
  {
    id: "anapra",
    name: "Noroeste",
    detail: "Anapra y Lomas de Poleo",
    latitude: 31.79,
    longitude: -106.535,
  },
  {
    id: "poniente",
    name: "Poniente",
    detail: "Pie de la Sierra de Juárez",
    latitude: 31.735,
    longitude: -106.56,
  },
  {
    id: "oriente",
    name: "Oriente",
    detail: "Kilómetro 20 y Río Bravo",
    latitude: 31.66,
    longitude: -106.32,
  },
  {
    id: "aeropuerto",
    name: "Sur oriente",
    detail: "Aeropuerto y Parque Industrial",
    latitude: 31.636,
    longitude: -106.429,
  },
  {
    id: "valle",
    name: "Sur",
    detail: "Valle de Juárez",
    latitude: 31.62,
    longitude: -106.4,
  },
];

export const BASE = {
  forecast: "https://api.open-meteo.com/v1/forecast",
  airQuality: "https://air-quality-api.open-meteo.com/v1/air-quality",
  ensemble: "https://ensemble-api.open-meteo.com/v1/ensemble",
  archive: "https://archive-api.open-meteo.com/v1/archive",
  radar: "https://api.rainviewer.com/public/weather-maps.json",
};

/**
 * Geometría del radar, compartida por el servidor y el cliente.
 *
 * Vive aquí, junto al resto de constantes compartidas, por un motivo concreto: el
 * servidor calcula la extensión del cuadro y el cliente pide las teselas, y cuando
 * cada uno tenía su propia copia del zoom el visor pidió el 8 mientras RainViewer
 * solo sirve hasta el 7. El resultado fueron seis carteles de "Zoom Level Not
 * Supported" tapando el mapa en lugar de lluvia.
 *
 * El tope es el 7, comprobado pidiendo la misma tesela a cada nivel: en 8, 9 y 10
 * RainViewer devuelve una imagen de error opaca de 1370 bytes, idéntica en los tres.
 * OpenStreetMap sí sirve el 8, pero manda el radar, que es el que tiene el límite.
 */
export const RADAR = {
  zoom: 7,
  tileSize: 256,
  /** Esquema 4 de RainViewer: precipitación con la escala de colores habitual. */
  colorScheme: 4,
  smooth: 1,
  snow: 0,
  columns: 3,
  rows: 2,
  baseTileUrl: "https://tile.openstreetmap.org",
};

/**
 * Lado de una tesela de radar en metros a una latitud dada.
 *
 * Cuidado con el divisor: es `2 ** zoom`, el número de teselas que caben alrededor
 * del mundo, NO `tileSize * 2 ** zoom`, que da metros por PÍXEL. La confusión es
 * fácil porque a zoom 8 los dos coinciden (256 = 2⁸) y el error queda invisible; al
 * bajar a zoom 7 el panel llegó a anunciar "unos 3 km de ancho" en vez de 800.
 */
export function radarTileEdgeMetres(latitude) {
  const equator = 40075016.686;
  return (equator * Math.cos((latitude * Math.PI) / 180)) / 2 ** RADAR.zoom;
}

/** Coordenada de la tesela (Web Mercator) que contiene un punto. */
export function radarTileFor(latitude, longitude, zoom = RADAR.zoom) {
  const count = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  return {
    zoom,
    x: Math.floor(((longitude + 180) / 360) * count),
    y: Math.floor(
      ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
        count,
    ),
  };
}

/** URL de la tesela de lluvia de RainViewer: `{host}{path}/{size}/{z}/{x}/{y}/...`. */
export function radarTileUrl(host, framePath, tile) {
  const cleanHost = String(host).replace(/\/$/, "");
  return `${cleanHost}${framePath}/${RADAR.tileSize}/${tile.zoom}/${tile.x}/${tile.y}/${RADAR.colorScheme}/${RADAR.smooth}_${RADAR.snow}.png`;
}

/** URL de la tesela de cartografía base de OpenStreetMap. */
export function baseTileUrl(tile) {
  return `${RADAR.baseTileUrl}/${tile.zoom}/${tile.x}/${tile.y}.png`;
}

/**
 * Segundos que Next.js reutiliza cada respuesta. Con estos valores la app gasta
 * unas 900 peticiones al día con tráfico continuo, muy por debajo del límite no
 * comercial de Open-Meteo (~10 000).
 */
export const REVALIDATE = {
  detailed: 900,
  zones: 900,
  minutely: 300,
  airQuality: 1800,
  models: 1800,
  ensemble: 3600,
  history: 3600,
  climate: 86400,
  radar: 300,
};

/** Variables horarias del pronóstico detallado (59, todas verificadas). */
export const HOURLY_VARIABLES = [
  // Temperatura y humedad
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "apparent_temperature",
  "wet_bulb_temperature_2m",
  "vapour_pressure_deficit",
  // Precipitación
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "snow_depth",
  // Estado del cielo
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  // Presión
  "pressure_msl",
  "surface_pressure",
  // Viento en cuatro alturas
  "wind_speed_10m",
  "wind_speed_80m",
  "wind_speed_120m",
  "wind_speed_180m",
  "wind_direction_10m",
  "wind_direction_80m",
  "wind_direction_120m",
  "wind_direction_180m",
  "wind_gusts_10m",
  "temperature_80m",
  "temperature_120m",
  "temperature_180m",
  // Estabilidad y convección (monzón de verano)
  "cape",
  "lifted_index",
  "convective_inhibition",
  "freezing_level_height",
  "boundary_layer_height",
  "total_column_integrated_water_vapour",
  // Radiación y sol
  "uv_index",
  "uv_index_clear_sky",
  "is_day",
  "shortwave_radiation",
  "direct_radiation",
  "direct_normal_irradiance",
  "diffuse_radiation",
  "global_tilted_irradiance",
  "terrestrial_radiation",
  "sunshine_duration",
  // Suelo
  "soil_temperature_0cm",
  "soil_temperature_6cm",
  "soil_temperature_18cm",
  "soil_temperature_54cm",
  "soil_moisture_0_to_1cm",
  "soil_moisture_1_to_3cm",
  "soil_moisture_3_to_9cm",
  "soil_moisture_9_to_27cm",
  "soil_moisture_27_to_81cm",
  "evapotranspiration",
  "et0_fao_evapotranspiration",
];

/** Variables "ahora mismo" (19, todas verificadas). */
export const CURRENT_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "dew_point_2m",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "visibility",
  "cape",
  "uv_index",
];

/** Variables diarias (26, todas verificadas). */
export const DAILY_VARIABLES = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "temperature_2m_mean",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "apparent_temperature_mean",
  "sunrise",
  "sunset",
  "daylight_duration",
  "sunshine_duration",
  "uv_index_max",
  "uv_index_clear_sky_max",
  "precipitation_sum",
  "rain_sum",
  "showers_sum",
  "snowfall_sum",
  "precipitation_hours",
  "precipitation_probability_max",
  "precipitation_probability_min",
  "precipitation_probability_mean",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "shortwave_radiation_sum",
  "et0_fao_evapotranspiration",
];

/** Variables cada 15 minutos (16, todas verificadas). */
export const MINUTELY_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "is_day",
  "visibility",
  "cape",
  "lightning_potential",
];

/** Contaminantes y calidad del aire (13, todos verificados). */
export const AIR_VARIABLES = [
  "pm10",
  "pm2_5",
  "carbon_monoxide",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "aerosol_optical_depth",
  "dust",
  "uv_index",
  "uv_index_clear_sky",
  "us_aqi",
  "european_aqi",
  "ammonia",
];

/** Variables por zona: suficientes para comparar, pocas para ser baratas. */
export const ZONE_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "precipitation",
  "weather_code",
];

/**
 * Los seis modelos globales que se comparan. Se piden en una sola llamada y la
 * respuesta trae una clave por modelo (`temperature_2m_gfs_seamless`, etc.).
 */
export const MODELS = [
  { id: "ecmwf_ifs025", name: "ECMWF IFS", origin: "Centro Europeo" },
  { id: "gfs_seamless", name: "GFS", origin: "NOAA, Estados Unidos" },
  { id: "icon_seamless", name: "ICON", origin: "DWD, Alemania" },
  { id: "gem_global", name: "GEM", origin: "Canadá" },
  { id: "meteofrance_seamless", name: "ARPEGE", origin: "Météo-France" },
  { id: "ukmo_seamless", name: "UM", origin: "Met Office, Reino Unido" },
];

/** Modelo de ensamble: 30 miembros del GFS. */
export const ENSEMBLE_MODEL = "gfs025";
export const ENSEMBLE_MEMBER_COUNT = 30;

/** Ventanas de pronóstico (los máximos que acepta la API). */
export const FORECAST_DAYS = 16;
export const PAST_DAYS = 1;
export const MINUTELY_STEPS = 8; // 2 horas
export const ENSEMBLE_DAYS = 10;
export const AIR_QUALITY_DAYS = 5;
export const HISTORY_PAST_DAYS = 14;

/** Periodo de la climatología de referencia. */
export const CLIMATE_PERIOD_START = 1995;
export const CLIMATE_PERIOD_END = 2024;

function withParams(base, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  return `${base}?${search.toString()}`;
}

export function buildDetailedForecastUrl() {
  return withParams(BASE.forecast, {
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    current: CURRENT_VARIABLES.join(","),
    hourly: HOURLY_VARIABLES.join(","),
    daily: DAILY_VARIABLES.join(","),
    timezone: POINT.timezone,
    past_days: PAST_DAYS,
    forecast_days: FORECAST_DAYS,
  });
}

export function buildMinutelyUrl() {
  return withParams(BASE.forecast, {
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    minutely_15: MINUTELY_VARIABLES.join(","),
    timezone: POINT.timezone,
    forecast_minutely_15: MINUTELY_STEPS,
  });
}

export function buildZonesUrl() {
  return withParams(BASE.forecast, {
    latitude: ZONES.map((zone) => zone.latitude).join(","),
    longitude: ZONES.map((zone) => zone.longitude).join(","),
    current: ZONE_VARIABLES.join(","),
    timezone: POINT.timezone,
    forecast_days: 1,
  });
}

export function buildAirQualityUrl() {
  return withParams(BASE.airQuality, {
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    current: AIR_VARIABLES.join(","),
    hourly: AIR_VARIABLES.join(","),
    timezone: POINT.timezone,
    forecast_days: AIR_QUALITY_DAYS,
  });
}

export function buildModelsUrl() {
  return withParams(BASE.forecast, {
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    hourly: "temperature_2m,precipitation",
    models: MODELS.map((model) => model.id).join(","),
    timezone: POINT.timezone,
    forecast_days: FORECAST_DAYS,
  });
}

export function buildEnsembleUrl() {
  return withParams(BASE.ensemble, {
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    hourly: "temperature_2m,precipitation",
    models: ENSEMBLE_MODEL,
    timezone: POINT.timezone,
    forecast_days: ENSEMBLE_DAYS,
  });
}

/**
 * Histórico reciente. Solo se piden los agregados diarios: el panel de clima
 * muestra máximas, mínimas y lluvia acumulada, así que pedir además las series
 * horarias solo sería descargar cientos de números para tirarlos.
 */
export function buildHistoryUrl() {
  return withParams(BASE.forecast, {
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max",
    timezone: POINT.timezone,
    past_days: HISTORY_PAST_DAYS,
    forecast_days: 1,
  });
}

/**
 * Climatología: se pide por décadas porque un solo rango de 30 años es una
 * respuesta demasiado grande para una sola llamada.
 */
export function buildClimateUrl(startDate, endDate) {
  return withParams(BASE.archive, {
    latitude: POINT.latitude,
    longitude: POINT.longitude,
    start_date: startDate,
    end_date: endDate,
    daily:
      "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum",
    timezone: POINT.timezone,
  });
}

/** Las décadas que se suman para calcular los valores normales. */
export const CLIMATE_CHUNKS = (() => {
  const chunks = [];
  for (
    let start = CLIMATE_PERIOD_START;
    start <= CLIMATE_PERIOD_END;
    start += 10
  ) {
    const end = Math.min(start + 9, CLIMATE_PERIOD_END);
    chunks.push({ startDate: `${start}-01-01`, endDate: `${end}-12-31` });
  }
  return chunks;
})();
