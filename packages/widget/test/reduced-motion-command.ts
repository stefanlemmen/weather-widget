import type { BrowserCommand } from "vitest/node";

export type ReducedMotion = "reduce" | "no-preference";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reducedMotion: ReducedMotion) => Promise<void>;
  }
}

export const emulateReducedMotion: BrowserCommand<[ReducedMotion]> = async (
  context,
  reducedMotion,
) => {
  await context.page.emulateMedia({ reducedMotion });
};
