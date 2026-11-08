import { DEFAULT_LOCALE, LOCALES, type Locale } from "@weather-widget/contract";
import * as v from "valibot";

const LocaleSchema = v.fallback(v.picklist(LOCALES), DEFAULT_LOCALE);

export const parseLocale = (locale: unknown): Locale =>
  v.parse(LocaleSchema, locale);
