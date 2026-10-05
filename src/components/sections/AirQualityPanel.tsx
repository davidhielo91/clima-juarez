import {
  BigStat,
  Caveat,
  DataState,
  EmptyNote,
  Panel,
  Row,
  RowList,
  toneText,
} from "@/components/ui/primitives";
import { ChartFrame, Trace } from "@/components/ui/charts";
import { dominantPollutant, europeanAqiCategory, usAqiCategory } from "@/lib/derive/aqi";
import { mean } from "@/lib/derive/stats";
import { formatTime, indexOfCurrentHour } from "@/lib/format";
import { getAirQuality } from "@/lib/sources/airQuality";
import type { AirQualityBundle } from "@/lib/types";
import { formatConcentration, formatIndex, formatNumber, type UnitSystem } from "@/lib/units";

/**
 * Calidad del aire: los ocho contaminantes que la API publica para esta región, con
 * los dos índices oficiales y una tira horaria de partículas.
 *
 * Aquí hay que ser muy explícito con dos cosas:
 *  1. La celda de calidad del aire es de unos 11 km (31.700, −106.500), mucho más
 *     gruesa que la del pronóstico. El valor es de la cuenca de Juárez y El Paso,
 *     no de tu colonia.
 *  2. Los dos índices no son intercambiables: el estadounidense (EPA) y el europeo
 *     (EAQI) usan escalas distintas y el mismo aire puede salir "moderada" en uno y
 *     "mala" en el otro. Se muestran los dos, cada uno con su categoría.
 *
 * `ammonia` llega `null` en toda la región —está comprobado contra la API— así que
 * el contaminante no se lista: pintar "0 µg/m³" afirmaría una medición que no existe.
 */

const WINDOW_HOURS = 24;

interface PollutantSpec {
  key: string;
  label: string;
  hint: string;
  digits: number;
  /** `μg/m³` para concentraciones; adimensional para el espesor óptico. */
  unit: "μg/m³" | "adimensional";
}

/** Orden de la tabla: primero el material particulado, que es el problema local. */
const POLLUTANTS: readonly PollutantSpec[] = [
  { key: "pm10", label: "PM10", hint: "partículas menores de 10 µm", digits: 1, unit: "μg/m³" },
  { key: "pm2_5", label: "PM2.5", hint: "partículas menores de 2.5 µm", digits: 1, unit: "μg/m³" },
  { key: "carbon_monoxide", label: "Monóxido de carbono", hint: "CO", digits: 0, unit: "μg/m³" },
  { key: "nitrogen_dioxide", label: "Dióxido de nitrógeno", hint: "NO₂", digits: 1, unit: "μg/m³" },
  { key: "sulphur_dioxide", label: "Dióxido de azufre", hint: "SO₂", digits: 1, unit: "μg/m³" },
  { key: "ozone", label: "Ozono", hint: "O₃", digits: 0, unit: "μg/m³" },
  { key: "dust", label: "Polvo", hint: "polvo sahariano y de tolvanera", digits: 1, unit: "μg/m³" },
  {
    key: "aerosol_optical_depth",
    label: "Espesor óptico de aerosoles",
    hint: "cuánta luz bloquea la columna de aire",
    digits: 2,
    unit: "adimensional",
  },
];

/** Claves que entran al concurso de contaminante dominante (solo concentraciones). */
const DOMINANT_KEYS = [
  "pm10",
  "pm2_5",
  "carbon_monoxide",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "dust",
] as const;

function numbers(values: Array<string | number | null> | undefined): Array<number | null> {
  if (!Array.isArray(values)) return [];
  return values.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
  );
}

function formatPollutant(value: number | null, spec: PollutantSpec): string {
  if (spec.unit === "adimensional") return formatNumber(value, spec.digits);
  return formatConcentration(value, spec.digits);
}

function peakOf(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : Math.max(...known);
}

/** Máximo de la serie con la posición donde ocurre, para poder decir la hora. */
function peakEntry(
  values: Array<number | null>,
): { value: number; index: number } | null {
  let best: { value: number; index: number } | null = null;
  values.forEach((value, index) => {
    if (value === null) return;
    if (best === null || value > best.value) best = { value, index };
  });
  return best;
}

