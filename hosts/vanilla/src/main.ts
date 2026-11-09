import type { LocationSelectDetail } from "@weather-widget/location-picker";
import {
  LOCALES,
  UNITS,
  WIDGET_ATTRIBUTE_NAMES,
  widgetAttributes,
  widgetMarkup,
  type WidgetConfig,
} from "./widget-markup.ts";

const WIDGET_SETTINGS_SELECTOR = "#widget-settings";
const CONTROLLED_WIDGET_SELECTOR = "#controlled-widget";
const CONTROLLED_WIDGET_MARKUP_SELECTOR = "#controlled-widget-markup";
const LOCATION_PICKER_SELECTOR = "weather-location-picker";
const LOCALE_FIELD = "locale";
const UNITS_FIELD = "units";

const NIEUWEGEIN: LocationSelectDetail = {
  latitude: 52.03,
  longitude: 5.08,
  name: null,
};

const elementOf = <T extends Element>(
  selector: string,
  type: abstract new () => T,
): T => {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`The Example host misses ${selector}`);
  }
  return element;
};

const parseOption = <T extends string>(
  options: readonly T[],
  value: FormDataEntryValue | null,
): T => {
  const option = options.find((candidate) => candidate === value);
  if (option === undefined) {
    throw new Error(`A Widget setting is none of ${options.join(", ")}`);
  }
  return option;
};

const settings = elementOf(WIDGET_SETTINGS_SELECTOR, HTMLFormElement);
const widget = elementOf(CONTROLLED_WIDGET_SELECTOR, HTMLElement);
const snippet = elementOf(CONTROLLED_WIDGET_MARKUP_SELECTOR, HTMLElement);
const picker = elementOf(LOCATION_PICKER_SELECTOR, HTMLElement);

const configFrom = (
  form: HTMLFormElement,
  location: LocationSelectDetail,
): WidgetConfig => {
  const values = new FormData(form);
  return {
    location,
    locale: parseOption(LOCALES, values.get(LOCALE_FIELD)),
    units: parseOption(UNITS, values.get(UNITS_FIELD)),
  };
};

const show = (config: WidgetConfig) => {
  const attributes = widgetAttributes(config);
  for (const name of WIDGET_ATTRIBUTE_NAMES) {
    const value = attributes.get(name);
    if (value === undefined) widget.removeAttribute(name);
    else widget.setAttribute(name, value);
  }
  snippet.textContent = widgetMarkup(attributes);
};

let config = configFrom(settings, NIEUWEGEIN);
show(config);

settings.addEventListener("change", () => {
  config = configFrom(settings, config.location);
  show(config);
});

picker.addEventListener("location-select", ({ detail }) => {
  config = { ...config, location: detail };
  show(config);
});
