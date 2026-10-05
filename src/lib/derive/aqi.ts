/**
 * Índices de calidad del aire.
 *
 * Se manejan dos escalas porque Open-Meteo entrega las dos y no significan lo
 * mismo: el US AQI (el que usa la EPA y el que reconoce la gente en la frontera)
 * y el EAQI europeo. Mezclarlas sería un error de lectura del dato, así que cada
 * una tiene su función.
 *
 * Criterios fijados aquí:
 *  - Los cortes son los oficiales de cada escala. En la europea, el límite
 *    superior "81–100" y el inferior "100+" se traslapan en 100: se resuelve a
 *    favor del tramo cerrado, es decir 100 exacto es "Muy mala" y solo lo
 *    estrictamente mayor es "Extremadamente mala".
 *  - `dominantPollutant` compara concentraciones crudas, tal como se pidió. Hay
 *    que tener presente que la definición oficial del contaminante dominante usa
 *    los subíndices, no los µg/m³: 40 µg/m³ de PM2.5 y 40 µg/m³ de ozono no
 *    tienen el mismo efecto. Esta función sirve para "qué contaminante trae el
 *    valor más alto en crudo", que es lo que muestra la tabla.
 *  - En caso de empate se conserva la primera clave del objeto, para que el
 *    resultado sea estable entre llamadas.
 *  - `null`, `undefined` y `NaN` se ignoran; si no queda ningún valor, devuelve
 *    `null`.
 */
import type { Tone } from "./tone";

export interface AirQualityCategory {
  label: string;
  tone: Tone;
  advice: string;
}

const UNKNOWN_US: AirQualityCategory = {
  label: "Sin dato",
  tone: "info",
  advice: "No hay índice de calidad del aire disponible.",
};

const UNKNOWN_EU: AirQualityCategory = {
  label: "Sin dato",
  tone: "info",
  advice: "No hay índice de calidad del aire disponible.",
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** US AQI: escala de la EPA, de 0 a 500. */
export function usAqiCategory(aqi: number | null | undefined): AirQualityCategory {
  if (!isNumber(aqi) || aqi < 0) return UNKNOWN_US;
  if (aqi <= 50) {
    return {
      label: "Buena",
      tone: "good",
      advice:
        "Aire limpio. Es un buen momento para ventilar la casa o hacer ejercicio al aire libre.",
    };
  }
  if (aqi <= 100) {
    return {
      label: "Moderada",
      tone: "info",
      advice:
        "Aceptable para casi todos. Si eres muy sensible al polvo, reduce el esfuerzo prolongado al aire libre.",
    };
  }
  if (aqi <= 150) {
    return {
      label: "Dañina para grupos sensibles",
      tone: "caution",
      advice:
        "Niños, adultos mayores, embarazadas y personas con asma o corazón: menos tiempo al aire libre y sin esfuerzo intenso.",
    };
  }
  if (aqi <= 200) {
    return {
      label: "Dañina",
      tone: "warn",
      advice:
        "Todos sentimos efectos. Cierra ventanas, evita ejercicio al aire libre y usa cubrebocas si sales.",
    };
  }
  if (aqi <= 300) {
    return {
      label: "Muy dañina",
      tone: "danger",
      advice:
        "Alerta de salud: quédate dentro, cierra ventanas y enciende purificador o aire acondicionado en recirculación.",
    };
  }
  return {
    label: "Peligrosa",
    tone: "extreme",
    advice:
      "Emergencia sanitaria. No salgas, sella la casa y sigue las indicaciones de Protección Civil.",
  };
}

/** EAQI: escala europea, de 0 a más de 100. */
export function europeanAqiCategory(aqi: number | null | undefined): AirQualityCategory {
  if (!isNumber(aqi) || aqi < 0) return UNKNOWN_EU;
  if (aqi <= 20) {
    return {
      label: "Buena",
      tone: "good",
      advice: "Aire limpio; sin precauciones especiales.",
    };
  }
  if (aqi <= 40) {
    return {
      label: "Aceptable",
      tone: "info",
      advice:
        "Calidad aceptable. Las personas muy sensibles al polvo pueden notar molestias leves.",
    };
  }
  if (aqi <= 60) {
    return {
      label: "Moderada",
      tone: "caution",
      advice:
        "Reduce el esfuerzo físico prolongado al aire libre si tienes asma o alergias.",
    };
  }
  if (aqi <= 80) {
    return {
      label: "Mala",
      tone: "warn",
      advice:
        "Evita el ejercicio al aire libre y mantén cerradas las ventanas del lado del viento.",
    };
  }
  if (aqi <= 100) {
    return {
      label: "Muy mala",
      tone: "danger",
      advice:
        "Quédate dentro en lo posible, cierra ventanas y usa cubrebocas si tienes que salir.",
    };
  }
  return {
    label: "Extremadamente mala",
    tone: "extreme",
    advice:
      "No salgas. Sella la casa, usa purificador y pon atención a los avisos oficiales.",
  };
}

/** Nombre en español de las claves de Open-Meteo para contaminantes. */
const POLLUTANT_LABELS: Record<string, string> = {
  pm2_5: "PM2.5",
  pm10: "PM10",
  ozone: "Ozono",
  nitrogen_dioxide: "Dióxido de nitrógeno",
  sulphur_dioxide: "Dióxido de azufre",
  carbon_monoxide: "Monóxido de carbono",
  ammonia: "Amoniaco",
  dust: "Polvo",
  aerosol_optical_depth: "Espesor óptico de aerosoles",
};

/**
 * Contaminante con el valor más alto del objeto. Ignora nulos y no numéricos.
 * Devuelve `null` si no hay ningún valor utilizable.
 */
export function dominantPollutant(
  values: Record<string, number | null | undefined>,
): { key: string; label: string } | null {
  if (!values || typeof values !== "object") return null;
  let bestKey: string | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const [key, raw] of Object.entries(values)) {
    if (!isNumber(raw)) continue;
    // Estrictamente mayor: en empate gana la primera clave del objeto.
    if (bestKey === null || raw > bestValue) {
      bestKey = key;
      bestValue = raw;
    }
  }
  if (bestKey === null) return null;
  return { key: bestKey, label: POLLUTANT_LABELS[bestKey] ?? bestKey };
}
