import { performance } from "node:perf_hooks";

import { getAiRuntimeConfig, type AiMode } from "@/server/ai/config";
import { checkRewriteFactPreservation } from "@/server/ai/factGuard";
import { resolveFeedbackLanguage } from "@/server/ai/feedbackLanguage";
import { createOpenAiClient } from "@/server/ai/openaiClient";
import type { StgAiClient } from "@/server/ai/types";
import { createPromptResolver } from "@/server/prompts/promptResolver";
import { createDeterministicMockResult } from "@/server/attempts/mockResult";
import type {
  AiFeedbackInsert,
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow,
  ScoreInsert
} from "@/server/attempts";
import {
  AnalysisOutputSchema,
  AnalysisStructuredOutput,
  CoachingOutputSchema,
  CoachingStructuredOutput,
  type AnalysisOutput,
  type CoachingOutput,
  validateCoachingMatchesAnalysis
} from "@/schemas/ai";

export type PipelineProfileContext = {
  targetRole: string;
  trainingGoal: string;
  preferredAnswerLanguage: "zh" | "en";
};

export type PipelineInput = {
  mode?: AiMode;
  userId: string;
  attempt: AttemptRow;
  question: AttemptQuestionRow;
  repository: AttemptRepository;
  aiClient?: StgAiClient;
  profileContext?: PipelineProfileContext;
};

