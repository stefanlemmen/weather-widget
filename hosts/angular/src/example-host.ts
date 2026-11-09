import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";
import type { LocationSelectDetail } from "@weather-widget/location-picker";

const NIEUWEGEIN: LocationSelectDetail = {
  latitude: 52.03,
  longitude: 5.08,
  name: null,
};

@Component({
  selector: "example-host",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main>
      <h1>Weather Widget in Angular</h1>
      <figure>
        <figcaption>Choose a Location to show it in this Widget.</figcaption>
        <weather-location-picker
          (location-select)="chosen.set($event.detail)"
        ></weather-location-picker>
        <weather-widget
          [latitude]="chosen().latitude"
          [longitude]="chosen().longitude"
          [locationName]="chosen().name ?? undefined"
        ></weather-widget>
      </figure>
      <div class="examples">
        <figure>
          <figcaption>Dutch: <code>locale="nl"</code></figcaption>
          <weather-widget
            [latitude]="nieuwegein.latitude"
            [longitude]="nieuwegein.longitude"
            locale="nl"
          ></weather-widget>
        </figure>
        <figure>
          <figcaption>Imperial units: <code>units="imperial"</code></figcaption>
          <weather-widget
            [latitude]="nieuwegein.latitude"
            [longitude]="nieuwegein.longitude"
            units="imperial"
          ></weather-widget>
        </figure>
        <figure>
          <figcaption>Themed with five CSS custom properties</figcaption>
          <weather-widget
            [latitude]="nieuwegein.latitude"
            [longitude]="nieuwegein.longitude"
            style="
              --weather-font: Georgia, serif;
              --weather-background: #fffaf2;
              --weather-ink: #2b1d16;
              --weather-accent: #9c3412;
              --weather-radius: 0;
            "
          ></weather-widget>
        </figure>
      </div>
    </main>
  `,
})
export class ExampleHost {
  protected readonly nieuwegein = NIEUWEGEIN;
  protected readonly chosen = signal(NIEUWEGEIN);
}
