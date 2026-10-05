import {
  Badge,
  Caveat,
  DataState,
  EmptyNote,
  Panel,
  Row,
  RowList,
} from "@/components/ui/primitives";
import { dailyExtremes, mean } from "@/lib/derive/stats";
import { formatDayMonth, formatWeekdayShort, indexOfCurrentDay } from "@/lib/format";
import { getModels } from "@/lib/sources/models";
import type { ModelSeries } from "@/lib/types";
import {
  formatNumber,
  formatPrecipitation,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * Comparación de los seis modelos globales.
 *
 * Ningún modelo es "el bueno": cada uno es una corrida independiente de una
 * agencia distinta sobre la misma celda de rejilla. Ponerlos en la misma tabla no
 * sirve para elegir uno, sino para ver **cuánto se separan**: cuando los seis
 * coinciden en la máxima del jueves, ese dato es sólido; cuando el rango pasa de
 * 3 °C, el día está en disputa y quien planee algo al aire libre debería mirar el
 * panel de ensamble antes de fiarse.
 *
 * La precipitación de cada modelo se acumula por día sumando sus horas, porque la
 * API la publica por hora y en el desierto un chubasco de monzón cabe en dos horas.
 */

/** Días completos que se comparan: hoy queda fuera porque está a medias. */
const WINDOW_DAYS = 7;

/** A partir de este rango entre máximas se avisa de que los modelos no coinciden. */
const DISAGREEMENT_LIMIT = 3;

interface DaySummary {
  date: string;
  max: number | null;
  min: number | null;
  precipitation: number | null;
}

interface ModelRanking {
  model: ModelSeries;
  meanMax: number | null;
  totalRain: number | null;
}

/** Lluvia acumulada por fecha; un día sin ninguna hora con dato no entra. */
function sumsByDay(time: string[], values: Array<number | null>): Map<string, number> {
  const totals = new Map<string, number>();
  time.forEach((stamp, index) => {
    const value = values[index];
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const date = stamp.slice(0, 10);
    totals.set(date, (totals.get(date) ?? 0) + value);
  });
  return totals;
}

/** Extremos y lluvia de un modelo, indexados por fecha. */
function summarize(model: ModelSeries): Map<string, DaySummary> {
  const extremes = dailyExtremes(model.time, model.temperature);
  const rain = sumsByDay(model.time, model.precipitation);
  const byDate = new Map<string, DaySummary>();

  for (const day of extremes) {
    byDate.set(day.date, {
      date: day.date,
      max: day.max,
      min: day.min,
      precipitation: rain.get(day.date) ?? null,
    });
  }
  return byDate;
}

function sumOf(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return null;
  return known.reduce((total, value) => total + value, 0);
}

/**
 * Separación entre dos temperaturas.
 *
 * Una **diferencia** de temperatura no lleva el desfase de +32 al pasar a
 * Fahrenheit, solo el factor 9/5; por eso aquí no se usa `formatTemperature`, que
 * sumaría 32 grados a un rango.
 */
function formatSpan(celsius: number | null, units: UnitSystem): string {
  if (celsius === null || !Number.isFinite(celsius)) return "—";
  const converted = units.temperature === "f" ? celsius * 1.8 : celsius;
  return `${formatNumber(converted, 1)} ${units.temperature === "f" ? "°F" : "°C"}`;
}

export default async function ModelsPanel({ units }: { units: UnitSystem }) {
  const result = await getModels();

  return (
    <Panel
      id="modelos"
      title="Seis modelos, siete días"
      subtitle="Máxima, mínima y lluvia de cada modelo global, y cuánto se separan entre ellos."
    >
      <DataState result={result} what="la comparación de modelos">
        {(data) => <ModelsTable models={data.models} units={units} />}
      </DataState>

      <Caveat>
        Los seis modelos son corridas independientes sobre la misma celda, no seis
        mediciones: cuando coinciden, el pronóstico es sólido, y cuando el rango de
        las máximas pasa de {DISAGREEMENT_LIMIT} °C el día está en disputa. El rango
        se calcula solo con las máximas, así que no dice nada de la mínima ni de la
        hora a la que ocurre cada una. En verano la lluvia de monzón es convectiva y
        cada modelo la coloca en su propia celda: la columna de lluvia sirve para ver
        quién espera agua, no cuánta va a caer en tu calle. Las rejillas van de 9 a
        25 km, más gruesas que una tormenta.
      </Caveat>
    </Panel>
  );
}

function ModelsTable({
  models,
  units,
}: {
  models: ModelSeries[];
  units: UnitSystem;
}) {
  if (models.length === 0) {
    return <EmptyNote>La fuente respondió sin ninguna serie de modelo.</EmptyNote>;
  }

  const summaries = models.map((model) => ({ model, days: summarize(model) }));
  const dayKeys = [...summaries[0].days.keys()];

  if (dayKeys.length === 0) {
    return (
      <EmptyNote>
        Ningún modelo publicó temperatura horaria para estos días: no hay nada que
        comparar.
      </EmptyNote>
    );
  }

  // El primer día del pronóstico está a medias, así que la tabla empieza mañana.
  const todayIndex = indexOfCurrentDay(dayKeys);
  const window = dayKeys.slice(todayIndex + 1, todayIndex + 1 + WINDOW_DAYS);

  if (window.length === 0) {
    return (
      <EmptyNote>
        El pronóstico por modelos no alcanza un día completo más allá de hoy.
      </EmptyNote>
    );
  }

  const rows = window.map((date) => {
    const entries = summaries.map(({ model, days }) => ({
      model,
      day: days.get(date) ?? null,
    }));
    const maxima = entries
      .map((entry) => entry.day?.max ?? null)
      .filter((value): value is number => value !== null);

    return {
      date,
      entries,
      range: maxima.length >= 2 ? Math.max(...maxima) - Math.min(...maxima) : null,
    };
  });

  const ranking: ModelRanking[] = summaries.map(({ model, days }) => ({
    model,
    meanMax: mean(window.map((date) => days.get(date)?.max ?? null)),
    totalRain: sumOf(window.map((date) => days.get(date)?.precipitation ?? null)),
  }));

  const rankedByHeat = ranking
    .filter((item): item is ModelRanking & { meanMax: number } => item.meanMax !== null)
    .sort((a, b) => b.meanMax - a.meanMax);
  const rankedByRain = ranking
    .filter((item): item is ModelRanking & { totalRain: number } => item.totalRain !== null)
    .sort((a, b) => b.totalRain - a.totalRain);

  const ranges = rows
    .map((row) => row.range)
    .filter((value): value is number => value !== null);
  const meanRange = mean(ranges);
  const widest = rows.reduce<{ date: string; range: number } | null>(
    (best, row) =>
      row.range !== null && (best === null || row.range > best.range)
        ? { date: row.date, range: row.range }
        : best,
    null,
  );

  return (
    <>
      <p className="mb-2 text-[11px] text-ink-dim">
        Máxima y mínima en {units.temperature === "f" ? "°F" : "°C"}; lluvia
        acumulada en {units.precipitation === "in" ? "in" : "mm"}.
      </p>

      <div className="scroll-thin overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Máxima, mínima y lluvia acumulada de los próximos {rows.length} días según
            cada modelo global, con el rango de las máximas
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="eyebrow border-b border-rule px-2 py-1.5 text-[10px] font-semibold text-ink-dim"
              >
                Día
              </th>
              {models.map((model) => (
                <th
                  key={model.id}
                  scope="col"
                  className="eyebrow whitespace-nowrap border-b border-rule px-2 py-1.5 text-left text-[10px] font-semibold text-ink-dim"
                >
                  {model.name}
                  <span className="block text-[9px] font-normal normal-case tracking-normal text-ink-dim/80">
                    {model.origin}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="eyebrow whitespace-nowrap border-b border-rule px-2 py-1.5 text-left text-[10px] font-semibold text-ink-dim"
              >
                Desacuerdo
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const disputed = row.range !== null && row.range > DISAGREEMENT_LIMIT;
              return (
                <tr key={row.date} className="border-b border-rule/30">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-normal text-ink-soft"
                  >
                    <span className="block text-ink">{formatWeekdayShort(row.date)}</span>
                    <span className="numeric block text-[10px] text-ink-dim">
                      {formatDayMonth(row.date)}
                    </span>
                  </th>
                  {row.entries.map((entry) => (
                    <td
                      key={entry.model.id}
                      className="numeric whitespace-nowrap px-2 py-1.5 text-[11px]"
                    >
                      <span className="block text-ink">
                        {formatTemperature(entry.day?.max ?? null, units)}
                        <span className="text-ink-dim">
                          {" / "}
                          {formatTemperature(entry.day?.min ?? null, units)}
                        </span>
                      </span>
                      <span className="block text-[10px] text-cold">
                        {formatPrecipitation(entry.day?.precipitation ?? null, units)}
                      </span>
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1.5 text-[11px]">
                    <span
                      className={`numeric ${disputed ? "text-tone-warn" : "text-ink-soft"}`}
                    >
                      {formatSpan(row.range, units)}
                    </span>
                    {disputed ? (
                      <span className="mt-0.5 block text-[10px] text-tone-warn">
                        los modelos no se ponen de acuerdo
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RowList>
        <Row
          label="Desacuerdo medio en las máximas"
          hint={`${rows.length} días`}
          value={formatSpan(meanRange, units)}
          tone={
            meanRange !== null && meanRange > DISAGREEMENT_LIMIT ? "warn" : undefined
          }
        />
        <Row
          label="Día más disputado"
          value={
            widest === null
              ? "—"
              : `${formatWeekdayShort(widest.date)} · ${formatSpan(widest.range, units)}`
          }
        />
        <Row
          label="Modelo más cálido"
          hint="promedio de máximas"
          value={
            rankedByHeat.length === 0 ? (
              "—"
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {rankedByHeat[0].model.name}
                <Badge tone="warn">{formatSpan(rankedByHeat[0].meanMax, units)}</Badge>
              </span>
            )
          }
        />
        <Row
          label="Modelo más frío"
          hint="promedio de máximas"
          value={
            rankedByHeat.length === 0 ? (
              "—"
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {rankedByHeat[rankedByHeat.length - 1].model.name}
                <Badge tone="info">
                  {formatSpan(rankedByHeat[rankedByHeat.length - 1].meanMax, units)}
                </Badge>
              </span>
            )
          }
        />
        <Row
          label="Modelo que más lluvia espera"
          value={
            rankedByRain.length === 0
              ? "—"
              : `${rankedByRain[0].model.name} · ${formatPrecipitation(rankedByRain[0].totalRain, units, { withUnit: true })}`
          }
        />
        <Row
          label="Modelo que menos lluvia espera"
          value={
            rankedByRain.length === 0
              ? "—"
              : `${rankedByRain[rankedByRain.length - 1].model.name} · ${formatPrecipitation(
                  rankedByRain[rankedByRain.length - 1].totalRain,
                  units,
                  { withUnit: true },
                )}`
          }
        />
      </RowList>
    </>
  );
}
