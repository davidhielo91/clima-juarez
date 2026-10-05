/**
 * Iconos del tiempo dibujados a mano, uno por cada clave que devuelve
 * `describeWeather`. Son trazos simples sobre la retícula del panel: sin
 * dependencias ni fuentes de iconos, y heredan el color del texto.
 */

export type GlyphKey =
  | "clear"
  | "partly"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "showers"
  | "snow"
  | "thunder"
  | "freezing";

function Cloud({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M8 18.5 h12.5 a4.5 4.5 0 0 0 0.4 -8.98 A6 6 0 0 0 9.4 8.6 A4.6 4.6 0 0 0 8 18.5 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

export function WeatherGlyph({
  icon,
  size = 40,
  isDay = true,
}: {
  icon: GlyphKey;
  size?: number;
  isDay?: boolean;
}) {
  const sun = (
    <g stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <circle cx={11} cy={10} r={4} fill="none" />
      <path d="M11 2.5 V4.6 M11 15.4 V17.5 M3.5 10 H5.6 M16.4 10 H18.5 M5.7 4.7 L7.2 6.2 M14.8 13.8 L16.3 15.3 M16.3 4.7 L14.8 6.2 M7.2 13.8 L5.7 15.3" />
    </g>
  );

  const moon = (
    <path
      d="M14.5 3.4 a7.2 7.2 0 1 0 5.9 11.4 a5.9 5.9 0 0 1 -5.9 -11.4 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );

  const body = isDay ? sun : moon;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      className="shrink-0"
    >
      {icon === "clear" ? body : null}

      {icon === "partly" ? (
        <>
          <g transform="scale(0.72) translate(0.5 0)">{body}</g>
          <Cloud y={4} />
        </>
      ) : null}

      {icon === "overcast" ? (
        <>
          <Cloud y={2.5} x={-2} />
          <Cloud y={5} x={1.5} />
        </>
      ) : null}

      {icon === "fog" ? (
        <>
          <Cloud y={4} />
          <g stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
            <path d="M5 19 H16 M8 21.5 H19" />
          </g>
        </>
      ) : null}

      {icon === "drizzle" ? (
        <>
          <Cloud y={2} />
          <g stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
            <path d="M9 19.5 V21 M13 19.5 V21 M17 19.5 V21" />
          </g>
        </>
      ) : null}

      {icon === "rain" ? (
        <>
          <Cloud y={2} />
          <g stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
            <path d="M9 19 L8 22.5 M13 19 L12 22.5 M17 19 L16 22.5" />
          </g>
        </>
      ) : null}

      {icon === "showers" ? (
        <>
          <Cloud y={2} />
          <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M8.5 18.5 L7 22.5 M12.5 18.5 L11 22.5 M16.5 18.5 L15 22.5" />
          </g>
        </>
      ) : null}

      {icon === "snow" ? (
        <>
          <Cloud y={2} />
          <g stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
            <path d="M9 19.5 V22.5 M7.7 20.2 L10.3 21.8 M10.3 20.2 L7.7 21.8" />
            <path d="M15 19.5 V22.5 M13.7 20.2 L16.3 21.8 M16.3 20.2 L13.7 21.8" />
          </g>
        </>
      ) : null}

      {icon === "thunder" ? (
        <>
          <Cloud y={2} />
          <path
            d="M13 17 L9.5 23 L12.2 23 L10.8 26.5 L16 21.4 L13.2 21.4 Z"
            fill="currentColor"
          />
        </>
      ) : null}

      {icon === "freezing" ? (
        <>
          <Cloud y={2} />
          <g stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
            <path d="M9 19.5 V22.5 M9 21 L7.2 19.6 M9 21 L10.8 19.6" />
            <path d="M15 19.5 V22.5 M15 21 L13.2 19.6 M15 21 L16.8 19.6" />
          </g>
        </>
      ) : null}
    </svg>
  );
}
