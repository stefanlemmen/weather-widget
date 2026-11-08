---
name: Weather Widget
description: One quiet column that leads with the current temperature at one Location, and fits any Host page.
colors:
  ground: "#eef3f9"
  ink: "#13243a"
  accent: "#17703f"
  ground-dark: "#16263b"
  ink-dark: "#f2f5f9"
  accent-dark: "#6fdc9b"
  rain-base: "#3b82f0"
  rain: "color-mix(in oklab, rain-base 65%, ink)"
  ink-soft: "color-mix(in oklab, ink 82%, ground)"
  ink-muted: "color-mix(in oklab, ink 66%, ground)"
  band: "color-mix(in oklab, ink 6%, ground)"
  track: "color-mix(in oklab, ink 16%, ground)"
  field-border: "color-mix(in oklab, ink 55%, ground)"
typography:
  display:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 26.5cqi, 6.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  condition:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 500
    lineHeight: 1.4
  title:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1.4
  value:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "tnum"
  body:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  button:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.4
  footer:
    fontFamily: "Lexend, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  widget: "12px"
  control: "6px"
  bone: "4px"
  bar: "2px"
spacing:
  indent: "12px"
  inset: "clamp(1rem, 5cqi, 1.75rem)"
  group: "24px"
  section: "clamp(2rem, 12cqi, 3rem)"
  target: "44px"
  narrow: "20rem"
  wide: "35rem"
  widest: "45rem"
components:
  widget:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.widget}"
    padding: "24px {spacing.inset}"
  daily-band:
    backgroundColor: "{colors.band}"
    padding: "{spacing.inset}"
  range-track:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.bar}"
    height: "4px"
  range-fill:
    backgroundColor: "{colors.ink-muted}"
    rounded: "{rounded.bar}"
    height: "4px"
  chance-of-rain:
    textColor: "{colors.rain}"
    typography: "{typography.label}"
  link:
    textColor: "{colors.accent}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ground}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "{spacing.target}"
  button-secondary:
    textColor: "{colors.accent}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "{spacing.target}"
  text-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "{spacing.target}"
  skeleton-bone:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.bone}"
---

# Design System: Weather Widget

The reference sheet `docs/design/reference.html` draws every state below with `docs/design/widget.css` and sample data, at four widths and in both color schemes. Serve the folder over HTTP to view it (`python3 -m http.server` in `docs/design`), because browsers don't load CSS masks from `file://`.

## Overview

**Creative North Star: "The Window Glance"**

People read the Widget the way they glance out of a window: how warm it is, whether it rains, when it turns. The current temperature is the largest thing in it, and everything else sits under it in reading order. There are no tiles, cards or gauges inside the Widget. The ground is a cool blue-grey and the text a dark ink (pale ink in dark mode). Only two hues carry meaning: blue for chance of rain, green for anything you can press.

The design comes from the archived Astro project, where the Widget was a whole page. Here it is an element on someone else's page, which changes four things:

- It has its own edge: the ground is a rounded panel (12px), so it reads as one object on any Host page.
- It follows its own width: container queries switch the layout at 20rem and 35rem of the Widget's width, not the viewport's.
- The Host page can theme it: five custom properties set font, background, ink, accent and radius. Every other tone is mixed from them, so a themed Widget keeps its hierarchy.
- It never asks for a Location. "Use my location" moved to the separate Location picker (ADR 0002), which shares this system.

**Key characteristics:**

- A 6.5rem extra-bold temperature as the first thing read, scaled down with the Widget's width.
- Lexend throughout, with tabular figures for every number in a column.
- Blue only for chance of rain, green only for interaction.
- One tinted band (the Daily forecast); nothing else inside the Widget gets a box or a shadow.
- Monochrome Meteocons drawn in the text color, sized to the text they sit beside.
- Twelve hours, all visible, never scrolled.

## Theming

The Host page sets these on the element or any ancestor, for example through the `style` attribute. Every default follows the visitor's color scheme through `light-dark()`.

