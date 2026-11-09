import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { METEOCONS_NOTICE } from "../src/build-output.ts";

const METEOCON_NAMES = [
  "clear-day",
  "clear-night",
  "partly-cloudy-day",
  "partly-cloudy-night",
  "overcast-day",
  "overcast-night",
  "cloudy",
  "fog-day",
  "fog-night",
  "haze-day",
  "haze-night",
  "drizzle",
  "rain",
  "sleet",
  "snow",
  "thunderstorms-day",
  "thunderstorms-night",
  "not-available",
  "thermometer",
  "raindrop",
] as const;

const ANIMATED_METEOCONS = "@meteocons/svg/monochrome";
const STILL_METEOCONS = "@meteocons/svg-static/monochrome";
const ICON_SVGS_MODULE = new URL("../src/icon-svgs.ts", import.meta.url);
const OWN_ICONS = new URL("../src/icons/", import.meta.url);

const readMeteocon = (directory: string, name: string) =>
  readFile(
    fileURLToPath(import.meta.resolve(`${directory}/${name}.svg`)),
    "utf8",
  );
const readOwnIcon = (name: string) =>
  readFile(new URL(`${name}.svg`, OWN_ICONS), "utf8");

const meteocons = Object.fromEntries(
  await Promise.all(
    METEOCON_NAMES.map(
      async (name) =>
        [
          name,
          {
            animated: await readMeteocon(ANIMATED_METEOCONS, name),
            still: await readMeteocon(STILL_METEOCONS, name),
          },
        ] as const,
    ),
  ),
);

const iconSvgs = {
  meteocons,
  windCompass: await readOwnIcon("wind-compass"),
  notAvailableMark: await readOwnIcon("not-available"),
};

const source = `${METEOCONS_NOTICE}\nexport const ICON_SVGS = ${JSON.stringify(iconSvgs)} as const;\n`;
const prettierConfig = await resolveConfig(fileURLToPath(ICON_SVGS_MODULE));

await writeFile(
  ICON_SVGS_MODULE,
  await format(source, { ...prettierConfig, parser: "typescript" }),
);
