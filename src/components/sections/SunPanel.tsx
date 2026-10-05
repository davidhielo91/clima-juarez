import { Caveat, DataState, EmptyNote, Panel, Row, RowList, toneText } from "@/components/ui/primitives";
import { ChartFrame, MoonDisk, Trace } from "@/components/ui/charts";
import { moonPhase, sunPosition, SYNODIC_MONTH_DAYS } from "@/lib/derive/sun";
import { uvCategory } from "@/lib/derive/uv";
import { compassLongLabel, compassPoint } from "@/lib/derive/wind";
import {
  formatDayMonth,
  formatDuration,
  formatTime,
  formatWeekdayShort,
  indexOfCurrentDay,
  indexOfCurrentHour,
  nowInJuarez,
} from "@/lib/format";
import { getForecast } from "@/lib/sources/forecast";
import type { ForecastBundle } from "@/lib/types";
import {
  formatDistance,
  formatNumber,
  formatPercent,
  formatRadiation,
  formatSolarDuration,
  type UnitSystem,
} from "@/lib/units";

/**
 * El sol: cuándo sale, cuándo se mete, cuánto dura el día y cuánta energía llega.
 *
 * En una ciudad a 1 130 m sobre el nivel del mar y con 300 días de sol al año, la
 * radiación no es un dato decorativo: explica por qué la piel se quema tan rápido,
 * por qué el asfalto se agrieta y cuánta agua va a pedir el suelo. Por eso el panel
 * separa las seis formas en que la API publica la radiación, que no son sinónimos.
 *
 * La posición del sol y la fase lunar se calculan en el servidor con las fórmulas
 * de `src/lib/derive/sun.ts`; no vienen de la API.
 */

/** Ventana del trazo de radiación: dos días. */
const RADIATION_HOURS = 48;

/** Días de la tabla de salidas y puestas. */
const TABLE_DAYS = 7;

function numbers(values: Array<string | number | null> | undefined): Array<number | null> {
  if (!Array.isArray(values)) return [];
  return values.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
  );
}

