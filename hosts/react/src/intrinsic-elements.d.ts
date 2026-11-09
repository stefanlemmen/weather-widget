import type {
  LOCATION_SELECT_EVENT,
  LocationSelectDetail,
  WEATHER_LOCATION_PICKER_TAG,
  WeatherLocationPicker,
} from "@weather-widget/location-picker";
import type { WEATHER_WIDGET_TAG, WeatherWidget } from "@weather-widget/widget";
import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react";

type CustomElementProps<Element extends HTMLElement> = DetailedHTMLProps<
  HTMLAttributes<Element>,
  Element
>;

type WeatherThemeProperty =
  | "--weather-font"
  | "--weather-background"
  | "--weather-ink"
  | "--weather-accent"
  | "--weather-radius";

type WeatherWidgetProps = Omit<CustomElementProps<WeatherWidget>, "style"> &
  Partial<
    Pick<
      WeatherWidget,
      | "latitude"
      | "longitude"
      | "locationName"
      | "locale"
      | "units"
      | "parts"
      | "proxyUrl"
    >
  > & {
    style?: CSSProperties &
      Partial<Record<WeatherThemeProperty, string | number>>;
  };

type WeatherLocationPickerProps = CustomElementProps<WeatherLocationPicker> &
  Partial<Pick<WeatherLocationPicker, "locale" | "proxyUrl">> &
  Partial<
    Record<
      `on${typeof LOCATION_SELECT_EVENT}`,
      (event: CustomEvent<LocationSelectDetail>) => void
    >
  >;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements
      extends
        Record<typeof WEATHER_WIDGET_TAG, WeatherWidgetProps>,
        Record<
          typeof WEATHER_LOCATION_PICKER_TAG,
          WeatherLocationPickerProps
        > {}
  }
}
