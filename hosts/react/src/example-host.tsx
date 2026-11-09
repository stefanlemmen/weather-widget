import type { LocationSelectDetail } from "@weather-widget/location-picker";
import { useState } from "react";

const NIEUWEGEIN: LocationSelectDetail = {
  latitude: 52.03,
  longitude: 5.08,
  name: null,
};

export const ExampleHost = () => {
  const [chosen, setChosen] = useState(NIEUWEGEIN);

  return (
    <main>
      <h1>Weather Widget in React</h1>
      <figure>
        <figcaption>Choose a Location to show it in this Widget.</figcaption>
        <weather-location-picker
          onlocation-select={({ detail }) => {
            setChosen(detail);
          }}
        />
        <weather-widget
          latitude={chosen.latitude}
          longitude={chosen.longitude}
          locationName={chosen.name ?? undefined}
        />
      </figure>
      <div className="examples">
        <figure>
          <figcaption>
            Dutch: <code>locale="nl"</code>
          </figcaption>
          <weather-widget
            latitude={NIEUWEGEIN.latitude}
            longitude={NIEUWEGEIN.longitude}
            locale="nl"
          />
        </figure>
        <figure>
          <figcaption>
            Imperial units: <code>units="imperial"</code>
          </figcaption>
          <weather-widget
            latitude={NIEUWEGEIN.latitude}
            longitude={NIEUWEGEIN.longitude}
            units="imperial"
          />
        </figure>
        <figure>
          <figcaption>Themed with five CSS custom properties</figcaption>
          <weather-widget
            latitude={NIEUWEGEIN.latitude}
            longitude={NIEUWEGEIN.longitude}
            style={{
              "--weather-font": "Georgia, serif",
              "--weather-background": "#fffaf2",
              "--weather-ink": "#2b1d16",
              "--weather-accent": "#9c3412",
              "--weather-radius": 0,
            }}
          />
        </figure>
      </div>
    </main>
  );
};
