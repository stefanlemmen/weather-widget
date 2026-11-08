import { CoordinatesSchema } from "@weather-widget/contract";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import * as v from "valibot";
import {
  fetchForecast,
  keepsShownParts,
  refreshedForecast,
  requestedParts,
  type Forecast,
  type ForecastResult,
} from "./forecast-client.ts";

export type ShownForecast = Forecast & {
  readonly status: "ok";
  readonly nameTakesFocus: boolean;
  readonly receivedAt: number;
};

type FetchingState =
  { readonly status: "loading" } | { readonly status: "retrying" };

export type ForecastState =
  | FetchingState
  | ShownForecast
  | { readonly status: "error" }
  | { readonly status: "invalid-location" };

export interface ForecastRequest {
  readonly proxyUrl: string;
  readonly latitude: number | undefined;
  readonly longitude: number | undefined;
  readonly parts: string | undefined;
}

type ForecastLoaderHost = ReactiveControllerHost &
  HTMLElement &
  ForecastRequest;

interface Superseded {
  readonly status: "superseded";
}

type Sent =
  | { readonly status: "invalid-location" }
  | {
      readonly status: "sent";
      readonly answer: Promise<ForecastResult | Superseded>;
    };

const LOADING: FetchingState = { status: "loading" };
const RETRYING: FetchingState = { status: "retrying" };
const INVALID_LOCATION = { status: "invalid-location" } as const;
const SUPERSEDED: Superseded = { status: "superseded" };

const REQUEST_FIELDS = [
  "proxyUrl",
  "latitude",
  "longitude",
  "parts",
] as const satisfies readonly (keyof ForecastRequest)[];

const NEAR_VIEWPORT_MARGIN = "200px";
const FORECAST_MAX_AGE_MILLISECONDS = 10 * 60 * 1000;

const snapshot = (request: ForecastRequest): ForecastRequest => ({
  proxyUrl: request.proxyUrl,
  latitude: request.latitude,
  longitude: request.longitude,
  parts: request.parts,
});

const isSameRequest = (
  loaded: ForecastRequest | undefined,
  wanted: ForecastRequest,
) =>
  loaded !== undefined &&
  REQUEST_FIELDS.every((field) => Object.is(loaded[field], wanted[field]));

export class ForecastLoader implements ReactiveController {
  readonly #host: ForecastLoaderHost;
  #state: ForecastState = LOADING;
  #loaded: ForecastRequest | undefined;
  #inFlight: AbortController | undefined;
  #viewport: IntersectionObserver | undefined;
  #nearViewport = false;

  constructor(host: ForecastLoaderHost) {
    this.#host = host;
    host.addController(this);
  }

  get state(): ForecastState {
    return this.#state;
  }

  retry() {
    if (this.#state.status === "retrying") return;
    void this.#load(RETRYING);
  }

  hostConnected() {
    document.addEventListener("visibilitychange", this.#refreshWhenStale);
    if (!this.#nearViewport) this.#waitUntilNearViewport();
    if (!isSameRequest(this.#loaded, this.#host)) this.#host.requestUpdate();
  }

  hostDisconnected() {
    document.removeEventListener("visibilitychange", this.#refreshWhenStale);
    if (this.#inFlight && this.#state.status !== "ok") this.#loaded = undefined;
    this.#inFlight?.abort();
    this.#inFlight = undefined;
    this.#viewport?.disconnect();
  }

  hostUpdate() {
    if (!this.#nearViewport || isSameRequest(this.#loaded, this.#host)) return;
    this.#loaded = snapshot(this.#host);
    void this.#load(this.#state.status === "retrying" ? RETRYING : LOADING);
  }

  #show(state: ForecastState) {
    this.#state = state;
    this.#host.requestUpdate();
  }

  #waitUntilNearViewport() {
    this.#viewport = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#viewport?.disconnect();
        this.#nearViewport = true;
        this.#host.requestUpdate();
      },
      { rootMargin: NEAR_VIEWPORT_MARGIN },
    );
    this.#viewport.observe(this.#host);
  }

  readonly #refreshWhenStale = () => {
    const shown = this.#state;
    if (
      document.visibilityState === "visible" &&
      this.#inFlight === undefined &&
      shown.status === "ok" &&
      Date.now() - shown.receivedAt > FORECAST_MAX_AGE_MILLISECONDS
    ) {
      void this.#refresh(shown);
    }
  };

  #send(): Sent {
    this.#inFlight?.abort();
    this.#inFlight = undefined;
    const coordinates = v.safeParse(CoordinatesSchema, {
      latitude: this.#host.latitude,
      longitude: this.#host.longitude,
    });
    if (!coordinates.success) return INVALID_LOCATION;

    const request = new AbortController();
    this.#inFlight = request;
    const answer = fetchForecast(
      this.#host.proxyUrl,
      coordinates.output,
      requestedParts(this.#host.parts),
      request.signal,
    ).then((result) => {
      if (request.signal.aborted) return SUPERSEDED;
      this.#inFlight = undefined;
      return result;
    });
    return { status: "sent", answer };
  }

  async #load(fetching: FetchingState) {
    const sent = this.#send();
    if (sent.status === "invalid-location") {
      this.#show(INVALID_LOCATION);
      return;
    }

    this.#show(fetching);
    const answer = await sent.answer;
    if (answer.status === "superseded") return;
    this.#show(
      answer.status === "ok"
        ? {
            ...answer,
            nameTakesFocus:
              fetching.status === "retrying" &&
              this.#host.shadowRoot?.activeElement != null,
            receivedAt: Date.now(),
          }
        : answer,
    );
  }

  async #refresh(shown: ShownForecast) {
    const sent = this.#send();
    if (sent.status === "invalid-location") return;
    const answer = await sent.answer;
    if (answer.status !== "ok") return;
    this.#show({
      ...refreshedForecast(shown, answer),
      status: "ok",
      nameTakesFocus: false,
      receivedAt: keepsShownParts(shown, answer)
        ? shown.receivedAt
        : Date.now(),
    });
  }
}
