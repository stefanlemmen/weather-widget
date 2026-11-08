import { css } from "lit";

const tokens = css`
  :host {
    --_font: var(--weather-font, "Lexend", system-ui, sans-serif);
    --_ground: var(--weather-background, light-dark(#eef3f9, #16263b));
    --_ink: var(--weather-ink, light-dark(#13243a, #f2f5f9));
    --_accent: var(--weather-accent, light-dark(#17703f, #6fdc9b));
    --_radius: var(--weather-radius, 12px);
    --_radius-control: calc(var(--_radius) * 0.5);
    --_radius-bone: 4px;
    --_radius-bar: 2px;
    --_bar-height: 4px;

    --_ink-soft: color-mix(in oklab, var(--_ink) 82%, var(--_ground));
    --_ink-muted: color-mix(in oklab, var(--_ink) 66%, var(--_ground));
    --_band: color-mix(in oklab, var(--_ink) 6%, var(--_ground));
    --_track: color-mix(in oklab, var(--_ink) 16%, var(--_ground));
    --_rain: color-mix(in oklab, #3b82f0 65%, var(--_ink));

    --_size-display: clamp(3.5rem, 26.5cqi, 6.5rem);
    --_size-headline: 1.75rem;
    --_size-condition: 1.2rem;
    --_size-title: 1rem;
    --_size-value: 1.05rem;
    --_size-body: 1.0625rem;
    --_size-label: 0.85rem;
    --_size-footer: 0.8rem;

    --_space-part: clamp(2rem, 12cqi, 3rem);
    --_space-group: 1.5rem;
    --_space-inset: clamp(1rem, 5cqi, 1.75rem);
    --_space-indent: 0.75rem;
    --_target: 2.75rem;
  }
`;

const base = css`
  :host {
    display: block;
    container: weather / inline-size;
    color-scheme: light dark;
    min-block-size: 6rem;
    border-radius: var(--_radius);
    background-color: var(--_ground);
    color: var(--_ink);
    font: 400 var(--_size-body) / 1.4 var(--_font);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :where(h2, h3, p, ol, dl, dd) {
    margin: 0;
    padding: 0;
  }

  ol {
    list-style: none;
  }

  ::selection {
    background: var(--_accent);
    color: var(--_ground);
  }

  :focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 3px;
  }

  .widget,
  .skeleton {
    display: grid;
    gap: var(--_space-part);
  }

  .widget {
    padding: var(--_space-group) var(--_space-inset);
  }

  .widget > *,
  .skeleton > * {
    min-inline-size: 0;
  }

  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  a {
    color: var(--_accent);
    font-weight: 600;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }

  a:hover {
    text-decoration-thickness: 2px;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--_target);
    padding: 0.5rem 1.125rem;
    border: 1.5px solid var(--_accent);
    border-radius: var(--_radius-control);
    background: transparent;
    color: var(--_accent);
    font: 600 1rem / 1.2 var(--_font);
    cursor: pointer;
  }

  .button:not([aria-disabled="true"]):hover {
    background: color-mix(in oklab, var(--_accent) 10%, var(--_ground));
  }

  .button[aria-disabled="true"] {
    cursor: progress;
  }

  h2 {
    font-size: var(--_size-headline);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  h3 {
    margin-block-end: 0.75rem;
    font-size: var(--_size-title);
    font-weight: 800;
  }
`;

const icons = css`
  .icon {
    --_icon-size: 1.5rem;
    display: inline-block;
    flex: none;
    inline-size: var(--_icon-size);
    aspect-ratio: 1;
    vertical-align: middle;
  }

  .icon svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }

  .not-available {
    --_na-height: 1.125rem;
    display: inline-block;
    flex: none;
    block-size: var(--_na-height);
  }

  .not-available svg {
    display: block;
    inline-size: auto;
    block-size: 100%;
  }
`;

