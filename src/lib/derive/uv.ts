/**
 * Categoría del índice UV.
 *
 * Los cortes son los de la escala internacional (OMS/EPA): 0–2, 3–5, 6–7, 8–10
 * y 11 o más. La diferencia local está en los consejos: Ciudad Juárez está a
 * 1 130 m de altitud, donde la atmósfera filtra menos radiación ultravioleta que
 * al nivel del mar, así que la misma categoría quema antes aquí. Los consejos lo
 * dicen explícitamente para que no se lean como genéricos.
 */
import type { Tone } from "./tone";

export interface UvCategory {
  label: string;
  tone: Tone;
  advice: string;
}

const UNKNOWN: UvCategory = {
  label: "Sin dato",
  tone: "info",
  advice: "No hay índice UV disponible en este momento.",
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function uvCategory(index: number | null | undefined): UvCategory {
  if (!isNumber(index) || index < 0) return UNKNOWN;
  if (index < 3) {
    return {
      label: "Bajo",
      tone: "good",
      advice:
        "Sin protección extra. Aun así, a esta altitud conviene sombrero si vas a estar horas al sol.",
    };
  }
  if (index < 6) {
    return {
      label: "Moderado",
      tone: "caution",
      advice:
        "Usa protector solar y gafas de sol. Busca sombra entre las 11 y las 16 h.",
    };
  }
  if (index < 8) {
    return {
      label: "Alto",
      tone: "warn",
      advice:
        "Protector SPF 30+, sombrero y sombra al mediodía. En Juárez, a 1 130 m, la piel se enrojece rápido.",
    };
  }
  if (index < 11) {
    return {
      label: "Muy alto",
      tone: "danger",
      advice:
        "Evita el sol de 10 a 17 h. SPF 50+, manga larga, gafas y sombrero: la altura agrava la radiación.",
    };
  }
  return {
    label: "Extremo",
    tone: "extreme",
    advice:
      "No te expongas sin protección. SPF 50+ reaplicado, ropa que cubra todo y sombra; a esta altitud la piel puede quemarse en minutos.",
  };
}
