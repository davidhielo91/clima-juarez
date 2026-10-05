import type { ReactNode } from "react";

/**
 * Gráficas en SVG escritas a mano. No hay librería de gráficas: son trazos,
 * bandas y barras sobre el papel reglado, del tamaño exacto que necesitan.
 *
 * Todas dibujan con `vector-effect="non-scaling-stroke"` para que el grosor de
 * línea siga siendo 1 px nítido cuando el SVG se estira al ancho de la pantalla.
 */

type MaybeNumber = number | null | undefined;

function isFiniteNumber(value: MaybeNumber): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Construye un trazo que se corta donde faltan datos, en vez de unirlos. */
function buildPath(
  values: MaybeNumber[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  let path = "";
  let penDown = false;
  values.forEach((value, index) => {
    if (!isFiniteNumber(value)) {
      penDown = false;
      return;
    }
    path += `${penDown ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)} `;
    penDown = true;
  });
  return path.trim();
}

function extent(series: MaybeNumber[][]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const values of series) {
    for (const value of values) {
      if (!isFiniteNumber(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (min === Number.POSITIVE_INFINITY) return { min: 0, max: 1 };
  if (min === max) return { min: min - 1, max: max + 1 };
  return { min, max };
}

/* ------------------------------------------------------------------ trazo */

/**
 * Trazo de una magnitud a lo largo del tiempo, con banda opcional (mínimos y
 * máximos, o percentiles del ensamble) y marca de "ahora".
 */
export function Trace({
  values,
  lower,
  upper,
  markerIndex,
  width = 720,
  height = 120,
  stroke = "var(--color-ink)",
  bandFill = "var(--color-ember)",
  ariaLabel,
  showZeroLine = false,
}: {
  values: MaybeNumber[];
  lower?: MaybeNumber[];
  upper?: MaybeNumber[];
  markerIndex?: number;
  width?: number;
  height?: number;
  stroke?: string;
  bandFill?: string;
  ariaLabel: string;
  showZeroLine?: boolean;
}) {
  const padTop = 10;
  const padBottom = showZeroLine ? 16 : 10;
  const { min, max } = extent([
    values,
    lower ?? [],
    upper ?? [],
    showZeroLine ? [0] : [],
  ]);
  const span = max - min || 1;
  const innerHeight = height - padTop - padBottom;

  const x = (index: number) =>
    values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
  const y = (value: number) => padTop + innerHeight - ((value - min) / span) * innerHeight;

  const band =
    lower && upper
      ? (() => {
          const top = upper
            .map((value, index) =>
              isFiniteNumber(value) ? `${x(index).toFixed(1)} ${y(value).toFixed(1)}` : null,
            )
            .filter((point): point is string => point !== null);
          const bottom = lower
            .map((value, index) =>
              isFiniteNumber(value) ? `${x(index).toFixed(1)} ${y(value).toFixed(1)}` : null,
            )
            .filter((point): point is string => point !== null)
            .reverse();
          if (top.length < 2 || bottom.length < 2) return "";
          return `M${top.join(" L")} L${bottom.join(" L")} Z`;
        })()
      : "";

  const markerX =
    markerIndex !== undefined && markerIndex >= 0 && markerIndex < values.length
      ? x(markerIndex)
      : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {band ? <path d={band} fill={bandFill} opacity={0.16} /> : null}
      {showZeroLine ? (
        <line
          x1={0}
          x2={width}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--color-rule-strong)"
          strokeWidth={1}
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={buildPath(values, x, y)}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {markerX !== null ? (
        <line
          x1={markerX}
          x2={markerX}
          y1={0}
          y2={height}
          stroke="var(--color-amber)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ barras */

/** Barras verticales de 0 a 100: probabilidad de precipitación. */
export function ProbabilityBars({
  values,
  width = 720,
  height = 34,
  ariaLabel,
}: {
  values: MaybeNumber[];
  width?: number;
  height?: number;
  ariaLabel: string;
}) {
  if (values.length === 0) return null;
  const slot = width / values.length;
  const barWidth = Math.max(1, slot * 0.62);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {values.map((value, index) => {
        if (!isFiniteNumber(value) || value <= 0) return null;
        const barHeight = Math.max(1, (Math.min(100, value) / 100) * height);
        return (
          <rect
            key={index}
            x={index * slot + (slot - barWidth) / 2}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill="var(--color-cold)"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

/** Barras de precipitación acumulada, escaladas al máximo del periodo. */
export function AmountBars({
  values,
  width = 720,
  height = 40,
  ariaLabel,
}: {
  values: MaybeNumber[];
  width?: number;
  height?: number;
  ariaLabel: string;
}) {
  if (values.length === 0) return null;
  const peak = Math.max(
    0.4,
    ...values.filter(isFiniteNumber).map((value) => value),
  );
  const slot = width / values.length;
  const barWidth = Math.max(1, slot * 0.62);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {values.map((value, index) => {
        if (!isFiniteNumber(value) || value <= 0) return null;
        const barHeight = Math.max(1.5, (value / peak) * height);
        return (
          <rect
            key={index}
            x={index * slot + (slot - barWidth) / 2}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill="var(--color-cold-deep)"
          />
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ rosa */

/**
 * Rosa de los vientos: la flecha apunta hacia donde SOPLA el viento, mientras
 * que el dato de la API es la dirección DESDE la que viene (convención
 * meteorológica). Por eso se gira 180°.
 */
export function WindArrow({
  degrees,
  size = 28,
  label,
}: {
  degrees: MaybeNumber;
  size?: number;
  label?: string;
}) {
  const known = isFiniteNumber(degrees);
  const rotation = known ? (degrees as number) + 180 : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label ?? (known ? `Viento soplando hacia el rumbo ${rotation}°` : "Dirección del viento sin dato")}
    >
      <circle
        cx={12}
        cy={12}
        r={10.5}
        fill="none"
        stroke="var(--color-rule-strong)"
        strokeWidth={1}
      />
      {known ? (
        <g transform={`rotate(${rotation} 12 12)`}>
          <path
            d="M12 4 L15.4 12.4 L12 10.6 L8.6 12.4 Z"
            fill="var(--color-amber)"
          />
        </g>
      ) : (
        <text
          x={12}
          y={15}
          textAnchor="middle"
          fontSize={9}
          fill="var(--color-ink-dim)"
        >
          s/d
        </text>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ luna */

/**
 * Disco lunar. `fraction` va de 0 (luna nueva) a 0.5 (llena) a 1 (nueva otra
 * vez), así que el terminador se dibuja con una elipse cuyo semieje depende del
 * coseno de la fase.
 */
export function MoonDisk({
  fraction,
  illumination,
  size = 44,
}: {
  fraction: number;
  illumination: number;
  size?: number;
}) {
  const radius = 11;
  const k = Math.cos(2 * Math.PI * fraction);
  const terminatorRadius = Math.abs(k) * radius;
  const waxing = fraction < 0.5;
  const sweep = k > 0 ? 1 : 0;

  const litPath = `M0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius} A ${terminatorRadius} ${radius} 0 0 ${sweep} 0 ${-radius} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-14 -14 28 28"
      role="img"
      aria-label={`Fase lunar: ${Math.round(illumination * 100)} % iluminada`}
    >
      <circle cx={0} cy={0} r={radius} fill="var(--color-night-700)" />
      <g transform={waxing ? undefined : "scale(-1 1)"}>
        <path d={litPath} fill="var(--color-ink)" opacity={0.92} />
      </g>
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill="none"
        stroke="var(--color-rule-strong)"
        strokeWidth={0.7}
      />
    </svg>
  );
}

/* --------------------------------------------------------------- envoltura */

/** Marco reglado para las gráficas: la retícula del papel de registrador. */
export function ChartFrame({
  children,
  caption,
  scaleLeft,
  scaleRight,
}: {
  children: ReactNode;
  caption: string;
  scaleLeft?: string;
  scaleRight?: string;
}) {
  return (
    <figure className="m-0">
      <div className="ruled relative border-y border-rule/60 py-1">
        {scaleLeft ? (
          <span className="numeric pointer-events-none absolute left-0 top-0 text-[9px] text-ink-dim">
            {scaleLeft}
          </span>
        ) : null}
        {scaleRight ? (
          <span className="numeric pointer-events-none absolute bottom-0 left-0 text-[9px] text-ink-dim">
            {scaleRight}
          </span>
        ) : null}
        {children}
      </div>
      <figcaption className="mt-1.5 text-[11px] text-ink-dim">
        {caption}
      </figcaption>
    </figure>
  );
}
