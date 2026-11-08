import type { ReactiveController, ReactiveControllerHost } from "lit";

export const MOTIONS = ["animated", "still"] as const;

export type Motion = (typeof MOTIONS)[number];

export const ANIMATED: Motion = "animated";
export const STILL: Motion = "still";

const NO_MOTION_PREFERENCE = "(prefers-reduced-motion: no-preference)";

export class MotionPreference implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #query = matchMedia(NO_MOTION_PREFERENCE);

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  get motion(): Motion {
    return this.#query.matches ? ANIMATED : STILL;
  }

  hostConnected() {
    this.#query.addEventListener("change", this.#update);
  }

  hostDisconnected() {
    this.#query.removeEventListener("change", this.#update);
  }

  readonly #update = () => {
    this.#host.requestUpdate();
  };
}
