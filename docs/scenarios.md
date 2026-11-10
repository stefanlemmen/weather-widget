# Scenarios

How the Widget, the Proxy and the Location picker behave in the situations a Visitor runs into. The "For developers" lines point to the code and the tests that prove it.

Words used throughout, as defined in [GLOSSARY.md](../GLOSSARY.md):

- Host page: the web page the Widget sits on. It tells the Widget which Location to show.
- Forecast parts: Current weather, Hourly forecast and Daily forecast. The Host page picks which ones the Widget shows.
- Proxy: our own server. The Widget asks the Proxy for the weather, and the Proxy asks the Weather provider, an outside weather service.
- Stored copy: the network between the Widget and the Proxy keeps a copy of each Forecast for a few minutes, so the next Visitor gets it without the Proxy asking the Weather provider again.

## 1. What the Widget shows

```mermaid
stateDiagram-v2
    state "Grey placeholder, waiting to come into view" as Waiting
    state "Grey placeholder, loading" as Loading
    state "Forecast" as Shown
    state "Error message with Try again" as Failed
    state "Try again pressed, loading" as Retrying

    [*] --> Waiting
    Waiting --> Loading: almost in view
    Loading --> Shown: at least one Forecast part arrived
    Loading --> Failed: nothing arrived
    Failed --> Retrying: Visitor presses Try again
    Retrying --> Shown: at least one Forecast part arrived
    Retrying --> Failed: nothing arrived
```

The Widget starts loading once it is within 200 pixels of the visible part of the page, so a Widget further down waits until the Visitor scrolls towards it. The grey outline keeps the page from jumping when the weather arrives. Sections 3 and 4 cover what happens after that.

When Try again works and the Visitor was using the Widget at that moment, the keyboard focus moves to the Location name, so keyboard and screen reader users start reading at the new Forecast.

For developers:

- "Nothing arrived" also covers an answer the Widget can't read and a Proxy that doesn't answer at all.
- A Host page that gives missing or wrong coordinates gets an error message without Try again, since trying again wouldn't help.
- Code: `packages/widget/src/forecast-loader.ts`, `packages/widget/src/weather-widget.ts`
- Tests: `packages/widget/test/loading.test.ts`, `packages/widget/test/error-state.test.ts`

## 2. Fetching a Forecast

```mermaid
flowchart TD
    Ask["Widget asks for a Forecast:<br/>coordinates and Forecast parts"] --> Cached{"Is there a recent stored copy?"}
    Cached -- yes --> Copy["The stored copy"]
    Cached -- no --> Calls["Proxy asks the Weather provider<br/>for the requested parts and the place name,<br/>all at once, waiting at most 3 seconds"]
    Calls --> Loaded{"Which requested<br/>parts arrived?"}
    Loaded -- every one --> Complete["Forecast,<br/>stored for 10 minutes"]
    Loaded -- some --> Partial["Forecast with the missing parts marked,<br/>stored for 1 minute"]
    Loaded -- none --> Expired{"Is there a stored copy<br/>that ran out less than an hour ago?"}
    Expired -- yes --> OldCopy["The old stored copy"]
    Expired -- no --> ErrorState["Error message"]
    Copy & Complete & Partial & OldCopy --> Show["Forecast shown,<br/>with an Unavailable message<br/>for each missing part"]
```

A Forecast with every part stays recent for 10 minutes. For 10 minutes after that, the network still hands it out while it fetches a fresh one in the background. A Forecast with missing parts stays recent for 1 minute only, so a short problem at the Weather provider clears up quickly. When the Weather provider sends nothing at all, the network falls back on a stored copy that ran out less than an hour ago, even one with missing parts.

Widgets that use the same Proxy and ask for the same coordinates and Forecast parts share one stored copy. Their language and units don't matter, because the Widget translates and converts the weather itself.

For developers:

- The Proxy rounds coordinates to two decimals before it asks the Weather provider. The Widget sends them unrounded, so 52.0907 and 52.09 are two different stored copies.
- The Proxy answers 400 to invalid coordinates or Forecast parts, which a Widget never sends, and 503 when the Weather provider sends nothing. Neither answer is stored.
- The Widget shows the error message for any answer that lacks a requested part or has none that arrived.
- Code: `packages/proxy/src/proxy.ts`, `packages/proxy/src/weather-provider.ts`, `packages/proxy/src/provider-call.ts`, `packages/widget/src/forecast-client.ts`
- Tests: `packages/proxy/test/forecast.test.ts`, `packages/widget/test/forecast-parts.test.ts`

## 3. The Visitor comes back to the page

