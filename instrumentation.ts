// Runs once when the server starts. Fails fast with a clear message if any
// required environment variable is missing or malformed (PROJECT_BRIEF SR-12).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("./lib/env-schema");
    parseServerEnv(process.env);
  }
}
