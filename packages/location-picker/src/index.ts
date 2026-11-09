import {
  LOCATION_SELECT_EVENT,
  WEATHER_LOCATION_PICKER_TAG,
  WeatherLocationPicker,
  type LocationSelectDetail,
} from "./weather-location-picker.ts";

export {
  LOCATION_SELECT_EVENT,
  WEATHER_LOCATION_PICKER_TAG,
  WeatherLocationPicker,
  type LocationSelectDetail,
};

if (!customElements.get(WEATHER_LOCATION_PICKER_TAG)) {
  customElements.define(WEATHER_LOCATION_PICKER_TAG, WeatherLocationPicker);
}

declare global {
  interface HTMLElementTagNameMap {
    [WEATHER_LOCATION_PICKER_TAG]: WeatherLocationPicker;
  }

  interface HTMLElementEventMap {
    [LOCATION_SELECT_EVENT]: CustomEvent<LocationSelectDetail>;
  }
}
