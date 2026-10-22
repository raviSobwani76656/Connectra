export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Seconds left before another confirmation email may be requested (0 = allowed now).
 * A timestamp in the future (clock change or tampering) counts as "just sent".
 */
export function secondsUntilResendAllowed(
  lastSentAtMs: number | null | undefined,
  nowMs: number,
  cooldownSeconds: number = RESEND_COOLDOWN_SECONDS,
): number {
  if (lastSentAtMs == null || !Number.isFinite(lastSentAtMs)) {
    return 0;
  }
  const elapsedMs = nowMs - lastSentAtMs;
  if (elapsedMs < 0) {
    return cooldownSeconds;
  }
  return Math.max(0, cooldownSeconds - Math.floor(elapsedMs / 1000));
}
