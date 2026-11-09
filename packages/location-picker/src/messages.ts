import type { Locale } from "@weather-widget/contract";

export type LocationError = "denied" | "timedOut" | "unavailable";

export interface Messages {
  readonly chooseALocation: string;
  readonly location: string;
  readonly search: string;
  readonly useMyLocation: string;
  readonly locationsFound: string;
  readonly searching: (term: string) => string;
  readonly foundCount: (count: number) => string;
  readonly noneFound: (term: string) => string;
  readonly chosen: (name: string) => string;
  readonly searchFailed: string;
  readonly locating: string;
  readonly locationErrors: Readonly<Record<LocationError, string>>;
  readonly creditSearchBy: string;
  readonly creditPlaceNamesFrom: string;
}

const en: Messages = {
  chooseALocation: "Choose a location",
  location: "Location",
  search: "Search",
  useMyLocation: "Use my location",
  locationsFound: "Locations found",
  searching: (term) => `Searching for “${term}”…`,
  foundCount: (count) =>
    count === 1 ? "1 location found" : `${String(count)} locations found`,
  noneFound: (term) =>
    `No locations found for “${term}”. Check the spelling or try a nearby town.`,
  chosen: (name) => `${name} chosen`,
  searchFailed: "Search isn't working right now. Try again in a moment.",
  locating: "Finding your location…",
  locationErrors: {
    denied:
      "Location access is off. You can turn it on in your browser settings.",
    timedOut: "Finding your location took too long. Try again.",
    unavailable:
      "Your device couldn't find its location. Try again or search by name.",
  },
  creditSearchBy: "Search by",
  creditPlaceNamesFrom: "place names from",
};

const nl: Messages = {
  chooseALocation: "Kies een locatie",
  location: "Locatie",
  search: "Zoeken",
  useMyLocation: "Gebruik mijn locatie",
  locationsFound: "Gevonden locaties",
  searching: (term) => `Zoeken naar ‘${term}’…`,
  foundCount: (count) =>
    count === 1 ? "1 locatie gevonden" : `${String(count)} locaties gevonden`,
  noneFound: (term) =>
    `Geen locaties gevonden voor ‘${term}’. Controleer de spelling of probeer een plaats in de buurt.`,
  chosen: (name) => `${name} gekozen`,
  searchFailed: "Zoeken werkt nu niet. Probeer het zo opnieuw.",
  locating: "Locatie bepalen…",
  locationErrors: {
    denied: "Locatietoegang staat uit. Zet die aan in de browserinstellingen.",
    timedOut: "Locatie bepalen duurde te lang. Probeer het opnieuw.",
    unavailable:
      "Je apparaat kon zijn locatie niet vinden. Probeer het opnieuw of zoek op naam.",
  },
  creditSearchBy: "Zoeken via",
  creditPlaceNamesFrom: "plaatsnamen van",
};

export const MESSAGES: Readonly<Record<Locale, Messages>> = {
  en,
  nl,
};