| Property               | Default (light / dark)            | Drives                                                            |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `--weather-font`       | `"Lexend", system-ui, sans-serif` | All text                                                          |
| `--weather-background` | `#eef3f9` / `#16263b`             | The ground; the band, track and field border are mixed from it    |
| `--weather-ink`        | `#13243a` / `#f2f5f9`             | Text and icons; ink soft, ink muted, band, track and field border |
| `--weather-accent`     | `#17703f` / `#6fdc9b`             | Links, buttons, focus ring, text selection                        |
| `--weather-radius`     | `12px`                            | The Widget's and picker's corners; controls use half of it        |

Rain blue has no property of its own: it is a fixed blue mixed with the ink, so it keeps one meaning on every Host page and stays readable on any ground the ink is readable on.

A Host page that sets `--weather-background` should set `--weather-ink` too, with values that work in both schemes (for example with `light-dark()`), or force a scheme with `color-scheme` on the element. Contrast of a themed Widget is the Host page's responsibility; the README warns about it (#15).

## Colors

A cool, low-chroma blue-grey family with two saturated accents, each with one job. Ground, ink and accent are set; every other tone is mixed in OKLab from them, so it follows a theme. Rain blue mixes a fixed blue (`#3b82f0`) with the ink, so it darkens on light grounds and lightens on dark ones, whatever the color scheme.

| Token        | Derivation             | Light     | Dark      |
| ------------ | ---------------------- | --------- | --------- |
| ground       | set                    | `#eef3f9` | `#16263b` |
| ink          | set                    | `#13243a` | `#f2f5f9` |
| accent       | set                    | `#17703f` | `#6fdc9b` |
| rain         | `#3b82f0` 65% into ink | `#2d5fac` | `#7dacf6` |
| ink soft     | ink 82% into ground    | `#354559` | `#c6ccd4` |
| ink muted    | ink 66% into ground    | `#556476` | `#a0a8b4` |
| band         | ink 6% into ground     | `#dfe5ec` | `#213145` |
| track        | ink 16% into ground    | `#c7ced8` | `#344357` |
| field border | ink 55% into ground    | `#6d7a8b` | `#87919f` |

WCAG 2.1 contrast ratios with the default values. Ground is the Widget's background; band is the Daily forecast's. Every text pairing passes AA (4.5:1) on both surfaces in both schemes.

| Token     | Light on ground | Light on band | Dark on ground | Dark on band |
| --------- | --------------- | ------------- | -------------- | ------------ |
| Ink       | 14.04:1         | 12.36:1       | 13.97:1        | 12.12:1      |
| Ink soft  | 8.80:1          | 7.75:1        | 9.43:1         | 8.19:1       |
| Ink muted | 5.44:1          | 4.79:1        | 6.39:1         | 5.55:1       |
| Rain      | 5.62:1          | 4.95:1        | 6.64:1         | 5.76:1       |
| Accent    | 5.49:1          | 4.84:1        | 9.01:1         | 7.82:1       |

Other pairings:

- Ground on accent (primary button text, selected text): 5.49:1 light, 9.01:1 dark.
- Accent on the secondary button's hover tint (accent 10% into ground): 4.77:1 light, 7.42:1 dark.
- The focus ring (accent) against ground: 5.49:1 and 9.01:1, above the 3:1 non-text minimum.
- The text field border against ground: 3.92:1 and 4.78:1, above 3:1.
- Icons are drawn in ink (14.04:1 and 13.97:1); the N/A icon in ink soft.
- The themed example in the reference sheet (cream ground `#fffaf2`, ink `#2b1d16`) gives rain 6.15:1 on the ground and 5.39:1 on the band, in both schemes.
- The range track against the band is 1.25:1 and 1.32:1, below 3:1. That is allowed because the bar is hidden from screen readers and repeats the low and high values shown as text.

### Named rules

**The Two Hues Rule.** Blue means chance of rain, green means you can press it. Neither appears anywhere else, and no third accent is added. A chance of 0% is drawn in ink muted at 400, so blue only appears where rain is possible.

**The Ink Icon Rule.** Icons are drawn in the text color of the place they sit (`currentColor`), so a theme or scheme change carries through without a second icon set.

## Typography

**Font:** Lexend (with `system-ui, sans-serif`), overridable with `--weather-font`.

One family at several weights. Lexend's wide, open forms keep small numbers legible, and its 800 weight gives the temperature and the Location's name their presence without a second face.

