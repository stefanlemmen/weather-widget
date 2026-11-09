import type { LocationSelectDetail } from "@weather-widget/location-picker";
import { useState } from "react";

const NIEUWEGEIN: LocationSelectDetail = {
  latitude: 52.03,
  longitude: 5.08,
  name: null,
};

const FORECAST_PARTS_HINT =
  "The Widget always shows at least one Forecast part.";
const SETTINGS_TITLE_ID = "widget-settings-title";
const FORECAST_PARTS_HINT_ID = "forecast-parts-hint";

const THEMED_PRESET_STYLE = {
  "--weather-font": "Georgia, serif",
  "--weather-background": "light-dark(#fffaf2, #211814)",
  "--weather-ink": "light-dark(#2b1d16, #f6ede2)",
  "--weather-accent": "light-dark(#9c3412, #f0936a)",
  "--weather-radius": "0",
};

const LOCALES = [
  { value: "", label: "English" },
  { value: "nl", label: "Dutch" },
];
const UNITS = [
  { value: "", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];
const FORECAST_PARTS = [
  { value: "current", label: "Current conditions" },
  { value: "hourly", label: "Hourly forecast" },
  { value: "daily", label: "Daily forecast" },
];
const ALL_PARTS = FORECAST_PARTS.map(({ value }) => value);
const THEMES = [
  { value: "", label: "None" },
  { value: "preset", label: "Georgia and rust" },
];
const COLOR_SCHEMES = [
  { value: "", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const DEFAULT_WIDTH = 390;
const WIDTHS = [240, DEFAULT_WIDTH, 640, 760].map((width) => ({
  value: String(width),
  label: `${String(width)} pixels`,
}));

const DEFAULT_SETTINGS = {
  locale: "",
  units: "",
  parts: ALL_PARTS,
  theme: "",
  colorScheme: "",
  width: String(DEFAULT_WIDTH),
};

type Option = Readonly<{ value: string; label: string }>;

type RadioGroupProps = Readonly<{
  legend: string;
  name: string;
  options: readonly Option[];
  checked: string;
  onChange: (value: string) => void;
}>;

const RadioGroup = ({
  legend,
  name,
  options,
  checked,
  onChange,
}: RadioGroupProps) => (
  <fieldset>
    <legend>{legend}</legend>
    {options.map(({ value, label }) => (
      <label key={value}>
        <input
          type="radio"
          name={name}
          value={value}
          checked={value === checked}
          onChange={() => {
            onChange(value);
          }}
        />{" "}
        {label}
      </label>
    ))}
  </fieldset>
);

export const ExampleHost = () => {
  const [location, setLocation] = useState(NIEUWEGEIN);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [partsRefused, setPartsRefused] = useState(false);

  const settingFor =
    (name: Exclude<keyof typeof DEFAULT_SETTINGS, "parts">) =>
    (value: string) => {
      setSettings((previous) => ({ ...previous, [name]: value }));
    };

  const toggleForecastPart = (part: string, ticked: boolean) => {
    const parts = ALL_PARTS.filter((value) =>
      value === part ? ticked : settings.parts.includes(value),
    );
    setPartsRefused(parts.length === 0);
    if (parts.length > 0) setSettings((previous) => ({ ...previous, parts }));
  };

  return (
    <main>
      <h1>Weather Widget in React</h1>
      <details open>
        <summary>
          <h2 id={SETTINGS_TITLE_ID}>Widget settings</h2>
        </summary>
        <form aria-labelledby={SETTINGS_TITLE_ID}>
          <RadioGroup
            legend="Locale"
            name="locale"
            options={LOCALES}
            checked={settings.locale}
            onChange={settingFor("locale")}
          />
          <RadioGroup
            legend="Units"
            name="units"
            options={UNITS}
            checked={settings.units}
            onChange={settingFor("units")}
          />
          <fieldset aria-describedby={FORECAST_PARTS_HINT_ID}>
            <legend>Forecast parts</legend>
            {FORECAST_PARTS.map(({ value, label }) => (
              <label key={value}>
                <input
                  type="checkbox"
                  name="parts"
                  value={value}
                  checked={settings.parts.includes(value)}
                  onChange={({ target }) => {
                    toggleForecastPart(value, target.checked);
                  }}
                />{" "}
                {label}
              </label>
            ))}
            <p id={FORECAST_PARTS_HINT_ID} role="status">
              {partsRefused ? FORECAST_PARTS_HINT : ""}
            </p>
          </fieldset>
          <RadioGroup
            legend="Theme"
            name="theme"
            options={THEMES}
            checked={settings.theme}
            onChange={settingFor("theme")}
          />
          <RadioGroup
            legend="Color scheme"
            name="color-scheme"
            options={COLOR_SCHEMES}
            checked={settings.colorScheme}
            onChange={settingFor("colorScheme")}
          />
          <RadioGroup
            legend="Width"
            name="width"
            options={WIDTHS}
            checked={settings.width}
            onChange={settingFor("width")}
          />
        </form>
      </details>
      <weather-location-picker
        onlocation-select={({ detail }) => {
          setLocation(detail);
        }}
      />
      <weather-widget
        latitude={location.latitude}
        longitude={location.longitude}
        locationName={location.name ?? undefined}
        locale={settings.locale || undefined}
        units={settings.units || undefined}
        parts={
          settings.parts.length < ALL_PARTS.length
            ? settings.parts.join(" ")
            : undefined
        }
        style={{
          inlineSize: `${settings.width}px`,
          ...(settings.theme ? THEMED_PRESET_STYLE : {}),
          ...(settings.colorScheme
            ? { colorScheme: settings.colorScheme }
            : {}),
        }}
      />
    </main>
  );
};
