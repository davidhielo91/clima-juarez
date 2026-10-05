import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * Barlow viene de la señalización de carretera del suroeste estadounidense, que
 * es el paisaje de esta ciudad fronteriza. Plex Mono es la voz de los
 * instrumentos: todas las cifras del panel la usan.
 */
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Clima Ciudad Juárez — estación detallada",
    template: "%s · Clima Ciudad Juárez",
  },
  description:
    "Panel detallado del clima en Ciudad Juárez, Chihuahua: condiciones actuales, avance cada 15 minutos, 168 horas, 16 días, comparación de 6 modelos, ensamble de 30 miembros, calidad del aire, perfil del suelo, climatología de 30 años y radar.",
  applicationName: "Clima Juárez",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Clima Juárez",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#12141c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-MX"
      className={`${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
