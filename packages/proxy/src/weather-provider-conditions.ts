import type { Condition } from "@weather-widget/contract";

const CONDITIONS_BY_CODE_RANGE: readonly (readonly [
  from: number,
  to: number,
  condition: Condition,
])[] = [
  [200, 232, "thunderstorm"],
  [300, 321, "drizzle"],
  [500, 504, "rain"],
  [511, 511, "sleet"],
  [520, 531, "rain"],
  [600, 602, "snow"],
  [611, 616, "sleet"],
  [620, 622, "snow"],
  [701, 701, "fog"],
  [711, 731, "haze"],
  [741, 741, "fog"],
  [751, 762, "haze"],
  [771, 781, "thunderstorm"],
  [800, 800, "clear"],
  [801, 802, "partly-cloudy"],
  [803, 803, "mostly-cloudy"],
  [804, 804, "overcast"],
];

export const conditionFor = (code: number): Condition =>
  CONDITIONS_BY_CODE_RANGE.find(
    ([from, to]) => code >= from && code <= to,
  )?.[2] ?? "unknown";
