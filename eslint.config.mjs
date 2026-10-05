import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/sw.js",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/components/radar/**/*.tsx"],
    rules: {
      // Las teselas del radar y del mapa base son imágenes de mapa: decenas por
      // vista, con URL que cambia en cada fotograma y ya en PNG desde el origen.
      // Pasarlas por `next/image` mandaría cada tesela al optimizador una por una,
      // que es exactamente el intercambio equivocado. Aquí el `<img>` es la
      // decisión correcta, no un descuido.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
