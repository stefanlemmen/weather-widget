# A simpler Forecast loader

The Widget's Forecast loader keeps every behaviour it has now, and we don't trim it to make the code shorter.

## Why this is out of scope

The spec in #1 asks for each behaviour:

- Story 17: a "Try again" button when nothing loaded
- Story 18: a fresh Forecast when the visitor returns to the tab and the Forecast is more than 10 minutes old
- Story 19: the Forecast on screen stays when a background refresh fails
- The Widget fetches once it nears the viewport, and refetches when its configuration changes or the page becomes visible again with a Forecast older than 10 minutes

Removing any of these would break the spec. A change that makes the loader easier to read is welcome if it keeps all of them.

## Prior requests

- #54: "Simplify ForecastLoader to the behaviour the brief asks for"
