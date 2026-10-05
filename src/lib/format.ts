/**
 * Formato de fechas y horas.
 *
 * Detalle importante: Open-Meteo devuelve la hora local de Ciudad Juárez SIN
 * desfase ("2026-10-05T11:30"). Si eso se interpretara con la zona del navegador,
 * alguien en Madrid vería las 13:30 y alguien en Los Ángeles las 04:30.
 *
 * Para que la app muestre siempre la hora de Juárez, la hora de pared se trata
 * como si fuera UTC y todos los formateos usan `timeZone: "UTC"`. El resultado
 * son literalmente los números que devolvió la API.
 */

export const TIMEZONE = "America/Ciudad_Juarez";
export const LOCALE = "es-MX";

const UTC = "UTC";

/** Convierte la hora de pared de Juárez en un `Date` con esos mismos campos. */
export function parseWallClock(value: string): Date {
  if (value.length === 10) return new Date(`${value}T00:00:00Z`);
  if (value.length === 16) return new Date(`${value}:00Z`);
  if (value.endsWith("Z")) return new Date(value);
  return new Date(`${value}Z`);
}

/** Ahora mismo, expresado como hora de pared de Juárez. */
export function nowInJuarez(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return new Date(
    Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour"),
      read("minute"),
      read("second"),
    ),
  );
}

const hourFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: UTC,
});

const weekdayShortFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  timeZone: UTC,
});

const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  timeZone: UTC,
});

const dateLongFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: UTC,
});

const dateWithWeekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: UTC,
});

const dateShortFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: UTC,
});

/** Marca de dato ausente, igual que en `units.ts`. */
const EMPTY = "—";

/**
 * Formatea solo si la fecha es válida.
 *
 * Importante: si falta un dato (por ejemplo `sunrise` en una corrida a medias),
 * `parseWallClock("")` produce una fecha inválida y `Intl.format` lanzaría un
 * `RangeError` que tumbaría el panel completo. Aquí se devuelve una marca.
 */
function formatWith(formatter: Intl.DateTimeFormat, value: string): string {
  if (!value) return EMPTY;
  const date = parseWallClock(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return formatter.format(date);
}

/** "11:30" */
export function formatTime(value: string): string {
  return formatWith(hourFormatter, value);
}

/** "lun" */
export function formatWeekdayShort(value: string): string {
  return formatWith(weekdayShortFormatter, value).replace(".", "");
}

/** "5 oct" */
export function formatDayMonth(value: string): string {
  return formatWith(dayMonthFormatter, value).replace(".", "");
}

/** "lunes, 5 de octubre de 2026" */
export function formatDateLong(value: string): string {
  return formatWith(dateLongFormatter, value);
}

/** "lunes, 5 de octubre" */
export function formatDateWithWeekday(value: string): string {
  return formatWith(dateWithWeekdayFormatter, value);
}

/** "05/10/2026" */
export function formatDateShort(value: string): string {
  return formatWith(dateShortFormatter, value);
}

/** Clave de la hora en curso, en hora de Juárez: "2026-10-05T11:00". */
export function currentHourKey(now: Date = nowInJuarez()): string {
  return `${now.toISOString().slice(0, 13)}:00`;
}

/** Clave del día en curso, en hora de Juárez: "2026-10-05". */
export function currentDayKey(now: Date = nowInJuarez()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Índice de la hora en curso dentro de un arreglo `time` de Open-Meteo.
 * Devuelve 0 si no coincide ninguna, para que la interfaz siempre tenga dónde
 * anclarse aunque el reloj del visitante esté desfasado.
 */
export function indexOfCurrentHour(times: string[], now: Date = nowInJuarez()): number {
  const key = currentHourKey(now);
  const exact = times.indexOf(key);
  if (exact !== -1) return exact;
  const prefix = key.slice(0, 13);
  const byPrefix = times.findIndex((time) => time.startsWith(prefix));
  if (byPrefix !== -1) return byPrefix;
  const future = times.findIndex((time) => time > key);
  return future === -1 ? Math.max(0, times.length - 1) : future;
}

/** Índice del día en curso dentro de un arreglo `time` diario. */
export function indexOfCurrentDay(days: string[], now: Date = nowInJuarez()): number {
  const key = currentDayKey(now);
  const exact = days.indexOf(key);
  if (exact !== -1) return exact;
  const future = days.findIndex((day) => day > key);
  return future === -1 ? Math.max(0, days.length - 1) : future;
}

/** "14 h 32 min" a partir de segundos. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

/**
 * Hora de un instante Unix de verdad (los fotogramas de radar vienen así).
 *
 * Ojo con la diferencia: los datos de Open-Meteo llegan como hora de pared SIN
 * desfase y se formatean con `timeZone: "UTC"`; un instante Unix, en cambio, es un
 * momento absoluto y hay que formatearlo en la zona de Juárez. Por eso este
 * formateador no usa `UTC`.
 */
const instantFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIMEZONE,
});

export function formatTimestamp(seconds: number): string {
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return instantFormatter.format(date);
}

/**
 * "hace 12 min". Se compara contra el reloj real, no contra la hora de pared de
 * Juárez: restar un instante absoluto de una hora de pared daría un desfase igual
 * al huso horario.
 */
export function formatRelativeMinutes(seconds: number, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - seconds * 1000) / 60000);
  if (minutes <= 1) return "ahora mismo";
  return `hace ${minutes} min`;
}