export default async function AirQualityPanel({ units }: { units: UnitSystem }) {
  const result = await getAirQuality();
  const headline = result.ok ? usAqiCategory(result.data.current["us_aqi"]) : null;

  return (
    <Panel
      id="aire"
      title="Calidad del aire"
      subtitle="Contaminantes e índices de la cuenca de Juárez y El Paso."
      tone={headline?.tone}
    >
      <DataState result={result} what="la calidad del aire">
        {(data) => <AirBody air={data} units={units} />}
      </DataState>

      <Caveat>
        El dato es regional, no de tu colonia: la calidad del aire se publica en una
        celda de unos 11 km centrada en 31.700, −106.500, y la cuenca atmosférica es
        compartida con El Paso, así que el humo de un incendio o el polvo de una
        tolvanera al otro lado del río aparecen en el mismo número. Los dos índices
        no son comparables entre sí: el estadounidense (0–500) y el europeo (0–100+)
        tienen escalas y contaminantes de referencia distintos, y por eso el mismo
        aire puede estar «moderado» en uno y «malo» en el otro. El contaminante
        dominante se calcula comparando µg/m³ en crudo, lo que siempre favorece al
        monóxido de carbono; la definición oficial usa subíndices por contaminante,
        así que tómalo como «qué compuesto trae el número más alto», no como un
        diagnóstico sanitario.
      </Caveat>
    </Panel>
  );
}

