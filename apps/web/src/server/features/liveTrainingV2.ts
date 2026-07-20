type FeatureEnv = Record<string, string | undefined>;

/**
 * Live Training V2 is a server-owned release switch. It is fail-closed in every
 * environment unless explicitly enabled, so a production deployment can retain
 * the read-only result flow while the new revision journey is validated.
 */
export function isLiveTrainingV2Enabled(env: FeatureEnv = process.env) {
  return env.LIVE_TRAINING_V2 === "true";
}
