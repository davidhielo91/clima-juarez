/**
 * Confort térmico: bochorno, punto de rocío, déficit de presión de vapor,
 * bulbo húmedo y estrés térmico.
 *
 * Criterios no especificados que se fijan aquí:
 *  - `heatIndexCelsius` implementa la ecuación de Rothfusz tal como la publica
 *    el NWS, con sus dos correcciones (aire muy seco y aire muy húmedo). Se
 *    calcula en °F porque los coeficientes están ajustados a esa escala y se
 *    devuelve en °C. Solo aplica con temperatura ≥ 27 °C: por debajo de ese
 *    umbral la ecuación no está validada y devuelve `null`.
 *  - El punto de rocío se clasifica en ocho tramos de confort, del aire muy seco
 *    al insoportable. En Juárez, que es desierto a 1 130 m, lo normal es el tramo
 *    "Seco"; los tramos húmedos aparecen sobre todo en el monzón de verano.
 *  - `vpdCategory` usa los umbrales de estrés de la planta: por debajo de
 *    0.4 kPa la transpiración se frena, entre 0.4 y 0.8 kPa está el óptimo y por
 *    encima de 2.4 kPa el cultivo cierra estomas y se estresa.
 *  - `wetBulbCategory` usa los umbrales de seguridad del bulbo húmedo: 27 °C ya
 *    es riesgo para quien trabaja al sol, 31 °C es peligro y 35 °C es el límite
 *    teórico de supervivencia humana (letal incluso en reposo y a la sombra).
 *  - `thermalStress` reparte la sensación térmica en nueve tramos, de frío
 *    extremo a calor extremo, para que la interfaz tenga una etiqueta y un
 *    consejo en cualquier época del año.
 */
import type { Tone } from "./tone";

