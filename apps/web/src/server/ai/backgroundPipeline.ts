import {
  AnalysisOutputSchema,
  AnalysisStructuredOutput,
  CoachingOutputSchema,
  CoachingStructuredOutput,
  type AnalysisOutput,
  type CoachingOutput,
  validateCoachingMatchesAnalysis
} from "@/schemas/ai";
import { checkRewriteFactPreservation } from "@/server/ai/factGuard";
import { resolveFeedbackLanguage } from "@/server/ai/feedbackLanguage";
import type {
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow
} from "@/server/attempts";
import {
  feedbackInsertFromRescore,
  feedbackInsertFromOutputs,
  scoreInsertFromRescore,
  scoreInsertFromAnalysis,
  type PipelineProfileContext
} from "@/server/ai/pipeline";
import type { StgBackgroundAiClient } from "@/server/ai/types";
import {
  submitClaimedAiJob,
  type AiJobRequestPayload,
  type AiJobRepository,
  type AiJobResultHandler,
  type AiJobStage,
  type ClaimedAiJob
} from "@/server/ai/jobs";
import { createPromptResolver } from "@/server/prompts/promptResolver";

type RepairTarget = "analysis" | "coaching" | "rescore";

export function createBackgroundAiPipeline({
  attemptRepository,
  jobRepository,
  aiClient,
  model,
  timeoutMs,
  profileContextResolver = async () => undefined
}: {
  attemptRepository: AttemptRepository;
  jobRepository: AiJobRepository;
  aiClient: StgBackgroundAiClient;
  model: string;
  timeoutMs: number;
  profileContextResolver?: (
    userId: string
  ) => Promise<PipelineProfileContext | undefined>;
}) {
  const prompts = createPromptResolver();

  async function enqueueInitial(input: {
    userId: string;
    attempt: AttemptRow;
    question: AttemptQuestionRow;
    profileContext?: PipelineProfileContext;
  }) {
    const prompt = prompts.getActivePrompt("analysis");
    const profile = input.profileContext;
    await startStage({
      jobRepository,
      aiClient,
      attempt: input.attempt,
      stage: "analysis",
      model,
      promptVersion: prompt.version,
      system: prompt.system,
      user: renderTemplate(prompt.userTemplate, {
        question: formatQuestion(input.question),
        user_answer: input.attempt.original_answer,
        target_role: formatProfileContext(profile),
        language: resolveFeedbackLanguage(
          input.attempt.original_answer,
          profile?.preferredAnswerLanguage
        )
      }),
      output: AnalysisStructuredOutput,
      temperature: 0.1,
      timeoutMs
    });
    return requireAttempt(
      await attemptRepository.findAttemptById(input.userId, input.attempt.id),
      input.attempt.id
    );
  }

  async function enqueueRescore(input: {
    userId: string;
    attempt: AttemptRow;
    question: AttemptQuestionRow;
    profileContext?: PipelineProfileContext;
  }) {
    const prompt = input.attempt.analysis_prompt_version
      ? prompts.getPrompt("analysis", input.attempt.analysis_prompt_version)
      : prompts.getActivePrompt("analysis");
    const pinnedModel = input.attempt.ai_model ?? model;
    const profile = input.profileContext;
    await startStage({
      jobRepository,
      aiClient,
      attempt: input.attempt,
      stage: "rescore",
      model: pinnedModel,
      promptVersion: prompt.version,
      rubricVersion: input.attempt.rubric_version ?? "stg-rubric-v1",
      system: prompt.system,
      user: renderTemplate(prompt.userTemplate, {
        question: formatQuestion(input.question),
        user_answer: input.attempt.original_answer,
        target_role: formatProfileContext(profile),
        language: resolveFeedbackLanguage(
          input.attempt.original_answer,
          profile?.preferredAnswerLanguage
        )
      }),
      output: AnalysisStructuredOutput,
      temperature: 0.1,
      timeoutMs
    });
    return requireAttempt(
      await attemptRepository.findAttemptById(input.userId, input.attempt.id),
      input.attempt.id
    );
  }

  const resultHandler: AiJobResultHandler = {
    async onCompleted(job, response) {
      if (!response.text) {
        await repairOrFail(
          job,
          response,
          "",
          "EMPTY_PROVIDER_OUTPUT",
          "OpenAI returned no output text."
        );
        return;
      }

      let raw: unknown;
      try {
        raw = JSON.parse(response.text);
      } catch {
        await repairOrFail(
          job,
          response,
          response.text,
          "INVALID_PROVIDER_JSON",
          "OpenAI output was not valid JSON."
        );
        return;
      }

      if (job.stage === "repair") {
        await handleRepairCompletion(job, raw, response);
        return;
      }

      if (job.stage === "analysis") {
        const parsed = AnalysisOutputSchema.safeParse(raw);
        if (!parsed.success) {
          await enqueueRepair(
            job,
            "analysis",
            response.text,
            parsed.error.message,
            response
          );
          return;
        }

        await enqueueCoaching(job, parsed.data, response);
        return;
      }

      if (job.stage === "rescore") {
        const parsed = AnalysisOutputSchema.safeParse(raw);
        if (!parsed.success) {
          await enqueueRepair(
            job,
            "rescore",
            response.text,
            parsed.error.message,
            response
          );
          return;
        }
        await completeRescore(job, parsed.data, response);
        return;
      }

      if (job.stage === "coaching") {
        const analysis = await loadCompletedAnalysis(job.attemptId);
        const coaching = CoachingOutputSchema.safeParse(raw);
        if (!analysis) {
          await failJob(
            job,
            "ANALYSIS_OUTPUT_MISSING",
            "A valid completed analysis output was not available."
          );
          return;
        }
        if (!coaching.success) {
          await enqueueRepair(
            job,
            "coaching",
            response.text,
            coaching.error.message,
            response,
            analysis.output
          );
          return;
        }

        try {
          validateCoachingMatchesAnalysis(coaching.data, analysis.output);
        } catch (error) {
          await enqueueRepair(
            job,
            "coaching",
            response.text,
            error instanceof Error ? error.message : "Coaching did not match analysis.",
            response,
            analysis.output
          );
          return;
        }

        const factCheck = checkRewriteFactPreservation({
          originalAnswer: (
            await requireAttemptForJob(job)
          ).original_answer,
          coaching: coaching.data
        });
        if (!factCheck.ok) {
          await enqueueRepair(
            job,
            "coaching",
            response.text,
            "Fact guard: remove every number, company, tool, role, responsibility, or result that is not present in the original answer.",
            response,
            analysis.output
          );
          return;
        }

        await completeCoaching(
          job,
          analysis.output,
          coaching.data,
          factCheck.flags,
          response,
          analysis.repaired ? 1 : 0
        );
      }
    },

    async onFailed(job, response) {
      await failJob(
        job,
        response.errorCode ?? `OPENAI_${response.status.toUpperCase()}`,
        `OpenAI background response ended with ${response.status}.`
      );
    }
  };

  async function handleRepairCompletion(
    job: ClaimedAiJob,
    raw: unknown,
    response: Parameters<AiJobResultHandler["onCompleted"]>[1]
  ) {
    const target = parseRepairTarget(job.promptVersion);
    if (!target) {
      await failJob(
        job,
        "REPAIR_TARGET_INVALID",
        `Repair job has an invalid prompt version: ${job.promptVersion}`
      );
      return;
    }

    if (target === "analysis" || target === "rescore") {
      const analysis = AnalysisOutputSchema.safeParse(raw);
      if (!analysis.success) {
        await failJob(
          job,
          target === "analysis"
            ? "ANALYSIS_REPAIR_FAILED"
            : "RESCORE_REPAIR_FAILED",
          analysis.error.message
        );
        return;
      }

      if (target === "rescore") {
        await completeRescore(job, analysis.data, response, 1);
        return;
      }

      await enqueueCoaching(job, analysis.data, response);
      return;
    }

    const analysis = await loadCompletedAnalysis(job.attemptId);
    if (!analysis) {
      await failJob(
        job,
        "ANALYSIS_OUTPUT_MISSING",
        "A valid completed analysis output was not available to validate coaching repair."
      );
      return;
    }

    const coaching = CoachingOutputSchema.safeParse(raw);
    if (!coaching.success) {
      await failJob(job, "COACHING_REPAIR_FAILED", coaching.error.message);
      return;
    }

    try {
      validateCoachingMatchesAnalysis(coaching.data, analysis.output);
    } catch (error) {
      await failJob(
        job,
        "COACHING_REPAIR_FAILED",
        error instanceof Error ? error.message : "Coaching repair did not match analysis."
      );
      return;
    }

    const attempt = await requireAttemptForJob(job);
    const factCheck = checkRewriteFactPreservation({
      originalAnswer: attempt.original_answer,
      coaching: coaching.data
    });
    if (!factCheck.ok) {
      await failJob(
        job,
        "FACT_GUARD_REPAIR_FAILED",
        "The one allowed coaching repair still introduced unsupported facts."
      );
      return;
    }

    await completeCoaching(
      job,
      analysis.output,
      coaching.data,
      [
        ...factCheck.flags,
        {
          flag_type: "background_output_repaired",
          severity: "low",
          message: "The original coaching output required one repair pass."
        }
      ],
      response,
      1 + (analysis.repaired ? 1 : 0)
    );
  }

  async function repairOrFail(
    job: ClaimedAiJob,
    response: Parameters<AiJobResultHandler["onCompleted"]>[1],
    invalidOutput: string,
    errorCode: string,
    errorMessage: string
  ) {
    if (job.stage === "repair") {
      await failJob(job, `${errorCode}_AFTER_REPAIR`, errorMessage);
      return;
    }

    await enqueueRepair(
      job,
      repairTargetForStage(job.stage),
      invalidOutput,
      errorMessage,
      response
    );
  }

  async function enqueueRepair(
    job: ClaimedAiJob,
    target: RepairTarget,
    invalidOutput: string,
    validationError: string,
    response: Parameters<AiJobResultHandler["onCompleted"]>[1],
    analysis?: AnalysisOutput
  ) {
    const attempt = await requireAttemptForJob(job);
    const question = await requireQuestion(attempt.question_id);
    const repairPrompt = prompts.getActivePrompt("repair");
    const repairUser = renderTemplate(repairPrompt.userTemplate, {
      target_schema_name: target === "coaching" ? "coaching" : "analysis",
      question: formatQuestion(question),
      user_answer: attempt.original_answer,
      invalid_output: invalidOutput
    });
    const analysisConstraint = analysis
      ? `\n\nThe repaired coaching must exactly preserve this analysis score and dimension scores:\n${JSON.stringify(analysis)}`
      : "";

    const requestPayload = createRequestPayload({
      system: repairPrompt.system,
      user: `${repairUser}\n\nValidation or quality errors:\n${validationError}${analysisConstraint}`,
      model: job.model,
      output:
        target === "coaching"
          ? CoachingStructuredOutput
          : AnalysisStructuredOutput,
      temperature: 0,
      timeoutMs
    });
    const repairJob = await jobRepository.completeAndClaimNext({
      jobId: job.id,
      leaseToken: job.leaseToken,
      output: { invalid_output: invalidOutput },
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
      next: {
        stage: "repair",
        model: job.model,
        promptVersion: formatRepairPromptVersion(repairPrompt.version, target),
        rubricVersion: job.rubricVersion,
        requestPayload
      }
    });
    await submitDurableJob(repairJob);
  }

  async function loadCompletedAnalysis(attemptId: string): Promise<{
    output: AnalysisOutput;
    repaired: boolean;
  } | null> {
    const direct = AnalysisOutputSchema.safeParse(
      await jobRepository.getCompletedStageOutput(attemptId, "analysis")
    );
    if (direct.success) return { output: direct.data, repaired: false };

    // When the analysis stage needed repair, its invalid output remains in the
    // audit ledger and the validated replacement is stored in the completed
    // repair job. A coaching repair is still in-progress while this lookup runs,
    // so it cannot shadow the earlier analysis repair.
    const repaired = AnalysisOutputSchema.safeParse(
      await jobRepository.getCompletedStageOutput(attemptId, "repair")
    );
    return repaired.success
      ? { output: repaired.data, repaired: true }
      : null;
  }

  async function enqueueCoaching(
    job: ClaimedAiJob,
    analysis: AnalysisOutput,
    response: Parameters<AiJobResultHandler["onCompleted"]>[1]
  ) {
    const attempt = await requireAttemptForJob(job);
    const question = await requireQuestion(attempt.question_id);
    const profile = await profileContextResolver(job.userId);
    const prompt = prompts.getActivePrompt("coaching");
    const requestPayload = createRequestPayload({
      system: prompt.system,
      user: renderTemplate(prompt.userTemplate, {
        question: formatQuestion(question),
        user_answer: attempt.original_answer,
        target_role: formatProfileContext(profile),
        language: resolveFeedbackLanguage(
          attempt.original_answer,
          profile?.preferredAnswerLanguage
        ),
        analysis_json: JSON.stringify(analysis)
      }),
      model: job.model,
      output: CoachingStructuredOutput,
      temperature: 0.2,
      timeoutMs
    });
    const coachingJob = await jobRepository.completeAndClaimNext({
      jobId: job.id,
      leaseToken: job.leaseToken,
      output: analysis,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
      next: {
        stage: "coaching",
        model: job.model,
        promptVersion: prompt.version,
        rubricVersion: job.rubricVersion,
        requestPayload
      }
    });
    await submitDurableJob(coachingJob);
  }

  async function submitDurableJob(job: ClaimedAiJob) {
    try {
      await submitClaimedAiJob(job, aiClient, jobRepository);
    } catch {
      // The queued request and stable idempotency key were committed first.
      // Reconciler safely retries after this lease expires.
    }
  }

  async function completeCoaching(
    job: ClaimedAiJob,
    analysis: AnalysisOutput,
    coaching: CoachingOutput,
    safetyFlags: Array<Record<string, unknown>>,
    response: Parameters<AiJobResultHandler["onCompleted"]>[1],
    repairCount = 0
  ) {
    const complete = requireAtomicCompletion();
    const prompt = prompts.getActivePrompt("coaching");
    await complete({
      userId: job.userId,
      attemptId: job.attemptId,
      score: scoreInsertFromAnalysis(job.attemptId, analysis, coaching),
      feedback: feedbackInsertFromOutputs(
        job.attemptId,
        analysis,
        coaching,
        safetyFlags
      ),
      metadata: {
        analysis_prompt_version: prompts.getActivePrompt("analysis").version,
        coaching_prompt_version: prompt.version,
        ai_model: response.model,
        rubric_version: job.rubricVersion,
        repair_count: repairCount,
        provider_response_id: response.responseId,
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
        total_tokens: response.totalTokens,
        job_stage: "coaching",
        job_output: coaching
      },
      jobId: job.id,
      leaseToken: job.leaseToken
    });
  }

  async function completeRescore(
    job: ClaimedAiJob,
    analysis: AnalysisOutput,
    response: Parameters<AiJobResultHandler["onCompleted"]>[1],
    repairCount = 0
  ) {
    const complete = requireAtomicCompletion();
    await complete({
      userId: job.userId,
      attemptId: job.attemptId,
      score: scoreInsertFromRescore(job.attemptId, analysis),
      feedback: feedbackInsertFromRescore(
        job.attemptId,
        (await requireAttemptForJob(job)).original_answer,
        analysis
      ),
      metadata: {
        analysis_prompt_version: prompts.getActivePrompt("analysis").version,
        coaching_prompt_version: "not-run-rescore",
        ai_model: response.model,
        rubric_version: job.rubricVersion,
        repair_count: repairCount,
        provider_response_id: response.responseId,
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
        total_tokens: response.totalTokens,
        job_stage: "rescore",
        job_output: analysis
      },
      jobId: job.id,
      leaseToken: job.leaseToken
    });
  }

  async function failJob(
    job: ClaimedAiJob,
    errorCode: string,
    errorMessage: string
  ) {
    await jobRepository.fail({
      jobId: job.id,
      leaseToken: job.leaseToken,
      errorCode,
      errorMessage
    });
  }

  async function requireAttemptForJob(job: ClaimedAiJob) {
    return requireAttempt(
      await attemptRepository.findAttemptById(job.userId, job.attemptId),
      job.attemptId
    );
  }

  async function requireQuestion(questionId: string) {
    const question = await attemptRepository.findActiveQuestionById(questionId);
    if (!question) throw new Error(`Question ${questionId} was not found.`);
    return question;
  }

  function requireAtomicCompletion() {
    if (!attemptRepository.completeAiAttempt) {
      throw new Error("Atomic AI completion repository is required in background mode.");
    }
    return attemptRepository.completeAiAttempt.bind(attemptRepository);
  }

  return {
    enqueueInitial,
    enqueueRescore,
    resultHandler
  };
}

