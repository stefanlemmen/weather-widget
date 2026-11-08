import { css } from "lit";
import { base, tokens } from "./theme-styles.ts";

const picker = css`
  :where(p, ul) {
    margin: 0;
    padding: 0;
  }

  ul {
    list-style: none;
  }

  .picker {
    display: grid;
    gap: 1rem;
    padding: var(--_space-group) var(--_space-inset);
  }

  .picker > * {
    min-inline-size: 0;
  }

  label {
    display: block;
    margin-block-end: 0.375rem;
    font-weight: 600;
  }

  .picker-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }

  input {
    inline-size: 100%;
    min-block-size: var(--_target);
    padding: 0.5rem 0.75rem;
    border: 1.5px solid var(--_field-border);
    border-radius: var(--_radius-control);
    background: var(--_ground);
    color: var(--_ink);
    font: 400 var(--_size-body) / 1.4 var(--_font);
    caret-color: var(--_accent);
  }

  input:focus-visible {
    outline-offset: 2px;
    border-color: var(--_accent);
  }

  .button-primary {
    background: var(--_accent);
    color: var(--_ground);
  }

  .button-primary:not([aria-disabled="true"]):hover {
    background: color-mix(in oklab, var(--_accent) 86%, var(--_ink));
    border-color: color-mix(in oklab, var(--_accent) 86%, var(--_ink));
  }

  .locate {
    justify-self: start;
    gap: 0.5rem;
  }

  .locate svg {
    inline-size: 1.25rem;
    block-size: 1.25rem;
    translate: -1px 1px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .locate[aria-disabled="true"] svg {
      animation: locate-pulse 1.2s ease-in-out infinite alternate;
    }
  }

  @keyframes locate-pulse {
    to {
      opacity: 0.35;
    }
  }

  .picker-message {
    color: var(--_ink-soft);
    font-size: var(--_size-label);
  }

  .picker-message.is-empty {
    position: absolute;
  }

  .picker-results {
    display: grid;
  }

  .picker-results li + li {
    border-block-start: 1px solid var(--_track);
  }

  .result {
    inline-size: 100%;
    min-block-size: var(--_target);
    padding: 0.5rem 0.75rem;
    display: grid;
    justify-items: start;
    border: 0;
    border-radius: var(--_radius-control);
    background: none;
    color: var(--_ink);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .result:hover {
    background: var(--_band);
  }

  .result-name {
    font-weight: 600;
  }

  .result-context {
    color: var(--_ink-muted);
    font-size: var(--_size-label);
  }

  .credit {
    color: var(--_ink-muted);
    font-size: var(--_size-footer);
    font-variant-numeric: proportional-nums;
    line-height: 1.6;
  }

  .credit a:focus-visible {
    outline-offset: 2px;
  }

  @container weather (inline-size < 20rem) {
    .picker-row {
      grid-template-columns: 1fr;
    }
  }
`;

export const pickerStyles = [tokens, base, picker];