```mermaid
flowchart TD
    Back["The page comes back into view,<br/>from another tab or a minimised window"] --> Old{"Is a Forecast on screen,<br/>more than 10 minutes old,<br/>with nothing loading?"}
    Old -- no --> NoFetch["Nothing happens"]
    Old -- yes --> Refresh["Widget fetches a new one,<br/>the old one stays on screen meanwhile"]
    Refresh --> Answer{"What came back?"}
    Answer -- "nothing" --> Keep["The Forecast stays as it was.<br/>The Widget tries again next time"]
    Answer -- "every part" --> New["The new Forecast"]
    Answer -- "some parts" --> Mixed["Parts that arrived are updated,<br/>the others stay as they were.<br/>The Widget tries again next time"]
```

The Widget has no timer, so it doesn't use Weather provider calls while nobody is looking. A window that stays visible next to another app never counts as out of sight, and clicking it doesn't update the Forecast either. An update can also bring a stored copy up to 20 minutes old (section 2), so the Forecast doesn't always change.

When the Widget shows Current weather, the Update time at the bottom tells the Visitor when the Weather provider measured it.

For developers:

- The Widget listens for `visibilitychange`. "Tries again next time" happens when a part that was on screen failed to update: the Widget then keeps the old arrival time.
- Code: `packages/widget/src/forecast-loader.ts`, `packages/widget/src/forecast-client.ts`
- Tests: `packages/widget/test/loading.test.ts`, "when the page becomes visible again"

## 4. The Host page changes the Widget

```mermaid
flowchart TD
    Change["Host page changes a setting"] --> Which{"Which one?"}
    Which -- "language, units or Location name" --> Redraw["Widget redraws,<br/>nothing is fetched"]
    Which -- "Location or Forecast parts" --> Near{"Is the Widget<br/>almost in view?"}
    Near -- no --> Later["Fetches once it is"]
    Near -- yes --> Abort["Stops what it was fetching,<br/>shows the grey placeholder<br/>and fetches the new Forecast"]
```

A slow answer to an older question never replaces a newer Forecast.

For developers:

- The settings are the attributes `locale`, `units` and `location-name` (redraw only) and `latitude`, `longitude`, `parts` and `proxy-url` (new fetch).
- When the Host page takes the Widget off the page, it cancels the fetch in progress. If no Forecast was on screen yet, it fetches again when put back (`loading.test.ts`, "fetches again when the Host page moves it while it was loading").
- Code: `packages/widget/src/forecast-loader.ts`
- Tests: `packages/widget/test/weather-widget.test.ts`, `packages/widget/test/loading.test.ts`, `packages/widget/test/locale.test.ts`

## 5. The Location picker

The Visitor can choose a Location in two ways. Both end with the Host page giving the Widget the new coordinates, as in section 4. Screen readers read every message aloud.

### Searching by name

```mermaid
flowchart TD
    Submit["Visitor searches for a place by name"] --> Empty{"Is the search field empty?"}
    Empty -- yes --> Ignore["Nothing happens"]
    Empty -- no --> Search["Stops any earlier search<br/>and says it is searching"]
    Search --> Found{"What did the Proxy find?"}
    Found -- "the search failed" --> SearchFailed["Search isn't working right now"]
    Found -- "no places" --> NoneFound["No locations found,<br/>check the spelling"]
    Found -- "1 to 5 places" --> List["The places as buttons,<br/>and how many there are"]
    List --> Choose["Visitor picks one"]
    Choose --> Named["Tells the Host page the place and its name,<br/>the cursor goes back to the search field"]
```

### Using the device's location

```mermaid
flowchart TD
    Locate["Visitor presses Use my location,<br/>shown only when the browser can find its location"] --> Position{"Did the device find it<br/>within 10 seconds?"}
    Position -- yes --> Unnamed["Tells the Host page the place,<br/>without a name"]
    Position -- "Visitor blocked location access" --> Denied["Location access is off"]
    Position -- "took too long" --> TimedOut["Took too long, try again"]
    Position -- "some other problem" --> NotFound["Device couldn't find its location"]
```

The Location picker and the Widget don't know about each other. The Host page decides which Widget gets the chosen Location ([ADR 0002](adr/0002-the-host-page-owns-the-location.md)).

For developers:

- The picker tells the Host page through a `location-select` event. Its `name` is `null` for the device's own location.
- The device may answer with a location it found in the last 5 minutes. The picker rounds it to two decimals.
- Code: `packages/location-picker/src/weather-location-picker.ts`, `packages/location-picker/src/locations-client.ts`, `packages/proxy/src/search-provider.ts`
- Tests: `packages/location-picker/test/search.test.ts`, `packages/location-picker/test/device-location.test.ts`, `packages/proxy/test/locations.test.ts`
