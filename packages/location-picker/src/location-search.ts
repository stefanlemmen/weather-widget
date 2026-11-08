import {
  FAILED,
  LOCATIONS_PATH,
  LocationsResponseSchema,
  type FoundLocation,
  type LocationsQuery,
  type Result,
} from "@weather-widget/contract";
import * as v from "valibot";

const locationsUrl = (proxyUrl: string, { name, locale }: LocationsQuery) => {
  const url = new URL(`${proxyUrl}${LOCATIONS_PATH}`, document.baseURI);
  url.search = new URLSearchParams({ name, locale }).toString();
  return url;
};

export const findLocations = async (
  proxyUrl: string,
  query: LocationsQuery,
  signal: AbortSignal,
): Promise<Result<readonly FoundLocation[]>> => {
  try {
    const response = await fetch(locationsUrl(proxyUrl, query), {
      signal,
    });
    if (!response.ok) return FAILED;
    const found = v.safeParse(LocationsResponseSchema, await response.json());
    return found.success
      ? { status: "ok", data: found.output.locations }
      : FAILED;
  } catch {
    return FAILED;
  }
};