export async function runAiCoachPipeline(input: PipelineInput): Promise<AttemptRow> {
  const config = getAiRuntimeConfig({
    ...process.env,
    STG_AI_MODE: input.mode ?? process.env.STG_AI_MODE,
    OPENAI_API_KEY: input.aiClient
      ? process.env.OPENAI_API_KEY ?? "test-openai-key"
      : process.env.OPENAI_API_KEY
  });

  if (config.mode === "mock") {
    return runMockPipeline(input);
  }

  const aiClient =
    input.aiClient ?? createOpenAiClient(config.apiKey ?? "");
  const resolver = createPromptResolver();
  const startedAt = performance.now();
  let repairCount = 0;
  let analysisLatencyMs = 0;
  let coachingLatencyMs = 0;

  try {
    const analysisPrompt = resolver.getActivePrompt("analysis");
    const coachingPrompt = resolver.getActivePrompt("coaching");
    const targetRole = formatProfileContext(input.profileContext);
    const answerLanguage = resolveFeedbackLanguage(
      input.attempt.original_answer,
      input.profileContext?.preferredAnswerLanguage
    );

    await updateStatus(input, "analysis_running");
    await updateMetadata(input, {
      analysis_prompt_version: analysisPrompt.version,
      coaching_prompt_version: coachingPrompt.version,
      ai_model: config.model,
      rubric_version: "stg-rubric-v1",
      repair_count: 0,
      error_code: null
    });

    const analysisCall = await callAndValidateWithRepair<AnalysisOutput>({
      aiClient,
      schemaName: "analysis",
      promptSystem: analysisPrompt.system,
      promptUser: renderTemplate(analysisPrompt.userTemplate, {
        question: formatQuestion(input.question),
        user_answer: input.attempt.original_answer,
        target_role: targetRole,
        language: answerLanguage
      }),
      question: input.question,
      answer: input.attempt.original_answer,
      model: config.model,
      temperature: config.analysisTemperature,
      timeoutMs: config.timeoutMs,
      parse: (value) => AnalysisOutputSchema.parse(value),
      structuredOutput: AnalysisStructuredOutput,
      errorCode: "ANALYSIS_VALIDATION_FAILED",
      aiClientForRepair: aiClient
    });
    repairCount += analysisCall.repairCount;
    analysisLatencyMs = analysisCall.latencyMs;

    await updateStatus(input, "coaching_running");

    let coachingCall = await callAndValidateWithRepair<CoachingOutput>({
      aiClient,
      schemaName: "coaching",
      promptSystem: coachingPrompt.system,
      promptUser: renderTemplate(coachingPrompt.userTemplate, {
        question: formatQuestion(input.question),
        user_answer: input.attempt.original_answer,
        target_role: targetRole,
        language: answerLanguage,
        analysis_json: JSON.stringify(analysisCall.output)
      }),
      question: input.question,
      answer: input.attempt.original_answer,
      model: config.model,
      temperature: config.coachingTemperature,
      timeoutMs: config.timeoutMs,
      parse: (value) => {
        const coaching = CoachingOutputSchema.parse(value);
        validateCoachingMatchesAnalysis(coaching, analysisCall.output);
        return coaching;
      },
      structuredOutput: CoachingStructuredOutput,
      errorCode: "COACHING_VALIDATION_FAILED",
      aiClientForRepair: aiClient
    });
    repairCount += coachingCall.repairCount;
    coachingLatencyMs = coachingCall.latencyMs;

    let safetyFlags = checkRewriteFactPreservation({
      originalAnswer: input.attempt.original_answer,
      coaching: coachingCall.output
    });

    if (!safetyFlags.ok) {
      const stricterCall = await aiClient.generateJson({
        system: `${coachingPrompt.system}\n\nStrict fact preservation: regenerate without adding any number, company, tool, role, responsibility, or result not present in the original answer.`,
        user: renderTemplate(coachingPrompt.userTemplate, {
          question: formatQuestion(input.question),
          user_answer: input.attempt.original_answer,
          target_role: targetRole,
          language: answerLanguage,
          analysis_json: JSON.stringify(analysisCall.output)
        }),
        model: config.model,
        temperature: config.coachingTemperature,
        timeoutMs: config.timeoutMs,
        output: CoachingStructuredOutput
      });
      const regenerated = CoachingOutputSchema.parse(parseJson(stricterCall.text));
      validateCoachingMatchesAnalysis(regenerated, analysisCall.output);
      const regeneratedFlags = checkRewriteFactPreservation({
        originalAnswer: input.attempt.original_answer,
        coaching: regenerated
      });

      if (!regeneratedFlags.ok) {
        await failAttempt(input, "FACT_GUARD_FAILED", repairCount);
        throw new Error("Coaching rewrite introduced unsupported facts.");
      }

      coachingCall = {
        ...coachingCall,
        output: regenerated,
        latencyMs: coachingCall.latencyMs + stricterCall.latencyMs,
        responseId: stricterCall.responseId ?? coachingCall.responseId,
        inputTokens: coachingCall.inputTokens + (stricterCall.inputTokens ?? 0),
        outputTokens: coachingCall.outputTokens + (stricterCall.outputTokens ?? 0),
        totalTokens: coachingCall.totalTokens + (stricterCall.totalTokens ?? 0)
      };
      safetyFlags = {
        ok: true,
        flags: [
          {
            flag_type: "fact_guard_regenerated",
            severity: "medium",
            message: "Initial coaching rewrite introduced unsupported facts."
          }
        ]
      };
    }

    const totalLatencyMs = Math.round(performance.now() - startedAt);
    const score = scoreInsertFromAnalysis(
      input.attempt.id,
      analysisCall.output,
      coachingCall.output
    );
    const feedback = feedbackInsertFromOutputs(
      input.attempt.id,
      analysisCall.output,
      coachingCall.output,
      safetyFlags.flags
    );
    const completionMetadata = {
      analysis_prompt_version: analysisPrompt.version,
      coaching_prompt_version: coachingPrompt.version,
      rubric_version: "stg-rubric-v1",
      repair_count: repairCount,
      analysis_latency_ms: analysisLatencyMs,
      coaching_latency_ms: coachingLatencyMs,
      total_latency_ms: totalLatencyMs,
      ai_model: analysisCall.model,
      provider_response_id: coachingCall.responseId,
      input_tokens: analysisCall.inputTokens + coachingCall.inputTokens,
      output_tokens: analysisCall.outputTokens + coachingCall.outputTokens,
      total_tokens: analysisCall.totalTokens + coachingCall.totalTokens
    };

    if (input.repository.completeAiAttempt) {
      return await input.repository.completeAiAttempt({
        userId: input.userId,
        attemptId: input.attempt.id,
        score,
        feedback,
        metadata: completionMetadata
      });
    }

    await persistResult(input.repository, score, feedback);
    const completed = await updateStatus(input, "completed");
    await updateMetadata(input, completionMetadata);

    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI pipeline error";
    const errorCode =
      error instanceof PipelineValidationError
        ? error.errorCode
        : classifyPipelineError(message);
    const finalRepairCount =
      error instanceof PipelineValidationError
        ? repairCount + error.repairCount
        : repairCount;
    await failAttempt(input, errorCode, finalRepairCount);
    throw new Error(
      errorCode.endsWith("VALIDATION_FAILED")
        ? message
        : "AI pipeline request failed."
    );
  }
}

