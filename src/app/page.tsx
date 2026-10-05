import { Suspense } from "react";

import Footer from "@/components/shell/Footer";
import Header from "@/components/shell/Header";
import { DataState, Panel, Skeleton } from "@/components/ui/primitives";

import AlertsPanel from "@/components/sections/AlertsPanel";
import ColumnRail from "@/components/sections/ColumnRail";
import DailyPanel from "@/components/sections/DailyPanel";
import HourlyPanel from "@/components/sections/HourlyPanel";
import MinutelyPanel from "@/components/sections/MinutelyPanel";
import NowPanel from "@/components/sections/NowPanel";

import AirQualityPanel from "@/components/sections/AirQualityPanel";
import ClimatePanel from "@/components/sections/ClimatePanel";
import EnsemblePanel from "@/components/sections/EnsemblePanel";
import ModelsPanel from "@/components/sections/ModelsPanel";
import RadarPanel from "@/components/sections/RadarPanel";
import SoilPanel from "@/components/sections/SoilPanel";
import SunPanel from "@/components/sections/SunPanel";
import ZonesPanel from "@/components/sections/ZonesPanel";

import { getForecast } from "@/lib/sources/forecast";
import { getMinutely } from "@/lib/sources/minutely";
import { getUnitSystem, getUnitSystemId } from "@/lib/preferences";
import type { UnitSystem } from "@/lib/units";

/**
 * La hoja de registro completa.
 *
 * Cada módulo se pide y se pinta por su cuenta, dentro de su propio límite de
 * Suspense: si una fuente tarda o falla, el resto de la página sigue en pie. Las
 * secciones que comparten el pronóstico detallado no multiplican las llamadas,
 * porque Next.js deduplica las peticiones idénticas dentro del mismo renderizado.
 *
 * En pantallas anchas la columna vertical ocupa una columna fija a la derecha y
 * acompaña al desplazamiento; en el teléfono aparece en su sitio lógico, justo
 * después de las condiciones actuales.
 */

export const metadata = {
  description:
    "Condiciones actuales, avance cada 15 minutos, 168 horas y 16 días para Ciudad Juárez, con comparación de modelos, ensamble, calidad del aire, suelo, climatología y radar.",
};

function Fallback({ id, title }: { id: string; title: string }) {
  return (
    <Panel id={id} title={title}>
      <Skeleton rows={5} />
    </Panel>
  );
}

type SectionProps = { units: UnitSystem };

async function NowSection({ units }: SectionProps) {
  const result = await getForecast();
  return (
    <DataState result={result} what="las condiciones actuales">
      {(forecast) => <NowPanel forecast={forecast} units={units} />}
    </DataState>
  );
}

async function ColumnSection({ units }: SectionProps) {
  const result = await getForecast();
  return (
    <DataState result={result} what="el perfil vertical">
      {(forecast) => <ColumnRail forecast={forecast} units={units} />}
    </DataState>
  );
}

async function MinutelySection({ units }: SectionProps) {
  // Ojo: el detalle de quince minutos NO viene en la petición del pronóstico
  // detallado, que pide horas y días. Tiene su propia llamada; usar la del
  // pronóstico dejaba el módulo diciendo "el modelo no publicó datos".
  const result = await getMinutely();
  return (
    <DataState result={result} what="el detalle de quince minutos">
      {(minutely) => <MinutelyPanel forecast={minutely} units={units} />}
    </DataState>
  );
}

async function HourlySection({ units }: SectionProps) {
  const result = await getForecast();
  return (
    <DataState result={result} what="el pronóstico por hora">
      {(forecast) => <HourlyPanel forecast={forecast} units={units} />}
    </DataState>
  );
}

async function DailySection({ units }: SectionProps) {
  const result = await getForecast();
  return (
    <DataState result={result} what="el pronóstico de 16 días">
      {(forecast) => <DailyPanel forecast={forecast} units={units} />}
    </DataState>
  );
}

export default async function Page() {
  const units = await getUnitSystem();
  const unitsId = await getUnitSystemId();

  return (
    <div className="mx-auto max-w-[1560px] pb-10">
      <Header unitsId={unitsId} />

      <main className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="order-1 lg:col-start-1">
          <Suspense fallback={<Fallback id="avisos" title="Avisos" />}>
            <AlertsPanel />
          </Suspense>
        </div>

        <div className="order-2 lg:col-start-1">
          <Suspense fallback={<Fallback id="ahora" title="Ahora mismo" />}>
            <NowSection units={units} />
          </Suspense>
        </div>

        {/* Columna vertical: elemento firma. Una sola instancia, recolocada por CSS. */}
        <aside
          aria-label="Perfil vertical de la atmósfera"
          className="order-3 lg:sticky lg:top-0 lg:col-start-2 lg:row-span-[40] lg:row-start-1 lg:max-h-screen lg:self-start lg:overflow-y-auto lg:border-l lg:border-rule"
        >
          <Suspense fallback={<Fallback id="columna" title="Columna vertical" />}>
            <ColumnSection units={units} />
          </Suspense>
        </aside>

        <div className="order-4 lg:col-start-1">
          <Suspense
            fallback={<Fallback id="quince-minutos" title="Próximas 2 horas" />}
          >
            <MinutelySection units={units} />
          </Suspense>
        </div>

        <div className="order-5 lg:col-start-1">
          <Suspense
            fallback={
              <Fallback id="ciento-sesenta-y-ocho-horas" title="Próximas 168 horas" />
            }
          >
            <HourlySection units={units} />
          </Suspense>
        </div>

        <div className="order-6 lg:col-start-1">
          <Suspense
            fallback={<Fallback id="dieciseis-dias" title="Próximos 16 días" />}
          >
            <DailySection units={units} />
          </Suspense>
        </div>

        <div className="order-7 lg:col-start-1">
          <Suspense fallback={<Fallback id="modelos" title="Seis modelos" />}>
            <ModelsPanel units={units} />
          </Suspense>
        </div>

        <div className="order-8 lg:col-start-1">
          <Suspense
            fallback={<Fallback id="ensamble" title="Ensamble de 30 miembros" />}
          >
            <EnsemblePanel units={units} />
          </Suspense>
        </div>

        <div className="order-9 lg:col-start-1">
          <Suspense fallback={<Fallback id="aire" title="Calidad del aire" />}>
            <AirQualityPanel units={units} />
          </Suspense>
        </div>

        <div className="order-10 lg:col-start-1">
          <Suspense fallback={<Fallback id="sol" title="Sol y radiación" />}>
            <SunPanel units={units} />
          </Suspense>
        </div>

        <div className="order-11 lg:col-start-1">
          <Suspense fallback={<Fallback id="suelo" title="Suelo y agricultura" />}>
            <SoilPanel units={units} />
          </Suspense>
        </div>

        <div className="order-12 lg:col-start-1">
          <Suspense fallback={<Fallback id="zonas" title="Por zonas de la ciudad" />}>
            <ZonesPanel units={units} />
          </Suspense>
        </div>

        <div className="order-13 lg:col-start-1">
          <Suspense fallback={<Fallback id="clima" title="Histórico y clima" />}>
            <ClimatePanel units={units} />
          </Suspense>
        </div>

        <div className="order-14 lg:col-start-1">
          <Suspense fallback={<Fallback id="radar" title="Radar" />}>
            <RadarPanel units={units} />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