const currentConditions = css`
  .current {
    margin-block-start: calc(var(--_space-group) - var(--_space-part));
    display: grid;
    grid-template-columns: 1fr minmax(0, 36%);
    grid-template-areas:
      "temp condition"
      "facts facts";
    align-items: center;
    column-gap: 0.5rem;
  }

  .current > .unavailable {
    grid-column: 1 / -1;
  }

  .temperature {
    grid-area: temp;
    font-size: var(--_size-display);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
    white-space: nowrap;
  }

  .condition {
    grid-area: condition;
    display: grid;
    justify-items: center;
    color: var(--_ink-soft);
    font-size: var(--_size-condition);
    font-weight: 500;
    text-align: center;
    text-wrap: balance;
  }

  .condition .icon {
    --_icon-size: min(100%, 10rem);
    margin-block: -1.25rem -0.5rem;
    color: var(--_ink);
  }

  .facts {
    grid-area: facts;
    margin-block-start: var(--_space-group);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    column-gap: 0.75rem;
    text-align: center;
  }

  .fact {
    display: grid;
    justify-items: center;
    align-content: start;
  }

  .fact dt {
    display: grid;
    justify-items: center;
    color: var(--_ink-muted);
    font-size: var(--_size-label);
  }

  .fact .icon {
    --_icon-size: 3.75rem;
    margin-block: -0.5rem -0.125rem;
    color: var(--_ink);
  }

  .fact dd {
    font-size: var(--_size-value);
    font-weight: 600;
  }

  .fact dd.rain {
    color: var(--_rain);
  }
`;

const hourlyForecast = css`
  .hourly ol {
    --_hour-columns: 6;
    padding-inline-start: var(--_space-indent);
    display: grid;
    grid-template-columns: repeat(var(--_hour-columns), 1fr);
    row-gap: 0.75rem;
  }

  .hour {
    display: grid;
    justify-items: center;
    gap: 0.375rem;
  }

  .hour time {
    color: var(--_ink-muted);
    font-size: var(--_size-label);
    font-variant-numeric: proportional-nums;
    white-space: nowrap;
  }

  .hour .icon {
    --_icon-size: 2.5rem;
  }

  .value {
    font-size: var(--_size-value);
    font-weight: 600;
  }

  .chance {
    color: var(--_rain);
    font-size: var(--_size-label);
    font-weight: 600;
  }

  .chance.dry {
    color: var(--_ink-muted);
    font-weight: 400;
  }

  @container weather (20rem <= inline-size < 45rem) {
    .hour:nth-child(n + 7) {
      border-block-start: 1px solid var(--_track);
      padding-block-start: 0.75rem;
    }
  }

  @container weather (inline-size < 20rem) {
    .hour:nth-child(n + 5) {
      border-block-start: 1px solid var(--_track);
      padding-block-start: 0.75rem;
    }
  }
`;

const dailyForecast = css`
  .daily {
    margin-inline: calc(var(--_space-inset) * -1);
    padding: var(--_space-inset);
    background: var(--_band);
  }

  .daily ol {
    padding-inline-start: var(--_space-indent);
    display: grid;
    grid-template-columns: max-content 2.25rem max-content 1fr max-content max-content;
    column-gap: 0.625rem;
  }

  .day {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    padding-block: 0.5rem;
  }

  .day-name {
    font-weight: 600;
  }

  .day-name abbr {
    text-decoration: none;
  }

  .day-name-narrow,
  .day-name-long {
    display: none;
  }

  .day .icon {
    --_icon-size: 2.25rem;
  }

  .low,
  .high,
  .day .chance {
    text-align: end;
  }

  .low {
    color: var(--_ink-muted);
    font-size: var(--_size-value);
  }

  .high {
    font-size: var(--_size-value);
    font-weight: 600;
  }

  .range {
    position: relative;
    block-size: var(--_bar-height);
    border-radius: var(--_radius-bar);
    background: var(--_track);
  }

  .range-fill {
    position: absolute;
    inset-block: 0;
    inset-inline-start: calc(var(--_from) * 100%);
    inline-size: calc((var(--_to) - var(--_from)) * 100%);
    border-radius: var(--_radius-bar);
    background: var(--_ink-muted);
  }
`;

const messages = css`
  .credit {
    color: var(--_ink-muted);
    font-size: var(--_size-footer);
    font-variant-numeric: proportional-nums;
    line-height: 1.6;
  }

  .credit a:focus-visible {
    outline-offset: 2px;
  }

  .unavailable {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--_ink-soft);
  }

  .error {
    padding-block: var(--_space-group);
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  .error .not-available {
    --_na-height: 1.5rem;
    color: var(--_ink-soft);
  }

  .error h3 {
    margin: 0;
    font-size: var(--_size-condition);
  }

  .error p {
    max-inline-size: 30ch;
    color: var(--_ink-soft);
  }

  .error .button {
    margin-block-start: 0.25rem;
  }
`;

