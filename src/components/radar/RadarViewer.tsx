"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { EmptyNote } from "@/components/ui/primitives";
import { POINT } from "@/lib/endpoints.mjs";
import { formatTimestamp, TIMEZONE } from "@/lib/format";
import type { RadarFrame } from "@/lib/types";

/**
 * Radar de lluvia de RainViewer, reconstruido a mano.
 *
 * No hay librería de mapas a propósito: son doce `<img>` posicionados de forma
 * absoluta sobre una base cartográfica de OpenStreetMap. Un mapa interactivo
 * —Leaflet, Mapbox— costaría cientos de kilobytes y traería zoom y arrastre que este
 * panel no necesita: lo único que se pregunta aquí es dónde está lloviendo ahora y
 * hacia dónde se mueve.
 *
 * Detalles del armado:
 *  - Se pide una rejilla de 3×2 teselas a zoom 8, centrada en Ciudad Juárez. La
 *    tesela base se calcula con la fórmula estándar de Mercator (la latitud en
 *    radianes, con la tangente y la secante) y la rejilla se desplaza media tesela
 *    para que el punto caiga en el centro exacto del cuadro.
 *  - Cada tesela mide 133 km de lado a esta latitud, así que el cuadro cubre unos
 *    400 km de ancho: entra el valle completo, El Paso y buena parte del sur de Nuevo
 *    México. Es lo que hace falta para ver de dónde viene un chubasco de monzón.
 *  - La URL de cada mosaico de lluvia es
 *    `{host}{path}/{size}/{z}/{x}/{y}/{colorScheme}/{smooth}_{snow}.png`.
 *  - Los fotogramas se dejan montados todos y se alterna su opacidad: los mosaicos de
 *    RainViewer pesan uno o dos kilobytes, y volver a pedirlos en cada vuelta haría
 *    que la animación se cortara. Se acepta el coste de memoria a cambio de que el
 *    ciclo se vea continuo.
 *  - Con `prefers-reduced-motion` la animación **no arranca sola**: se queda en el
 *    fotograma más reciente y el botón de reproducir sigue disponible.
 */

const ZOOM = 8;
const TILE_SIZE = 256;
/** Esquema 4 de RainViewer: precipitación, con la escala de colores habitual. */
const COLOR_SCHEME = 4;
const SMOOTH = 1;
const SNOW = 0;

const COLUMNS = 3;
const ROWS = 2;

/** Milisegundos por fotograma: rápido para ver el movimiento, lento para leerlo. */
const FRAME_MS = 550;

const BASE_TILE_URL = "https://tile.openstreetmap.org";

interface GridTile {
  x: number;
  y: number;
  column: number;
  row: number;
}

/** Coordenada continua de tesela (Mercator) en longitud. */
function tileX(longitude: number): number {
  return ((longitude + 180) / 360) * 2 ** ZOOM;
}

/** Coordenada continua de tesela (Mercator) en latitud. */
function tileY(latitude: number): number {
  const radians = (latitude * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** ZOOM;
}

/** Rejilla de 3×2 teselas con el punto de referencia en el centro del cuadro. */
function buildGrid(): GridTile[] {
  const originX = Math.floor(tileX(POINT.longitude) - COLUMNS / 2);
  const originY = Math.floor(tileY(POINT.latitude) - ROWS / 2);
  const tiles: GridTile[] = [];

  for (let column = 0; column < COLUMNS; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      tiles.push({ x: originX + column, y: originY + row, column, row });
    }
  }
  return tiles;
}

/** La rejilla solo depende del punto y del zoom: se calcula una vez por módulo. */
const GRID = buildGrid();

/** Hora local de Ciudad Juárez a partir de un instante Unix real. */
const juarezTime = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIMEZONE,
});

function tileStyle(tile: GridTile): CSSProperties {
  return {
    left: `${(tile.column / COLUMNS) * 100}%`,
    top: `${(tile.row / ROWS) * 100}%`,
    width: `${100 / COLUMNS}%`,
    height: `${100 / ROWS}%`,
  };
}

function baseTileUrl(tile: GridTile): string {
  return `${BASE_TILE_URL}/${ZOOM}/${tile.x}/${tile.y}.png`;
}

