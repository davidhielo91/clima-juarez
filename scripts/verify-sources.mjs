#!/usr/bin/env node
/**
 * Verificación de fuentes: golpea los nueve endpoints con las MISMAS URLs que usa
 * la app en producción y comprueba que responden y que traen cada variable
 * esperada.
 *
 * Sirve para detectar a tiempo que Open-Meteo renombró o retiró una variable, en
 * lugar de descubrirlo con la página ya desplegada.
 *
 * Uso:  node scripts/verify-sources.mjs
 * Sale con código 1 si alguna comprobación falla.
 */

import {
  AIR_VARIABLES,
  CLIMATE_CHUNKS,
  CURRENT_VARIABLES,
  DAILY_VARIABLES,
  ENSEMBLE_MEMBER_COUNT,
  HOURLY_VARIABLES,
  MINUTELY_VARIABLES,
  MODELS,
  POINT,
  ZONES,
  ZONE_VARIABLES,
  BASE,
  buildAirQualityUrl,
  buildClimateUrl,
  buildDetailedForecastUrl,
  buildEnsembleUrl,
  buildHistoryUrl,
  buildMinutelyUrl,
  buildModelsUrl,
  buildZonesUrl,
} from "../src/lib/endpoints.mjs";

const failures = [];
const notes = [];

function fail(check, message) {
  failures.push(`${check}: ${message}`);
}

function ok(check, message) {
  console.log(`  ok   ${check}${message ? ` — ${message}` : ""}`);
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function requireKeys(check, block, keys, label) {
  if (!block || typeof block !== "object") {
    fail(check, `no llegó el bloque ${label}`);
    return;
  }
  const missing = keys.filter((key) => !(key in block));
  if (missing.length > 0) {
    fail(check, `${label} sin estas variables: ${missing.join(", ")}`);
  }
}

/** Cada arreglo de variable debe tener la misma longitud que `time`. */
function requireAligned(check, block, label) {
  if (!block || !Array.isArray(block.time)) {
    fail(check, `${label} no trae arreglo time`);
    return;
  }
  const expected = block.time.length;
  const mismatched = Object.keys(block)
    .filter((key) => key !== "time")
    .filter((key) => !Array.isArray(block[key]) || block[key].length !== expected);
  if (mismatched.length > 0) {
    fail(
      check,
      `${label} con longitudes distintas a time (${expected}): ${mismatched.join(", ")}`,
    );
  }
}

function checkPlace(check, body) {
  if (body.timezone !== POINT.timezone) {
    fail(check, `zona horaria ${body.timezone}, se esperaba ${POINT.timezone}`);
  }
  if (typeof body.utc_offset_seconds !== "number") {
    fail(check, "sin utc_offset_seconds");
  }
  if (typeof body.elevation !== "number") {
    fail(check, "sin elevación");
  }
}

async function checkDetailed() {
  const check = "forecast detallado";
  const { status, body } = await getJson(buildDetailedForecastUrl());
  if (status !== 200) return fail(check, `HTTP ${status}`);
  checkPlace(check, body);
  requireKeys(check, body.current, CURRENT_VARIABLES, "current");
  requireKeys(check, body.hourly, HOURLY_VARIABLES, "hourly");
  requireKeys(check, body.daily, DAILY_VARIABLES, "daily");
  requireAligned(check, body.hourly, "hourly");
  requireAligned(check, body.daily, "daily");
  if (!failures.some((item) => item.startsWith(check))) {
    ok(
      check,
      `${body.hourly.time.length} h × ${HOURLY_VARIABLES.length} variables, ${body.daily.time.length} días, celda ${body.latitude}/${body.longitude}`,
    );
    notes.push(
      `coordenada pedida ${POINT.latitude}/${POINT.longitude} → celda del modelo ${body.latitude}/${body.longitude}`,
    );
  }
}

async function checkMinutely() {
  const check = "pronóstico cada 15 min";
  const { status, body } = await getJson(buildMinutelyUrl());
  if (status !== 200) return fail(check, `HTTP ${status}`);
  requireKeys(check, body.minutely_15, MINUTELY_VARIABLES, "minutely_15");
  requireAligned(check, body.minutely_15, "minutely_15");
  if (!failures.some((item) => item.startsWith(check))) {
    ok(check, `${body.minutely_15.time.length} pasos`);
  }
}

async function checkZones() {
  const check = "zonas de la ciudad";
  const { status, body } = await getJson(buildZonesUrl());
  if (status !== 200) return fail(check, `HTTP ${status}`);
  if (!Array.isArray(body)) {
    return fail(check, "se esperaba un arreglo multi-ubicación");
  }
  if (body.length !== ZONES.length) {
    fail(check, `${body.length} zonas devueltas, se esperaban ${ZONES.length}`);
  }
  body.forEach((entry, index) => {
    requireKeys(check, entry.current, ZONE_VARIABLES, `zona ${ZONES[index]?.id ?? index}`);
    if (typeof entry.elevation !== "number") {
      fail(check, `zona ${ZONES[index]?.id ?? index} sin elevación`);
    }
  });
  const elevations = body.map((entry) => entry.elevation);
  if (new Set(elevations).size === 1) {
    notes.push(
      `las ${elevations.length} zonas comparten elevación (${elevations[0]} m): la malla del modelo no distingue el relieve dentro de la ciudad`,
    );
  }
  if (!failures.some((item) => item.startsWith(check))) {
    ok(
      check,
      `${body.length} puntos, elevaciones ${Math.min(...elevations)}–${Math.max(...elevations)} m`,
    );
  }
}

async function checkAirQuality() {
  const check = "calidad del aire";
  const { status, body } = await getJson(buildAirQualityUrl());
  if (status !== 200) return fail(check, `HTTP ${status}`);
  requireKeys(check, body.current, AIR_VARIABLES, "current");
  requireKeys(check, body.hourly, AIR_VARIABLES, "hourly");
  requireAligned(check, body.hourly, "hourly");
  if (Array.isArray(body.hourly?.ammonia) && body.hourly.ammonia.every((v) => v === null)) {
    notes.push("ammonia llega nula en toda la región: la interfaz la oculta");
  }
  if (!failures.some((item) => item.startsWith(check))) {
    ok(
      check,
      `${body.hourly.time.length} h, celda ${body.latitude}/${body.longitude} (~11 km)`,
    );
  }
}

async function checkModels() {
  const check = "seis modelos";
  const { status, body } = await getJson(buildModelsUrl());
  if (status !== 200) return fail(check, `HTTP ${status}`);
  for (const model of MODELS) {
    for (const variable of ["temperature_2m", "precipitation"]) {
      const key = `${variable}_${model.id}`;
      if (!(key in (body.hourly ?? {}))) {
        fail(check, `falta ${key}`);
      }
    }
  }
  requireAligned(check, body.hourly, "hourly");
  if (!failures.some((item) => item.startsWith(check))) {
    ok(check, `${MODELS.length} modelos × ${body.hourly.time.length} h`);
  }
}

async function checkEnsemble() {
  const check = "ensamble";
  const { status, body } = await getJson(buildEnsembleUrl());
  if (status !== 200) return fail(check, `HTTP ${status}`);
  if (!("temperature_2m" in (body.hourly ?? {}))) {
    fail(check, "falta temperature_2m del control");
  }
  for (let index = 1; index <= ENSEMBLE_MEMBER_COUNT; index += 1) {
    const key = `temperature_2m_member${String(index).padStart(2, "0")}`;
    if (!(key in (body.hourly ?? {}))) {
      fail(check, `falta ${key}`);
    }
  }
  requireAligned(check, body.hourly, "hourly");
  if (!failures.some((item) => item.startsWith(check))) {
    ok(check, `${ENSEMBLE_MEMBER_COUNT} miembros × ${body.hourly.time.length} h`);
  }
}

async function checkRadar() {
  const check = "radar";
  const { status, body } = await getJson(BASE.radar);
  if (status !== 200) return fail(check, `HTTP ${status}`);
  if (typeof body.host !== "string") fail(check, "sin host de tiles");
  const frames = body.radar?.past;
  if (!Array.isArray(frames) || frames.length === 0) {
    fail(check, "sin fotogramas de radar en radar.past");
  }
  const infrared = body.satellite?.infrared;
  if (!Array.isArray(infrared) || infrared.length === 0) {
    notes.push("RainViewer no publica fotogramas infrarrojos: el módulo solo usa radar");
  }
  if (!failures.some((item) => item.startsWith(check))) {
    ok(check, `${frames.length} fotogramas, host ${body.host}`);
  }
}

async function checkHistory() {
  const check = "histórico reciente";
  const { status, body } = await getJson(buildHistoryUrl());
  if (status !== 200) return fail(check, `HTTP ${status}`);
  requireKeys(
    check,
    body.daily,
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_gusts_10m_max",
    ],
    "daily",
  );
  requireAligned(check, body.daily, "daily");
  if (!failures.some((item) => item.startsWith(check))) {
    ok(check, `${body.daily.time.length} días`);
  }
}