Every number that lines up with others uses tabular figures (set on the Widget). Hour times and the footer switch back to proportional figures, since they never align in a column.

### Hierarchy

- **Display** (800, `clamp(3.5rem, 26.5cqi, 6.5rem)`, line height 1, -0.04em): the current temperature only. It is 6.5rem from about 390px wide and scales down in a sidebar.
- **Headline** (800, 1.75rem, 1.15, -0.01em): the Location's name. Long names wrap and balance, and never overflow.
- **Condition** (500, 1.2rem): the Condition label in Current conditions; also the error state's heading (at 800).
- **Title** (800, 1rem): "Next 12 hours" and "Next 5 days", 12px above their list.
- **Value** (600, 1.05rem): fact values, hourly temperatures and daily highs. Daily lows use the same size at 400 in ink muted.
- **Body** (400, 1.0625rem, line height 1.4): the base, day names (at 600) and the picker's text field.
- **Button** (600, 1rem, line height 1.2): buttons in the Widget and the picker.
- **Label** (400, 0.85rem): fact labels, hour times, chance of rain (600, rain blue), picker messages and result context.
- **Footer** (400, 0.8rem, line height 1.6): the update time and the credits.

### Named rules

**The One Face Rule.** One typeface per Widget. Hierarchy comes from size and weight (400, 500, 600, 800), never from a second family.

**The Column Figures Rule.** Any number that sits above or beside another number uses tabular figures. Negative temperatures use the true minus sign (−, U+2212).

## Layout

The Widget fills the width its Host page gives it. It is a size container (`container: weather / inline-size`), and three layouts follow from its own width. The smallest width it is designed for is 240px.

| Width          | Name           | Current conditions                                                     | Hourly forecast          | Daily forecast             |
| -------------- | -------------- | ---------------------------------------------------------------------- | ------------------------ | -------------------------- |
| under 20rem    | narrow sidebar | Temperature and icon side by side; facts as a list, one row per fact   | 4 per row, 3 rows        | No range bar (below 24rem) |
| 20rem to 35rem | column         | Temperature left, icon and Condition right; facts in 3 centred columns | 6 per row, 2 rows        | Range bar from 24rem       |
| 35rem and up   | wide column    | Temperature, icon and Condition, then the facts as a list on the right | 6 per row; 12 from 45rem | Range bar capped at 14rem  |

**Order, top to bottom.** The Location's name, Current conditions, Hourly forecast, Daily forecast, footer. The order never changes.

**Composition.** The Host page chooses the Forecast parts. A part that is off is left out of the markup, and the next one moves up with the usual gap between Forecast parts. The name and the footer always show.

**Spacing rhythm.** Forecast parts are `clamp(2rem, 12cqi, 3rem)` apart (`--_space-part`); the name and Current conditions sit closer, at 24px. The Widget has 24px block padding and `clamp(1rem, 5cqi, 1.75rem)` inline padding. Both lists indent 12px from their heading from 20rem up.

### Current conditions

The temperature fills the left column. The Condition icon sits to its right, up to 160px and bleeding slightly above and below its row, with the Condition label under it. The facts (Feels like, Wind, Rain) follow:

- **Column:** three equal centred columns, each a 60px icon over a label over a value. A long value such as "112 km/h NNW" wraps onto two centred lines.
- **Narrow sidebar:** one row per fact: a 36px icon, the label beside it, the value right-aligned.
- **Wide column:** a list to the right of the Condition: a 44px icon beside the label over the value.

### Hourly forecast

Twelve hours, all visible, in a grid of equal columns: 4, 6 or 12 per row, always a divisor of 12, so no row is ragged. Each hour is a stack of time, 40px icon, temperature and chance of rain with 6px gaps. There is no horizontal scrolling and no hidden overflow. The Weather provider's remaining hours are not shown.

### Daily forecast

Five rows inside the tinted band, which runs to the Widget's edges (it cancels the inline padding and puts it back as its own padding). Each row is a fixed grid:

