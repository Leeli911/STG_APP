export type FeedbackLanguage = "zh" | "en";

/**
 * Keep the product version and its feedback in one language. The current
 * Chinese beta saves `zh`; a future standalone English version can save `en`.
 * Script detection is only a fallback for callers without a saved preference.
 */
export function resolveFeedbackLanguage(
  answer: string,
  preference?: FeedbackLanguage
): FeedbackLanguage {
  if (preference) return preference;

  const chineseCharacters = answer.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinCharacters = answer.match(/[A-Za-z]/g)?.length ?? 0;

  if (chineseCharacters > 0 && latinCharacters === 0) return "zh";
  if (latinCharacters > 0 && chineseCharacters === 0) return "en";

  // For pre-onboarding users, mixed text, or answers without a language signal,
  // follow the dominant script instead of relying on process locale.
  return chineseCharacters >= latinCharacters ? "zh" : "en";
}