async function checkClimate() {
  const check = "climatología";
  let days = 0;
  const years = new Set();
  for (const chunk of CLIMATE_CHUNKS) {
    const { status, body } = await getJson(buildClimateUrl(chunk.startDate, chunk.endDate));
    if (status !== 200) {
      fail(check, `HTTP ${status} en ${chunk.startDate}..${chunk.endDate}`);
      continue;
    }
    requireKeys(
      check,
      body.daily,
      [
        "temperature_2m_max",
        "temperature_2m_min",
        "temperature_2m_mean",
        "precipitation_sum",
      ],
      `daily ${chunk.startDate}`,
    );
    requireAligned(check, body.daily, `daily ${chunk.startDate}`);
    days += body.daily?.time?.length ?? 0;
    for (const day of body.daily?.time ?? []) years.add(day.slice(0, 4));
  }
  if (!failures.some((item) => item.startsWith(check))) {
    ok(check, `${days} días, ${years.size} años distintos`);
  }
}

async function main() {
  console.log(`Verificando fuentes para ${POINT.name}, ${POINT.admin}`);
  console.log(`${BASE.forecast}\n`);

  const checks = [
    checkDetailed,
    checkMinutely,
    checkZones,
    checkAirQuality,
    checkModels,
    checkEnsemble,
    checkRadar,
    checkHistory,
    checkClimate,
  ];

  for (const run of checks) {
    try {
      await run();
    } catch (error) {
      fail(run.name, error instanceof Error ? error.message : String(error));
    }
  }

  if (notes.length > 0) {
    console.log("\nNotas:");
    for (const note of notes) console.log(`  · ${note}`);
  }

  if (failures.length > 0) {
    console.error(`\nFallaron ${failures.length} comprobaciones:`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }

  console.log("\nTodas las fuentes responden con las variables esperadas.");
}

await main();
