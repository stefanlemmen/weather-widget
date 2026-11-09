import { readFileSync } from "node:fs";

export const LOCATION_PICKER_MODULE_DIRECTORY = "location-picker";
export const LOCATION_PICKER_MODULE_FILE = "weather-location-picker.js";
export const LOCATION_PICKER_MODULE_PATH = `/${LOCATION_PICKER_MODULE_DIRECTORY}/${LOCATION_PICKER_MODULE_FILE}`;

const LUCIDE_LICENSE = readFileSync(
  new URL("../lucide-LICENSE", import.meta.url),
  "utf8",
);
export const LUCIDE_NOTICE = `/*! Lucide (https://lucide.dev)\n\n${LUCIDE_LICENSE}*/`;
