import Link from "next/link";

/**
 * Página de dirección no encontrada.
 *
 * La app es de una sola ciudad y una sola página: no hay rutas que explorar, así
 * que en vez de un 404 genérico se devuelve a la persona al panel con una
 * explicación breve.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="eyebrow text-[11px] text-ink-dim">
        Estación de campo · 404
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
        Esa dirección no existe
      </h1>
      <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-ink-soft">
        Este panel es de una sola página: todo el detalle del clima de Ciudad Juárez
        vive en la raíz. Puede que el enlace que seguiste esté viejo o mal escrito.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block bg-amber px-4 py-2 text-[13px] font-semibold text-night-950 transition-opacity hover:opacity-90"
      >
        Ver el panel del clima
      </Link>
    </main>
  );
}
