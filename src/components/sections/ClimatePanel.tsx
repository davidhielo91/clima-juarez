import {
  Caveat,
  DataState,
  EmptyNote,
  Panel,
  Row,
  RowList,
} from "@/components/ui/primitives";
import { AmountBars, ChartFrame, Trace } from "@/components/ui/charts";
import { WeatherGlyph, type GlyphKey } from "@/components/ui/glyphs";
import {
  anomalyForDate,
  dayOfYearKey,
  extremeSummary,
  monthlyNormals,
} from "@/lib/derive/climate";
import { describeWeather } from "@/lib/derive/wmo";
import {
  currentDayKey,
  formatDateLong,
  formatDayMonth,
  formatWeekdayShort,
  indexOfCurrentDay,
} from "@/lib/format";
import { getClimateNormals } from "@/lib/sources/climate";
import { getHistory } from "@/lib/sources/history";
import type { ClimateNormals, HistoryBundle } from "@/lib/types";
import {
  formatNumber,
  formatPrecipitation,
  formatSigned,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * Histórico reciente y clima de referencia.
 *
 * Son dos preguntas distintas y por eso van en dos bloques con fuentes distintas:
 *  - "¿cómo ha estado esto?" → los últimos 14 días observados por el modelo.
 *  - "¿cómo suele estar esto?" → los valores normales de 1995–2024 para la fecha de
 *    hoy, calculados en `src/lib/sources/climate.ts` a partir del archivo ERA5.
 *
 * Las dos fuentes se piden en paralelo y **cada una se pinta por separado**: la
 * climatología tarda mucho más que el histórico, así que si una falla se muestra la
 * otra y se avisa de la que falta, en vez de dejar el panel entero en blanco.
 *
 * La anomalía es la resta de dos temperaturas absolutas, así que al pasar a
 * Fahrenheit se convierte solo el tamaño de la diferencia (×9/5) y no se le suma 32:
 * por eso se usa `formatSigned` sobre el valor convertido y no `formatTemperature`.
 */

/** Días del histórico que se muestran: catorce, contando hoy. */
const HISTORY_DAYS = 14;

function numberAt(
  block: Record<string, Array<string | number | null>>,
  key: string,
  index: number,
): number | null {
  const series = block[key];
  if (!Array.isArray(series)) return null;
  const value = series[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Anomalía con su unidad: `formatSigned` sobre la diferencia ya convertida. */
function formatAnomaly(celsius: number | null, units: UnitSystem): string {
  if (celsius === null) return "—";
  const converted = units.temperature === "f" ? celsius * 1.8 : celsius;
  return `${formatSigned(converted, 1)} ${units.temperature === "f" ? "°F" : "°C"}`;
}

function anomalyPhrase(celsius: number | null): string {
  if (celsius === null) return "sin dato para comparar";
  if (celsius > 0.5) return "por encima de lo normal";
  if (celsius < -0.5) return "por debajo de lo normal";
  return "en lo normal";
}

export default async function ClimatePanel({ units }: { units: UnitSystem }) {
  const [historyResult, climateResult] = await Promise.all([
    getHistory(),
    getClimateNormals(),
  ]);

  // La fecha de hoy en hora de Juárez; es la que se busca en las normales.
  const today = currentDayKey();

  const observed =
    historyResult.ok && historyResult.data.daily.time.length > 0
      ? todayRow(historyResult.data)
      : null;

  return (
    <Panel
      id="clima"
      title="Clima e histórico"
      subtitle="Los últimos 14 días observados y los valores normales de la fecha de hoy."
    >
      <h3 className="eyebrow mb-1 text-[11px] text-ink-soft">
        Últimos {HISTORY_DAYS} días
      </h3>
      <DataState result={historyResult} what="el histórico de los últimos días">
        {(history) => <HistoryBlock history={history} units={units} />}
      </DataState>

      <h3 className="eyebrow mt-6 mb-1 text-[11px] text-ink-soft">
        Valores normales · {formatDateLong(today)}
      </h3>
      <DataState result={climateResult} what="la climatología de referencia">
        {(normals) => (
          <ClimateBlock normals={normals} observed={observed} units={units} />
        )}
      </DataState>

      {!historyResult.ok || !climateResult.ok ? (
        <p className="mt-3 text-[11px] text-tone-warn">
          {!historyResult.ok
            ? `El histórico de los últimos días no llegó: ${historyResult.error}.`
            : null}
          {!historyResult.ok && !climateResult.ok ? " " : null}
          {!climateResult.ok
            ? `Las normales de 1995–2024 no llegaron: ${climateResult.error}.`
            : null}
        </p>
      ) : null}

      <Caveat>
        Los dos bloques miden cosas distintas. El histórico son días ya cerrados, con
        la temperatura del modelo en la celda del centro; la climatología compara la
        fecha de hoy contra 30 años de archivo, y una anomalía de +2 °C en un solo día
        no dice nada del clima: dice cómo viene este día respecto a los 30 anteriores
        con la misma fecha. Si la fila de hoy del histórico todavía está en curso, su
        máxima y su mínima son las que el modelo espera para el día completo, no las
        que ya ocurrieron.
      </Caveat>
    </Panel>
  );
}

/** Máxima y mínima del día de hoy según el bloque histórico. */
function todayRow(
  history: HistoryBundle,
): { date: string; tMax: number | null; tMin: number | null } | null {
  const index = indexOfCurrentDay(history.daily.time);
  const date = history.daily.time[index];
  if (date === undefined) return null;
  return {
    date,
    tMax: numberAt(history.daily, "temperature_2m_max", index),
    tMin: numberAt(history.daily, "temperature_2m_min", index),
  };
}

function HistoryBlock({
  history,
  units,
}: {
  history: HistoryBundle;
  units: UnitSystem;
}) {
  const { daily } = history;
  const todayIndex = indexOfCurrentDay(daily.time);
  const startIndex = Math.max(0, todayIndex - (HISTORY_DAYS - 1));
  const dates = daily.time.slice(startIndex, todayIndex + 1);

  if (dates.length === 0) {
    return <EmptyNote>El histórico llegó sin días que mostrar.</EmptyNote>;
  }

  const maxima = dates.map((_, offset) =>
    numberAt(daily, "temperature_2m_max", startIndex + offset),
  );
  const minima = dates.map((_, offset) =>
    numberAt(daily, "temperature_2m_min", startIndex + offset),
  );
  const rain = dates.map((_, offset) =>
    numberAt(daily, "precipitation_sum", startIndex + offset),
  );

  const knownMaxima = maxima.filter((value): value is number => value !== null);
  const knownMinima = minima.filter((value): value is number => value !== null);
  const totalRain = rain.reduce<number>((total, value) => total + (value ?? 0), 0);
  const rainyDays = rain.filter((value) => value !== null && value > 0).length;

  const warmestIndex = maxima.indexOf(
    knownMaxima.length === 0 ? Number.NaN : Math.max(...knownMaxima),
  );
  const coldestIndex = minima.indexOf(
    knownMinima.length === 0 ? Number.NaN : Math.min(...knownMinima),
  );

  return (
    <>
      <ChartFrame
        caption="Banda: de la mínima a la máxima de cada día. Línea: la máxima. Los catorce días terminan en hoy, que todavía está en curso."
        scaleLeft={formatTemperature(
          knownMaxima.length === 0 ? null : Math.max(...knownMaxima),
          units,
          { withUnit: true },
        )}
        scaleRight={formatTemperature(
          knownMinima.length === 0 ? null : Math.min(...knownMinima),
          units,
          { withUnit: true },
        )}
      >
        <Trace
          values={maxima}
          lower={minima}
          upper={maxima}
          markerIndex={dates.length - 1}
          height={130}
          showZeroLine
          ariaLabel={`Temperatura máxima y mínima de cada uno de los últimos ${dates.length} días`}
        />
      </ChartFrame>

      <div className="mt-3">
        <p className="eyebrow mb-1 text-[10px] text-ink-dim">Lluvia acumulada por día</p>
        <AmountBars
          values={rain}
          ariaLabel={`Lluvia acumulada de cada uno de los últimos ${dates.length} días`}
        />
      </div>

      <RowList>
        <Row
          label="Día más caluroso"
          value={
            warmestIndex === -1
              ? "—"
              : `${formatWeekdayShort(dates[warmestIndex])} · ${formatTemperature(maxima[warmestIndex], units, { withUnit: true })}`
          }
        />
        <Row
          label="Noche más fría"
          value={
            coldestIndex === -1
              ? "—"
              : `${formatWeekdayShort(dates[coldestIndex])} · ${formatTemperature(minima[coldestIndex], units, { withUnit: true })}`
          }
        />
        <Row
          label="Lluvia acumulada del periodo"
          hint={`${dates.length} días`}
          value={formatPrecipitation(totalRain, units, { withUnit: true })}
        />
        <Row
          label="Días con lluvia registrada"
          hint="más de 0 mm en el día"
          value={`${formatNumber(rainyDays, 0)} de ${dates.length}`}
        />
      </RowList>

      <div className="scroll-thin mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Máxima, mínima y lluvia acumulada de cada uno de los últimos días
          </caption>
          <thead>
            <tr>
              {["Día", "Cielo", "Máxima", "Mínima", "Lluvia"].map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="eyebrow whitespace-nowrap border-b border-rule px-2 py-1.5 text-[10px] font-semibold text-ink-dim"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date, offset) => {
              const index = startIndex + offset;
              const weather = describeWeather(numberAt(daily, "weather_code", index));
              return (
                <tr key={date} className="border-b border-rule/30">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-2 py-1 text-left text-[11px] font-normal text-ink-soft"
                  >
                    <span className="block text-ink">
                      {offset === dates.length - 1 ? "Hoy" : formatWeekdayShort(date)}
                    </span>
                    <span className="numeric block text-[10px] text-ink-dim">
                      {formatDayMonth(date)}
                    </span>
                  </th>
                  <td className="px-2 py-1 text-[11px] text-ink-soft">
                    <span className="inline-flex items-center gap-1.5">
                      <WeatherGlyph icon={weather.icon as GlyphKey} size={15} />
                      <span className="hidden xl:inline">{weather.label}</span>
                    </span>
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink">
                    {formatTemperature(maxima[offset], units)}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {formatTemperature(minima[offset], units)}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-cold">
                    {formatPrecipitation(rain[offset], units, { withUnit: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ClimateBlock({
  normals,
  observed,
  units,
}: {
  normals: ClimateNormals;
  observed: { date: string; tMax: number | null; tMin: number | null } | null;
  units: UnitSystem;
}) {
  const today = currentDayKey();
  const anomaly = anomalyForDate(
    normals,
    today,
    observed?.tMax ?? null,
    observed?.tMin ?? null,
  );
  const extremes = extremeSummary(normals, today);
  const months = monthlyNormals(normals);
  const currentMonth = Number(today.slice(5, 7));

  if (anomaly === null) {
    return (
      <EmptyNote>
        La climatología de referencia no tiene valores para la fecha de hoy (
        {dayOfYearKey(today)}), así que no se puede calcular la anomalía. El periodo
        cubre de {normals.periodStart} a {normals.periodEnd} y tiene{" "}
        {formatNumber(normals.daysWithData, 0)} días con dato.
      </EmptyNote>
    );
  }

  return (
    <>
      <RowList>
        <Row
          label="Máxima normal"
          hint={`${anomaly.years} años de referencia`}
          value={formatTemperature(anomaly.tMaxNormal, units, {
            digits: 1,
            withUnit: true,
          })}
        />
        <Row
          label="Mínima normal"
          value={formatTemperature(anomaly.tMinNormal, units, {
            digits: 1,
            withUnit: true,
          })}
        />
        <Row
          label="Máxima de hoy"
          hint={observed === null ? "el histórico no llegó" : "según el modelo"}
          value={formatTemperature(observed?.tMax ?? null, units, {
            digits: 1,
            withUnit: true,
          })}
        />
        <Row
          label="Mínima de hoy"
          value={formatTemperature(observed?.tMin ?? null, units, {
            digits: 1,
            withUnit: true,
          })}
        />
        <Row
          label="Anomalía de la máxima"
          hint={anomalyPhrase(anomaly.tMaxAnomaly)}
          value={formatAnomaly(anomaly.tMaxAnomaly, units)}
          tone={
            anomaly.tMaxAnomaly === null
              ? undefined
              : anomaly.tMaxAnomaly > 3
                ? "warn"
                : anomaly.tMaxAnomaly > 0.5
                  ? "caution"
                  : anomaly.tMaxAnomaly < -3
                    ? "info"
                    : undefined
          }
        />
        <Row
          label="Anomalía de la mínima"
          hint={anomalyPhrase(anomaly.tMinAnomaly)}
          value={formatAnomaly(anomaly.tMinAnomaly, units)}
        />
      </RowList>

      <p className="mt-2 max-w-prose text-[12px] leading-snug text-ink-soft">
        Hoy la máxima está {anomalyPhrase(anomaly.tMaxAnomaly)}:{" "}
        {formatAnomaly(anomaly.tMaxAnomaly, units)} respecto al valor normal de un{" "}
        {formatDateLong(today)} en el periodo {normals.periodStart.slice(0, 4)}–
        {normals.periodEnd.slice(0, 4)}, calculado con {anomaly.years} años.
      </p>

      <h4 className="eyebrow mt-4 text-[11px] text-ink-soft">
        Extremos de las normales del mes
      </h4>
      <RowList>
        <Row
          label="Día más cálido del mes"
          hint="en promedio, 1995–2024"
          value={formatTemperature(extremes.warmest, units, {
            digits: 1,
            withUnit: true,
          })}
        />
        <Row
          label="Día más frío del mes"
          value={formatTemperature(extremes.coolest, units, {
            digits: 1,
            withUnit: true,
          })}
        />
        <Row
          label="Día más lluvioso del mes"
          hint="promedio diario"
          value={formatPrecipitation(extremes.wettest, units, { withUnit: true })}
        />
        <Row
          label="Cobertura del periodo"
          hint={`${normals.periodStart} a ${normals.periodEnd}`}
          value={`${formatNumber(normals.daysWithData, 0)} días con dato`}
        />
      </RowList>

      <h4 className="eyebrow mt-4 text-[11px] text-ink-soft">
        Promedios mensuales del periodo
      </h4>
      <div className="scroll-thin mt-1 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Valores normales mensuales de máxima, mínima, media y precipitación diaria
            para el periodo {normals.periodStart} a {normals.periodEnd}
          </caption>
          <thead>
            <tr>
              {["Mes", "Máxima", "Mínima", "Media", "Lluvia por día"].map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="eyebrow whitespace-nowrap border-b border-rule px-2 py-1.5 text-[10px] font-semibold text-ink-dim"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr
                key={month.month}
                className={
                  month.month === currentMonth
                    ? "border-b border-rule/30 bg-ember-deep/15"
                    : "border-b border-rule/30"
                }
              >
                <th
                  scope="row"
                  className="whitespace-nowrap px-2 py-1 text-left text-[11px] font-normal text-ink-soft"
                >
                  {month.label}
                  {month.month === currentMonth ? (
                    <span className="text-ink-dim"> · mes en curso</span>
                  ) : null}
                </th>
                <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink">
                  {formatTemperature(month.tMax, units, { digits: 1, withUnit: true })}
                </td>
                <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                  {formatTemperature(month.tMin, units, { digits: 1, withUnit: true })}
                </td>
                <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                  {formatTemperature(month.tMean, units, { digits: 1, withUnit: true })}
                </td>
                <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-cold">
                  {formatPrecipitation(month.precipitation, units, { withUnit: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Caveat>
        Cada renglón de la tabla mensual es el promedio de los valores normales de todos
        los días de ese mes, sin ponderar por año: un mes con mejor cobertura no pesa
        más que otro. La precipitación se promedia por día, así que el número es «lo
        que llueve en un día normal de ese mes», no lo que llueve en el mes:
        multiplícalo por los días del mes para tener el acumulado, y aun así tómalo con
        pinzas, porque en el desierto la lluvia de un año entero puede caer en tres
        tardes de agosto. El
        periodo de referencia es {normals.periodStart} a {normals.periodEnd} con{" "}
        {formatNumber(normals.daysWithData, 0)} días con dato.
      </Caveat>
    </>
  );
}
