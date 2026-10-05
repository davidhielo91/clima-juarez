import { Caveat, Panel, Row, RowList } from "@/components/ui/primitives";
import { WindArrow } from "@/components/ui/charts";
import { compassLongLabel } from "@/lib/derive/wind";
import { indexOfCurrentHour } from "@/lib/format";
import type { ForecastBundle, Place } from "@/lib/types";
import {
  formatDistance,
  formatPressure,
  formatTemperature,
  type UnitSystem,
} from "@/lib/units";

/**
 * ELEMENTO FIRMA: la columna vertical.
 *
 * Casi ninguna página del clima muestra el perfil de la atmósfera, aunque los
 * datos vengan en la misma respuesta: capa límite mezclada, nivel de congelación,
 * viento a 80/120/180 m sobre el suelo y temperatura del suelo a cuatro
 * profundidades. Esta columna los pone en su sitio físico real: la ciudad está a
 * 1 132 m sobre el nivel del mar, en un valle, y en octubre el nivel de
 * congelación ronda los 5 200 m. Verlo dibujado explica por qué hace calor de día
 * y frío de noche en el desierto.
 */

/** Dominio de la columna de aire, en metros sobre el nivel del mar. */
const AIR_MIN = 900;
const AIR_MAX = 6000;

const SVG_WIDTH = 208;
const SVG_HEIGHT = 560;
const AIR_TOP = 26;
const AIR_BOTTOM = 392;
const SOIL_TOP = 412;
const SOIL_BOTTOM = 512;
const SOIL_MAX_CM = 54;

const SOIL_DEPTHS = [0, 6, 18, 54] as const;

/** Alturas del viento sobre el suelo que publica la API. */
const WIND_LEVELS = [
  { height: 10, key: "wind_speed_10m", directionKey: "wind_direction_10m" },
  { height: 80, key: "wind_speed_80m", directionKey: "wind_direction_80m" },
  { height: 120, key: "wind_speed_120m", directionKey: "wind_direction_120m" },
  { height: 180, key: "wind_speed_180m", directionKey: "wind_direction_180m" },
] as const;

function numberAt(
  block: Record<string, Array<string | number | null>>,
  key: string,
  index: number,
): number | null {
  const series = block[key];
  if (!Array.isArray(series)) return null;
  const value = series[index];
  return typeof value === "number" ? value : null;
}