function textAt(
  block: Record<string, Array<string | number | null>>,
  key: string,
  index: number,
): string | null {
  const series = block[key];
  if (!Array.isArray(series)) return null;
  const value = series[index];
  return typeof value === "string" ? value : null;
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

function peakOf(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : Math.max(...known);
}

/**
 * Hora formateada, con guion si no hay dato. `formatTime` no acepta una cadena
 * vacía —`parseWallClock("")` produce una fecha inválida y `Intl` lanza— así que el
 * hueco se resuelve antes de llamarla.
 */
function safeTime(value: string | null): string {
  return value === null || value === "" ? "—" : formatTime(value);
}

export default async function SunPanel({ units }: { units: UnitSystem }) {
  const result = await getForecast();
  const uvMaxToday = result.ok
    ? numberAt(result.data.daily, "uv_index_max", indexOfCurrentDay(result.data.daily.time))
    : null;
  const uv = uvCategory(uvMaxToday);

  return (
    <Panel
      id="sol"
      title="Sol, radiación y luna"
      subtitle="Salida, puesta, duración del día, energía que llega y fase lunar."
      tone={result.ok ? uv.tone : undefined}
    >
      <DataState result={result} what="el pronóstico del sol">
        {(data) => <SunBody forecast={data} units={units} />}
      </DataState>

      <Caveat>
        Las horas de salida y puesta son geométricas para el centro de la celda del
        modelo y suponen un horizonte plano: al poniente de la ciudad está la Sierra de
        Juárez, así que en la práctica el sol desaparece antes de la hora que dice la
        tabla, sobre todo en diciembre. Las «horas de sol efectivas» son las que pasan
        de 120 W/m² de radiación directa, que es la definición meteorológica estándar;
        un día con nubes altas puede tener el cielo cubierto y aun así contar varias
        horas de sol efectivas. La radiación es la que llega a una superficie
        horizontal en el punto de la rejilla, no la que recibe un panel inclinado ni un
        techo con sombra.
      </Caveat>
    </Panel>
  );
}

function SunBody({
  forecast,
  units,
}: {
  forecast: ForecastBundle;
  units: UnitSystem;
}) {
  const { daily, hourly, place } = forecast;
  const dayIndex = indexOfCurrentDay(daily.time);
  const hourIndex = indexOfCurrentHour(hourly.time);
  const now = nowInJuarez();

  const moon = moonPhase(now);
  const sun = sunPosition(now, place.latitude, place.longitude);

  const sunrise = textAt(daily, "sunrise", dayIndex);
  const sunset = textAt(daily, "sunset", dayIndex);
  const uvMax = numberAt(daily, "uv_index_max", dayIndex);
  const uv = uvCategory(uvMax);

  const radiationKeys = [
    { key: "shortwave_radiation", label: "Global", hint: "horizontal, sol más cielo" },
    { key: "direct_radiation", label: "Directa", hint: "la que viene del disco solar" },
    { key: "diffuse_radiation", label: "Difusa", hint: "la que reparte el cielo" },
    { key: "direct_normal_irradiance", label: "Directa normal", hint: "perpendicular al sol, para paneles" },
    { key: "global_tilted_irradiance", label: "Inclinada", hint: "sobre plano a 37° al sur" },
    { key: "terrestrial_radiation", label: "Terrestre", hint: "la que llegaría sin atmósfera" },
  ] as const;

  const global = numberAt(hourly, "shortwave_radiation", hourIndex);
  const direct = numberAt(hourly, "direct_radiation", hourIndex);
  const diffuse = numberAt(hourly, "diffuse_radiation", hourIndex);

  const radiationSeries = numbers(hourly["shortwave_radiation"]).slice(
    hourIndex,
    hourIndex + RADIATION_HOURS,
  );
  const radiationTimes = hourly.time.slice(hourIndex, hourIndex + RADIATION_HOURS);
  const radiationPeak = peakOf(radiationSeries);

  const share = (part: number | null): string => {
    if (part === null || global === null || global <= 0) return "—";
    return formatPercent((part / global) * 100);
  };

  const windowDays = daily.time.slice(dayIndex, dayIndex + TABLE_DAYS);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:gap-10">
        <div>
          <RowList>
            <Row
              label="Amanece"
              hint="hora de Ciudad Juárez"
              value={safeTime(sunrise)}
            />
            <Row label="Anochece" value={safeTime(sunset)} />
            <Row
              label="Duración del día"
              hint={formatSolarDuration(numberAt(daily, "daylight_duration", dayIndex))}
              value={formatDuration(numberAt(daily, "daylight_duration", dayIndex))}
            />
            <Row
              label="Horas de sol efectivas"
              hint="radiación directa > 120 W/m²"
              value={formatDuration(numberAt(daily, "sunshine_duration", dayIndex))}
            />
            <Row
              label="Índice UV máximo de hoy"
              value={
                <span className={toneText(uv.tone)}>
                  {formatNumber(uvMax, 1)} · {uv.label}
                </span>
              }
            />
            <Row
              label="Sol ahora mismo"
              hint={compassLongLabel(sun.azimuth)}
              value={
                sun.altitude > 0
                  ? `${formatNumber(sun.altitude, 1)}° sobre el horizonte`
                  : `${formatNumber(Math.abs(sun.altitude), 1)}° bajo el horizonte`
              }
            />
            <Row
              label="Rumbo del sol"
              hint="desde el norte, hacia el este"
              value={`${compassPoint(sun.azimuth)} · ${formatNumber(sun.azimuth, 0)}°`}
            />
          </RowList>

          <p className="mt-2 max-w-prose text-[11px] leading-snug text-ink-soft">
            {uv.advice}
          </p>
        </div>

        {/* Luna */}
        <div className="flex items-start gap-4">
          <MoonDisk fraction={moon.fraction} illumination={moon.illumination} size={64} />
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight text-ink">{moon.name}</p>
            <p className="numeric mt-1 text-[13px] text-ink-soft">
              {formatPercent(moon.illumination * 100)}
              <span className="text-ink-dim"> del disco iluminado</span>
            </p>
            <p className="numeric mt-1 text-[11px] text-ink-dim">
              {formatNumber(moon.fraction * SYNODIC_MONTH_DAYS, 1)} días desde la luna
              nueva
            </p>
          </div>
        </div>
      </div>

      <h3 className="eyebrow mt-5 text-[11px] text-ink-soft">
        Radiación ahora mismo
      </h3>
      <RowList>
        {radiationKeys.map((item) => (
          <Row
            key={item.key}
            label={item.label}
            hint={item.hint}
            value={formatRadiation(numberAt(hourly, item.key, hourIndex))}
          />
        ))}
        <Row
          label="Reparto de la radiación global"
          hint="directa y difusa sobre el total"
          value={`${share(direct)} directa · ${share(diffuse)} difusa`}
        />
      </RowList>

      <div className="mt-4">
        {radiationTimes.length === 0 ? (
          <EmptyNote>
            El modelo no publicó radiación horaria para las próximas horas.
          </EmptyNote>
        ) : (
          <ChartFrame
            caption={`Radiación global las próximas ${RADIATION_HOURS} horas. El pico de cada día es el mediodía solar, que en Juárez no coincide con el mediodía del reloj.`}
            scaleLeft={formatRadiation(radiationPeak)}
            scaleRight={formatRadiation(0)}
          >
            <Trace
              values={radiationSeries}
              markerIndex={0}
              height={120}
              stroke="var(--color-amber)"
              showZeroLine
              ariaLabel={`Radiación solar global hora por hora durante las próximas ${RADIATION_HOURS} horas`}
            />
          </ChartFrame>
        )}
      </div>

      <h3 className="eyebrow mt-5 text-[11px] text-ink-soft">
        Próximos {windowDays.length} días
      </h3>
      <div className="scroll-thin mt-1 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Salida y puesta del sol, duración del día, horas de sol efectivas, índice
            ultravioleta máximo y radiación acumulada de cada día
          </caption>
          <thead>
            <tr>
              {[
                "Día",
                "Amanece",
                "Anochece",
                "Duración",
                "Sol efectivo",
                "UV máx.",
                "Radiación del día",
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
            {windowDays.map((date, position) => {
              const index = dayIndex + position;
              const dayUv = uvCategory(numberAt(daily, "uv_index_max", index));
              return (
                <tr key={date} className="border-b border-rule/30">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-2 py-1 text-left text-[11px] font-normal text-ink-soft"
                  >
                    <span className="block text-ink">
                      {position === 0 ? "Hoy" : formatWeekdayShort(date)}
                    </span>
                    <span className="numeric block text-[10px] text-ink-dim">
                      {formatDayMonth(date)}
                    </span>
                  </th>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {safeTime(textAt(daily, "sunrise", index))}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {safeTime(textAt(daily, "sunset", index))}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {formatDuration(numberAt(daily, "daylight_duration", index))}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {formatDuration(numberAt(daily, "sunshine_duration", index))}
                    <span className="text-ink-dim">
                      {" "}
                      {formatPercent(
                        (() => {
                          const effective = numberAt(daily, "sunshine_duration", index);
                          const total = numberAt(daily, "daylight_duration", index);
                          if (effective === null || total === null || total <= 0) return null;
                          return (effective / total) * 100;
                        })(),
                      )}
                    </span>
                  </td>
                  <td
                    className={`numeric whitespace-nowrap px-2 py-1 text-[11px] ${toneText(dayUv.tone)}`}
                  >
                    {formatNumber(numberAt(daily, "uv_index_max", index), 1)}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1 text-[11px] text-ink-soft">
                    {formatNumber(numberAt(daily, "shortwave_radiation_sum", index), 1)}
                    <span className="text-ink-dim"> MJ/m²</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {radiationTimes.length === 0 ? (
        <EmptyNote>
          El modelo no publicó radiación horaria para las próximas horas.
        </EmptyNote>
      ) : null}

      <Caveat>
        La radiación «terrestre» es la que llegaría al suelo sin atmósfera: la
        diferencia entre esa curva y la global es exactamente lo que se come la
        atmósfera y las nubes. Comparar directa con difusa dice de qué está hecho el
        día: en un cielo despejado de octubre la directa manda, y con calima o polvo en
        suspensión la difusa gana terreno. La columna «radiación del día» va en MJ/m²
        —es una energía acumulada, no una potencia— y no se puede comparar con las
        cifras en W/m² de arriba. El índice UV máximo se calcula para el
        mediodía solar en la celda de {place.latitude.toFixed(3)},{" "}
        {place.longitude.toFixed(3)} a {formatDistance(place.elevation, units, { withUnit: true })}.
      </Caveat>
    </>
  );
}
