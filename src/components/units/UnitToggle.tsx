"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { UNITS_COOKIE, UNIT_LABELS, type UnitSystemId } from "@/lib/units";

/**
 * Conmutador de unidades.
 *
 * Ciudad Juárez está en la frontera: hay quien piensa en grados Celsius y quien
 * piensa en Fahrenheit, y la misma persona cambia según con quién hable. Por eso
 * el conmutador está siempre a la vista y no escondido en un menú.
 *
 * Escribe una cookie y refresca: el formateo ocurre en el servidor, así que no
 * hay que reenviar los datos ni rehidratar nada.
 */
export default function UnitToggle({ current }: { current: UnitSystemId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options: Array<{ id: UnitSystemId; label: string; detail: string }> = [
    { id: "metric", label: "Métrico", detail: UNIT_LABELS.temperature.c },
    { id: "imperial", label: "Imperial", detail: UNIT_LABELS.temperature.f },
  ];

  const choose = (value: UnitSystemId) => {
    if (value === current) return;
    document.cookie = `${UNITS_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label="Sistema de unidades"
      className="inline-flex items-center rounded-sm border border-rule"
    >
      {options.map((option) => {
        const active = option.id === current;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => choose(option.id)}
            aria-pressed={active}
            disabled={pending}
            className={`numeric px-2.5 py-1 text-[11px] transition-colors ${
              active
                ? "bg-ember-deep/40 text-ink"
                : "text-ink-dim hover:text-ink-soft"
            } ${pending ? "opacity-60" : ""}`}
            title={`Mostrar las cifras en ${option.label.toLowerCase()} (${option.detail})`}
          >
            {option.label}
            <span className="ml-1 text-ink-dim">{option.detail}</span>
          </button>
        );
      })}
    </div>
  );
}
