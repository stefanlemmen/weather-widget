import * as v from "valibot";

export const MISSING_WEATHER_PROVIDER_KEY_MESSAGE =
  "OPENWEATHER_API_KEY is not set. Add it to .env for local development, or to the Vercel project's environment variables.";

export const WEATHER_PROVIDER_MODES = {
  live: "live",
  fixtures: "fixtures",
} as const;

const UNKNOWN_WEATHER_PROVIDER_MODE_MESSAGE = `WEATHER_PROVIDER_MODE must be "${WEATHER_PROVIDER_MODES.live}" or "${WEATHER_PROVIDER_MODES.fixtures}".`;

const LiveEnvironmentSchema = v.pipe(
  v.object({
    WEATHER_PROVIDER_MODE: v.optional(
      v.literal(WEATHER_PROVIDER_MODES.live),
      WEATHER_PROVIDER_MODES.live,
    ),
    OPENWEATHER_API_KEY: v.pipe(
      v.optional(v.string(), ""),
      v.trim(),
      v.nonEmpty(MISSING_WEATHER_PROVIDER_KEY_MESSAGE),
    ),
  }),
  v.transform((raw) => ({
    mode: raw.WEATHER_PROVIDER_MODE,
    weatherProviderKey: raw.OPENWEATHER_API_KEY,
  })),
);

const FixturesEnvironmentSchema = v.pipe(
  v.object({
    WEATHER_PROVIDER_MODE: v.literal(WEATHER_PROVIDER_MODES.fixtures),
  }),
  v.transform((raw) => ({ mode: raw.WEATHER_PROVIDER_MODE })),
);

const ModeSchema = v.object({
  WEATHER_PROVIDER_MODE: v.optional(
    v.picklist(
      Object.values(WEATHER_PROVIDER_MODES),
      UNKNOWN_WEATHER_PROVIDER_MODE_MESSAGE,
    ),
  ),
});

export type Environment =
  | v.InferOutput<typeof LiveEnvironmentSchema>
  | v.InferOutput<typeof FixturesEnvironmentSchema>;

export type RawEnvironment = Readonly<Record<string, string | undefined>>;

const parseOrThrow = <TSchema extends v.GenericSchema>(
  schema: TSchema,
  raw: unknown,
): v.InferOutput<TSchema> => {
  const result = v.safeParse(schema, raw);
  if (!result.success) {
    throw new Error(result.issues.map((issue) => issue.message).join("\n"));
  }
  return result.output;
};

export const parseEnvironment = (raw: RawEnvironment): Environment => {
  const { WEATHER_PROVIDER_MODE } = parseOrThrow(ModeSchema, raw);
  return WEATHER_PROVIDER_MODE === WEATHER_PROVIDER_MODES.fixtures
    ? parseOrThrow(FixturesEnvironmentSchema, raw)
    : parseOrThrow(LiveEnvironmentSchema, raw);
};