function radarTileUrl(host: string, frame: RadarFrame, tile: GridTile): string {
  const cleanHost = host.endsWith("/") ? host.slice(0, -1) : host;
  return `${cleanHost}${frame.path}/${TILE_SIZE}/${ZOOM}/${tile.x}/${tile.y}/${COLOR_SCHEME}/${SMOOTH}_${SNOW}.png`;
}

export default function RadarViewer({
  host,
  frames,
}: {
  host: string;
  frames: RadarFrame[];
}) {
  // Se arranca en el fotograma más reciente, que es el que interesa al abrir.
  const [index, setIndex] = useState(() => Math.max(0, frames.length - 1));
  const [playing, setPlaying] = useState(false);

  // Arranque diferido y respeto por `prefers-reduced-motion`: quien pide menos
  // movimiento en su sistema no ve una animación en marcha sin pedirla.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!query.matches) setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % frames.length);
    }, FRAME_MS);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  if (frames.length < 2) {
    return (
      <EmptyNote>
        El catálogo del radar llegó con {frames.length}{" "}
        {frames.length === 1 ? "fotograma" : "fotogramas"}: hacen falta al menos dos
        para saber hacia dónde se mueve la lluvia. Se prefiere decir esto a dibujar un
        cuadro vacío.
      </EmptyNote>
    );
  }

  const safeIndex = Math.min(index, frames.length - 1);
  const frame = frames[safeIndex];
  const isLatest = safeIndex === frames.length - 1;

  return (
    <div>
      <div
        className="relative aspect-[3/2] w-full overflow-hidden border border-rule bg-night-800"
        role="img"
        aria-label={`Mapa del norte de Chihuahua y el sur de Nuevo México con la lluvia detectada por radar a las ${formatTimestamp(frame.time)} horas UTC`}
      >
        {GRID.map((tile) => (
          // Base cartográfica. Decorativa: el sentido lo carga la etiqueta del visor.
          <img
            key={`base-${tile.x}-${tile.y}`}
            src={baseTileUrl(tile)}
            alt=""
            aria-hidden="true"
            width={TILE_SIZE}
            height={TILE_SIZE}
            draggable={false}
            style={tileStyle(tile)}
            className="absolute block select-none opacity-75"
          />
        ))}

        {frames.map((item, position) => (
          <div
            key={item.path}
            aria-hidden={position !== safeIndex}
            className={`absolute inset-0 transition-opacity duration-150 ${
              position === safeIndex ? "opacity-90" : "opacity-0"
            }`}
          >
            {GRID.map((tile) => (
              <img
                key={`${item.path}-${tile.x}-${tile.y}`}
                src={radarTileUrl(host, item, tile)}
                alt=""
                aria-hidden="true"
                width={TILE_SIZE}
                height={TILE_SIZE}
                draggable={false}
                style={tileStyle(tile)}
                className="absolute block select-none"
              />
            ))}
          </div>
        ))}

        <p className="absolute bottom-0 right-0 bg-night-950/80 px-1.5 py-0.5 text-[10px] text-ink-dim">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule-strong underline-offset-2"
          >
            © OpenStreetMap
          </a>
          {" · "}
          <a
            href="https://www.rainviewer.com/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule-strong underline-offset-2"
          >
            Radar: RainViewer
          </a>
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={
            playing ? "Pausar la animación del radar" : "Reproducir la animación del radar"
          }
          className="numeric border border-rule px-2.5 py-1 text-[11px] text-ink-soft hover:border-rule-strong hover:text-ink"
        >
          {playing ? "Pausar" : "Reproducir"}
        </button>

        <input
          type="range"
          min={0}
          max={frames.length - 1}
          step={1}
          value={safeIndex}
          onChange={(event) => {
            setPlaying(false);
            setIndex(Number(event.target.value));
          }}
          aria-label="Fotograma del radar"
          aria-valuetext={`Fotograma ${safeIndex + 1} de ${frames.length}, ${formatTimestamp(frame.time)} horas UTC`}
          className="h-1 min-w-[140px] flex-1 accent-[var(--color-amber)]"
        />

        <p className="numeric text-[11px] text-ink-soft">
          {formatTimestamp(frame.time)} UTC
          <span className="text-ink-dim">
            {" · "}
            {juarezTime.format(new Date(frame.time * 1000))} en Juárez
          </span>
          <span className="ml-2 text-ink-dim">
            {safeIndex + 1} / {frames.length}
          </span>
          {isLatest ? <span className="ml-2 text-amber">último</span> : null}
        </p>
      </div>
    </div>
  );
}