- **Column:** day (3.5rem), icon (36px), low (2.5rem, right-aligned), range bar (flexible), high (2.5rem, right-aligned), chance of rain (2.75rem, right-aligned), with 10px gaps and 8px vertical padding.
- **Wide column:** the same, but the day column takes the spare width and the range bar stays between 4rem and 14rem, so lows and highs don't drift apart.
- **Below 24rem:** day (flexible), icon (32px), low (2.5rem), high (2.5rem), chance (2.5rem), with 6px gaps. The range bar is dropped, and lows and highs drop to 1rem, so "−12°" and "104°" still fit at 240px. The Daily forecast has its own breakpoint because at 20rem the fixed columns would leave the range bar only a few pixels wide.

The range bar shows the day's low to high as a filled segment on a scale shared by the five days.

### Named rules

**The Own Width Rule.** Layout follows the Widget's width, never the viewport's. Two Widgets on one page can show two layouts.

**The Twelve Hours Rule.** The Hourly forecast shows exactly twelve hours, all visible at once, in rows of 4, 6 or 12.

## Elevation and depth

The system is flat. There are no shadows. The Widget's edge comes from its ground color and radius; depth inside it comes from one tonal step, the Daily forecast band.

### Named rules

**The One Box Rule.** Inside the Widget only the Daily forecast gets a filled background. Current conditions, hours, messages and the error state sit directly on the ground.

## Shapes

- The Widget and the picker: `--weather-radius` (12px).
- Buttons, the text field and result rows: half of it (6px), so a square theme (`0`) squares the panel and every control. Bones and the range bar keep their own small radius.
- Skeleton bones: 4px; icon placeholders are circles.
- The range bar: a 4px line with 2px rounded ends.
- The N/A icon is cropped to its lettering so it sits inline with text like a word.

## Components

### Location's name

An `h2` (headline). The Host page owns the `h1`, so the Widget's headings start at `h2`, and the Forecast parts use `h3`. Current conditions has a visually hidden `h3`.

The name is the `location-name` attribute when set, otherwise the Proxy's name, otherwise the coordinates formatted in the locale, such as "52.03° N, 5.08° E". The coordinates use the same headline style and wrap like any long name.

### Live region

Each Widget has one visually hidden `role="status"` element, outside the Forecast markup so re-rendering never removes it. It announces a new Forecast ("Forecast for Nieuwegein, updated at 2:52 PM"), a failed part ("Daily forecast unavailable") and the error state ("Forecast unavailable"). A background refresh that fails announces nothing, because the Forecast on screen stays.

### Facts

Feels like (thermometer), Wind (compass) and Rain (raindrop): an icon, a label in ink muted and a value at 600. The Rain value is rain blue.

### Hour

