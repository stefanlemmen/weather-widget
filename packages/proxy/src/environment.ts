import * as v from "valibot";

export const MISSING_WEATHER_PROVIDER_KEY_MESSAGE =
  "OPENWEATHER_API_KEY is not set. Add it to .env for local development, or to the Vercel project's environment variables.";

const EnvironmentSchema = v.pipe(
  v.object({
    OPENWEATHER_API_KEY: v.pipe(
      v.optional(v.string(), ""),
      v.trim(),
      v.nonEmpty(MISSING_WEATHER_PROVIDER_KEY_MESSAGE),
    ),
  }),
  v.transform((raw) => ({ weatherProviderKey: raw.OPENWEATHER_API_KEY })),
);

export type Environment = v.InferOutput<typeof EnvironmentSchema>;

export type RawEnvironment = Readonly<Record<string, string | undefined>>;

export const parseEnvironment = (raw: RawEnvironment): Environment =>
  v.parse(EnvironmentSchema, raw);
