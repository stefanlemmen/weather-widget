# Weather Widget

A self-contained component that shows the weather forecast for one Location. Any Host page can embed it, several times on one page if it likes.

## Language

**Widget**:
The self-contained component that shows the Forecast for one Location, configured entirely by its Host page.
_Avoid_: App, page, dashboard, card

**Host page**:
A page that embeds one or more Widgets and gives each one its configuration (Location, locale, units, Forecast parts).
_Avoid_: Parent, container, demo app

**Example host**:
A Host page we build ourselves in one framework to show how Widgets are embedded there.
_Avoid_: Demo app, showcase, playground

**Location**:
The place a Forecast is for. It has coordinates, a name and a time zone, and its Host page always hands it to the Widget.
_Avoid_: City, place, position

**Location picker**:
An optional component, separate from the Widget, that a Host page can use to let the visitor choose a Location by name or from their device.
_Avoid_: Search box, city selector, location input

**Location's local time**:
The clock time and calendar day at the Location, which can differ from the visitor's own.
_Avoid_: Local time, visitor time

## Forecast

**Forecast**:
The weather outlook for one Location: its Current conditions, Hourly forecast and Daily forecast together.
_Avoid_: Weather data, report

**Forecast part**:
One of the three parts of a Forecast: Current conditions, Hourly forecast or Daily forecast. Each one loads or fails on its own, and the Host page chooses which ones the Widget shows.
_Avoid_: Section, block, module

**Current conditions**:
The weather at the Location right now.
_Avoid_: Now, realtime, current weather

**Hourly forecast**:
The expected weather per hour for roughly the next 12 to 24 hours.
_Avoid_: Timeline, hourly data

**Daily forecast**:
The expected weather per day for the next 5 days, summarised as high, low, condition and precipitation chance.
_Avoid_: Week forecast, daily data

**Condition**:
The kind of weather in a period (clear, cloudy, rain, snow and so on), shown as an icon plus a text label.
_Avoid_: Weather type, weather code, status

## Services

**Weather provider**:
The external weather service the Forecast comes from.
_Avoid_: Provider, API, source, backend

**Search provider**:
The external service that finds a Location by the name a visitor types.
_Avoid_: Geocoder, places API

**Proxy**:
Our own server that Widgets ask for Forecasts, and the only party that talks to the Weather provider and the Search provider.
_Avoid_: API, backend, BFF
