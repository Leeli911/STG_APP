import { z } from "zod";

const uuid = z.string().uuid();
const practiceDay = z.number().int().min(1).max(7);

const onboardingEvent = z
  .object({
    event_name: z.literal("onboarding_completed"),
    metadata: z
      .object({
        interview_type: z.enum(["behavioral", "case", "general"]).optional(),
        preferred_answer_language: z.enum(["zh", "en"]).optional(),
        consent_to_anonymized_evals: z.boolean().optional()
      })
      .strict()
      .default({})
  })
  .strict();

const draftEvent = z
  .object({
    event_name: z.literal("draft_submitted"),
    attempt_id: uuid,
    metadata: z
      .object({
        practice_day: practiceDay,
        character_count: z.number().int().min(1).max(6000),
        answer_language: z.enum(["zh", "en", "mixed"]).optional()
      })
      .strict()
  })
  .strict();

const feedbackEvent = z
  .object({
    event_name: z.literal("feedback_viewed"),
    session_id: uuid,
    attempt_id: uuid.optional(),
    metadata: z
      .object({
        practice_day: practiceDay,
        feedback_mode: z.literal("D").optional()
      })
      .strict()
  })
  .strict();

const revisionEvent = z
  .object({
    event_name: z.literal("revision_committed"),
    session_id: uuid,
    attempt_id: uuid.optional(),
    metadata: z
      .object({
        practice_day: practiceDay,
        action: z.enum(["accepted", "rejected", "edited"])
      })
      .strict()
  })
  .strict();

const completedEvent = z
  .object({
    event_name: z.literal("session_completed"),
    session_id: uuid,
    attempt_id: uuid.optional(),
    metadata: z
      .object({
        practice_day: practiceDay,
        action: z.enum(["accepted", "rejected", "edited"]),
        score_delta: z.number().int().min(-100).max(100).optional()
      })
      .strict()
  })
  .strict();

const dayCompletedEvent = z
  .object({
    event_name: z.literal("day_completed"),
    session_id: uuid,
    attempt_id: uuid.optional(),
    metadata: z
      .object({
        practice_day: practiceDay,
        curriculum_slug: z.literal("stg-7day-v1").optional()
      })
      .strict()
  })
  .strict();

export const ProductEventInputSchema = z.discriminatedUnion("event_name", [
  onboardingEvent,
  draftEvent,
  feedbackEvent,
  revisionEvent,
  completedEvent,
  dayCompletedEvent
]);

export type ProductEventInput = z.infer<typeof ProductEventInputSchema>;
export type ProductEventName = ProductEventInput["event_name"];

export type ProductEventRecordInput = ProductEventInput & {
  /** Authenticated by the owning business API, never accepted from a browser body. */
  userId: string;
  request_id?: string;
};

export const ProductEventUserIdSchema = uuid;
