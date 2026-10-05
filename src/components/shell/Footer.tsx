import InstallPrompt from "@/components/pwa/InstallPrompt";
import NotificationPermission from "@/components/pwa/NotificationPermission";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import { POINT } from "@/lib/endpoints.mjs";

/**
 * Pie de la hoja: de dónde salen los datos, qué límites tienen y qué NO es esta
 * página. Es la parte que evita que alguien confunda un modelo con un aviso
 * oficial, así que va en texto claro y no escondida.
 */
export default function Footer() {
  return (
    <footer className="border-t border-rule px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <h2 className="eyebrow text-[11px] text-ink-soft">
            De dónde salen los datos
          </h2>
          <ul className="mt-3 grid gap-1.5 text-[12px] text-ink-dim">
            <li>
              Pronóstico, ensamble de 30 miembros, climatología y calidad del aire:{" "}
              <a
                className="text-ink-soft underline decoration-rule-strong underline-offset-4"
                href="https://open-meteo.com/"
                rel="noreferrer noopener"
                target="_blank"
              >
                Open-Meteo
              </a>
              , que a su vez agrega los modelos del Centro Europeo (ECMWF), la NOAA
              (GFS), el servicio alemán (ICON), Canadá (GEM), Météo-France (ARPEGE) y
              el Met Office (UM), y el servicio europeo de vigilancia atmosférica
              (CAMS) para los contaminantes.
            </li>
            <li>
              Radar de precipitación:{" "}
              <a
                className="text-ink-soft underline decoration-rule-strong underline-offset-4"
                href="https://www.rainviewer.com/"
                rel="noreferrer noopener"
                target="_blank"
              >
                RainViewer
              </a>
              . Cartografía base:{" "}
              <a
                className="text-ink-soft underline decoration-rule-strong underline-offset-4"
                href="https://www.openstreetmap.org/copyright"
                rel="noreferrer noopener"
                target="_blank"
              >
                colaboradores de OpenStreetMap
              </a>
              .
            </li>
          </ul>

          <h2 className="eyebrow mt-6 text-[11px] text-ink-soft">
            Qué límites tiene
          </h2>
          <ul className="mt-3 grid gap-1.5 text-[12px] text-ink-dim">
            <li>
              El pronóstico llega de una malla de modelo, no de sensores en tu
              colonia. Cuando pides {POINT.latitude}°, {POINT.longitude}°, el modelo
              responde con la celda más cercana, que suele estar a varios kilómetros.
            </li>
            <li>
              La calidad del aire viene de una celda de unos 11 km: sirve para la
              cuenca atmosférica compartida con El Paso, no para una calle.
            </li>
            <li>
              Más allá de siete días la incertidumbre crece de verdad. Los paneles de
              modelos y de ensamble están justamente para que eso se vea, en lugar de
              esconderlo detrás de una cifra única.
            </li>
            <li>
              Los avisos de esta página son umbrales propios calculados sobre el
              pronóstico. <strong className="text-ink-soft">No son avisos oficiales</strong> y no
              sustituyen a Protección Civil ni al Servicio Meteorológico Nacional.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow text-[11px] text-ink-soft">Esta aplicación</h2>
          <div className="mt-3 grid gap-3">
            <NotificationPermission />
            <InstallPrompt />
          </div>
          <p className="mt-4 text-[11px] text-ink-dim">
            Se puede instalar como aplicación: queda en tu pantalla de inicio y
            guarda la última lectura para que la veas sin conexión. Los datos en vivo
            siempre se piden a la red, nunca se sirven de caché, para que no veas un
            pronóstico viejo.
          </p>
          <p className="numeric mt-4 text-[10px] text-ink-dim">
            Ciudad Juárez, {POINT.admin} · zona horaria {POINT.timezone} · datos
            abiertos, sin claves de API
          </p>
        </div>
      </div>
      <ServiceWorkerRegistrar />
    </footer>
  );
}