function AirBody({ air, units }: { air: AirQualityBundle; units: UnitSystem }) {
  const { current, hourly } = air;
  const us = usAqiCategory(current["us_aqi"]);
  const european = europeanAqiCategory(current["european_aqi"]);

  const dominant = dominantPollutant(
    Object.fromEntries(DOMINANT_KEYS.map((key) => [key, current[key] ?? null])),
  );

  const start = indexOfCurrentHour(hourly.time);
  const window = hourly.time.slice(start, start + WINDOW_HOURS);
  const pm25 = numbers(hourly["pm2_5"]).slice(start, start + WINDOW_HOURS);
  const pm10 = numbers(hourly["pm10"]).slice(start, start + WINDOW_HOURS);
  const pm25Peak = peakEntry(pm25);
  const pm10Peak = peakEntry(pm10);

  if (window.length === 0) {
    return <EmptyNote>La fuente no publicó horas de calidad del aire.</EmptyNote>;
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <BigStat
            value={formatIndex(current["us_aqi"])}
            unit="USAQI"
            label="Índice estadounidense (EPA)"
            tone={us.tone}
          />
          <p className={`mt-2 text-[12px] ${toneText(us.tone)}`}>{us.label}</p>
          <p className="mt-1 max-w-prose text-[11px] leading-snug text-ink-soft">
            {us.advice}
          </p>
        </div>

        <div>
          <BigStat
            value={formatIndex(current["european_aqi"])}
            unit="EAQI"
            label="Índice europeo"
            tone={european.tone}
          />
          <p className={`mt-2 text-[12px] ${toneText(european.tone)}`}>
            {european.label}
          </p>
          <p className="mt-1 max-w-prose text-[11px] leading-snug text-ink-soft">
            {european.advice}
          </p>
        </div>
      </div>

      <RowList>
        <Row
          label="Contaminante dominante"
          hint="concentración más alta"
          value={dominant === null ? "Sin dato" : dominant.label}
        />
        <Row
          label="PM2.5 ahora"
          hint={dominant?.key === "pm2_5" ? "es el dominante" : undefined}
          value={formatConcentration(current["pm2_5"], 1)}
        />
        <Row label="PM10 ahora" value={formatConcentration(current["pm10"], 1)} />
        <Row
          label="PM2.5 más alto en 24 h"
          hint={
            pm25Peak === null
              ? undefined
              : `a las ${formatTime(window[pm25Peak.index] ?? window[0])}`
          }
          value={formatConcentration(pm25Peak?.value ?? null, 1)}
          tone={(() => {
            if (pm25Peak === null) return undefined;
            return pm25Peak.value > 35 ? "warn" : pm25Peak.value > 15 ? "caution" : "good";
          })()}
        />
        <Row
          label="PM10 más alto en 24 h"
          hint={
            pm10Peak === null
              ? undefined
              : `a las ${formatTime(window[pm10Peak.index] ?? window[0])}`
          }
          value={formatConcentration(pm10Peak?.value ?? null, 1)}
        />
        <Row
          label="Índice UV de la celda de aire"
          hint="no es el del pronóstico"
          value={formatNumber(current["uv_index"], 1)}
        />
      </RowList>

      <div className="mt-5">
        <ChartFrame
          caption="PM2.5 hora por hora en las próximas 24 horas. Es el contaminante que más afecta a la salud en la frontera."
          scaleLeft={formatConcentration(peakOf(pm25), 0)}
          scaleRight={formatConcentration(0, 0)}
        >
          <Trace
            values={pm25}
            markerIndex={0}
            height={110}
            showZeroLine
            bandFill="var(--color-cold)"
            ariaLabel="Concentración de PM2.5 hora por hora durante las próximas 24 horas"
          />
        </ChartFrame>
      </div>

      <div className="mt-4">
        <ChartFrame
          caption="PM10: el polvo de tolvanera y de las obras. En primavera es el contaminante que dispara los avisos."
          scaleLeft={formatConcentration(peakOf(pm10), 0)}
          scaleRight={formatConcentration(0, 0)}
        >
          <Trace
            values={pm10}
            height={80}
            stroke="var(--color-amber)"
            showZeroLine
            ariaLabel="Concentración de PM10 hora por hora durante las próximas 24 horas"
          />
        </ChartFrame>
      </div>

      <h3 className="eyebrow mt-5 text-[11px] text-ink-soft">
        Contaminantes · ahora, máximo y promedio de 24 horas
      </h3>
      <div className="scroll-thin mt-1 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Contaminantes medidos por el modelo de calidad del aire: valor actual,
            máximo y promedio de las próximas 24 horas
          </caption>
          <thead>
            <tr>
              {["Contaminante", "Ahora", "Máximo 24 h", "Promedio 24 h"].map((column) => (
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
            {POLLUTANTS.map((spec) => {
              const series = numbers(hourly[spec.key]).slice(start, start + WINDOW_HOURS);
              const isDominant = dominant?.key === spec.key;
              return (
                <tr key={spec.key} className="border-b border-rule/30">
                  <th
                    scope="row"
                    className="px-2 py-1 text-left text-[11px] font-normal text-ink-soft"
                  >
                    <span className={isDominant ? "text-tone-warn" : "text-ink"}>
                      {spec.label}
                    </span>
                    <span className="numeric ml-1.5 text-[10px] text-ink-dim">
                      {spec.unit === "adimensional" ? "" : "µg/m³"}
                    </span>
                    <span className="block text-[10px] text-ink-dim">{spec.hint}</span>
                  </th>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink">
                    {formatPollutant(current[spec.key] ?? null, spec)}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {formatPollutant(peakOf(series), spec)}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {formatPollutant(mean(series), spec)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-ink-dim">
        El amoníaco no aparece en la tabla porque la fuente lo devuelve nulo en toda la
        región: no hay medición que mostrar. Las concentraciones van siempre en µg/m³ y
        el espesor óptico es adimensional, así que el conmutador de{" "}
        {units.temperature === "f" ? "Fahrenheit" : "Celsius"} no cambia ninguna de
        estas cifras.
      </p>

      <Caveat>
        La celda de este modelo mide unos 11 km de lado, así que un incendio de
        pastizal a diez cuadras de tu casa y otro al otro lado de la ciudad caen en el
        mismo píxel. El promedio de 24 horas se calcula solo con las horas que traen
        dato; si la serie viene corta, el promedio es de menos horas y así se reporta
        el conteo en la tira de arriba. La calidad del aire no se puede leer como un
        pronóstico del tiempo: depende del tráfico, del viento y de los incendios del
        día.
      </Caveat>
    </>
  );
}