export interface Category {
  label: string;
  tone: Tone;
  advice: string;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Índice de calor (sensación por humedad) con la ecuación de Rothfusz.
 *
 * Devuelve `null` si falta algún dato, si la humedad está fuera de 0–100 % o si
 * la temperatura es menor de 27 °C, donde la ecuación no aplica.
 *
 * Aviso: la propia ecuación pierde sentido por encima de ~57 °C (137 °F), su
 * techo de fiabilidad. Combinaciones extremas como 35 °C con 90 % de humedad
 * devuelven valores mayores que ese techo porque el ajuste es polinómico y se
 * dispara; se devuelven tal cual, sin recortar, para no inventar un límite que
 * el NWS no publica. La interfaz debería mostrarlos como "muy por encima del
 * umbral" más que como un número exacto.
 */
export function heatIndexCelsius(
  temperatureC: number | null | undefined,
  relativeHumidity: number | null | undefined,
): number | null {
  if (!isNumber(temperatureC) || !isNumber(relativeHumidity)) return null;
  if (relativeHumidity < 0 || relativeHumidity > 100) return null;
  if (temperatureC < 27) return null;

  const t = (temperatureC * 9) / 5 + 32;
  const r = relativeHumidity;

  let hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * r -
    0.22475541 * t * r -
    0.00683783 * t * t -
    0.05481717 * r * r +
    0.00122874 * t * t * r +
    0.00085282 * t * r * r -
    0.00000199 * t * t * r * r;

  // Aire muy seco (menos de 13 %): la ecuación sobreestima el bochorno.
  if (r < 13 && t >= 80 && t <= 112) {
    hi -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  }
  // Aire muy húmedo (más de 85 %) con calor moderado: lo subestima.
  if (r > 85 && t >= 80 && t <= 87) {
    hi += ((r - 85) / 10) * ((87 - t) / 5);
  }

  return ((hi - 32) * 5) / 9;
}

const UNKNOWN_DEW_POINT: { label: string; tone: Tone } = {
  label: "Sin dato",
  tone: "info",
};

/** Confort según el punto de rocío, que es lo que de verdad se siente. */
export function dewPointComfort(
  dewPointC: number | null | undefined,
): { label: string; tone: Tone } {
  if (!isNumber(dewPointC)) return UNKNOWN_DEW_POINT;
  if (dewPointC < 0) return { label: "Muy seco", tone: "caution" };
  if (dewPointC < 7) return { label: "Seco", tone: "good" };
  if (dewPointC < 13) return { label: "Cómodo", tone: "good" };
  if (dewPointC < 16) return { label: "Algo húmedo", tone: "info" };
  if (dewPointC < 18) return { label: "Húmedo", tone: "caution" };
  if (dewPointC < 21) return { label: "Muy húmedo", tone: "warn" };
  if (dewPointC < 24) return { label: "Opresivo", tone: "danger" };
  return { label: "Insoportable", tone: "extreme" };
}

const UNKNOWN_VPD: Category = {
  label: "Sin dato",
  tone: "info",
  advice: "No hay déficit de presión de vapor disponible.",
};

/** Estrés de la planta según el déficit de presión de vapor (kPa). */
export function vpdCategory(vpdKpa: number | null | undefined): Category {
  if (!isNumber(vpdKpa) || vpdKpa < 0) return UNKNOWN_VPD;
  if (vpdKpa < 0.4) {
    return {
      label: "Bajo",
      tone: "info",
      advice:
        "Aire húmedo: la planta transpira poco y el follaje tarda en secarse. Vigila hongos.",
    };
  }
  if (vpdKpa < 0.8) {
    return {
      label: "Moderado",
      tone: "good",
      advice: "Rango óptimo para el cultivo: la planta transpira y crece sin estrés.",
    };
  }
  if (vpdKpa < 1.6) {
    return {
      label: "Alto",
      tone: "caution",
      advice:
        "Demanda evaporativa alta: riega más seguido y evita trasplantar en las horas de más sol.",
    };
  }
  if (vpdKpa <= 2.4) {
    return {
      label: "Muy alto",
      tone: "warn",
      advice:
        "Estrés hídrico: la planta cierra estomas y frena el crecimiento. Riego temprano y acolchado.",
    };
  }
  return {
    label: "Extremo",
    tone: "danger",
    advice:
      "Sequía atmosférica: riesgo de quemadura en hojas y pérdida de floración. Riego de emergencia y malla sombra.",
  };
}

const UNKNOWN_WET_BULB: Category = {
  label: "Sin dato",
  tone: "info",
  advice: "No hay temperatura de bulbo húmedo disponible.",
};

/** Riesgo por calor húmedo según la temperatura de bulbo húmedo (°C). */
export function wetBulbCategory(wetBulbC: number | null | undefined): Category {
  if (!isNumber(wetBulbC)) return UNKNOWN_WET_BULB;
  if (wetBulbC < 27) {
    return {
      label: "Sin riesgo",
      tone: "good",
      advice:
        "El sudor todavía enfría el cuerpo con eficacia. Hidrátate si trabajas al sol.",
    };
  }
  if (wetBulbC < 31) {
    return {
      label: "Riesgo",
      tone: "caution",
      advice:
        "Con esta humedad el sudor rinde menos: sombra, pausas frecuentes y agua cada 20 minutos.",
    };
  }
  if (wetBulbC < 35) {
    return {
      label: "Peligro",
      tone: "danger",
      advice:
        "Golpe de calor probable en esfuerzo prolongado. Suspende trabajo al aire libre y busca aire acondicionado.",
    };
  }
  return {
    label: "Letal",
    tone: "extreme",
    advice:
      "Por encima de 35 °C de bulbo húmedo el cuerpo no puede enfriarse ni en reposo: refugio con aire acondicionado obligatorio.",
  };
}

const UNKNOWN_STRESS: Category = {
  label: "Sin dato",
  tone: "info",
  advice: "No hay sensación térmica disponible.",
};

/** Estrés térmico según la sensación térmica (°C). */
export function thermalStress(apparentC: number | null | undefined): Category {
  if (!isNumber(apparentC)) return UNKNOWN_STRESS;
  if (apparentC < -10) {
    return {
      label: "Frío extremo",
      tone: "extreme",
      advice:
        "Riesgo de hipotermia en minutos. Sal solo lo indispensable y cubre manos, orejas y cara.",
    };
  }
  if (apparentC < 0) {
    return {
      label: "Frío intenso",
      tone: "danger",
      advice:
        "Abrígate en capas, cubre extremidades y limita el tiempo al aire libre; cuida a menores y adultos mayores.",
    };
  }
  if (apparentC < 10) {
    return {
      label: "Frío",
      tone: "warn",
      advice: "Chamarra y gorra; el viento de la tarde hace que se sienta más frío.",
    };
  }
  if (apparentC < 18) {
    return {
      label: "Fresco",
      tone: "info",
      advice: "Clima fresco: una capa ligera basta, sobre todo al amanecer.",
    };
  }
  if (apparentC < 27) {
    return {
      label: "Confortable",
      tone: "good",
      advice: "Sin molestias por temperatura: buen momento para estar afuera.",
    };
  }
  if (apparentC < 32) {
    return {
      label: "Calor",
      tone: "caution",
      advice: "Hidrátate y busca sombra en las horas centrales; evita esfuerzo al mediodía.",
    };
  }
  if (apparentC < 38) {
    return {
      label: "Calor fuerte",
      tone: "warn",
      advice:
        "Reduce la actividad física de 11 a 17 h, toma agua con frecuencia y usa ropa clara.",
    };
  }
  if (apparentC < 43) {
    return {
      label: "Calor muy fuerte",
      tone: "danger",
      advice:
        "Riesgo de agotamiento por calor: quédate en interiores con ventilación y revisa a quien viva solo.",
    };
  }
  return {
    label: "Calor extremo",
    tone: "extreme",
    advice:
      "Peligro de golpe de calor. No hagas esfuerzo al aire libre, refúgiate con aire acondicionado e hidrátate aunque no tengas sed.",
  };
}
