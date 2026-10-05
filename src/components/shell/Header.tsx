import UnitToggle from "@/components/units/UnitToggle";
import { formatDateLong, formatTime, nowInJuarez } from "@/lib/format";
import { POINT } from "@/lib/endpoints.mjs";
import type { UnitSystemId } from "@/lib/units";

/**
 * Cabecera de la hoja de registro: dónde, cuándo y en qué unidades.
 *
 * La hora que se muestra es siempre la de Ciudad Juárez, no la del visitante:
 * quien consulta el clima de Juárez desde otra ciudad necesita saber qué hora es
 * ALLÁ.
 */

const NAV = [
  { id: "avisos", label: "Avisos" },
  { id: "ahora", label: "Ahora" },
  { id: "quince-minutos", label: "2 h" },
  { id: "ciento-sesenta-y-ocho-horas", label: "168 h" },
  { id: "dieciseis-dias", label: "16 días" },
  { id: "modelos", label: "Modelos" },
  { id: "ensamble", label: "Ensamble" },
  { id: "aire", label: "Aire" },
  { id: "sol", label: "Sol" },
  { id: "suelo", label: "Suelo" },
  { id: "zonas", label: "Zonas" },
  { id: "clima", label: "Clima" },
  { id: "radar", label: "Radar" },
];

export default function Header({ unitsId }: { unitsId: UnitSystemId }) {
  const now = nowInJuarez();
  const iso = now.toISOString();

  return (
    <header className="border-b border-rule px-4 pb-3 pt-5 sm:px-6">
      <a
        href="#ahora"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-night-800 focus:px-3 focus:py-1.5 focus:text-[12px]"
      >
        Saltar a las condiciones actuales
      </a>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="eyebrow text-[10px] text-ink-dim">
            Estación de campo · {POINT.country}
          </p>
          <h1 className="font-display text-3xl font-semibold leading-none tracking-tight text-ink sm:text-4xl">
            Ciudad Juárez
          </h1>
          <p className="mt-1 text-[12px] text-ink-dim">
            {POINT.admin} · {POINT.latitude.toFixed(4)}°, {POINT.longitude.toFixed(4)}°
            {" · "}
            <span className="numeric">{formatDateLong(iso)}</span>
            {", "}
            <span className="numeric">{formatTime(iso)}</span> hora local
          </p>
        </div>

        <div className="flex items-center gap-3">
          <UnitToggle current={unitsId} />
        </div>
      </div>

      <nav aria-label="Secciones del panel" className="mt-3 -mb-1">
        <ul className="scroll-thin flex gap-x-4 gap-y-1 overflow-x-auto pb-2 text-[11px]">
          {NAV.map((item) => (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                className="text-ink-dim underline decoration-rule-strong decoration-1 underline-offset-4 hover:text-ink-soft"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