const layouts = css`
  @container weather (inline-size < 20rem) {
    .current {
      grid-template-columns: 1fr minmax(0, 42%);
    }

    .facts {
      grid-template-columns: 1fr;
      row-gap: 0.5rem;
      text-align: start;
    }

    .fact {
      grid-template-columns: 1fr auto;
      align-items: center;
      justify-items: start;
      column-gap: 0.5rem;
    }

    .fact dt {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .fact dd {
      justify-self: end;
    }

    .fact .icon {
      --_icon-size: 2.25rem;
      margin: 0;
    }

    .hourly ol {
      --_hour-columns: 4;
      padding-inline-start: 0;
    }

    .daily ol {
      padding-inline-start: 0;
    }

    .day-name-narrow {
      display: inline;
    }

    .day-name-short {
      display: none;
    }
  }

  @container weather (inline-size < 24rem) {
    .daily ol {
      grid-template-columns: max-content 2rem repeat(3, max-content);
      justify-content: space-between;
      column-gap: 0.375rem;
    }

    .day .icon {
      --_icon-size: 2rem;
    }

    .range {
      display: none;
    }

    .low,
    .high {
      font-size: 1rem;
    }
  }

  @container weather (inline-size >= 35rem) {
    .day-name-short {
      display: none;
    }

    .day-name-long {
      display: inline;
    }

    .current {
      grid-template-columns: auto minmax(0, 9rem) minmax(12rem, 1fr);
      grid-template-areas: "temp condition facts";
      column-gap: 1.25rem;
    }

    .facts {
      margin: 0;
      margin-inline-start: var(--_space-inset);
      grid-template-columns: 1fr;
      row-gap: 0.75rem;
      align-self: center;
      text-align: start;
    }

    .fact {
      grid-template-columns: 2.75rem 1fr;
      justify-items: start;
      column-gap: 0.75rem;
    }

    .fact dt {
      grid-column: 1 / -1;
      grid-row: 1 / span 2;
      display: grid;
      grid-template-columns: subgrid;
      grid-template-rows: subgrid;
      justify-items: start;
    }

    .fact .icon {
      --_icon-size: 2.75rem;
      grid-row: 1 / -1;
      margin: 0;
    }

    .fact dd {
      grid-column: 2;
      grid-row: 2;
    }

    .daily ol {
      grid-template-columns:
        minmax(3.5rem, 1fr) 2.25rem 2.5rem minmax(4rem, 14rem)
        2.5rem 2.75rem;
    }
  }

  @container weather (inline-size >= 45rem) {
    .hourly ol {
      --_hour-columns: 12;
    }
  }
`;

const skeleton = css`
  .skeleton,
  .skeleton * {
    color: transparent;
    text-decoration: none;
  }

  .skeleton
    :where(
      h2,
      h3,
      .temperature,
      .condition > :not(.icon),
      dt > :not(.icon),
      dd,
      .hour > :not(.icon),
      .day > :not(.icon, .range),
      .credit p
    ) {
    inline-size: fit-content;
    border-radius: var(--_radius-bone);
    background-color: var(--_track);
  }

  .skeleton .range-fill {
    visibility: hidden;
  }

  .skeleton .icon {
    border-radius: 50%;
    background-color: var(--_track);
  }

  .skeleton .icon svg {
    visibility: hidden;
  }

  @media (prefers-reduced-motion: no-preference) {
    .skeleton {
      animation: pulse 1.4s ease-in-out infinite alternate;
    }
  }

  @keyframes pulse {
    to {
      opacity: 0.55;
    }
  }
`;

const forcedColors = css`
  @media (forced-colors: active) {
    .icon,
    .not-available,
    .range-fill {
      forced-color-adjust: none;
      color: CanvasText;
    }

    .range-fill {
      background: CanvasText;
    }

    .skeleton
      :is(
        .icon,
        h2,
        h3,
        .temperature,
        .condition > :not(.icon),
        dt > :not(.icon),
        dd,
        .hour > :not(.icon),
        .day > :not(.icon, .range),
        .credit p
      ),
    .range {
      forced-color-adjust: none;
      background: GrayText;
    }
  }
`;

export const widgetStyles = [
  tokens,
  base,
  icons,
  currentConditions,
  hourlyForecast,
  dailyForecast,
  messages,
  layouts,
  skeleton,
  forcedColors,
];
