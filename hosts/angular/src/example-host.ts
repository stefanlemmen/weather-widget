import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
  signal,
} from "@angular/core";
import type { LocationSelectDetail } from "@weather-widget/location-picker";

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
  { value: "current", label: "Current weather" },
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
type RadioSetting = Exclude<keyof typeof DEFAULT_SETTINGS, "parts">;
type RadioChoice = Readonly<{
  legend: string;
  name: string;
  setting: RadioSetting;
  options: readonly Option[];
}>;

const RADIO_CHOICES = {
  locale: {
    legend: "Locale",
    name: "locale",
    setting: "locale",
    options: LOCALES,
  },
  units: { legend: "Units", name: "units", setting: "units", options: UNITS },
  theme: { legend: "Theme", name: "theme", setting: "theme", options: THEMES },
  colorScheme: {
    legend: "Color scheme",
    name: "color-scheme",
    setting: "colorScheme",
    options: COLOR_SCHEMES,
  },
  width: { legend: "Width", name: "width", setting: "width", options: WIDTHS },
} satisfies Record<RadioSetting, RadioChoice>;

@Component({
  selector: "fieldset[radio-group]",
  template: `
    <legend>{{ choice().legend }}</legend>
    @for (option of choice().options; track option.value) {
      <label
        ><input
          type="radio"
          [name]="choice().name"
          [value]="option.value"
          [checked]="option.value === checked()"
          (change)="choose.emit(option.value)"
        />
        {{ option.label }}</label
      >
    }
  `,
})
class RadioGroup {
  readonly choice = input.required<RadioChoice>();
  readonly checked = input.required<string>();
  readonly choose = output<string>();
}

@Component({
  selector: "example-host",
  imports: [RadioGroup],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main>
      <h1>Weather Widget in Angular</h1>
      <details open>
        <summary><h2 [id]="settingsTitleId">Widget settings</h2></summary>
        <form [attr.aria-labelledby]="settingsTitleId">
          <fieldset
            radio-group
            [choice]="radioChoices.locale"
            [checked]="settings().locale"
            (choose)="chooseSetting(radioChoices.locale.setting, $event)"
          ></fieldset>
          <fieldset
            radio-group
            [choice]="radioChoices.units"
            [checked]="settings().units"
            (choose)="chooseSetting(radioChoices.units.setting, $event)"
          ></fieldset>
          <fieldset [attr.aria-describedby]="forecastPartsHintId">
            <legend>Forecast parts</legend>
            @for (part of forecastParts; track part.value) {
              <label
                ><input
                  #box
                  type="checkbox"
                  name="parts"
                  [value]="part.value"
                  [checked]="settings().parts.includes(part.value)"
                  (change)="toggleForecastPart(part.value, box)"
                />
                {{ part.label }}</label
              >
            }
            <p [id]="forecastPartsHintId" role="status">
              {{ partsRefused() ? forecastPartsHint : "" }}
            </p>
          </fieldset>
          <fieldset
            radio-group
            [choice]="radioChoices.theme"
            [checked]="settings().theme"
            (choose)="chooseSetting(radioChoices.theme.setting, $event)"
          ></fieldset>
          <fieldset
            radio-group
            [choice]="radioChoices.colorScheme"
            [checked]="settings().colorScheme"
            (choose)="chooseSetting(radioChoices.colorScheme.setting, $event)"
          ></fieldset>
          <fieldset
            radio-group
            [choice]="radioChoices.width"
            [checked]="settings().width"
            (choose)="chooseSetting(radioChoices.width.setting, $event)"
          ></fieldset>
        </form>
      </details>
      <weather-location-picker
        (location-select)="location.set($event.detail)"
      ></weather-location-picker>
      <weather-widget
        [latitude]="location().latitude"
        [longitude]="location().longitude"
        [locationName]="location().name ?? undefined"
        [locale]="settings().locale || undefined"
        [units]="settings().units || undefined"
        [parts]="parts()"
        [style]="widgetStyle()"
      ></weather-widget>
    </main>
  `,
})
export class ExampleHost {
  protected readonly radioChoices = RADIO_CHOICES;
  protected readonly forecastParts = FORECAST_PARTS;
  protected readonly settingsTitleId = SETTINGS_TITLE_ID;
  protected readonly forecastPartsHintId = FORECAST_PARTS_HINT_ID;
  protected readonly forecastPartsHint = FORECAST_PARTS_HINT;

  protected readonly location = signal(NIEUWEGEIN);
  protected readonly settings = signal(DEFAULT_SETTINGS);
  protected readonly partsRefused = signal(false);

  protected readonly parts = computed(() => {
    const { parts } = this.settings();
    return parts.length < ALL_PARTS.length ? parts.join(" ") : undefined;
  });

  protected readonly widgetStyle = computed(() => {
    const { width, theme, colorScheme } = this.settings();
    return {
      "inline-size": `${width}px`,
      ...(theme ? THEMED_PRESET_STYLE : {}),
      ...(colorScheme ? { "color-scheme": colorScheme } : {}),
    };
  });

  protected chooseSetting(name: RadioSetting, value: string) {
    this.settings.update((previous) => ({ ...previous, [name]: value }));
  }

  protected toggleForecastPart(part: string, box: HTMLInputElement) {
    const parts = ALL_PARTS.filter((value) =>
      value === part ? box.checked : this.settings().parts.includes(value),
    );
    this.partsRefused.set(parts.length === 0);
    if (parts.length > 0) {
      this.settings.update((previous) => ({ ...previous, parts }));
    } else {
      box.checked = true;
    }
  }
}