export async function runAiRescorePipeline(input: PipelineInput): Promise<AttemptRow> {
  const config = getAiRuntimeConfig({
    ...process.env,
    STG_AI_MODE: input.mode ?? process.env.STG_AI_MODE,
    OPENAI_API_KEY: input.aiClient
      ? process.env.OPENAI_API_KEY ?? "test-openai-key"
      : process.env.OPENAI_API_KEY
  });
  if (config.mode === "mock") {
    return runMockPipeline(input);
  }

  const aiClient = input.aiClient ?? createOpenAiClient(config.apiKey ?? "");
  const promptResolver = createPromptResolver();
  const prompt = input.attempt.analysis_prompt_version
    ? promptResolver.getPrompt("analysis", input.attempt.analysis_prompt_version)
    : promptResolver.getActivePrompt("analysis");
  const pinnedModel = input.attempt.ai_model ?? config.model;
  const pinnedRubric = input.attempt.rubric_version ?? "stg-rubric-v1";
  const startedAt = performance.now();
  const answerLanguage = resolveFeedbackLanguage(
    input.attempt.original_answer,
    input.profileContext?.preferredAnswerLanguage
  );

  try {
    await updateStatus(input, "analysis_running");
    await updateMetadata(input, {
      analysis_prompt_version: prompt.version,
      coaching_prompt_version: "not-run-rescore",
      ai_model: pinnedModel,
      rubric_version: pinnedRubric,
      repair_count: 0,
      error_code: null
    });

    const analysisCall = await callAndValidateWithRepair<AnalysisOutput>({
      aiClient,
      aiClientForRepair: aiClient,
      schemaName: "analysis",
      promptSystem: prompt.system,
      promptUser: renderTemplate(prompt.userTemplate, {
        question: formatQuestion(input.question),
        user_answer: input.attempt.original_answer,
        target_role: formatProfileContext(input.profileContext),
        language: answerLanguage
      }),
      question: input.question,
      answer: input.attempt.original_answer,
      model: pinnedModel,
      temperature: config.analysisTemperature,
      timeoutMs: config.timeoutMs,
      parse: (value) => AnalysisOutputSchema.parse(value),
      structuredOutput: AnalysisStructuredOutput,
      errorCode: "RESCORE_VALIDATION_FAILED"
    });
    const totalLatencyMs = Math.round(performance.now() - startedAt);
    const score = scoreInsertFromRescore(input.attempt.id, analysisCall.output);
    const feedback = feedbackInsertFromRescore(
      input.attempt.id,
      input.attempt.original_answer,
      analysisCall.output
    );
    const metadata = {
      analysis_prompt_version: prompt.version,
      coaching_prompt_version: "not-run-rescore",
      ai_model: analysisCall.model,
      rubric_version: pinnedRubric,
      repair_count: analysisCall.repairCount,
      analysis_latency_ms: analysisCall.latencyMs,
      coaching_latency_ms: 0,
      total_latency_ms: totalLatencyMs,
      provider_response_id: analysisCall.responseId,
      input_tokens: analysisCall.inputTokens,
      output_tokens: analysisCall.outputTokens,
      total_tokens: analysisCall.totalTokens,
      job_stage: "rescore" as const,
      job_output: analysisCall.output
    };

    if (input.repository.completeAiAttempt) {
      return await input.repository.completeAiAttempt({
        userId: input.userId,
        attemptId: input.attempt.id,
        score,
        feedback,
        metadata
      });
    }

    await persistResult(input.repository, score, feedback);
    const completed = await updateStatus(input, "completed");
    await updateMetadata(input, metadata);
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown rescore error";
    await failAttempt(input, classifyPipelineError(message), 0);
    throw new Error("AI rescore request failed.");
  }
}

