import {
  Caveat,
  DataState,
  EmptyNote,
  Panel,
  Row,
  RowList,
} from "@/components/ui/primitives";
import { ChartFrame, Trace } from "@/components/ui/charts";
import { countAbove, percentile, percentileSeries } from "@/lib/derive/stats";
import {
  formatDayMonth,
  formatTime,
  formatWeekdayShort,
  indexOfCurrentHour,
} from "@/lib/format";
import { getEnsemble } from "@/lib/sources/ensemble";
import type { EnsembleBundle } from "@/lib/types";
import {
  formatNumber,
  formatPercent,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * Incertidumbre del pronóstico, medida con los 30 miembros del ensamble del GFS.
 *
 * Un pronóstico de un solo número esconde lo que no se sabe: aquí se dibuja la
 * banda que ocupan los 30 miembros. Si la banda es estrecha, los 30 escenarios
 * coinciden y el pronóstico es firme; si se abre, el modelo no sabe si hará 12 o
 * 30 °C y eso es información, no ruido.
 *
 * Criterios propios de este panel:
 *  - La ventana son las próximas 240 horas (diez días), que es todo lo que el
 *    ensamble cubre con detalle razonable.
 *  - Los percentiles por hora se calculan sobre el **corte transversal** de los 30
 *    miembros en esa hora: se transpone la matriz antes de llamar a
 *    `percentileSeries`, porque esa función aplica `percentile` al arreglo que
 *    recibe y lo que interesa promediar es "los 30 valores de las 15:00", no "las
 *    240 horas del miembro 7".
 *  - La probabilidad de lluvia de un día es la fracción de miembros cuya **lluvia
 *    acumulada** de ese día pasa de 1 mm; la probabilidad de calor, la fracción
 *    cuya máxima diaria pasa de 35 °C. Las dos usan `countAbove` sobre la serie
 *    diaria de cada miembro, que es la única forma de que el umbral mida lo que
 *    dice medir.
 */

const TRACE_HOURS = 240;
const TABLE_DAYS = 7;
const RAIN_THRESHOLD_MM = 1;
const HEAT_THRESHOLD_C = 35;

interface DayWindow {
  date: string;
  hours: number[];
}

/** Serie horaria del bloque reducida a números, con los huecos conservados. */
function numbers(values: Array<string | number | null> | undefined): Array<number | null> {
  if (!Array.isArray(values)) return [];
  return values.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
  );
}

/** Día → posiciones horarias que le corresponden, en orden de aparición. */
function dayWindows(time: string[]): DayWindow[] {
  const byDate = new Map<string, number[]>();
  time.forEach((stamp, index) => {
    const date = stamp.slice(0, 10);
    const bucket = byDate.get(date);
    if (bucket === undefined) byDate.set(date, [index]);
    else bucket.push(index);
  });
  return [...byDate.entries()].map(([date, hours]) => ({ date, hours }));
}

/** Suma o máximo de un miembro dentro de un día; `null` si no hay ninguna hora. */
function aggregate(
  series: Array<number | null>,
  day: DayWindow,
  mode: "sum" | "max",
): number | null {
  let total = 0;
  let peak: number | null = null;

  for (const hour of day.hours) {
    const value = series[hour];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    total += value;
    peak = peak === null ? value : Math.max(peak, value);
  }

  if (peak === null) return null;
  return mode === "sum" ? total : peak;
}

/**
 * Percentiles por hora. Se transpone la matriz (miembros × horas → horas ×
 * miembros) para que cada posición de `percentileSeries` sea el corte transversal
 * de una hora concreta.
 */
function hourPercentiles(
  members: Array<Array<number | null>>,
  hourCount: number,
  p: number,
): Array<number | null> {
  const columns: Array<Array<number | null>> = [];
  for (let hour = 0; hour < hourCount; hour += 1) {
    columns.push(members.map((member) => member[hour] ?? null));
  }
  return percentileSeries(columns, p);
}

/**
 * Separación entre dos temperaturas: una **diferencia** no lleva el desfase de
 * +32 al pasar a Fahrenheit, solo el factor 9/5.
 */
function formatSpan(celsius: number | null, units: UnitSystem): string {
  if (celsius === null || !Number.isFinite(celsius)) return "—";
  const converted = units.temperature === "f" ? celsius * 1.8 : celsius;
  return `${formatNumber(converted, 1)} ${units.temperature === "f" ? "°F" : "°C"}`;
}