Time (ink muted, label size, proportional figures, in the Location's local time), a 40px Condition icon, temperature (value), chance of rain.

### Day

Day name (600, short form in an `abbr` with the full name, without the dotted underline), a 36px Condition icon, low (ink muted), range bar, high (value), chance of rain.

### Footer

"Updated at 2:52 PM" in the Location's local time, then "Weather data provided by OpenWeather" as a link.

### Links

Accent, 600, underlined (1px, 2px on hover) with a 3px offset. Used for credits.

### Buttons

44px minimum height, 6px radius (half the theme radius), 600 weight.

- **Primary:** accent fill, ground text, hover mixes the fill 14% towards ink (darker in light mode, lighter in dark mode; ground on it stays above 5:1). Used for "Search".
- **Secondary:** accent outline (1.5px) and text, no fill; hover fills with a 10% accent tint. Used for "Try again" and "Use my location".

### Focus

Every focusable element gets a 2px solid accent outline with a 3px offset (2px for footer links and the text field).

### Forced colors

Icons, the N/A mark and the range fill are painted with a mask over `background`, which Windows High Contrast would otherwise erase. Under `forced-colors: active` they opt out with `forced-color-adjust: none` and paint in `CanvasText`; bones and the range track paint in `GrayText`.

### Unavailable message

When one Forecast part fails, its content is replaced by one line in ink soft: the N/A icon (18px high) and "Current conditions unavailable", "Hourly forecast unavailable" or "Daily forecast unavailable". The heading stays; the Daily forecast keeps its band.

### Error state

When every requested part fails, or the request itself fails, the name stays and the Forecast becomes a centred block with 24px block padding: the N/A icon (24px high), "Forecast unavailable" (800, condition size), one sentence in ink soft, and a secondary "Try again" button.

### Loading skeleton

The skeleton is the real layout filled with placeholder text ("Nieuwegein", "12°", "3 PM" and so on) drawn in transparent ink on a track-colored background with a 4px radius, and every icon replaced by a track-colored circle of its size. Because the bones are real text, every line box matches the Forecast, and the skeleton measures exactly the same height (1154px at 390px wide in the reference sheet). Nothing moves when the Forecast arrives. Under `prefers-reduced-motion: no-preference` the bones pulse to 55% opacity (1.4s, alternate); otherwise they stay still. The skeleton content is `aria-hidden`, and the Widget has `aria-busy="true"` while loading.

### Location picker

The picker is its own element and uses the same tokens, theming properties and radius. Top to bottom:

1. A search form (`role="search"`): the visible label "Location" (600), a text field and a primary "Search" button on one row. Below 20rem the button drops under the field.
2. A secondary "Use my location" button with the Lucide `navigation` arrow. It renders only when the Geolocation API exists. While locating it is `aria-disabled="true"`, its cursor is `progress`, and the arrow pulses to 35% opacity (1.2s, alternate) under `prefers-reduced-motion: no-preference`.
3. A `role="status"` message in ink soft at label size, hidden while empty.
4. Up to 5 results as a list of full-width buttons: the name (600) over its region and country (ink muted, label size), separated by 1px track lines. Hover fills a row with the band color.
5. The credit: "Search by Open-Meteo, place names from GeoNames (CC BY 4.0)", with links.

The text field is 44px high with a 1.5px field-border outline, the body font (17px, so iOS doesn't zoom) and an accent caret. On focus its border turns accent and the focus ring sits 2px outside it.

**Messages.** Each one says what happened and what the visitor can do:

| Situation            | Message                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| Results              | "5 locations found"                                                        |
| No results           | "No locations found for “Parjs”. Check the spelling or try a nearby town." |
| Search failed        | "Search isn't working right now. Try again in a moment."                   |
| Locating             | "Finding your location…"                                                   |
| Location denied      | "Location access is off. You can turn it on in your browser settings."     |
| Location timed out   | "Finding your location took too long. Try again."                          |
| Location unavailable | "Your device couldn't find its location. Try again or search by name."     |

Dutch versions live in the message dictionary (#9).

### Icons

Meteocons 3 monochrome (MIT), drawn in `currentColor`. Each icon has an animated SVG (SMIL) and a static one; the static one shows under `prefers-reduced-motion: reduce`.

Sizes follow their context: up to 160px in Current conditions, 60px for facts in the column layout (44px wide, 36px narrow), 40px for hours, 36px for days (32px narrow), and text height for N/A.

- **Wind:** the archived project's modified Meteocons compass: needle scaled 1.35 times, tail at 35% opacity. The needle points where the wind blows to, so a south-west wind points north-east. The text value ("24 km/h SW") carries the same information for screen readers.
- **N/A:** the Meteocons not-available icon with its viewBox cropped to the lettering (`32 52 65 24`).
- **Use my location:** Lucide `navigation` (ISC), inlined.

## Conditions

Eleven Conditions. Day and night variants differ where the sun or moon shows. Covered skies and precipitation use one icon for both, because no sun or moon would be visible. The Proxy maps OpenWeather condition codes to a Condition and a day or night flag (#10).

| Condition     | Key             | Day icon            | Night icon            | OpenWeather codes            |
| ------------- | --------------- | ------------------- | --------------------- | ---------------------------- |
| Clear         | `clear`         | `clear-day`         | `clear-night`         | 800                          |
| Partly cloudy | `partly-cloudy` | `partly-cloudy-day` | `partly-cloudy-night` | 801, 802                     |
| Mostly cloudy | `mostly-cloudy` | `overcast-day`      | `overcast-night`      | 803                          |
| Overcast      | `overcast`      | `cloudy`            | `cloudy`              | 804                          |
| Fog           | `fog`           | `fog-day`           | `fog-night`           | 701, 741                     |
| Haze          | `haze`          | `haze-day`          | `haze-night`          | 711, 721, 731, 751, 761, 762 |
| Drizzle       | `drizzle`       | `drizzle`           | `drizzle`             | 300–321                      |
| Rain          | `rain`          | `rain`              | `rain`                | 500–504, 520–531             |
| Sleet         | `sleet`         | `sleet`             | `sleet`               | 511, 611–616                 |
| Snow          | `snow`          | `snow`              | `snow`                | 600–602, 620–622             |
| Thunderstorm  | `thunderstorm`  | `thunderstorms-day` | `thunderstorms-night` | 200–232, 771, 781            |

Overcast uses the single-cloud `cloudy` icon. Meteocons' own `overcast` icon puts a second cloud behind the first, and at 40px that reads as a moon. Squalls (771) and tornadoes (781) map to Thunderstorm, the closest severe Condition in the set. Freezing rain (511) maps to Sleet. Day or night follows the Location's local time: OpenWeather's icon suffix (`d` or `n`) for hours, and day for the Daily forecast.

## Do's and don'ts

### Do

- Do keep the current temperature the largest element and the first thing in Current conditions.
- Do switch layouts on the Widget's own width with container queries.
- Do show exactly twelve hours, all visible, in rows of 4, 6 or 12.
- Do use rain blue only for a chance of precipitation above 0%, and the accent only for links, buttons, focus and selection.
- Do keep skeleton bones as real placeholder text, so the loading state can't change size.
- Do mix every secondary tone from ink and ground, so a theme keeps the hierarchy.
- Do use tabular figures for numbers that align, and the minus sign (U+2212) for negative temperatures.
- Do replace only the failed part with an unavailable line and keep every other part on screen.
- Do give every focusable element the 2px accent outline with a 3px offset.

### Don't

- Don't add cards, tiles or shadows inside the Widget; the Daily forecast band is the only filled surface.
- Don't add a second typeface or a third accent color.
- Don't add horizontal scrolling, or hide hours behind overflow.
- Don't use viewport media queries for layout.
- Don't rely on color alone: rain blue always sits on a percentage and the accent always on a control. Where an icon stands alone (hours, days), its accessible name carries the Condition.

## Implementation notes

Build requirements the reference sheet can't show, for #6 to #12.

- **Shadow DOM:** `widget.css` uses `.weather` where the component uses `:host`. Keep `color-scheme: light dark` on `:host` so `light-dark()` follows the visitor; a Host page can force a scheme with `color-scheme` on the element.
- **Font:** the Widget never loads a font. A `@font-face` inside a shadow root doesn't apply, and loading fonts would add a request to every Host page. The Example hosts self-host Lexend (variable, 400 to 800) and declare it in the document. Elsewhere the Widget falls back to `system-ui`.
- **Icons:** `@meteocons/svg` (animated) and `@meteocons/svg-static` (static), both `3.0.0-next.10`, MIT, no install scripts. That is a pre-release, published 2026-04-12; the only stable release (`0.1.0`) predates the monochrome set. Adding them needs the owner's approval as a dependency (#10), with the pre-release named in that approval. Inline the SVG markup so `currentColor` applies, and pick the static or animated variant from `matchMedia("(prefers-reduced-motion: reduce)")`, listening for changes. The reference sheet uses CSS masks instead, which only works over HTTP.
- **Wind direction:** the compass needle sits in a `rotate(0 64 64)` group, pointing north-east at 0 degrees. Rotate it by the wind direction plus 135 degrees, so a south-west wind (225) points north-east and every needle points where the wind blows to. Drop the needle's sway animation under reduced motion.
- **Minus sign:** `Intl.NumberFormat` outputs a hyphen-minus, so replace it with U+2212 when formatting (#9).
- **Accessible names:** hour and day icons carry the Condition as their accessible name. Icons next to a visible label (Current conditions, facts, N/A) are hidden. "chance of rain", "low" and "high" are visually hidden prefixes, and temperatures and wind are announced in full ("12 degrees Celsius", "24 kilometres per hour from the south-west").
- **Skeleton:** render the loading state from the same template as the Forecast, with placeholder values wrapped in bones, so the two can't drift apart in size.
- **Licenses:** ship `docs/design/icons/meteocons-LICENSE` and `lucide-LICENSE` with the icons.