export default function ColumnRail({
  forecast,
  units,
}: {
  forecast: ForecastBundle;
  units: UnitSystem;
}) {
  const { place, hourly } = forecast;
  const index = indexOfCurrentHour(hourly.time);

  const elevation = place.elevation;
  const boundaryLayer = numberAt(hourly, "boundary_layer_height", index);
  const freezingLevel = numberAt(hourly, "freezing_level_height", index);
  const surfacePressure = numberAt(hourly, "surface_pressure", index);
  const seaLevelPressure = numberAt(hourly, "pressure_msl", index);

  // La capa límite se dibuja desde la elevación de la estación hacia arriba:
  // el modelo no declara si su altura es sobre el suelo o sobre el nivel del
  // mar, así que no se afirma más de lo que dice el dato.
  const boundaryTop =
    boundaryLayer !== null ? Math.max(elevation, elevation + boundaryLayer) : null;

  const yAir = (metres: number) =>
    AIR_BOTTOM - ((metres - AIR_MIN) / (AIR_MAX - AIR_MIN)) * (AIR_BOTTOM - AIR_TOP);
  const ySoil = (centimetres: number) =>
    SOIL_TOP + (centimetres / SOIL_MAX_CM) * (SOIL_BOTTOM - SOIL_TOP);

  const surfaceY = yAir(elevation);
  // Solo se marcan las alturas POR ENCIMA de la estación. Una marca por debajo
  // —los 1000 m, con la ciudad a 1132— dibujaba una raya suelta dentro del perfil
  // del suelo y, peor, atravesaba la etiqueta de la superficie.
  const ticks = [1000, 2000, 3000, 4000, 5000, 6000].filter(
    (tick) => yAir(tick) < surfaceY,
  );

  const windReadings = WIND_LEVELS.map((level) => ({
    height: level.height,
    speed: numberAt(hourly, level.key, index),
    direction: numberAt(hourly, level.directionKey, index),
  }));

  const soilReadings = SOIL_DEPTHS.map((depth) => ({
    depth,
    temperature: numberAt(hourly, `soil_temperature_${depth}cm`, index),
  }));

  return (
    <Panel
      id="columna"
      title="Columna vertical"
      subtitle={`Perfil de la atmósfera sobre la estación, ${formatDistance(elevation, units, { withUnit: true })} sobre el nivel del mar`}
    >
      {/* Columna dibujada: solo en pantallas anchas. */}
      <div className="hidden lg:block">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="h-auto w-full max-w-[260px]"
          role="img"
          aria-label={`Perfil vertical: estación a ${Math.round(elevation)} metros, capa límite mezclada a ${boundaryLayer ?? "sin dato"} metros, nivel de congelación a ${freezingLevel ?? "sin dato"} metros, presión en superficie ${surfacePressure ?? "sin dato"} hectopascales`}
        >
          {/* Eje y retícula */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={44}
                x2={SVG_WIDTH - 6}
                y1={yAir(tick)}
                y2={yAir(tick)}
                stroke="var(--color-rule)"
                strokeWidth={1}
                strokeDasharray="1 4"
              />
              <text
                x={40}
                y={yAir(tick) + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--color-ink-dim)"
                fontFamily="var(--font-mono)"
              >
                {tick}
              </text>
            </g>
          ))}
          <text
            x={4}
            y={AIR_TOP - 10}
            fontSize={9}
            fill="var(--color-ink-dim)"
            fontFamily="var(--font-mono)"
          >
            m s.n.m.
          </text>

          {/* Banda de la capa límite mezclada */}
          {boundaryTop !== null ? (
            <>
              <rect
                x={52}
                y={yAir(boundaryTop)}
                width={SVG_WIDTH - 62}
                height={Math.max(2, surfaceY - yAir(boundaryTop))}
                fill="var(--color-ember)"
                opacity={0.14}
              />
              <line
                x1={52}
                x2={SVG_WIDTH - 6}
                y1={yAir(boundaryTop)}
                y2={yAir(boundaryTop)}
                stroke="var(--color-ember)"
                strokeWidth={1}
              />
              <text
                x={56}
                y={yAir(boundaryTop) - 4}
                fontSize={9}
                fill="var(--color-amber)"
                fontFamily="var(--font-mono)"
              >
                capa límite {boundaryLayer} m
              </text>
            </>
          ) : null}

          {/* Nivel de congelación */}
          {freezingLevel !== null ? (
            <>
              <line
                x1={52}
                x2={SVG_WIDTH - 6}
                y1={yAir(freezingLevel)}
                y2={yAir(freezingLevel)}
                stroke="var(--color-cold)"
                strokeWidth={1}
              />
              <text
                x={56}
                y={yAir(freezingLevel) - 4}
                fontSize={9}
                fill="var(--color-cold)"
                fontFamily="var(--font-mono)"
              >
                0 °C a {freezingLevel} m
              </text>
            </>
          ) : null}

          {/* Superficie: la línea de la ciudad */}
          <line
            x1={44}
            x2={SVG_WIDTH - 6}
            y1={surfaceY}
            y2={surfaceY}
            stroke="var(--color-ink-soft)"
            strokeWidth={1.4}
          />
          {/* La etiqueta va DEBAJO de la raya: encima chocaba con la caja del viento
              y con la marca de altitud inferior. */}
          <text
            x={48}
            y={surfaceY + 13}
            fontSize={9}
            fill="var(--color-ink)"
            fontFamily="var(--font-mono)"
          >
            superficie {elevation} m · {formatPressure(surfacePressure, units, { withUnit: true })}
          </text>

          {/* Escala ampliada del viento cerca del suelo: a escala real, 80, 120 y
              180 m caerían en el mismo píxel. Se dice que está ampliada, y la caja
              es lo bastante alta para que la última cifra no quede cortada. */}
          <g transform={`translate(52 ${surfaceY - 84})`}>
            <rect
              x={0}
              y={0}
              width={SVG_WIDTH - 62}
              height={72}
              fill="var(--color-night-800)"
              opacity={0.55}
              stroke="var(--color-rule)"
              strokeWidth={0.6}
            />
            <text x={4} y={10} fontSize={8} fill="var(--color-ink-dim)">
              viento sobre el suelo, km/h · escala ampliada
            </text>
            {windReadings.map((reading, position) => {
              const columnX = 8 + position * 34;
              return (
                <g key={reading.height} transform={`translate(${columnX} 16)`}>
                  <WindArrow
                    degrees={reading.direction}
                    size={22}
                    label={`Viento a ${reading.height} m: ${reading.speed ?? "sin dato"} kilómetros por hora desde ${compassLongLabel(reading.direction)}`}
                  />
                  <text
                    x={11}
                    y={50}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--color-ink-soft)"
                    fontFamily="var(--font-mono)"
                  >
                    {reading.height} m
                  </text>
                  <text
                    x={11}
                    y={62}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--color-ink-dim)"
                    fontFamily="var(--font-mono)"
                  >
                    {reading.speed === null ? "—" : reading.speed.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Perfil del suelo */}
          <text
            x={4}
            y={SOIL_TOP - 6}
            fontSize={9}
            fill="var(--color-ink-dim)"
            fontFamily="var(--font-mono)"
          >
            suelo (cm)
          </text>
          <rect
            x={52}
            y={SOIL_TOP}
            width={SVG_WIDTH - 62}
            height={SOIL_BOTTOM - SOIL_TOP}
            fill="var(--color-night-700)"
            opacity={0.5}
          />
          {soilReadings.map((reading) => (
            <g key={reading.depth}>
              <line
                x1={52}
                x2={SVG_WIDTH - 6}
                y1={ySoil(reading.depth)}
                y2={ySoil(reading.depth)}
                stroke="var(--color-rule-strong)"
                strokeWidth={0.8}
              />
              <text
                x={48}
                y={ySoil(reading.depth) + 3}
                textAnchor="end"
                fontSize={9}
                fill="var(--color-ink-dim)"
                fontFamily="var(--font-mono)"
              >
                {reading.depth}
              </text>
              <text
                x={56}
                y={ySoil(reading.depth) + 3}
                fontSize={9}
                fill="var(--color-ink-soft)"
                fontFamily="var(--font-mono)"
              >
                {formatTemperature(reading.temperature, units, { digits: 1, withUnit: true })}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Misma información como filas: móvil y tablet. */}
      <div className="lg:hidden">
        <RowList>
          <Row
            label="Nivel de congelación"
            hint="0 °C"
            value={formatDistance(freezingLevel, units, { withUnit: true })}
          />
          <Row
            label="Capa límite mezclada"
            hint="altura reportada"
            value={formatDistance(boundaryLayer, units, { withUnit: true })}
          />
          <Row
            label="Presión en la estación"
            hint={`${elevation} m s.n.m.`}
            value={formatPressure(surfacePressure, units, { withUnit: true })}
          />
          <Row
            label="Presión reducida al mar"
            value={formatPressure(seaLevelPressure, units, { withUnit: true })}
          />
          {windReadings.slice(1).map((reading) => (
            <Row
              key={reading.height}
              label={`Viento a ${reading.height} m`}
              hint={compassLongLabel(reading.direction)}
              value={`${reading.speed ?? "—"} km/h`}
            />
          ))}
          {soilReadings.map((reading) => (
            <Row
              key={reading.depth}
              label={`Suelo a ${reading.depth} cm`}
              value={formatTemperature(reading.temperature, units, {
                digits: 1,
                withUnit: true,
              })}
            />
          ))}
        </RowList>
      </div>

      <Caveat>
        La presión se muestra de dos formas porque a esta altitud importan las dos:
        la de la estación (unos 895 hPa) es la que sienten los cuerpos y los
        motores; la reducida al mar (unos 1 020 hPa) es la que se compara con otros
        lugares. La capa límite es la altura hasta donde el aire se mezcla por
        calentamiento del suelo: por eso en el desierto la temperatura cae en picada
        al atardecer. El modelo no declara si esa altura es sobre el suelo o sobre el
        nivel del mar, así que se dibuja desde la elevación de la estación sin
        afirmar más. <PlaceNote place={place} />
      </Caveat>
    </Panel>
  );
}

/** Recordatorio de que el dato es de una celda de modelo, no de una calle. */
function PlaceNote({ place }: { place: Place }) {
  return (
    <>
      Estos valores son de la celda del modelo centrada en {place.latitude.toFixed(3)},{" "}
      {place.longitude.toFixed(3)} a {place.elevation} m.
    </>
  );
}
