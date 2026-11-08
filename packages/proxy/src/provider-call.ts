import type { Result } from "@weather-widget/contract";
import * as v from "valibot";

const TIMEOUT_ERROR = "TimeoutError";
const FAILURE_REASONS = {
  timedOut: "timed out",
  unreachable: "unreachable",
  unexpectedResponse: "unexpected response",
} as const;
type FailureReason =
  (typeof FAILURE_REASONS)[keyof typeof FAILURE_REASONS] | `HTTP ${string}`;
const httpStatusReason = (status: number): FailureReason =>
  `HTTP ${String(status)}`;

export const FAILED = { status: "error" } as const;

export interface ProviderCall<TSchema extends v.GenericSchema> {
  readonly name: string;
  readonly url: string;
  readonly schema: TSchema;
}

export interface ProviderOptions {
  readonly provider: string;
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs: number;
}

export type FetchParsed = <TSchema extends v.GenericSchema>(
  call: ProviderCall<TSchema>,
  parameters: Readonly<Record<string, string>>,
) => Promise<Result<v.InferOutput<TSchema>>>;

const failureReason = (error: unknown): FailureReason => {
  if (error instanceof DOMException && error.name === TIMEOUT_ERROR) {
    return FAILURE_REASONS.timedOut;
  }
  if (error instanceof SyntaxError) return FAILURE_REASONS.unexpectedResponse;
  return FAILURE_REASONS.unreachable;
};

export const fetchParsedWith = (options: ProviderOptions): FetchParsed => {
  const callFailed = (
    call: ProviderCall<v.GenericSchema>,
    reason: FailureReason,
  ) => {
    console.error(`${options.provider} ${call.name} call failed: ${reason}`);
    return FAILED;
  };

  return async (call, parameters) => {
    const url = new URL(call.url);
    url.search = new URLSearchParams(parameters).toString();
    try {
      const response = await options.fetch(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        return callFailed(call, httpStatusReason(response.status));
      }
      const parsed = v.safeParse(call.schema, await response.json());
      return parsed.success
        ? { status: "ok", data: parsed.output }
        : callFailed(call, FAILURE_REASONS.unexpectedResponse);
    } catch (error) {
      return callFailed(call, failureReason(error));
    }
  };
};
