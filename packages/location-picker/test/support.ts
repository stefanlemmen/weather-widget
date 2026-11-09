import type { ProblemDetails } from "@weather-widget/contract";
import { afterEach, beforeEach, vi } from "vitest";

export const unavailable: ProblemDetails = {
  type: "about:blank",
  title: "Search unavailable",
  status: 503,
};

export const respondWith = (body: unknown, status = 200) =>
  Promise.resolve(Response.json(body, { status }));

export const fakeProxy = vi.fn<typeof fetch>();

const urlOf = (input: RequestInfo | URL) =>
  new URL(input instanceof Request ? input.url : input, document.baseURI);

export const requestedUrls = () =>
  fakeProxy.mock.calls.map(([input]) => urlOf(input));

beforeEach(() => {
  fakeProxy.mockReset();
  vi.stubGlobal("fetch", fakeProxy);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
