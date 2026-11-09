import { css } from "lit";

export const tokens = css`
  :host {
    --_font: var(--weather-font, "Lexend", system-ui, sans-serif);
    --_ground: var(--weather-background, light-dark(#eef3f9, #16263b));
    --_ink: var(--weather-ink, light-dark(#13243a, #f2f5f9));
    --_accent: var(--weather-accent, light-dark(#17703f, #6fdc9b));
    --_radius: var(--weather-radius, 12px);
    --_radius-control: calc(var(--_radius) * 0.5);

    --_ink-soft: color-mix(in oklab, var(--_ink) 82%, var(--_ground));
    --_ink-muted: color-mix(in oklab, var(--_ink) 66%, var(--_ground));
    --_band: color-mix(in oklab, var(--_ink) 6%, var(--_ground));
    --_track: color-mix(in oklab, var(--_ink) 16%, var(--_ground));
    --_field-border: color-mix(in oklab, var(--_ink) 55%, var(--_ground));

    --_size-body: 1.0625rem;
    --_size-label: 0.85rem;
    --_size-footer: 0.8rem;

    --_space-group: 1.5rem;
    --_space-inset: clamp(1rem, 5cqi, 1.75rem);
    --_target: 2.75rem;
  }
`;

export const base = css`
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

  ::selection {
    background: var(--_accent);
    color: var(--_ground);
  }

  :focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 3px;
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
`;
