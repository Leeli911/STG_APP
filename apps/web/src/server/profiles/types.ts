export type PreferredAnswerLanguage = "zh" | "en";
export type InterviewType = "behavioral" | "case" | "general";

export type UserProfileDto = {
  targetRole: string;
  interviewType: InterviewType;
  trainingGoal: string;
  preferredAnswerLanguage: PreferredAnswerLanguage;
  consentToAnonymizedEvals: boolean;
  onboardingCompletedAt: string;
};

export type UserProfileRow = {
  user_id: string;
  target_role: string;
  interview_type: InterviewType;
  training_goal: string;
  preferred_answer_language: PreferredAnswerLanguage;
  consent_to_anonymized_evals: boolean;
  onboarding_completed_at: string;
  created_at: string;
  updated_at: string;
};

export function toUserProfileDto(row: UserProfileRow): UserProfileDto {
  return {
    targetRole: row.target_role,
    interviewType: row.interview_type,
    trainingGoal: row.training_goal,
    preferredAnswerLanguage: row.preferred_answer_language,
    consentToAnonymizedEvals: row.consent_to_anonymized_evals,
    onboardingCompletedAt: row.onboarding_completed_at
  };
}