export default async function EnsemblePanel({ units }: { units: UnitSystem }) {
  const result = await getEnsemble();

  return (
    <Panel
      id="ensamble"
      title="Ensamble de 30 miembros"
      subtitle="La banda entre los 30 escenarios del GFS: angosta es pronóstico firme, ancha es incertidumbre."
    >
      <DataState result={result} what="el ensamble de 30 miembros">
        {(data) => <EnsembleBody ensemble={data} units={units} />}
      </DataState>

      <Caveat>
        Una banda ancha significa pronóstico inseguro: los 30 miembros del GFS son
        30 formas de resolver las mismas ecuaciones con el estado inicial ligeramente
        perturbado, y su separación mide el error de pronóstico, no el clima de la
        ciudad. Si a diez días la banda p10–p90 mide más de 15 °C, cualquier número
        suelto de ese día —el de esta app o el de la tele— es una posibilidad entre
        muchas. La banda no es un intervalo de confianza estadístico: es literalmente
        hasta dónde llegan los 30 escenarios que se calcularon.
      </Caveat>
    </Panel>
  );
}

function EnsembleBody({
  ensemble,
  units,
}: {
  ensemble: EnsembleBundle;
  units: UnitSystem;
}) {
  const { hourly, temperatureMembers, precipitationMembers } = ensemble;

  if (temperatureMembers.length === 0) {
    return <EmptyNote>El ensamble llegó sin miembros de temperatura.</EmptyNote>;
  }

  const start = indexOfCurrentHour(hourly.time);
  const times = hourly.time.slice(start, start + TRACE_HOURS);
  const hourCount = times.length;

  if (hourCount === 0) {
    return <EmptyNote>El ensamble no publicó horas futuras.</EmptyNote>;
  }

  const temperatureSeries = temperatureMembers.map((key) =>
    numbers(hourly[key]).slice(start, start + TRACE_HOURS),
  );
  const precipitationSeries = precipitationMembers.map((key) =>
    numbers(hourly[key]).slice(start, start + TRACE_HOURS),
  );

  const p10 = hourPercentiles(temperatureSeries, hourCount, 10);
  const p25 = hourPercentiles(temperatureSeries, hourCount, 25);
  const p50 = hourPercentiles(temperatureSeries, hourCount, 50);
  const p75 = hourPercentiles(temperatureSeries, hourCount, 75);
  const p90 = hourPercentiles(temperatureSeries, hourCount, 90);

  const widthAt = (index: number): number | null => {
    const low = p10[index] ?? null;
    const high = p90[index] ?? null;
    if (low === null || high === null) return null;
    return high - low;
  };
  const lastHour = hourCount - 1;

  // Días completos para las probabilidades: el día en curso está a medias.
  const windows = dayWindows(times);
  const tableDays = windows.slice(1, 1 + TABLE_DAYS);

  const memberDailyRain = precipitationSeries.map((series) =>
    windows.map((day) => aggregate(series, day, "sum")),
  );
  const memberDailyMax = temperatureSeries.map((series) =>
    windows.map((day) => aggregate(series, day, "max")),
  );

  const rows = tableDays.map((day, position) => {
    // `position` es el índice dentro de `tableDays`, pero las series diarias están
    // alineadas con `windows`: se desplaza uno porque la tabla salta el día de hoy.
    const dayIndex = position + 1;
    const dailyMaxima = memberDailyMax.map((series) => series[dayIndex] ?? null);

    return {
      date: day.date,
      median: percentile(dailyMaxima, 50),
      low: percentile(dailyMaxima, 10),
      high: percentile(dailyMaxima, 90),
      rain: countAbove(memberDailyRain, dayIndex, RAIN_THRESHOLD_MM),
      heat: countAbove(memberDailyMax, dayIndex, HEAT_THRESHOLD_C),
    };
  });

  const temperatures = p50.filter((value): value is number => value !== null);

  return (
    <>
      <p className="mb-2 text-[11px] text-ink-dim">
        {temperatureMembers.length} miembros de temperatura y{" "}
        {precipitationMembers.length} de lluvia, desde las{" "}
        {formatTime(hourly.time[start])} de hoy.
      </p>

      <ChartFrame
        caption={`Temperatura del ensamble. Banda clara: del percentil 10 al 90 (${temperatureMembers.length} miembros); línea: la mediana. La marca vertical es la hora en curso.`}
        scaleLeft={formatTemperature(
          temperatures.length ? Math.max(...temperatures) : null,
          units,
          { withUnit: true },
        )}
        scaleRight={formatTemperature(
          temperatures.length ? Math.min(...temperatures) : null,
          units,
          { withUnit: true },
        )}
      >
        <Trace
          values={p50}
          lower={p10}
          upper={p90}
          markerIndex={0}
          height={150}
          ariaLabel={`Temperatura mediana de las próximas ${hourCount} horas con la banda del percentil 10 al 90 de ${temperatureMembers.length} miembros del ensamble`}
        />
      </ChartFrame>

      <div className="mt-3">
        <ChartFrame
          caption="La misma mediana, con la banda estrecha del percentil 25 al 75: el cuerpo central de los 30 escenarios."
        >
          <Trace
            values={p50}
            lower={p25}
            upper={p75}
            markerIndex={0}
            height={90}
            bandFill="var(--color-cold)"
            ariaLabel={`Temperatura mediana con la banda del percentil 25 al 75 de ${temperatureMembers.length} miembros`}
          />
        </ChartFrame>
      </div>

      <RowList>
        <Row
          label="Ancho de la banda ahora"
          hint="p10 a p90"
          value={formatSpan(widthAt(0), units)}
        />
        <Row
          label={`Ancho de la banda a ${hourCount} h`}
          hint="p10 a p90"
          value={formatSpan(widthAt(lastHour), units)}
          tone={(() => {
            const width = widthAt(lastHour);
            if (width === null) return undefined;
            return width > 15 ? "warn" : width > 8 ? "caution" : "good";
          })()}
        />
        <Row
          label="Amplitud del día más incierto"
          hint={`${temperatureMembers.length} miembros`}
          value={(() => {
            const widths = windows.map((_, index) => widthAt(index)).filter(
              (value): value is number => value !== null,
            );
            return widths.length > 0 ? formatSpan(Math.max(...widths), units) : "—";
          })()}
        />
        <Row
          label="Miembros de temperatura recibidos"
          hint="se esperaban 30"
          value={String(temperatureMembers.length)}
        />
      </RowList>

      <h3 className="eyebrow mt-5 text-[11px] text-ink-soft">
        Por día · probabilidad y dispersión
      </h3>
      <div className="scroll-thin mt-1 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Probabilidad de lluvia y de máxima superior a 35 grados según la fracción
            de miembros del ensamble que superan cada umbral, por día
          </caption>
          <thead>
            <tr>
              {[
                "Día",
                "Máxima mediana",
                "Rango p10–p90 de las máximas",
                `Lluvia > ${RAIN_THRESHOLD_MM} mm`,
                `Máxima > ${HEAT_THRESHOLD_C} °C`,
              ].map((column) => (
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
            {rows.map((row) => (
              <tr key={row.date} className="border-b border-rule/30">
                <th
                  scope="row"
                  className="whitespace-nowrap px-2 py-1 text-left text-[11px] font-normal text-ink-soft"
                >
                  <span className="block text-ink">{formatWeekdayShort(row.date)}</span>
                  <span className="numeric block text-[10px] text-ink-dim">
                    {formatDayMonth(row.date)}
                  </span>
                </th>
                <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink">
                  {formatTemperature(row.median, units, { withUnit: true })}
                </td>
                <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                  {formatSpan(
                    row.low !== null && row.high !== null ? row.high - row.low : null,
                    units,
                  )}
                  <span className="text-ink-dim">
                    {" · "}
                    {formatTemperature(row.low, units, { digits: 0 })}–
                    {formatTemperature(row.high, units, { digits: 0 })}
                  </span>
                </td>
                <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-cold">
                  {row.rain === null ? (
                    "—"
                  ) : (
                    <>
                      {formatPercent(row.rain.probability * 100)}
                      <span className="text-ink-dim">
                        {" "}
                        ({row.rain.count} de {row.rain.total})
                      </span>
                    </>
                  )}
                </td>
                <td
                  className={`numeric whitespace-nowrap px-2 py-1 text-[11px] ${
                    row.heat !== null && row.heat.probability >= 0.5
                      ? "text-tone-warn"
                      : "text-ink-soft"
                  }`}
                >
                  {row.heat === null ? (
                    "—"
                  ) : (
                    <>
                      {formatPercent(row.heat.probability * 100)}
                      <span className="text-ink-dim">
                        {" "}
                        ({row.heat.count} de {row.heat.total})
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Caveat>
        Los conteos se hacen solo sobre los miembros que tienen dato en ese día, así
        que «12 de 30» y «12 de 28» no son lo mismo: el segundo caso significa que dos
        miembros no publicaron ese día. La probabilidad se calcula contando miembros,
        no con la fórmula de probabilidad de lluvia del pronóstico determinista: por
        eso puede no coincidir con el porcentaje del panel de 168 horas. La máxima
        mediana es el miembro que queda en medio de los 30, no el promedio.
      </Caveat>
    </>
  );
}
