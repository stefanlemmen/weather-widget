import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const WIDGET_MODULE_DIRECTORY = "widget";
export const WIDGET_MODULE_FILE = "weather-widget.js";
export const WIDGET_MODULE_PATH = `/${WIDGET_MODULE_DIRECTORY}/${WIDGET_MODULE_FILE}`;

const METEOCONS_LICENSE = readFileSync(
  fileURLToPath(import.meta.resolve("@meteocons/svg/LICENSE")),
  "utf8",
);
export const METEOCONS_NOTICE = `/*! Meteocons (https://github.com/basmilius/meteocons)\n\n${METEOCONS_LICENSE}*/`;
