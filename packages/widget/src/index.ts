import { WEATHER_WIDGET_TAG, WeatherWidget } from "./weather-widget.ts";

export { WEATHER_WIDGET_TAG, WeatherWidget };

if (!customElements.get(WEATHER_WIDGET_TAG)) {
  customElements.define(WEATHER_WIDGET_TAG, WeatherWidget);
}

declare global {
  interface HTMLElementTagNameMap {
    [WEATHER_WIDGET_TAG]: WeatherWidget;
  }
}
