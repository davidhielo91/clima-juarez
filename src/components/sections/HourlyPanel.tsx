import { Caveat, Panel } from "@/components/ui/primitives";
import { AmountBars, ChartFrame, ProbabilityBars, Trace } from "@/components/ui/charts";
import { WeatherGlyph, type GlyphKey } from "@/components/ui/glyphs";
import { describeWeather } from "@/lib/derive/wmo";
import { compassPoint } from "@/lib/derive/wind";
import {
  formatDayMonth,
  formatTime,
  formatWeekdayShort,
  indexOfCurrentHour,
} from "@/lib/format";
import type { ForecastBundle } from "@/lib/types";
import {
  formatDistance,
  formatHumidity,
  formatIndex,
  formatPrecipitation,
  formatPressure,
  formatSpeed,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * Las próximas 168 horas (siete días).
 *
 * Primero el trazo, porque la forma de la semana —las noches frías, el pico de la
 * tarde, el escalón de un frente— se entiende de un vistazo. Debajo, la tabla hora
 * por hora para quien necesita el dato exacto.
 *
 * La tabla cubre 96 horas para no enviar al navegador casi tres mil celdas; el
 * trazo sí abarca las 168. Se dice en la propia interfaz.
 */

const WINDOW_HOURS = 168;
const TABLE_HOURS = 96;

const TABLE_COLUMNS = [
  "Temperatura",
  "Sensación",
  "Punto de rocío",
  "Humedad",
  "Prob. lluvia",
  "Lluvia",
  "Viento",
  "Rachas",
  "Dirección",
  "Nubes",
  "UV",
  "Visibilidad",
  "Energía convectiva",
  "Presión en la estación",
  "Bulbo húmedo",
  "Nivel de congelación",
] as const;

export default function HourlyPanel({
  forecast,
  units,
}: {
  forecast: ForecastBundle;
  units: UnitSystem;
}) {
  const { hourly } = forecast;
  const start = indexOfCurrentHour(hourly.time);
  const times = hourly.time.slice(start, start + WINDOW_HOURS);

  const take = (key: string, offset = 0, count = WINDOW_HOURS): Array<number | null> => {
    const values = hourly[key];
    if (!Array.isArray(values)) return times.map(() => null);
    return values
      .slice(start + offset, start + offset + count)
      .map((value) => (typeof value === "number" ? value : null));
  };

  const temperature = take("temperature_2m");
  const apparent = take("apparent_temperature");
  const dewPoint = take("dew_point_2m");
  const humidity = take("relative_humidity_2m");
  const probability = take("precipitation_probability");
  const precipitation = take("precipitation");
  const windSpeed = take("wind_speed_10m");
  const windGusts = take("wind_gusts_10m");
  const windDirection = take("wind_direction_10m");
  const cloudCover = take("cloud_cover");
  const uvIndex = take("uv_index");
  const visibility = take("visibility");
  const cape = take("cape");
  const surfacePressure = take("surface_pressure");
  const wetBulb = take("wet_bulb_temperature_2m");
  const freezingLevel = take("freezing_level_height");
  const weatherCodes = hourly["weather_code"]?.slice(start, start + WINDOW_HOURS) ?? [];
  const isDay = hourly["is_day"]?.slice(start, start + WINDOW_HOURS) ?? [];

  const temperatures = temperature.filter((value): value is number => value !== null);
  const minTemperature = temperatures.length ? Math.min(...temperatures) : null;
  const maxTemperature = temperatures.length ? Math.max(...temperatures) : null;

  // Franjas de día: cada una ocupa el ancho proporcional a sus horas.
  const segments: Array<{ date: string; count: number }> = [];
  for (const stamp of times) {
    const date = stamp.slice(0, 10);
    const last = segments[segments.length - 1];
    if (last && last.date === date) last.count += 1;
    else segments.push({ date, count: 1 });
  }

  const rows = times.slice(0, TABLE_HOURS).map((stamp, index) => ({
    stamp,
    weather: describeWeather(
      typeof weatherCodes[index] === "number" ? (weatherCodes[index] as number) : null,
    ),
    day: (isDay[index] ?? 1) === 1,
    values: [
      formatTemperature(temperature[index], units, { withUnit: true }),
      formatTemperature(apparent[index], units, { withUnit: true }),
      formatTemperature(dewPoint[index], units, { withUnit: true }),
      formatHumidity(humidity[index]),
      formatIndex(probability[index]),
      formatPrecipitation(precipitation[index], units),
      formatSpeed(windSpeed[index], units),
      formatSpeed(windGusts[index], units),
      compassPoint(windDirection[index]),
      formatIndex(cloudCover[index]),
      formatIndex(uvIndex[index]),
      formatDistance(visibility[index], units),
      formatIndex(cape[index]),
      formatPressure(surfacePressure[index], units),
      formatTemperature(wetBulb[index], units, { digits: 1 }),
      formatDistance(freezingLevel[index], units),
    ],
  }));

  return (
    <Panel
      id="ciento-sesenta-y-ocho-horas"
      title="Próximas 168 horas"
      subtitle={`Hora por hora desde ${formatTime(times[0] ?? hourly.time[start])}`}
    >
      <div className="flex border-b border-rule/60">
        {segments.map((segment) => (
          <div
            key={segment.date}
            style={{ flexGrow: segment.count }}
            className="border-l border-rule/40 py-1 pl-1.5 text-[10px] text-ink-dim first:border-l-0"
          >
            <span className="text-ink-soft">
              {formatWeekdayShort(segment.date)}
            </span>{" "}
            {formatDayMonth(segment.date)}
          </div>
        ))}
      </div>

      <ChartFrame
        caption="Temperatura del aire. La línea vertical marca la hora en curso."
        scaleLeft={formatTemperature(maxTemperature, units, { withUnit: true })}
        scaleRight={formatTemperature(minTemperature, units, { withUnit: true })}
      >
        <Trace
          values={temperature}
          markerIndex={0}
          height={140}
          showZeroLine
          ariaLabel={`Temperatura de las próximas 168 horas: entre ${minTemperature ?? "sin dato"} y ${maxTemperature ?? "sin dato"} grados`}
        />
      </ChartFrame>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-1 text-[10px] text-ink-dim">
            Probabilidad de precipitación
          </p>
          <ProbabilityBars
            values={probability}
            ariaLabel="Probabilidad de precipitación hora por hora durante 168 horas"
          />
        </div>
        <div>
          <p className="eyebrow mb-1 text-[10px] text-ink-dim">
            Lluvia acumulada por hora
          </p>
          <AmountBars
            values={precipitation}
            ariaLabel="Lluvia acumulada por hora durante 168 horas"
          />
        </div>
      </div>

      <details className="mt-5">
        <summary className="eyebrow cursor-pointer text-[11px] text-ink-soft">
          Tabla hora por hora · primeras {TABLE_HOURS} horas
        </summary>
        <p className="mt-1 text-[11px] text-ink-dim">
          El trazo de arriba cubre las 168 horas; la tabla se limita a{" "}
          {TABLE_HOURS} para no cargar el navegador con miles de celdas.
        </p>
        <div className="scroll-thin mt-2 max-h-[70vh] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-night-950">
              <tr>
                <th className="eyebrow border-b border-rule px-2 py-1.5 text-[10px] text-ink-dim">
                  Hora
                </th>
                <th className="eyebrow border-b border-rule px-2 py-1.5 text-[10px] text-ink-dim">
                  Cielo
                </th>
                {TABLE_COLUMNS.map((column) => (
                  <th
                    key={column}
                    className="eyebrow whitespace-nowrap border-b border-rule px-2 py-1.5 text-[10px] font-semibold text-ink-dim"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isNewDay = index === 0 || row.stamp.slice(0, 10) !== rows[index - 1].stamp.slice(0, 10);
                return (
                  <tr
                    key={row.stamp}
                    className={
                      index === 0
                        ? "bg-ember-deep/20"
                        : isNewDay
                          ? "border-t border-rule-strong"
                          : "border-t border-rule/30"
                    }
                  >
                    <th
                      scope="row"
                      className="numeric whitespace-nowrap px-2 py-1 text-left text-[11px] font-normal text-ink"
                    >
                      {isNewDay ? (
                        <span className="text-ink-soft">
                          {formatWeekdayShort(row.stamp)}{" "}
                        </span>
                      ) : null}
                      {formatTime(row.stamp)}
                    </th>
                    <td className="px-2 py-1 text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <WeatherGlyph
                          icon={row.weather.icon as GlyphKey}
                          size={15}
                          isDay={row.day}
                        />
                        <span className="hidden text-[11px] xl:inline">
                          {row.weather.label}
                        </span>
                      </span>
                    </td>
                    {row.values.map((value, columnIndex) => (
                      <td
                        key={TABLE_COLUMNS[columnIndex]}
                        className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      <Caveat>
        Cada columna se muestra en las unidades que hayas elegido. La humedad, las
        nubes y la probabilidad de lluvia van en porcentaje; la energía convectiva en
        julios por kilogramo (a partir de unos 1 500 hay condiciones para tormenta
        de verano). La tabla marca con una línea más gruesa el cambio de día y resalta
        la hora en curso.
      </Caveat>
    </Panel>
  );
}
