# Shared theme styles

The Widget and the Location picker each keep their own copy of the theme styles. We don't move them into a shared package.

## Why this is out of scope

ADR 0002 decides that the Location picker is its own package and keeps its own copy of the theme styles it uses. An e2e test checks that the picker's font, background, ink, accent and radius match the Widget's on every Example host, so the copies can't drift apart unnoticed. The maintainer keeps that decision.

## Prior requests

- #53: "Share one theme styles module between the Widget and the Location picker"
