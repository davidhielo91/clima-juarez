import { Badge, Caveat, DataState, EmptyNote, Panel, Row, RowList, toneText } from "@/components/ui/primitives";
import { ChartFrame, Trace } from "@/components/ui/charts";
import { vpdCategory } from "@/lib/derive/comfort";
import { mean } from "@/lib/derive/stats";
import { indexOfCurrentDay, indexOfCurrentHour } from "@/lib/format";
import { getForecast } from "@/lib/sources/forecast";
import type { ForecastBundle } from "@/lib/types";
import {
  formatNumber,
  formatSoilMoisture,
  formatTemperature,
  formatVpd,
  type UnitSystem,
} from "@/lib/units";

/**
 * El suelo: temperatura a cuatro profundidades, humedad en las cinco capas que
 * publica la API, y el balance de agua (evapotranspiración, evaporación y déficit de
 * presión de vapor).
 *
 * Esto es la parte del pronóstico que le sirve al campo del Valle de Juárez: la
 * humedad de 9 a 27 cm dice si el riego llegó a la raíz, y la temperatura de 6 cm
 * dice si una noche despejada de enero va a helar el suelo y quemar el cultivo
 * aunque el aire se quede en 3 °C.
 *
 * La humedad se publica como fracción volumétrica (m³ de agua por m³ de suelo) y se
 * muestra en porcentaje: `formatSoilMoisture` multiplica por 100.
 */

/** Ventana del trazo de temperatura del suelo. */
const SOIL_HOURS = 72;

/** Escala de las barras de humedad: 0.40 m³/m³ es suelo saturado en textura franca. */
const SATURATION = 0.4;

const SOIL_TEMPERATURES = [
  { key: "soil_temperature_0cm", label: "Superficie", hint: "0 cm · piel del suelo" },
  { key: "soil_temperature_6cm", label: "A 6 cm", hint: "semilla y raíz joven" },
  { key: "soil_temperature_18cm", label: "A 18 cm", hint: "raíz del cultivo" },
  { key: "soil_temperature_54cm", label: "A 54 cm", hint: "memoria térmica del suelo" },
] as const;

const SOIL_MOISTURE = [
  { key: "soil_moisture_0_to_1cm", label: "0–1 cm", hint: "crosta superficial, se seca en horas" },
  { key: "soil_moisture_1_to_3cm", label: "1–3 cm", hint: "germinación" },
  { key: "soil_moisture_3_to_9cm", label: "3–9 cm", hint: "raíz joven" },
  { key: "soil_moisture_9_to_27cm", label: "9–27 cm", hint: "zona de raíces: aquí se riega" },
  { key: "soil_moisture_27_to_81cm", label: "27–81 cm", hint: "reserva profunda" },
] as const;

function numbers(values: Array<string | number | null> | undefined): Array<number | null> {
  if (!Array.isArray(values)) return [];
  return values.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
  );
}

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

function lowestOf(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : Math.min(...known);
}

/**
 * Separación entre dos temperaturas: una **diferencia** no lleva el desfase de +32
 * al pasar a Fahrenheit, solo el factor 9/5.
 */
function formatSpan(celsius: number | null, units: UnitSystem): string {
  if (celsius === null || !Number.isFinite(celsius)) return "—";
  const converted = units.temperature === "f" ? celsius * 1.8 : celsius;
  return `${formatNumber(converted, 1)} ${units.temperature === "f" ? "°F" : "°C"}`;
}

export default async function SoilPanel({ units }: { units: UnitSystem }) {
  const result = await getForecast();
  const vpd = result.ok
    ? vpdCategory(
        numberAt(
          result.data.hourly,
          "vapour_pressure_deficit",
          indexOfCurrentHour(result.data.hourly.time),
        ),
      )
    : null;

  return (
    <Panel
      id="suelo"
      title="Suelo y agua"
      subtitle="Temperatura y humedad por profundidad, más el balance de agua del día."
      tone={vpd?.tone}
    >
      <DataState result={result} what="los datos del suelo">
        {(data) => <SoilBody forecast={data} units={units} />}
      </DataState>

      <Caveat>
        El modelo publica el suelo de su celda, que es un suelo promedio de la mancha
        de rejilla: no distingue tu parcela de riego del terreno de al lado, ni la
        textura arenosa de la arcillosa. Sirve para dos decisiones, y para las dos es
        el mejor dato disponible: riego (si la humedad de 9 a 27 cm no sube después de
        regar, el agua se quedó en la superficie y hay compactación) y heladas de suelo
        (una noche clara y seca de invierno puede llevar el suelo de 6 cm por debajo de
        0 °C y quemar el cultivo mientras el aire marca 3 °C: el aire frío pesa y se
        estanca, y el suelo irradia y se enfría). La evaporación es la que publica el
        modelo para la hora en curso, no un promedio del día, y los «días de reserva»
        son una estimación con una capa efectiva de 20 cm, no un balance hídrico
        completo: no descuentan la lluvia ni el riego que venga después.
      </Caveat>
    </Panel>
  );
}

