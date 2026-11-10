# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A visitor who wants to know what the weather will do at one Location: is it raining now, will it rain in the next few hours, what are the coming days like. They may be on a phone with a slow connection, use a screen reader or keyboard only, zoom to 200%, prefer reduced motion, or read in a dark or light color scheme. Design decisions are made for this visitor first.

A Host page developer embeds the Widget in a page built with any framework, as often as they like, and configures it through attributes: Location, locale, units and Forecast parts. They can adjust a small set of documented CSS custom properties to match their brand, and can add the optional Location picker.

A reviewer reads the repository and the Example hosts. The project is an assessment for a job interview: it is sent in before the interview and discussed during it.

## Product Purpose

A Widget that shows the Forecast for one Location: Current weather first, then the Hourly forecast, then the Daily forecast. Success means a visitor reads the current temperature at a glance, spots when the weather turns and compares the coming days, on any device and with any assistive technology. For the Host page developer, success means dropping the Widget into any page without building a weather integration.

## Positioning

The Widget is a framework-agnostic web component, so the same element works in plain HTML, React and Angular. It never calls the Weather provider itself. It asks our Proxy, which holds the Weather provider's API key, so the key never reaches the browser. Each Forecast part loads or fails on its own.

## Operating Context

- The Host page owns the Location (ADR 0002). The Widget has no Location UI. The Location picker is a package of its own: it emits the chosen Location, and the Host page decides which Widget receives it.
- Each Widget lives in its own Shadow DOM, inside a Host page whose fonts, colors and width we don't control. Its layout follows its own width, from a narrow sidebar to a wide column.
- Locales are English (`en`, default) and Dutch (`nl`); units are metric (default) or imperial. Hours and days follow Location time.
- Forecasts are cached for 10 minutes, and for up to an hour when the Weather provider fails, so the Update time can be that old.

## Capabilities and Constraints

- Current weather: Condition, temperature (the most prominent number), feels-like temperature, wind speed and direction, chance of precipitation for the coming hour.
- Hourly forecast: time, Condition, temperature and chance of precipitation per hour.
- Daily forecast: 5 days with day name, Condition, high, low and chance of precipitation.
- The Widget names its Location and shows its Update time and the Weather provider's Credit as a visible link.
- A skeleton of the final size shows while loading. An Unavailable message replaces a failed Forecast part; when nothing loads, the Error state with a "Try again" button replaces the Forecast.
- The Location picker searches by name (up to 5 results) and offers "Use my location" when the Geolocation API exists. Its errors appear as short inline messages, announced to screen readers. It credits Open-Meteo and GeoNames (CC BY 4.0).
- Theming is limited to the documented CSS custom properties.
- Out of scope: server rendering, Widget events, autocomplete, a Location UI inside the Widget, locales beyond `en` and `nl`, a units toggle, weather alerts, charts, PWA and offline support.

## Brand Commitments

- Unbranded. Host pages bring their own brand through the theming properties.
- "Weather data provided by OpenWeather" with a visible link is required by the Weather provider's free tier.
- Terminology follows `GLOSSARY.md`.
- The visual design builds on the archived project (`stefanlemmen/weather-widget-astro`, `docs/design`), which the owner chose as the reference. Its assets are reused only where the owner approved them.

## Evidence on Hand

- No users, testimonials or usage figures exist. Do not invent them.

## Product Principles

1. Current weather comes first, and the current temperature is the first thing a visitor reads.
2. A failure removes only the part that failed; the rest of the Forecast stays on screen.
3. Text carries the meaning: a visible label, or alt text where an hour or day shows only an icon. Values are announced in full.
4. Every Widget is independent: its own Location, configuration, state and layout.
5. Hours and days are always shown in Location time.

## Accessibility & Inclusion

WCAG 2.1 AA is the floor, in both color schemes, for text and icons. Logical heading order inside the Widget; temperatures, units and times announced in full; icons next to a visible label skipped by screen readers, and icons without one announced by their Condition; new Forecasts and failures announced through a live region. Keyboard operable with a visible focus indicator and a focus order that follows the visual order. Usable at 200% zoom with nothing cut off. Respects `prefers-color-scheme` and `prefers-reduced-motion`.
