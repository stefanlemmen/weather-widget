import type { DailyForecast, HourlyForecast } from "@weather-widget/contract";

export const HOURS_SHOWN = 12;
export const DAYS_SHOWN = 5;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const CALENDAR_DATE_LOCALE = "en";
const CALENDAR_DATE_PARTS = ["year", "month", "day"] as const;

export const upcomingHours = (
  hours: HourlyForecast,
  now: Date,
): HourlyForecast =>
  hours
    .filter(
      (hour) =>
        Date.parse(hour.startsAt) + MILLISECONDS_PER_HOUR > now.getTime(),
    )
    .slice(0, HOURS_SHOWN);

const calendarDate = (moment: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat(CALENDAR_DATE_LOCALE, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(moment);
  return CALENDAR_DATE_PARTS.map((type) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new RangeError(`Intl gave no ${type} for ${timeZone}`);
    }
    return value;
  }).join("-");
};

export const upcomingDays = (
  days: DailyForecast,
  timeZone: string,
  now: Date,
): DailyForecast => {
  const today = calendarDate(now, timeZone);
  return days.filter((day) => day.date >= today).slice(0, DAYS_SHOWN);
};