async function runMockPipeline(input: PipelineInput) {
  await updateStatus(input, "mock_result_generating");
  const mockResult = createDeterministicMockResult(input.attempt);
  await input.repository.createScore({
    ...mockResult.score,
    rubric_evidence: null
  });
  await input.repository.createAiFeedback({
    ...mockResult.feedback,
    question_analysis: null,
    observable_features: null,
    safety_flags: []
  });
  const completed = await updateStatus(input, "completed");
  await updateMetadata(input, {
    ai_model: "mock",
    rubric_version: "stg-rubric-v1",
    repair_count: 0,
    error_code: null
  });
  return completed;
}

async function callAndValidateWithRepair<T>({
  aiClient,
  aiClientForRepair,
  schemaName,
  promptSystem,
  promptUser,
  question,
  answer,
  model,
  temperature,
  timeoutMs,
  parse,
  structuredOutput,
  errorCode
}: {
  aiClient: StgAiClient;
  aiClientForRepair: StgAiClient;
  schemaName: "analysis" | "coaching";
  promptSystem: string;
  promptUser: string;
  question: AttemptQuestionRow;
  answer: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  parse: (value: unknown) => T;
  structuredOutput: {
    name: string;
    schema: Record<string, unknown>;
  };
  errorCode: string;
}) {
  const first = await aiClient.generateJson({
    system: promptSystem,
    user: promptUser,
    model,
    temperature,
    timeoutMs,
    output: structuredOutput
  });

  try {
    return {
      output: parse(parseJson(first.text)),
      repairCount: 0,
      latencyMs: first.latencyMs,
      model: first.model,
      responseId: first.responseId,
      inputTokens: first.inputTokens ?? 0,
      outputTokens: first.outputTokens ?? 0,
      totalTokens: first.totalTokens ?? 0
    };
  } catch (validationError) {
    const repairPrompt = createPromptResolver().getActivePrompt("repair");
    const repairUser = renderTemplate(repairPrompt.userTemplate, {
      target_schema_name: schemaName,
      question: formatQuestion(question),
      user_answer: answer,
      invalid_output: first.text
    });
    const repair = await aiClientForRepair.generateJson({
      system: repairPrompt.system,
      user: `${repairUser}\n\nSchema Errors:\n${formatSchemaError(validationError)}`,
      model,
      temperature: 0,
      timeoutMs,
      output: structuredOutput
    });

    try {
      return {
        output: parse(parseJson(repair.text)),
        repairCount: 1,
        latencyMs: first.latencyMs + repair.latencyMs,
        model: first.model,
        responseId: repair.responseId ?? first.responseId,
        inputTokens: (first.inputTokens ?? 0) + (repair.inputTokens ?? 0),
        outputTokens: (first.outputTokens ?? 0) + (repair.outputTokens ?? 0),
        totalTokens: (first.totalTokens ?? 0) + (repair.totalTokens ?? 0)
      };
    } catch {
      throw new PipelineValidationError(
        `${schemaName === "analysis" ? "Analysis" : "Coaching"} output failed schema validation.`,
        errorCode,
        1
      );
    }
  }
}

async function persistResult(
  repository: AttemptRepository,
  score: ScoreInsert,
  feedback: AiFeedbackInsert
) {
  await repository.createScore(score);
  await repository.createAiFeedback(feedback);
}

export function feedbackInsertFromOutputs(
  attemptId: string,
  analysis: AnalysisOutput,
  coaching: CoachingOutput,
  safetyFlags: Array<Record<string, unknown>>
): AiFeedbackInsert {
  return {
    attempt_id: attemptId,
    question_analysis: analysis.question_analysis,
    observable_features: analysis.observable_features,
    diagnosis: coaching.diagnosis,
    rewrite: coaching.rewrite,
    why_better: coaching.why_better,
    growth_suggestion: coaching.growth_suggestion,
    safety_flags: safetyFlags
  };
}

