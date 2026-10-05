import type { ReactNode } from "react";
import type { Fetched } from "@/lib/fetchJson";
import type { Tone } from "@/lib/derive/tone";

/**
 * Piezas de la hoja de registro: filas regladas, etiquetas de sección y estados
 * de dato. Todas son componentes de servidor: no llevan estado ni interactividad.
 */

/* ------------------------------------------------------------------ tonos */

const TONE_TEXT: Record<Tone, string> = {
  good: "text-tone-good",
  info: "text-tone-info",
  caution: "text-tone-caution",
  warn: "text-tone-warn",
  danger: "text-tone-danger",
  extreme: "text-tone-extreme",
};

const TONE_BG: Record<Tone, string> = {
  good: "bg-tone-good",
  info: "bg-tone-info",
  caution: "bg-tone-caution",
  warn: "bg-tone-warn",
  danger: "bg-tone-danger",
  extreme: "bg-tone-extreme",
};

const TONE_BORDER: Record<Tone, string> = {
  good: "border-tone-good",
  info: "border-tone-info",
  caution: "border-tone-caution",
  warn: "border-tone-warn",
  danger: "border-tone-danger",
  extreme: "border-tone-extreme",
};

export function toneText(tone: Tone): string {
  return TONE_TEXT[tone];
}

/* ----------------------------------------------------------------- panel */

export function Panel({
  id,
  title,
  subtitle,
  actions,
  children,
  tone,
}: {
  id: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Pinta una franja de color a la izquierda del encabezado. */
  tone?: Tone;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="scroll-mt-20 border-t border-rule"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-5 sm:px-6">
        {tone ? (
          <span
            aria-hidden="true"
            className={`mt-1 h-3 w-1 shrink-0 rounded-sm ${TONE_BG[tone]}`}
          />
        ) : null}
        <h2
          id={`${id}-titulo`}
          className="eyebrow text-[12px] text-ink-soft sm:text-[13px]"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="max-w-prose text-[11px] leading-tight text-ink-dim">
            {subtitle}
          </p>
        ) : null}
        {actions ? <div className="ml-auto">{actions}</div> : null}
      </div>
      <div className="px-4 pb-6 pt-3 sm:px-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ filas */

/** Fila de registro: etiqueta a la izquierda, cifra a la derecha. */
export function Row({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule/50 py-1.5 last:border-b-0">
      <dt className="flex min-w-0 items-baseline gap-1.5 text-[12px] text-ink-dim">
        <span className="truncate">{label}</span>
        {hint ? (
          <span className="hidden shrink-0 text-[10px] text-ink-dim/70 sm:inline">
            {hint}
          </span>
        ) : null}
      </dt>
      <dd
        className={`numeric shrink-0 text-right text-[13px] ${
          tone ? TONE_TEXT[tone] : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function RowList({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-8 sm:grid-cols-2">{children}</dl>;
}

/* -------------------------------------------------------------- etiquetas */

export function Badge({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`numeric inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] ${TONE_BORDER[tone]} ${TONE_TEXT[tone]}`}
    >
      {children}
    </span>
  );
}

/** Cifra grande con etiqueta: la usan "Ahora" y los promedios del clima. */
export function BigStat({
  value,
  unit,
  label,
  tone,
  size = "lg",
}: {
  value: ReactNode;
  unit?: string;
  label: string;
  tone?: Tone;
  size?: "lg" | "md";
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1">
        <span
          className={`numeric font-medium leading-none ${
            size === "lg" ? "text-5xl sm:text-6xl" : "text-2xl"
          } ${tone ? TONE_TEXT[tone] : "text-ink"}`}
        >
          {value}
        </span>
        {unit ? (
          <span className="numeric text-base text-ink-dim">{unit}</span>
        ) : null}
      </div>
      <div className="eyebrow mt-1.5 text-[10px] text-ink-dim">{label}</div>
    </div>
  );
}

/* ----------------------------------------------------------- estados */

/**
 * Envoltorio de datos: si la fuente falló, muestra un aviso honesto con el
 * motivo; si llegó, entrega los datos. Cada módulo decide qué hacer con el error,
 * pero el mensaje es siempre el mismo formato.
 */
export function DataState<T>({
  result,
  what,
  children,
}: {
  result: Fetched<T>;
  what: string;
  children: (data: T) => ReactNode;
}) {
  if (!result.ok) {
    return (
      <div className="border-l-2 border-tone-warn/60 bg-night-900/60 py-3 pl-3">
        <p className="text-[13px] text-ink-soft">
          No se pudo cargar {what}.
        </p>
        <p className="numeric mt-0.5 text-[11px] text-ink-dim">
          Motivo: {result.error}
        </p>
        <p className="mt-1 text-[11px] text-ink-dim">
          Vuelve a cargar en unos minutos; el resto del panel sigue disponible.
        </p>
      </div>
    );
  }
  return <>{children(result.data)}</>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-4 rounded-sm bg-night-800"
          style={{ width: `${92 - index * 9}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-ink-dim">{children}</p>;
}

/** Nota metodológica: qué mide de verdad el dato y qué no. */
export function Caveat({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 border-l border-rule-strong pl-3 text-[11px] leading-relaxed text-ink-dim">
      {children}
    </p>
  );
}
