import { BigStat, Caveat, Panel, Row, RowList, toneText } from "@/components/ui/primitives";
import { WindArrow } from "@/components/ui/charts";
import { WeatherGlyph, type GlyphKey } from "@/components/ui/glyphs";
import { dewPointComfort, thermalStress, vpdCategory, wetBulbCategory } from "@/lib/derive/comfort";
import { uvCategory } from "@/lib/derive/uv";
import { beaufort, compassLongLabel, compassPoint, windChillCelsius } from "@/lib/derive/wind";
import { describeWeather } from "@/lib/derive/wmo";
import { formatTime, indexOfCurrentHour } from "@/lib/format";
import type { ForecastBundle } from "@/lib/types";
import {
  formatCape,
  formatDistance,
  formatHumidity,
  formatIndex,
  formatLiftedIndex,
  formatPrecipitation,
  formatPressure,
  formatRadiation,
  formatSpeed,
  formatTemperature,
  formatVpd,
  type UnitSystem,
} from "@/lib/units";

/**
 * "Ahora mismo": temperatura, sensación térmica y el desglose completo del
 * estado de la atmósfera. Es el bloque que la gente mira primero, así que la
 * cifra grande manda y el detalle se ordena por relevancia para esta ciudad:
 * viento, presión a 1 132 m, radiación y estabilidad.
 */