export function scoreInsertFromAnalysis(
  attemptId: string,
  analysis: AnalysisOutput,
  coaching: CoachingOutput
): ScoreInsert {
  const dimensionMap = new Map(
    analysis.dimension_scores.map((item) => [item.dimension, item.score])
  );

  return {
    attempt_id: attemptId,
    answer_relevance: dimensionMap.get("relevance") ?? 0,
    core_message: dimensionMap.get("core_message") ?? 0,
    structure: dimensionMap.get("structure") ?? 0,
    evidence: dimensionMap.get("evidence") ?? 0,
    interview_impact: dimensionMap.get("interview_impact") ?? 0,
    total_score: analysis.score.total,
    rubric_evidence: {
      score: coaching.score,
      dimension_scores: coaching.dimension_scores
    }
  };
}

export function scoreInsertFromRescore(
  attemptId: string,
  analysis: AnalysisOutput
): ScoreInsert {
  const dimensions = new Map(
    analysis.dimension_scores.map((item) => [item.dimension, item.score])
  );
  return {
    attempt_id: attemptId,
    answer_relevance: dimensions.get("relevance") ?? 0,
    core_message: dimensions.get("core_message") ?? 0,
    structure: dimensions.get("structure") ?? 0,
    evidence: dimensions.get("evidence") ?? 0,
    interview_impact: dimensions.get("interview_impact") ?? 0,
    total_score: analysis.score.total,
    rubric_evidence: {
      score: analysis.score,
      dimension_scores: analysis.dimension_scores
    }
  };
}

export function feedbackInsertFromRescore(
  attemptId: string,
  finalAnswer: string,
  analysis: AnalysisOutput
): AiFeedbackInsert {
  const primaryIssue = analysis.diagnosis[0];
  return {
    attempt_id: attemptId,
    question_analysis: analysis.question_analysis,
    observable_features: analysis.observable_features,
    diagnosis: analysis.diagnosis,
    rewrite: {
      rewrite_goal: "Rescore only; no second coaching rewrite was generated.",
      structure_used: analysis.question_analysis.expected_structure,
      text: finalAnswer,
      fact_preservation_note: "The final answer is stored unchanged."
    },
    why_better: [],
    growth_suggestion: {
      focus_for_next_practice: primaryIssue.issue_type,
      micro_drill: primaryIssue.why_it_matters,
      example_sentence_frame: "",
      estimated_next_level: analysis.score.learning_level
    },
    safety_flags: [
      {
        flag_type: "analysis_only_rescore",
        severity: "low",
        message: "The final answer was rescored without a second coaching call."
      }
    ]
  };
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

function parseJson(text: string) {
  return JSON.parse(text);
}

function formatSchemaError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown schema validation error.";
}

async function updateStatus(
  input: PipelineInput,
  status: AttemptRow["status"]
) {
  return input.repository.updateAttemptStatus(input.userId, input.attempt.id, status);
}

async function updateMetadata(
  input: PipelineInput,
  metadata: NonNullable<Parameters<NonNullable<AttemptRepository["updateAttemptPipelineMetadata"]>>[2]>
) {
  if (input.repository.updateAttemptPipelineMetadata) {
    await input.repository.updateAttemptPipelineMetadata(
      input.userId,
      input.attempt.id,
      metadata
    );
  }
}

async function failAttempt(
  input: PipelineInput,
  errorCode: string,
  repairCount: number
) {
  await updateStatus(input, "failed");
  await updateMetadata(input, {
    error_code: errorCode,
    repair_count: repairCount
  });
}

function classifyPipelineError(message: string) {
  if (/timeout/i.test(message)) {
    return "AI_TIMEOUT";
  }

  if (/Analysis output failed schema validation/.test(message)) {
    return "ANALYSIS_VALIDATION_FAILED";
  }

  if (/Coaching output failed schema validation/.test(message)) {
    return "COACHING_VALIDATION_FAILED";
  }

  return "AI_PIPELINE_FAILED";
}

class PipelineValidationError extends Error {
  errorCode: string;
  repairCount: number;

  constructor(message: string, errorCode: string, repairCount: number) {
    super(message);
    this.name = "PipelineValidationError";
    this.errorCode = errorCode;
    this.repairCount = repairCount;
  }
}
