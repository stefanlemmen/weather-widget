import { css } from "lit";

export const widgetStyles = css`
  :host {
    --_ground: light-dark(#eef3f9, #16263b);
    --_ink: light-dark(#13243a, #f2f5f9);
    --_accent: light-dark(#17703f, #6fdc9b);
    --_track: color-mix(in oklab, var(--_ink) 16%, var(--_ground));
    color-scheme: light dark;
    background-color: var(--_ground);
    color: var(--_ink);
    display: block;
    container-type: inline-size;
    min-block-size: 6rem;
    font-family: system-ui, sans-serif;
  }

  p,
  h2,
  dl,
  dd {
    margin: 0;
  }

  h2 {
    font-size: 1.25rem;
  }

  a {
    color: var(--_accent);
  }

  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .skeleton,
  .skeleton * {
    color: transparent;
    text-decoration: none;
  }

  .skeleton :is(h2, h3, p, dt, dd, li > *, .condition > *) {
    inline-size: fit-content;
    border-radius: 4px;
    background-color: var(--_track);
  }

  .skeleton .condition {
    background-color: transparent;
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

  .icon {
    display: inline-block;
    inline-size: var(--_icon-size, 40px);
    block-size: var(--_icon-size, 40px);
    vertical-align: middle;
  }

  .icon svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }

  .condition {
    --_icon-size: 160px;
  }

  .daily {
    --_icon-size: 36px;
  }

  @container (width < 24rem) {
    .daily {
      --_icon-size: 32px;
    }
  }

  .skeleton .icon {
    border-radius: 50%;
  }

  .skeleton .icon svg {
    visibility: hidden;
  }

  .temperature {
    font-size: 3rem;
    font-weight: 600;
    line-height: 1;
  }
`;
