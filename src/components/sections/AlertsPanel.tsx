import AlertNotifier from "@/components/pwa/AlertNotifier";
import { EmptyNote, Panel, toneText } from "@/components/ui/primitives";
import { evaluateAlerts, type AlertInput } from "@/lib/derive/alerts";
import { getAirQuality } from "@/lib/sources/airQuality";
import { getForecast } from "@/lib/sources/forecast";
import { formatDateWithWeekday, formatTime } from "@/lib/format";
import type { Tone } from "@/lib/derive/tone";

/**
 * Avisos locales.
 *
 * No son avisos oficiales: son umbrales que este panel evalúa sobre el pronóstico
 * y sobre la calidad del aire, pensados para el clima de Juárez (calor extremo,
 * tolvaneras, polvo, radiación a 1 130 m y arranques de monzón). Se dice
 * claramente en la interfaz para que nadie los confunda con una alerta de
 * Protección Civil.
 */

function seriesOf(
  block: Record<string, Array<string | number | null>> | undefined,
  key: string,
): Array<number | null> {
  const series = block?.[key];
  if (!Array.isArray(series)) return [];
  return series.map((value) => (typeof value === "number" ? value : null));
}

export default async function AlertsPanel() {
  const [forecastResult, airResult] = await Promise.all([
    getForecast(),
    getAirQuality(),
  ]);

  if (!forecastResult.ok) {
    return (
      <Panel
        id="avisos"
        title="Avisos"
        subtitle="Umbrales locales sobre el pronóstico y la calidad del aire"
      >
        <EmptyNote>
          No se pueden evaluar los avisos porque no llegó el pronóstico:{" "}
          {forecastResult.error}.
        </EmptyNote>
      </Panel>
    );
  }

  const hourly = forecastResult.data.hourly;
  const time = hourly.time;

  // La calidad del aire viene en su propia malla horaria: se alinea por hora.
  const airHourly = airResult.ok ? airResult.data.hourly : undefined;
  const airIndex = new Map<string, number>();
  airHourly?.time.forEach((stamp, index) => airIndex.set(stamp, index));

  const alignAir = (key: string): Array<number | null> => {
    const source = seriesOf(airHourly, key);
    if (source.length === 0) return time.map(() => null);
    return time.map((stamp) => {
      const index = airIndex.get(stamp);
      return index === undefined ? null : (source[index] ?? null);
    });
  };

  const input: AlertInput = {
    time,
    temperature: seriesOf(hourly, "temperature_2m"),
    apparent: seriesOf(hourly, "apparent_temperature"),
    windSpeed: seriesOf(hourly, "wind_speed_10m"),
    windGusts: seriesOf(hourly, "wind_gusts_10m"),
    precipitationProbability: seriesOf(hourly, "precipitation_probability"),
    precipitation: seriesOf(hourly, "precipitation"),
    snowfall: seriesOf(hourly, "snowfall"),
    visibility: seriesOf(hourly, "visibility"),
    cape: seriesOf(hourly, "cape"),
    liftedIndex: seriesOf(hourly, "lifted_index"),
    weatherCode: seriesOf(hourly, "weather_code"),
    pm10: alignAir("pm10"),
    usAqi: alignAir("us_aqi"),
    uvIndex: seriesOf(hourly, "uv_index"),
  };

  const alerts = evaluateAlerts(input);

  return (
    <Panel
      id="avisos"
      title="Avisos"
      subtitle="Umbrales locales sobre el pronóstico y la calidad del aire"
      tone={alerts[0]?.severity}
    >
      {alerts.length === 0 ? (
        <EmptyNote>
          Sin avisos para las próximas 168 horas: ninguna variable cruza los
          umbrales de calor, frío, viento, polvo, radiación, aire o tormenta.
        </EmptyNote>
      ) : (
        <ul className="grid gap-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`border-l-2 bg-night-900/50 py-2 pl-3 ${
                alert.severity === "extreme" || alert.severity === "danger"
                  ? "border-tone-danger"
                  : alert.severity === "warn"
                    ? "border-tone-warn"
                    : alert.severity === "caution"
                      ? "border-tone-caution"
                      : "border-tone-info"
              }`}
            >
              <p
                className={`eyebrow text-[11px] ${toneText(alert.severity as Tone)}`}
              >
                {alert.title}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                {alert.detail}
              </p>
              <p className="numeric mt-1 text-[11px] text-ink-dim">
                {describeWindow(alert.startsAt, alert.endsAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <AlertNotifier
        alerts={alerts.map((alert) => ({
          title: alert.title,
          detail: alert.detail,
        }))}
      />

      {!airResult.ok ? (
        <p className="mt-3 text-[11px] text-ink-dim">
          Los avisos de polvo y de calidad del aire no se evaluaron: {airResult.error}.
        </p>
      ) : null}

      <details className="mt-4 text-[11px] text-ink-dim">
        <summary className="cursor-pointer text-ink-soft">
          Qué se vigila y con qué umbrales
        </summary>
        <p className="mt-2 leading-relaxed">
          Calor extremo por temperatura y por sensación térmica; frío por
          temperatura y viento; viento sostenido y rachas; polvo por partículas
          PM10 y por pérdida de visibilidad con viento; radiación ultravioleta;
          calidad del aire por índice estadounidense; arranques de tormenta por
          energía convectiva disponible (CAPE) e inestabilidad; y nieve o lluvia
          helada. Los valores exactos de cada umbral están en{" "}
          <code className="numeric">src/lib/derive/alerts.ts</code>.
        </p>
        <p className="mt-2 leading-relaxed">
          Son umbrales propios calculados sobre el pronóstico. No sustituyen los
          avisos de Protección Civil ni del Servicio Meteorológico Nacional.
        </p>
      </details>
    </Panel>
  );
}

function describeWindow(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "Sin ventana definida";
  const start = `${formatDateWithWeekday(startsAt)} ${formatTime(startsAt)}`;
  if (!endsAt || endsAt === startsAt) return `Desde ${start}`;
  return `Desde ${start} hasta ${formatDateWithWeekday(endsAt)} ${formatTime(endsAt)}`;
}
