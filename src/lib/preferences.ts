import { cookies } from "next/headers";
import { IMPERIAL, METRIC, UNITS_COOKIE, type UnitSystem, type UnitSystemId } from "./units";

/**
 * Las unidades se guardan en una cookie y se resuelven en el servidor.
 *
 * Así el HTML llega ya con los números correctos: sin parpadeo al hidratar, sin
 * mandar los datos crudos al navegador y sin JavaScript obligatorio para leer el
 * panel. El conmutador solo escribe la cookie y refresca.
 */
export async function getUnitSystem(): Promise<UnitSystem> {
  return (await getUnitSystemId()) === "imperial" ? IMPERIAL : METRIC;
}

export async function getUnitSystemId(): Promise<UnitSystemId> {
  const store = await cookies();
  return store.get(UNITS_COOKIE)?.value === "imperial" ? "imperial" : "metric";
}
