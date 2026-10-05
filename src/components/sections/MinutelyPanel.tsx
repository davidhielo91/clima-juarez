import { Caveat, Panel, Row, RowList } from "@/components/ui/primitives";
import { AmountBars, ChartFrame, ProbabilityBars, Trace, WindArrow } from "@/components/ui/charts";
import { WeatherGlyph, type GlyphKey } from "@/components/ui/glyphs";
import { describeWeather } from "@/lib/derive/wmo";
import { compassPoint } from "@/lib/derive/wind";
import { formatTime } from "@/lib/format";
import type { ForecastBundle } from "@/lib/types";
import {
  formatDistance,
  formatHumidity,
  formatPrecipitation,
  formatSpeed,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * Las próximas dos horas, en pasos de quince minutos.
 *
 * Esta es la ventana donde el pronóstico por horas se queda corto: si vas a salir
 * a la calle ahora, lo que importa es si la temperatura está subiendo o bajando y
 * si va a llover en el siguiente cuarto de hora.
 */
export default function MinutelyPanel({
  forecast,
  units,
}: {
  forecast: ForecastBundle;
  units: UnitSystem;
}) {
  const { minutely15 } = forecast;
  const steps = minutely15.time.length;

  if (steps === 0) {
    return (
      <Panel
        id="quince-minutos"
        title="Próximas 2 horas"
        subtitle="Avance cada 15 minutos"
      >
        <p className="text-[12px] text-ink-dim">
          El modelo no publicó datos de quince minutos para esta corrida.
        </p>
      </Panel>
    );
  }

  const series = (key: string): Array<number | null> => {
    const values = minutely15[key];
    if (!Array.isArray(values)) return [];
    return values.map((value) => (typeof value === "number" ? value : null));
  };

  const temperature = series("temperature_2m");
  const precipitation = series("precipitation");
  const probability = series("precipitation_probability");
  const humidity = series("relative_humidity_2m");
  const windSpeed = series("wind_speed_10m");
  const windGusts = series("wind_gusts_10m");
  const windDirection = series("wind_direction_10m");
  const weatherCodes = series("weather_code");
  const visibility = series("visibility");
  const cape = series("cape");

  const first = 0;
  const last = steps - 1;
  const temperatureValues = temperature.filter(
    (value): value is number => value !== null,
  );
  const minTemperature = temperatureValues.length
    ? Math.min(...temperatureValues)
    : null;
  const maxTemperature = temperatureValues.length
    ? Math.max(...temperatureValues)
    : null;
  const totalPrecipitation = precipitation.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const maxGust = windGusts.reduce<number | null>(
    (peak, value) => (value === null ? peak : peak === null ? value : Math.max(peak, value)),
    null,
  );

  return (
    <Panel
      id="quince-minutos"
      title="Próximas 2 horas"
      subtitle={`Cada 15 minutos, de ${formatTime(minutely15.time[first])} a ${formatTime(minutely15.time[last])}`}
    >
      {/*
        La escala lleva un decimal obligatorio: en una ventana de dos horas el rango
        suele ser de uno o dos grados, y redondeado a entero mostraba la misma cifra
        arriba y abajo, con lo que no decía nada.
      */}
      <ChartFrame
        caption="Temperatura del aire, de ahora a dentro de dos horas."
        scaleLeft={formatTemperature(maxTemperature, units, { digits: 1, withUnit: true })}
        scaleRight={formatTemperature(minTemperature, units, { digits: 1, withUnit: true })}
      >
        <Trace
          values={temperature}
          ariaLabel={`Temperatura cada quince minutos: entre ${minTemperature ?? "sin dato"} y ${maxTemperature ?? "sin dato"} grados`}
        />
      </ChartFrame>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-1 text-[10px] text-ink-dim">
            Probabilidad de precipitación
          </p>
          <ProbabilityBars
            values={probability}
            ariaLabel="Probabilidad de precipitación en cada intervalo de quince minutos"
          />
        </div>
        <div>
          <p className="eyebrow mb-1 text-[10px] text-ink-dim">
            Precipitación acumulada
          </p>
          <AmountBars
            values={precipitation}
            ariaLabel="Precipitación acumulada en cada intervalo de quince minutos"
          />
        </div>
      </div>

      {/* Tira de pasos: la lectura directa, sin gráfica. */}
      <ol className="scroll-thin ruled-hours mt-4 flex gap-4 overflow-x-auto pb-2">
        {minutely15.time.map((stamp, index) => {
          const info = describeWeather(weatherCodes[index]);
          return (
            <li key={stamp} className="min-w-[74px] shrink-0 border-l border-rule/60 pl-2">
              <p className="numeric text-[11px] text-ink-dim">
                {formatTime(stamp)}
              </p>
              <div className="my-1 text-ink-soft">
                <WeatherGlyph
                  icon={info.icon as GlyphKey}
                  size={20}
                  isDay={(series("is_day")[index] ?? 1) === 1}
                />
              </div>
              <p className="numeric text-[13px] text-ink">
                {formatTemperature(temperature[index], units, { withUnit: true })}
              </p>
              <p className="numeric text-[11px] text-cold">
                {formatPrecipitation(precipitation[index], units, { withUnit: true })}
              </p>
              <p className="numeric mt-0.5 flex items-center gap-1 text-[11px] text-ink-dim">
                <WindArrow degrees={windDirection[index]} size={13} />
                {formatSpeed(windSpeed[index], units)}
              </p>
            </li>
          );
        })}
      </ol>

      <RowList>
        <Row
          label="Lluvia acumulada en 2 horas"
          value={formatPrecipitation(totalPrecipitation, units, { withUnit: true })}
        />
        <Row
          label="Racha máxima"
          value={formatSpeed(maxGust, units, { withUnit: true })}
        />
        <Row
          label="Visibilidad más baja"
          value={formatDistance(
            visibility.reduce<number | null>(
              (low, value) => (value === null ? low : low === null ? value : Math.min(low, value)),
              null,
            ),
            units,
            { withUnit: true },
          )}
        />
        <Row
          label="Humedad relativa"
          value={formatHumidity(humidity[0])}
        />
        <Row
          label="Energía convectiva"
          value={`${cape.reduce<number | null>((peak, value) => (value === null ? peak : peak === null ? value : Math.max(peak, value)), null) ?? "—"} J/kg`}
        />
        <Row
          label="Dirección del viento"
          value={compassPoint(windDirection[0])}
        />
      </RowList>

      <Caveat>
        El detalle de quince minutos lo publica el modelo de corto plazo de
        Open-Meteo y se refresca cada pocos minutos; es la estimación más fina que
        existe para esta zona, pero sigue siendo una celda de modelo y no un radar
        de precipitación. Para ver dónde está lloviendo ahora, usa el panel de radar.
      </Caveat>
    </Panel>
  );
}