async function startStage({
  jobRepository,
  aiClient,
  attempt,
  stage,
  model,
  promptVersion,
  rubricVersion = "stg-rubric-v1",
  system,
  user,
  output,
  temperature,
  timeoutMs
}: {
  jobRepository: AiJobRepository;
  aiClient: StgBackgroundAiClient;
  attempt: AttemptRow;
  stage: AiJobStage;
  model: string;
  promptVersion: string;
  rubricVersion?: string;
  system: string;
  user: string;
  output: { name: string; schema: Record<string, unknown> };
  temperature: number;
  timeoutMs: number;
}) {
  const requestPayload = createRequestPayload({
    system,
    user,
    model,
    temperature,
    timeoutMs,
    output
  });
  const job = await jobRepository.claim({
    attemptId: attempt.id,
    stage,
    model,
    promptVersion,
    rubricVersion,
    requestPayload
  });
  if (!job) return;

  try {
    await submitClaimedAiJob(job, aiClient, jobRepository);
  } catch {
    // The Job intent exists before the paid call. A possible Provider success
    // followed by an attach crash is replayed with the same idempotency key.
  }
}

function createRequestPayload(
  input: AiJobRequestPayload
): AiJobRequestPayload {
  return input;
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (rendered, [key, value]) =>
      rendered
        .replaceAll(`{{${key}}}`, value)
        .replaceAll(`{{${key.replaceAll("_", "\\_")}}}`, value),
    template
  );
}

function formatQuestion(question: AttemptQuestionRow) {
  return [
    question.title,
    question.scenario,
    question.prompt,
    question.expected_structure
  ]
    .filter(Boolean)
    .join("\n");
}

function formatProfileContext(profile: PipelineProfileContext | undefined) {
  if (!profile) return "";
  return [
    `Target role: ${profile.targetRole.trim()}`,
    `Training goal: ${profile.trainingGoal.trim()}`
  ].join("\n");
}

function repairTargetForStage(
  stage: Exclude<AiJobStage, "repair">
): RepairTarget {
  return stage;
}

function formatRepairPromptVersion(version: string, target: RepairTarget) {
  return `${version}:${target}`;
}

function parseRepairTarget(promptVersion: string): RepairTarget | null {
  const target = promptVersion.split(":").at(-1);
  return target === "analysis" || target === "coaching" || target === "rescore"
    ? target
    : null;
}

function requireAttempt(attempt: AttemptRow | null, attemptId: string) {
  if (!attempt) throw new Error(`Attempt ${attemptId} was not found.`);
  return attempt;
}
