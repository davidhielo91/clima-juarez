import { Caveat, Panel } from "@/components/ui/primitives";
import { WindArrow } from "@/components/ui/charts";
import { WeatherGlyph, type GlyphKey } from "@/components/ui/glyphs";
import { describeWeather } from "@/lib/derive/wmo";
import { compassLongLabel, compassPoint } from "@/lib/derive/wind";
import { uvCategory } from "@/lib/derive/uv";
import {
  formatDateWithWeekday,
  formatDayMonth,
  formatDuration,
  formatTime,
  formatWeekdayShort,
  indexOfCurrentDay,
} from "@/lib/format";
import type { ForecastBundle } from "@/lib/types";
import {
  formatIndex,
  formatPercent,
  formatPrecipitation,
  formatRadiation,
  formatSpeed,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * Los próximos 16 días.
 *
 * Cada día lleva una barra de rango térmico situada dentro del margen de la
 * quincena: así se ve de un golpe qué días son los extremos. Al desplegar un día
 * aparecen sus 24 horas, que es lo que hace falta para planear una salida concreta.
 */
export default function DailyPanel({
  forecast,
  units,
}: {
  forecast: ForecastBundle;
  units: UnitSystem;
}) {
  const { daily, hourly } = forecast;
  const currentDay = indexOfCurrentDay(daily.time);

  const day = (key: string, index: number): number | null => {
    const values = daily[key];
    if (!Array.isArray(values)) return null;
    const value = values[index];
    return typeof value === "number" ? value : null;
  };
  const dayText = (key: string, index: number): string | null => {
    const values = daily[key];
    if (!Array.isArray(values)) return null;
    const value = values[index];
    return typeof value === "string" ? value : null;
  };

  const maxima = daily.time.map((_, index) => day("temperature_2m_max", index));
  const minima = daily.time.map((_, index) => day("temperature_2m_min", index));
  const known = [...maxima, ...minima].filter(
    (value): value is number => value !== null,
  );
  const envelopeMin = known.length ? Math.min(...known) : 0;
  const envelopeMax = known.length ? Math.max(...known) : 1;
  const envelopeSpan = envelopeMax - envelopeMin || 1;

  /** Horas del arreglo horario que caen en una fecha concreta. */
  const hoursOfDay = (date: string): number[] => {
    const result: number[] = [];
    hourly.time.forEach((stamp, index) => {
      if (stamp.startsWith(date)) result.push(index);
    });
    return result;
  };

  return (
    <Panel
      id="dieciseis-dias"
      title="Próximos 16 días"
      subtitle="Máximas y mínimas, lluvia, viento y radiación. Despliega un día para ver sus horas."
    >
      <ol className="grid gap-0">
        {daily.time.map((date, index) => {
          const weather = describeWeather(day("weather_code", index));
          const max = maxima[index];
          const min = minima[index];
          const uvMax = day("uv_index_max", index);
          const uvInfo = uvCategory(uvMax);

          const left =
            min === null
              ? 0
              : ((min - envelopeMin) / envelopeSpan) * 100;
          const width =
            min === null || max === null
              ? 0
              : Math.max(2, ((max - min) / envelopeSpan) * 100);

          return (
            <li key={date} className="border-b border-rule/40 last:border-b-0">
              <details className="group">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 py-2.5 pl-1 marker:content-['']">
                  <span className="w-[104px] shrink-0">
                    <span className="block text-[13px] text-ink">
                      {index === currentDay
                        ? "Hoy"
                        : formatWeekdayShort(date)}
                    </span>
                    <span className="numeric block text-[10px] text-ink-dim">
                      {formatDayMonth(date)}
                    </span>
                  </span>

                  <span className="flex w-[132px] shrink-0 items-center gap-2 text-ink-soft">
                    <WeatherGlyph
                      icon={weather.icon as GlyphKey}
                      size={22}
                    />
                    <span className="text-[11px] leading-tight">
                      {weather.label}
                    </span>
                  </span>

                  {/* Rango térmico dentro del margen de la quincena */}
                  <span
                    className="relative hidden h-1.5 min-w-[80px] flex-1 bg-night-800 sm:block"
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-y-0 bg-ember"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </span>

                  <span className="numeric flex shrink-0 items-baseline gap-2 text-[13px]">
                    <span className="text-ink">
                      {formatTemperature(max, units)}
                    </span>
                    <span className="text-ink-dim">
                      {formatTemperature(min, units)}
                    </span>
                    <span className="text-[10px] text-ink-dim">
                      {units.temperature === "f" ? "°F" : "°C"}
                    </span>
                  </span>

                  <span className="numeric w-[86px] shrink-0 text-right text-[11px] text-cold">
                    {formatPrecipitation(day("precipitation_sum", index), units, {
                      withUnit: true,
                    })}
                    <span className="ml-1 text-ink-dim">
                      {formatPercent(day("precipitation_probability_max", index))}
                    </span>
                  </span>

                  <span className="numeric w-[92px] shrink-0 text-[11px] text-ink-soft">
                    <span className="inline-flex items-center gap-1">
                      <WindArrow
                        degrees={day("wind_direction_10m_dominant", index)}
                        size={14}
                      />
                      {formatSpeed(day("wind_gusts_10m_max", index), units)}
                    </span>
                  </span>
                </summary>

                {/* Detalle del día */}
                <div className="mb-3 grid gap-4 bg-night-900/40 px-3 py-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div>
                    {/* Ocho columnas de palabras se aprietan en un teléfono; con este
                        contenedor se desplazan en vez de salirse del panel. */}
                    <div className="scroll-thin overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr>
                          {["Hora", "Cielo", "Temp.", "Sensación", "Lluvia", "Prob.", "Viento", "Rachas"].map(
                            (column) => (
                              <th
                                key={column}
                                className="eyebrow border-b border-rule px-1.5 py-1 text-[10px] font-semibold text-ink-dim"
                              >
                                {column}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {hoursOfDay(date).map((hourIndex) => {
                          const hourCode = hourly["weather_code"]?.[hourIndex];
                          const hourWeather = describeWeather(
                            typeof hourCode === "number" ? hourCode : null,
                          );
                          const value = (key: string): number | null => {
                            const values = hourly[key];
                            if (!Array.isArray(values)) return null;
                            const raw = values[hourIndex];
                            return typeof raw === "number" ? raw : null;
                          };
                          return (
                            <tr
                              key={hourly.time[hourIndex]}
                              className="border-b border-rule/25"
                            >
                              <th
                                scope="row"
                                className="numeric px-1.5 py-1 text-left text-[11px] font-normal text-ink-soft"
                              >
                                {formatTime(hourly.time[hourIndex])}
                              </th>
                              <td className="px-1.5 py-1 text-ink-soft">
                                <WeatherGlyph
                                  icon={hourWeather.icon as GlyphKey}
                                  size={14}
                                  isDay={value("is_day") === 1}
                                />
                              </td>
                              <td className="numeric px-1.5 py-1 text-[11px] text-ink">
                                {formatTemperature(value("temperature_2m"), units)}
                              </td>
                              <td className="numeric px-1.5 py-1 text-[11px] text-ink-soft">
                                {formatTemperature(value("apparent_temperature"), units)}
                              </td>
                              <td className="numeric px-1.5 py-1 text-[11px] text-cold">
                                {formatPrecipitation(value("precipitation"), units)}
                              </td>
                              <td className="numeric px-1.5 py-1 text-[11px] text-ink-soft">
                                {formatIndex(value("precipitation_probability"))}
                              </td>
                              <td className="numeric px-1.5 py-1 text-[11px] text-ink-soft">
                                {formatSpeed(value("wind_speed_10m"), units)}
                              </td>
                              <td className="numeric px-1.5 py-1 text-[11px] text-ink-soft">
                                {formatSpeed(value("wind_gusts_10m"), units)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>

                  <dl className="grid content-start gap-x-6 sm:grid-cols-2 lg:grid-cols-1">
                    <DailyRow
                      label="Sensación máxima"
                      value={formatTemperature(
                        day("apparent_temperature_max", index),
                        units,
                        { withUnit: true },
                      )}
                    />
                    <DailyRow
                      label="Sensación mínima"
                      value={formatTemperature(
                        day("apparent_temperature_min", index),
                        units,
                        { withUnit: true },
                      )}
                    />
                    <DailyRow
                      label="Promedio del día"
                      value={formatTemperature(
                        day("temperature_2m_mean", index),
                        units,
                        { digits: 1, withUnit: true },
                      )}
                    />
                    <DailyRow
                      label="Horas con lluvia"
                      value={`${formatIndex(day("precipitation_hours", index))} h`}
                    />
                    <DailyRow
                      label="Probabilidad mínima"
                      value={formatPercent(
                        day("precipitation_probability_min", index),
                      )}
                    />
                    <DailyRow
                      label="Dirección dominante"
                      value={`${compassPoint(day("wind_direction_10m_dominant", index))} · ${compassLongLabel(day("wind_direction_10m_dominant", index))}`}
                    />
                    <DailyRow
                      label="Viento máximo sostenido"
                      value={formatSpeed(day("wind_speed_10m_max", index), units, {
                        withUnit: true,
                      })}
                    />
                    <DailyRow
                      label="Índice UV máximo"
                      value={`${formatIndex(uvMax, 1)} · ${uvInfo.label}`}
                    />
                    <DailyRow
                      label="Radiación solar del día"
                      value={formatRadiation(day("shortwave_radiation_sum", index))}
                    />
                    <DailyRow
                      label="Evapotranspiración"
                      value={`${formatIndex(day("et0_fao_evapotranspiration", index), 2)} mm`}
                    />
                    <DailyRow
                      label="Amanecer"
                      value={formatTime(dayText("sunrise", index) ?? "")}
                    />
                    <DailyRow
                      label="Atardecer"
                      value={formatTime(dayText("sunset", index) ?? "")}
                    />
                    <DailyRow
                      label="Duración del día"
                      value={formatDuration(day("daylight_duration", index))}
                    />
                    <DailyRow
                      label="Horas de sol efectivas"
                      value={formatDuration(day("sunshine_duration", index))}
                    />
                  </dl>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <Caveat>
        La barra de cada día está situada dentro del margen de toda la quincena: si
        un día se ve pegado a la derecha, es de los calurosos del periodo. Recuerda
        que la lluvia en el desierto es a ráfagas: un 20 % de probabilidad con 0 mm
        acumulados es el caso más común de la temporada de monzón.{" "}
        {formatDateWithWeekday(daily.time[0])} es el primer día del pronóstico
        extendido, donde la incertidumbre ya es alta: para eso está el panel de
        ensamble.
      </Caveat>
    </Panel>
  );
}

function DailyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule/30 py-1">
      <dt className="text-[11px] text-ink-dim">{label}</dt>
      <dd className="numeric text-right text-[11px] text-ink-soft">{value}</dd>
    </div>
  );
}
