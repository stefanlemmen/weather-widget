import type { BrowserCommand } from "vitest/node";

export interface MediaFeatures {
  readonly reducedMotion?: "reduce" | "no-preference";
  readonly colorScheme?: "light" | "dark";
}

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateMedia: (features: MediaFeatures) => Promise<void>;
  }
}

export const emulateMedia: BrowserCommand<[MediaFeatures]> = async (
  context,
  features,
) => {
  await context.page.emulateMedia(features);
};