export default function NowPanel({
  forecast,
  units,
}: {
  forecast: ForecastBundle;
  units: UnitSystem;
}) {
  const { current, hourly, place } = forecast;
  const index = indexOfCurrentHour(hourly.time);

  const fromHour = (key: string): number | null => {
    const series = hourly[key];
    if (!Array.isArray(series)) return null;
    const value = series[index];
    return typeof value === "number" ? value : null;
  };
  const fromCurrent = (key: string): number | null => {
    const value = current[key];
    return typeof value === "number" ? value : null;
  };

  const temperature = fromCurrent("temperature_2m") ?? fromHour("temperature_2m");
  const apparent = fromCurrent("apparent_temperature") ?? fromHour("apparent_temperature");
  const humidity = fromCurrent("relative_humidity_2m") ?? fromHour("relative_humidity_2m");
  const dewPoint = fromCurrent("dew_point_2m") ?? fromHour("dew_point_2m");
  const weather = describeWeather(
    fromCurrent("weather_code") ?? fromHour("weather_code"),
  );
  const isDay = (fromCurrent("is_day") ?? fromHour("is_day") ?? 1) === 1;

  const windSpeed = fromCurrent("wind_speed_10m") ?? fromHour("wind_speed_10m");
  const windGusts = fromCurrent("wind_gusts_10m") ?? fromHour("wind_gusts_10m");
  const windDirection = fromCurrent("wind_direction_10m") ?? fromHour("wind_direction_10m");
  const beaufortScale = beaufort(windSpeed);
  const windChill = windChillCelsius(temperature, windSpeed);

  const uv = fromCurrent("uv_index") ?? fromHour("uv_index");
  const uvClear = fromHour("uv_index_clear_sky");
  const uvInfo = uvCategory(uv);
  const comfort = thermalStress(apparent);
  const dew = dewPointComfort(dewPoint);
  const vpd = vpdCategory(fromHour("vapour_pressure_deficit"));
  const wetBulb = wetBulbCategory(fromHour("wet_bulb_temperature_2m"));

  const surfacePressure = fromCurrent("surface_pressure") ?? fromHour("surface_pressure");
  const seaLevelPressure = fromCurrent("pressure_msl") ?? fromHour("pressure_msl");
  const visibility = fromCurrent("visibility") ?? fromHour("visibility");
  const cape = fromCurrent("cape") ?? fromHour("cape");

  const cloudTotal = fromCurrent("cloud_cover") ?? fromHour("cloud_cover");
  const cloudLow = fromHour("cloud_cover_low");
  const cloudMid = fromHour("cloud_cover_mid");
  const cloudHigh = fromHour("cloud_cover_high");

  const shortwave = fromHour("shortwave_radiation");
  const direct = fromHour("direct_radiation");
  const diffuse = fromHour("diffuse_radiation");

  return (
    <Panel
      id="ahora"
      title="Ahora mismo"
      subtitle={`Lectura de las ${formatTime(currentTimeOf(forecast, index))} · hora de Ciudad Juárez`}
      tone={uvInfo.tone}
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-10">
        {/* Cifra principal */}
        <div>
          <div className="flex items-center gap-4">
            <span className="text-amber">
              <WeatherGlyph icon={weather.icon as GlyphKey} size={54} isDay={isDay} />
            </span>
            <div className="min-w-0">
              <BigStat
                value={formatTemperature(temperature, units)}
                unit={units.temperature === "f" ? "°F" : "°C"}
                label="Temperatura del aire"
              />
            </div>
          </div>

          <p className="mt-3 font-display text-lg leading-tight text-ink">
            {weather.label}
          </p>

          <dl className="mt-4 max-w-sm">
            <Row
              label="Sensación térmica"
              hint="temperatura aparente"
              value={formatTemperature(apparent, units, { withUnit: true })}
              tone={comfort.tone}
            />
            <Row
              label="Cómo se siente"
              value={<span className={toneText(comfort.tone)}>{comfort.label}</span>}
            />
            {windChill !== null ? (
              <Row
                label="Sensación por viento"
                value={formatTemperature(windChill, units, { withUnit: true })}
              />
            ) : null}
            <Row
              label="Viento"
              hint={compassLongLabel(windDirection)}
              value={
                <span className="inline-flex items-center gap-2">
                  <WindArrow
                    degrees={windDirection}
                    size={18}
                    label={`Viento desde ${compassLongLabel(windDirection)}`}
                  />
                  {formatSpeed(windSpeed, units, { withUnit: true })}
                  <span className="text-ink-dim">{compassPoint(windDirection)}</span>
                </span>
              }
            />
            <Row
              label="Rachas"
              value={formatSpeed(windGusts, units, { withUnit: true })}
            />
            {beaufortScale ? (
              <Row
                label="Fuerza en la escala Beaufort"
                value={`${beaufortScale.force} · ${beaufortScale.label}`}
              />
            ) : null}
          </dl>
        </div>

        {/* Desglose denso */}
        <RowList>
          <Row
            label="Humedad relativa"
            value={formatHumidity(humidity)}
            hint="del aire"
          />
          <Row
            label="Punto de rocío"
            hint={dew.label}
            value={formatTemperature(dewPoint, units, { digits: 1, withUnit: true })}
          />
          <Row
            label="Presión en la estación"
            hint={`${Math.round(place.elevation)} m s.n.m.`}
            value={formatPressure(surfacePressure, units, { withUnit: true })}
          />
          <Row
            label="Presión reducida al mar"
            value={formatPressure(seaLevelPressure, units, { withUnit: true })}
          />
          <Row
            label="Visibilidad"
            hint={visibility !== null && visibility < 5000 ? "reducida" : undefined}
            value={formatDistance(visibility, units, { withUnit: true })}
            tone={visibility !== null && visibility < 5000 ? "caution" : undefined}
          />
          <Row
            label="Nubosidad"
            hint={`baja ${formatIndex(cloudLow)} · media ${formatIndex(cloudMid)} · alta ${formatIndex(cloudHigh)}`}
            value={`${formatIndex(cloudTotal)} %`}
          />
          <Row
            label="Índice ultravioleta"
            hint="cielo despejado"
            value={
              <span className={toneText(uvInfo.tone)}>
                {formatIndex(uv, 1)}
                {uvClear !== null ? (
                  <span className="text-ink-dim"> / {formatIndex(uvClear, 1)}</span>
                ) : null}
                {" · "}
                {uvInfo.label}
              </span>
            }
          />
          <Row
            label="Radiación solar"
            hint="directa y difusa"
            value={`${formatRadiation(shortwave)} · ${formatRadiation(direct)} / ${formatRadiation(diffuse)}`}
          />
          <Row
            label="Energía convectiva"
            hint="CAPE · potencial de tormenta"
            value={formatCape(cape)}
            tone={cape !== null && cape >= 1500 ? "warn" : undefined}
          />
          <Row
            label="Índice elevado"
            hint="inestabilidad"
            value={formatLiftedIndex(fromHour("lifted_index"))}
          />
          <Row
            label="Bulbo húmedo"
            hint={wetBulb.label}
            value={formatTemperature(fromHour("wet_bulb_temperature_2m"), units, {
              digits: 1,
              withUnit: true,
            })}
            tone={wetBulb.tone}
          />
          <Row
            label="Déficit de presión de vapor"
            hint={vpd.label}
            value={formatVpd(fromHour("vapour_pressure_deficit"))}
            tone={vpd.tone}
          />
          <Row
            label="Precipitación en la última hora"
            value={formatPrecipitation(
              fromCurrent("precipitation") ?? fromHour("precipitation"),
              units,
              { withUnit: true },
            )}
          />
          <Row
            label="Vapor de agua en la columna"
            hint="agua precipitable"
            value={`${formatIndex(fromHour("total_column_integrated_water_vapour"), 1)} kg/m²`}
          />
        </RowList>
      </div>

      <Caveat>
        Lectura puntual del modelo, no de un termómetro en tu colonia: la celda que
        responde está centrada en {place.latitude.toFixed(3)},{" "}
        {place.longitude.toFixed(3)}. El índice ultravioleta se compara con el que
        habría sin nubes, y esa diferencia dice cuánto filtran las nubes de hoy.
        {uvInfo.advice ? ` ${uvInfo.advice}` : ""} {comfort.advice}
      </Caveat>
    </Panel>
  );
}

/** Hora exacta del instante observado, para el subtítulo. */
function currentTimeOf(forecast: ForecastBundle, index: number): string {
  const stamp = forecast.current["time"];
  if (typeof stamp === "string") return stamp;
  return forecast.hourly.time[index] ?? forecast.hourly.time[0] ?? "";
}
