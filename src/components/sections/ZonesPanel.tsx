import {
  Badge,
  Caveat,
  DataState,
  EmptyNote,
  Panel,
  Row,
  RowList,
} from "@/components/ui/primitives";
import { WindArrow } from "@/components/ui/charts";
import { WeatherGlyph, type GlyphKey } from "@/components/ui/glyphs";
import { describeWeather } from "@/lib/derive/wmo";
import { compassLongLabel, compassPoint } from "@/lib/derive/wind";
import { getZones } from "@/lib/sources/zones";
import type { ZoneReading } from "@/lib/types";
import {
  formatDistance,
  formatNumber,
  formatPrecipitation,
  formatSpeed,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * Las seis zonas de la ciudad, ordenadas de la más cálida a la más fría.
 *
 * La ciudad se extiende por un valle con más de 100 m de desnivel entre el norte y
 * el sur, y eso se ve en los datos: la misma tarde puede estar 4 °C más caliente en
 * Anapra que en el Valle de Juárez. Lo que NO dice esta tabla es la temperatura de
 * una calle: cada renglón es la celda del modelo más cercana a ese punto, y el
 * modelo responde con la coordenada y la elevación de su propia celda, que se
 * muestran a propósito para que se vea cuánto se movió el dato respecto al punto
 * que se pidió.
 */

/** Separación entre dos temperaturas (una diferencia no lleva el +32 de Fahrenheit). */
function formatSpan(celsius: number | null, units: UnitSystem): string {
  if (celsius === null || !Number.isFinite(celsius)) return "—";
  const converted = units.temperature === "f" ? celsius * 1.8 : celsius;
  return `${formatNumber(converted, 1)} ${units.temperature === "f" ? "°F" : "°C"}`;
}

/** Diferencia de elevación con signo explícito, en las unidades elegidas. */
function formatElevationDelta(metres: number | null, units: UnitSystem): string {
  if (metres === null || !Number.isFinite(metres)) return "—";
  if (Math.abs(metres) < 0.5) return "igual";
  const sign = metres > 0 ? "+" : "−";
  return `${sign}${formatDistance(Math.abs(metres), units, { withUnit: true })}`;
}

export default async function ZonesPanel({ units }: { units: UnitSystem }) {
  const result = await getZones();

  return (
    <Panel
      id="zonas"
      title="Zonas de la ciudad"
      subtitle="Las seis celdas del modelo más cercanas a cada punto, ordenadas de la más cálida a la más fría."
    >
      <DataState result={result} what="las zonas de la ciudad">
        {(zones) => <ZonesTable zones={zones} units={units} />}
      </DataState>

      <Caveat>
        Cada zona es la celda del modelo más cercana a ese punto, no una medición de esa
        colonia: la API responde con su propia coordenada y su propia elevación, que van
        escritas en cada renglón para que se vea el desplazamiento. Sirve para ver el
        gradiente entre el norte y el sur del valle, no para saber la temperatura de una
        calle: dentro de una misma zona puede haber 3 °C de diferencia entre una loma y
        el fondo de un arroyo, y el modelo no los distingue. Las seis lecturas son del
        mismo instante, así que compararlas entre sí sí es válido; lo que no es válido
        es tomarlas como un mapa de calor de la ciudad.
      </Caveat>
    </Panel>
  );
}

function ZonesTable({
  zones,
  units,
}: {
  zones: ZoneReading[];
  units: UnitSystem;
}) {
  if (zones.length === 0) {
    return <EmptyNote>La fuente no devolvió ninguna zona.</EmptyNote>;
  }

  const ranked = [...zones].sort((a, b) => {
    if (a.temperature === null && b.temperature === null) return 0;
    if (a.temperature === null) return 1;
    if (b.temperature === null) return -1;
    return b.temperature - a.temperature;
  });

  const known = ranked.filter(
    (zone): zone is ZoneReading & { temperature: number } => zone.temperature !== null,
  );
  const warmest = known.length > 0 ? known[0] : null;
  const coldest = known.length > 0 ? known[known.length - 1] : null;
  const gradient =
    warmest !== null && coldest !== null && warmest.id !== coldest.id
      ? warmest.temperature - coldest.temperature
      : null;

  const centre = zones.find((zone) => zone.id === "centro") ?? null;

  const elevations = zones.map((zone) => zone.elevation);
  const relief =
    elevations.length > 0 ? Math.max(...elevations) - Math.min(...elevations) : null;

  return (
    <>
      <p className="mb-2 text-[11px] text-ink-dim">
        Lectura del mismo instante para las seis zonas. La temperatura y la sensación
        van en {units.temperature === "f" ? "°F" : "°C"}, el viento en{" "}
        {units.speed === "mph" ? "mph" : units.speed === "ms" ? "m/s" : "km/h"} y la
        elevación en {units.distance === "ft" ? "ft" : "m"}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
        <div>
          <RowList>
            <Row
              label="Zona más cálida"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {warmest?.name ?? "Sin dato"}
                  {warmest !== null ? (
                    <Badge tone="warn">
                      {formatTemperature(warmest.temperature, units, { withUnit: true })}
                    </Badge>
                  ) : null}
                </span>
              }
            />
            <Row
              label="Zona más fría"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {coldest?.name ?? "Sin dato"}
                  {coldest !== null ? (
                    <Badge tone="info">
                      {formatTemperature(coldest.temperature, units, { withUnit: true })}
                    </Badge>
                  ) : null}
                </span>
              }
            />
          </RowList>
        </div>
        <div>
          <RowList>
            <Row
              label="Gradiente entre extremos"
              hint="cálida menos fría"
              value={formatSpan(gradient, units)}
              tone={gradient !== null && gradient >= 4 ? "caution" : undefined}
            />
            <Row
              label="Desnivel entre la zona más alta y la más baja"
              hint="elevación que reportó el modelo"
              value={formatDistance(relief, units, { withUnit: true })}
            />
          </RowList>
        </div>
      </div>

      <div className="scroll-thin mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Temperatura, sensación térmica, viento, lluvia y elevación de cada zona de
            la ciudad, con la diferencia de elevación respecto al centro
          </caption>
          <thead>
            <tr>
              {[
                "Zona",
                "Ahora",
                "Sensación",
                "Viento",
                "Rachas",
                "Lluvia",
                "Elevación",
                "Δ centro",
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
            {ranked.map((zone) => {
              const weather = describeWeather(zone.weatherCode);
              const delta = centre === null ? null : zone.elevation - centre.elevation;
              return (
                <tr key={zone.id} className="border-b border-rule/30">
                  <th
                    scope="row"
                    className="px-2 py-1.5 text-left text-[11px] font-normal text-ink-soft"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-ink-soft">
                        <WeatherGlyph icon={weather.icon as GlyphKey} size={16} />
                      </span>
                      <span className="text-ink">{zone.name}</span>
                      {warmest !== null && zone.id === warmest.id && known.length > 1 ? (
                        <Badge tone="warn">más cálida</Badge>
                      ) : null}
                      {coldest !== null && zone.id === coldest.id && known.length > 1 ? (
                        <Badge tone="info">más fría</Badge>
                      ) : null}
                    </span>
                    <span className="block text-[10px] text-ink-dim">{zone.detail}</span>
                    <span className="numeric block text-[10px] text-ink-dim/80">
                      celda {zone.modelLatitude.toFixed(3)},{" "}
                      {zone.modelLongitude.toFixed(3)}
                    </span>
                  </th>
                  <td className="numeric whitespace-nowrap px-2 py-1.5 text-[13px] text-ink">
                    {formatTemperature(zone.temperature, units, { withUnit: true })}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1.5 text-[11px] text-ink-soft">
                    {formatTemperature(zone.apparentTemperature, units)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1.5">
                      <WindArrow
                        degrees={zone.windDirection}
                        size={16}
                        label={`Viento en ${zone.name}: desde el ${compassLongLabel(zone.windDirection)}`}
                      />
                      <span className="numeric text-ink-soft">
                        {formatSpeed(zone.windSpeed, units)}
                      </span>
                      <span className="numeric text-ink-dim">
                        {compassPoint(zone.windDirection)}
                      </span>
                    </span>
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1.5 text-[11px] text-ink-soft">
                    {formatSpeed(zone.windGusts, units)}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1.5 text-[11px] text-cold">
                    {formatPrecipitation(zone.precipitation, units, { withUnit: true })}
                  </td>
                  <td className="numeric whitespace-nowrap px-2 py-1.5 text-[11px] text-ink-soft">
                    {formatDistance(zone.elevation, units, { withUnit: true })}
                  </td>
                  <td
                    className="numeric whitespace-nowrap px-2 py-1.5 text-[11px] text-ink-dim"
                  >
                    {formatElevationDelta(delta, units)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {known.length < zones.length ? (
        <p className="mt-2 text-[11px] text-ink-dim">
          {zones.length - known.length} de {zones.length} zonas llegaron sin
          temperatura: se ordenan al final y no entran al cálculo del gradiente.
        </p>
      ) : null}

      <Caveat>
        El orden es por temperatura de mayor a menor, así que el primer renglón es la
        zona más caliente de este instante y no necesariamente la más caliente de la
        ciudad en todo el día: al amanecer el valle del sur se enfría más que el norte
        por inversión térmica, y a media tarde la loma del poniente es la que más
        aguanta el calor. El desnivel que se muestra es el que reporta el modelo para
        su celda, no la altitud oficial de la colonia.
      </Caveat>
    </>
  );
}
