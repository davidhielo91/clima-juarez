/**
 * Tono semántico compartido por todos los módulos de derivación.
 *
 * Los módulos de `src/lib/derive` no saben de colores ni de CSS: devuelven un
 * tono y la interfaz decide cómo pintarlo. Así el mismo "danger" se ve igual en
 * el índice UV, en la calidad del aire o en un aviso local.
 *
 * Orden de gravedad creciente: good < info < caution < warn < danger < extreme.
 */
export type Tone = "good" | "info" | "caution" | "warn" | "danger" | "extreme";

/**
 * Gravedad numérica del tono, para comparar y ordenar. Se usa, por ejemplo,
 * para quedarse con el escalón más alto de una regla de avisos.
 */
export const TONE_RANK: Record<Tone, number> = {
  good: 0,
  info: 1,
  caution: 2,
  warn: 3,
  danger: 4,
  extreme: 5,
};

/** Tono de menor gravedad primero; útil para ordenar avisos. */
export function compareTone(a: Tone, b: Tone): number {
  return TONE_RANK[a] - TONE_RANK[b];
}