function SoilBody({
  forecast,
  units,
}: {
  forecast: ForecastBundle;
  units: UnitSystem;
}) {
  const { hourly, daily } = forecast;
  const hourIndex = indexOfCurrentHour(hourly.time);
  const dayIndex = indexOfCurrentDay(daily.time);

  const temperature = SOIL_TEMPERATURES.map((spec) => ({
    spec,
    value: numberAt(hourly, spec.key, hourIndex),
  }));

  const moisture = SOIL_MOISTURE.map((spec) => ({
    spec,
    value: numberAt(hourly, spec.key, hourIndex),
  }));

  const surface = numberAt(hourly, "soil_temperature_0cm", hourIndex);
  const shallow = numberAt(hourly, "soil_temperature_6cm", hourIndex);
  const deep = numberAt(hourly, "soil_temperature_54cm", hourIndex);

  const soilSeries = numbers(hourly["soil_temperature_6cm"]).slice(
    hourIndex,
    hourIndex + SOIL_HOURS,
  );
  const soilTimes = hourly.time.slice(hourIndex, hourIndex + SOIL_HOURS);
  const soilMinimum = lowestOf(soilSeries);
  const soilMaximum = soilSeries.filter((value): value is number => value !== null);
  const vpd = vpdCategory(numberAt(hourly, "vapour_pressure_deficit", hourIndex));
  const et0Hour = numberAt(hourly, "et0_fao_evapotranspiration", hourIndex);
  const et0Day = numberAt(daily, "et0_fao_evapotranspiration", dayIndex);
  const evaporation = numberAt(hourly, "evapotranspiration", hourIndex);

  const frostTone = soilMinimum === null
    ? undefined
    : soilMinimum < 0
      ? "danger"
      : soilMinimum < 2
        ? "caution"
        : "good";

  /**
   * Comparación entre la capa superficial y la zona de raíces: es la lectura que
   * dice si el riego penetró. Solo se afirma algo si las dos capas traen dato.
   */
  const shallowMoisture = moisture[1]?.value ?? null;
  const rootMoisture = moisture[3]?.value ?? null;
  const infiltration =
    shallowMoisture === null || rootMoisture === null
      ? null
      : rootMoisture - shallowMoisture;

  const warmest = temperature
    .map((item) => item.value)
    .filter((value): value is number => value !== null);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-10">
        <div>
          <h3 className="eyebrow mb-1 text-[11px] text-ink-soft">
            Temperatura del suelo
          </h3>
          <RowList>
            {temperature.map((item) => (
              <Row
                key={item.spec.key}
                label={item.spec.label}
                hint={item.spec.hint}
                value={formatTemperature(item.value, units, {
                  digits: 1,
                  withUnit: true,
                })}
              />
            ))}
          </RowList>

          <RowList>
            <Row
              label="Gradiente superficie a 54 cm"
              hint="si es negativo, el suelo se enfría hacia abajo"
              value={
                surface === null || deep === null
                  ? "—"
                  : formatSpan(surface - deep, units)
              }
            />
            <Row
              label={`Mínima a 6 cm en ${SOIL_HOURS} h`}
              hint="helada de suelo"
              value={formatTemperature(soilMinimum, units, {
                digits: 1,
                withUnit: true,
              })}
              tone={frostTone}
            />
            <Row
              label={`Máxima a 6 cm en ${SOIL_HOURS} h`}
              value={formatTemperature(
                soilMaximum.length === 0 ? null : Math.max(...soilMaximum),
                units,
                { digits: 1, withUnit: true },
              )}
            />
            <Row
              label="Rango de la temperatura del suelo"
              hint={`${warmest.length} de ${temperature.length} capas con dato`}
              value={
                warmest.length === 0
                  ? "—"
                  : formatSpan(Math.max(...warmest) - Math.min(...warmest), units)
              }
            />
          </RowList>
        </div>

        <div>
          <h3 className="eyebrow mb-1 text-[11px] text-ink-soft">
            Humedad volumétrica
          </h3>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Humedad volumétrica del suelo en las cinco capas que publica el modelo,
              con su rango de profundidad real
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="eyebrow border-b border-rule px-1.5 py-1 text-[10px] font-semibold text-ink-dim"
                >
                  Profundidad
                </th>
                <th
                  scope="col"
                  className="eyebrow border-b border-rule px-1.5 py-1 text-left text-[10px] font-semibold text-ink-dim"
                >
                  Humedad
                </th>
                <th
                  scope="col"
                  className="eyebrow border-b border-rule px-1.5 py-1 text-left text-[10px] font-semibold text-ink-dim"
                >
                  Frente a saturación
                </th>
              </tr>
            </thead>
            <tbody>
              {moisture.map((item) => (
                <tr key={item.spec.key} className="border-b border-rule/30">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-1.5 py-1.5 text-left text-[11px] font-normal text-ink-soft"
                  >
                    <span className="numeric block text-ink">{item.spec.label}</span>
                    <span className="block text-[10px] text-ink-dim">{item.spec.hint}</span>
                  </th>
                  <td className="numeric whitespace-nowrap px-1.5 py-1.5 text-[11px] text-ink">
                    {formatSoilMoisture(item.value)}
                  </td>
                  <td className="px-1.5 py-1.5">
                    <span
                      className="relative block h-1.5 w-full min-w-[70px] bg-night-800"
                      aria-hidden="true"
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-cold-deep"
                        style={{
                          width:
                            item.value === null
                              ? "0%"
                              : `${Math.min(100, (item.value / SATURATION) * 100)}%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <RowList>
            <Row
              label="Agua en la zona de raíces"
              hint="9–27 cm"
              value={formatSoilMoisture(rootMoisture)}
            />
            <Row
              label="Diferencia raíz menos superficie"
              hint="positivo: el riego penetró"
              value={
                infiltration === null
                  ? "—"
                  : formatSoilMoisture(infiltration)
              }
              tone={
                infiltration === null
                  ? undefined
                  : infiltration > 0.02
                    ? "good"
                    : infiltration < -0.02
                      ? "caution"
                      : "info"
              }
            />
            <Row
              label="Humedad media del perfil"
              hint={`${SOIL_MOISTURE.length} capas`}
              value={formatSoilMoisture(mean(moisture.map((item) => item.value)))}
            />
          </RowList>
        </div>
      </div>

      <h3 className="eyebrow mt-5 mb-1 text-[11px] text-ink-soft">
        Balance de agua
      </h3>
      <RowList>
        <Row
          label="Evapotranspiración de referencia"
          hint="ET0 · hora en curso"
          value={`${formatNumber(et0Hour, 2)} mm`}
        />
        <Row
          label="ET0 acumulada de hoy"
          hint="lo que pide el cultivo en el día"
          value={`${formatNumber(et0Day, 2)} mm`}
        />
        <Row
          label="Evaporación"
          hint="del suelo desnudo, hora en curso"
          value={`${formatNumber(evaporation, 2)} mm`}
        />
        <Row
          label="Déficit de presión de vapor"
          hint="sequía atmosférica"
          value={
            <span className={toneText(vpd.tone)}>
              {formatVpd(numberAt(hourly, "vapour_pressure_deficit", hourIndex))} ·{" "}
              {vpd.label}
            </span>
          }
        />
        <Row
          label="Días de reserva con la ET0 de hoy"
          hint="estimación gruesa"
          value={reserveDays(rootMoisture, et0Day)}
        />
      </RowList>

      <p className="mt-2 max-w-prose text-[11px] leading-snug text-ink-soft">
        {vpd.advice}
      </p>

      {frostTone === "danger" || frostTone === "caution" ? (
        <p className="mt-2">
          <Badge tone={frostTone}>
            helada de suelo en las próximas {SOIL_HOURS} h
          </Badge>{" "}
          <span className="text-[11px] text-ink-soft">
            La temperatura a 6 cm baja a{" "}
            {formatTemperature(soilMinimum, units, { digits: 1, withUnit: true })}.
            Cubre el suelo o riega al atardecer: el agua libera calor al congelarse.
          </span>
        </p>
      ) : null}

      <div className="mt-4">
        {soilTimes.length === 0 ? (
          <EmptyNote>
            El modelo no publicó temperatura del suelo para las próximas horas.
          </EmptyNote>
        ) : (
          <ChartFrame
            caption={`Temperatura del suelo a 6 cm en las próximas ${SOIL_HOURS} horas. Es la profundidad donde germina la semilla y donde se mide la helada de suelo.`}
            scaleLeft={formatTemperature(
              soilMaximum.length === 0 ? null : Math.max(...soilMaximum),
              units,
              { withUnit: true },
            )}
            scaleRight={formatTemperature(soilMinimum, units, { withUnit: true })}
          >
            <Trace
              values={soilSeries}
              markerIndex={0}
              height={120}
              showZeroLine
              stroke="var(--color-ember)"
              ariaLabel={`Temperatura del suelo a 6 centímetros hora por hora durante las próximas ${SOIL_HOURS} horas`}
            />
          </ChartFrame>
        )}
      </div>

      {shallow !== null && surface !== null && shallow > surface + 0.5 ? (
        <p className="mt-2 text-[11px] text-ink-dim">
          El suelo a 6 cm está más caliente que la superficie: el sol calienta la capa
          de siembra antes que la piel del suelo, que pierde calor por radiación.
        </p>
      ) : null}
    </>
  );
}

/**
 * Reserva de agua en días, a partir de la humedad de la zona de raíces y la ET0 del
 * día. Supone una profundidad efectiva de 20 cm sobre la capa de 9 a 27 cm, que es
 * la hipótesis más simple defendible: agua disponible = 0.2 m × fracción volumétrica,
 * dividida entre lo que el cultivo pide por día.
 */
function reserveDays(rootMoisture: number | null, et0Day: number | null): string {
  if (rootMoisture === null || et0Day === null || et0Day <= 0) return "—";
  const availableMm = rootMoisture * 200;
  const days = availableMm / et0Day;
  return `${formatNumber(days, 1)} días`;
}
