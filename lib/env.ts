import "server-only";
import { parseServerEnv, type ServerEnv } from "./env-schema";

let cached: ServerEnv | undefined;

/** Validated server configuration, including secrets. Server-only. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
