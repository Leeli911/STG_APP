import type {
  EvaluationConcept,
  SelfCheckStatus,
  SkillAssessment,
  SkillAssessmentStatus,
  StructuredEvaluationAnchor,
  StructuredSkillId
} from "@/features/structured-practice/types";

const RULE_VERSION = "stg-structure-rules-v2" as const;

export function evaluateStructuredAnswer(input: {
  skillId: StructuredSkillId;
  answer: string;
  selfStatement: string;
  evaluation: StructuredEvaluationAnchor;
}): SkillAssessment {
  const answer = input.answer.trim();
  const selfStatement = input.selfStatement.trim();
  const sentences = splitChineseSentences(answer);
  const intentMatches = matchConcepts(answer, input.evaluation.intentConcepts);
  const taskStatus = resolveTaskStatus(
    intentMatches.length,
    input.evaluation.requiredIntentMatches
  );
  const positionConcepts =
    input.skillId === "conclusion_first" &&
    input.evaluation.positionConceptIds?.length
      ? input.evaluation.conclusionConcepts.filter((concept) =>
          input.evaluation.positionConceptIds?.includes(concept.id)
        )
      : input.evaluation.conclusionConcepts;
  const evaluationUnits =
    input.skillId === "conclusion_first"
      ? splitConclusionUnits(answer)
      : sentences;
  const target = findBestConceptSentence(evaluationUnits, positionConcepts);
  const closest = findClosestSentence(evaluationUnits, selfStatement);
  const requiredPositionMatches =
    input.skillId === "conclusion_first" &&
    input.evaluation.positionConceptIds?.length
      ? 1
      : input.evaluation.requiredConclusionMatches;
  const selfCheckStatus = resolveSelfCheckStatus({
    closestIndex: closest.index,
    similarity: closest.similarity,
    targetIndex: target.index,
    targetMatchCount: target.matchIds.length,
    requiredTargetMatches: requiredPositionMatches
  });
  const sharedContext: EvaluationContext = {
    answer,
    sentences: evaluationUnits,
    taskStatus,
    target,
    closest,
    selfCheckStatus,
    matchedIntentIds: intentMatches
  };

  if (containsMetaScoringLanguage(answer)) {
    return assessment({
      skillId: input.skillId,
      status: "uncertain",
      taskStatus,
      selfCheckStatus,
      evidence: firstMeaningfulQuote(answer, evaluationUnits),
      observation:
        "回答在描述“如何命中方法或评分”，而不是直接完成当前沟通任务。",
      impact:
        "关键词和方法名称可能表面满足规则，但听众仍需要把碎片重新组织成真实信息。",
      action:
        "删除“关键词、结论先行、命中规则”等元说明，直接写出要传达的判断、依据或行动。",
      context: sharedContext
    });
  }

  if (input.skillId === "purpose") {
    return evaluatePurpose({
      answer,
      sentences: evaluationUnits,
      taskStatus,
      target,
      closest,
      selfCheckStatus,
      matchedIntentIds: intentMatches
    });
  }

  if (input.skillId === "conclusion_first") {
    return evaluateConclusionFirst({
      answer,
      sentences,
      taskStatus,
      target,
      requiredConclusionMatches:
        requiredPositionMatches,
      closest,
      selfCheckStatus,
      matchedIntentIds: intentMatches
    });
  }

  return evaluateGrouping({
    answer,
    sentences,
    taskStatus,
    target,
    closest,
    selfCheckStatus,
    matchedIntentIds: intentMatches,
    groupingConcepts: input.evaluation.groupingConcepts ?? [],
    minimumDistinctGroups: input.evaluation.minimumDistinctGroups ?? 2
  });
}

export function evaluateRevisionChange(input: {
  beforeAnswer: string;
  afterAnswer: string;
  before: SkillAssessment;
  after: SkillAssessment;
}) {
  const beforeNormalized = normalizeText(input.beforeAnswer);
  const afterNormalized = normalizeText(input.afterAnswer);

  if (beforeNormalized === afterNormalized) {
    return {
      kind: "unchanged" as const,
      canContinue: false,
      message: "只修改空格或标点不算有效重写，请根据反馈调整表达结构。"
    };
  }

  const statusImproved =
    statusRank(input.after.status) > statusRank(input.before.status);
  const taskImproved =
    statusRank(input.after.taskStatus) > statusRank(input.before.taskStatus);

  if (statusImproved || taskImproved) {
    return {
      kind: "improved" as const,
      canContinue: true,
      message: "目标结构已经改善，可以进入新题迁移。"
    };
  }

  if (
    input.before.status === "met" &&
    input.after.status === "met" &&
    input.after.taskStatus === "met"
  ) {
    return {
      kind: "maintained" as const,
      canContinue: true,
      message: "原回答已经达标，本次重写保持了目标结构。"
    };
  }

  return {
    kind: "not_improved" as const,
    canContinue: false,
    message: "文字已经变化，但目标结构尚未改善。请根据单点反馈继续修改。"
  };
}

export function splitChineseSentences(answer: string) {
  const sentences = answer
    .trim()
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length > 0 ? sentences : [answer.trim()];
}

function splitConclusionUnits(answer: string) {
  const units = answer
    .trim()
    .split(/(?<=[。！？!?；;，,])|\n+/)
    .map((unit) => unit.trim())
    .filter(Boolean);
  return units.length > 0 ? units : [answer.trim()];
}

export function findClosestSentence(sentences: string[], selfStatement: string) {
  if (sentences.length === 0 || selfStatement.trim().length === 0) {
    return { index: null, similarity: 0 };
  }

  let bestIndex = 0;
  let bestSimilarity = 0;

  sentences.forEach((sentence, index) => {
    const similarity = textSimilarity(sentence, selfStatement);
    if (similarity > bestSimilarity) {
      bestIndex = index;
      bestSimilarity = similarity;
    }
  });

  return {
    index: bestSimilarity >= 0.12 ? bestIndex : null,
    similarity: round(bestSimilarity)
  };
}

export function countExplicitGroups(answer: string) {
  return extractExplicitGroups(answer).length;
}

function evaluatePurpose(input: EvaluationContext): SkillAssessment {
  const evidence = sentenceQuote(input.sentences, input.target.index);
  const hasExplicitRequest = containsExplicitDecisionRequest(input.answer);

  if (input.taskStatus === "met" && hasExplicitRequest) {
    return assessment({
      skillId: "purpose",
      status: "met",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "回答已经同时说明关键情况和希望对方采取的决定或行动。",
      impact: "听众能够判断这次沟通要解决什么，而不只是听到背景。",
      action: "保留明确请求，再删除与本次决定无关的背景。",
      context: input
    });
  }

  if (input.taskStatus === "met") {
    return assessment({
      skillId: "purpose",
      status: "partial",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation:
        "回答包含关键情况和行动词，但还没有用请求语气明确请对方作出决定。",
      impact:
        "听众能看到相关词语，却可能不确定这是信息说明，还是需要自己立即拍板的请求。",
      action:
        "把行动词补成完整请求，例如“请您决定……”“麻烦确认……”或“请批准……”。",
      context: input
    });
  }

  if (input.taskStatus === "partial") {
    return assessment({
      skillId: "purpose",
      status: "partial",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "回答覆盖了大部分任务信息，但关键情况或行动请求仍不完整。",
      impact: "听众可能理解发生了什么，却仍要猜测下一步需要决定什么。",
      action: "补成一句完整目的：当前判断是什么，需要对方决定或行动什么。",
      context: input
    });
  }

  if (input.taskStatus === "uncertain") {
    return assessment({
      skillId: "purpose",
      status: "uncertain",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "规则只识别到少量任务信息，无法确认沟通目的是否完整出现。",
      impact: "如果系统直接判为达标，可能把关键词出现误当成目的明确。",
      action: "明确写出发生了什么，以及希望对方做出的具体决定。",
      context: input
    });
  }

  return assessment({
    skillId: "purpose",
    status: "needs_work",
    taskStatus: input.taskStatus,
    selfCheckStatus: input.selfCheckStatus,
    evidence,
    observation: "回答没有覆盖本题要求推动的关键决定或行动。",
    impact: "听众可能只听到无关信息，无法判断本次沟通要解决什么。",
    action: "回到题目目标，先写一句关键情况和需要对方采取的行动。",
    context: input
  });
}

function evaluateConclusionFirst(
  input: EvaluationContext & { requiredConclusionMatches: number }
): SkillAssessment {
  const evidence = sentenceQuote(input.sentences, input.target.index);
  const targetIsComplete =
    input.target.matchIds.length >= input.requiredConclusionMatches;

  if (
    input.taskStatus === "met" &&
    targetIsComplete &&
    input.target.index === 0
  ) {
    return assessment({
      skillId: "conclusion_first",
      status: "met",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "完成任务的核心判断已经出现在第一句话。",
      impact: "听众可以先得到答案，再判断后续依据是否充分。",
      action: "保留第一句，并检查后续内容是否都在支撑它。",
      context: input
    });
  }

  if (input.taskStatus === "needs_work") {
    return assessment({
      skillId: "conclusion_first",
      status: "needs_work",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "回答中还没有识别到完成本题所需的核心判断。",
      impact: "即使调整句序，听众仍可能不知道你的答案或建议。",
      action: "先补全对问题的直接回答，再把它放到第一句话。",
      context: input
    });
  }

  if (input.taskStatus !== "met") {
    return assessment({
      skillId: "conclusion_first",
      status: "uncertain",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "回答只覆盖了部分任务信息，无法可靠判断核心结论是否完整前置。",
      impact: "句序正确不能弥补任务内容缺失，系统不会把形式正确误判成达标。",
      action: "先补全对问题的直接回答，再确认它出现在开头。",
      context: input
    });
  }

  if (targetIsComplete && input.target.index !== null) {
    return assessment({
      skillId: "conclusion_first",
      status: "partial",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation:
        input.target.index === 0
          ? "核心判断在第一句，但完成任务所需的信息仍不完整。"
          : "完成任务的核心判断出现在开场铺垫之后。",
      impact:
        input.target.index === 0
          ? "听众能看到方向，但还需要猜测完整判断。"
          : "听众需要先处理铺垫，才能听到真正的答案。",
      action:
        input.target.index === 0
          ? "把第一句补成完整判断，并明确下一步。"
          : "把这句移到开头，再将背景和依据放到后面。",
      context: input
    });
  }

  return assessment({
    skillId: "conclusion_first",
    status: "uncertain",
    taskStatus: input.taskStatus,
    selfCheckStatus: input.selfCheckStatus,
    evidence,
    observation: "规则识别到部分相关信息，但无法可靠定位完整核心判断。",
    impact: "系统若只依据自填核心句，可能把无关首句错误判为结论先行。",
    action: "第一句话同时写出明确判断和最关键的处理方向。",
    context: input
  });
}

function evaluateGrouping(
  input: EvaluationContext & {
    answer: string;
    groupingConcepts: EvaluationConcept[];
    minimumDistinctGroups: number;
  }
): SkillAssessment {
  const explicitGroups = extractExplicitGroups(input.answer);
  const groupConceptMatches = explicitGroups.map((group) =>
    matchConcepts(group, input.groupingConcepts)
  );
  const distinctGroupIds = new Set(groupConceptMatches.flat());
  const conceptUseCounts = new Map<string, number>();

  groupConceptMatches.forEach((ids) => {
    ids.forEach((id) => {
      conceptUseCounts.set(id, (conceptUseCounts.get(id) ?? 0) + 1);
    });
  });

  const hasEmptyGroup = explicitGroups.some(
    (group) => normalizeText(group).length < 2
  );
  const hasDuplicateText = explicitGroups.some((group, index) =>
    explicitGroups
      .slice(index + 1)
      .some((other) => textSimilarity(group, other) >= 0.78)
  );
  const repeatsSameConcept = [...conceptUseCounts.values()].some(
    (count) => count > 1
  );
  const validCount = explicitGroups.length === 2 || explicitGroups.length === 3;
  const enoughDistinct =
    distinctGroupIds.size >= input.minimumDistinctGroups;
  const evidence = firstMeaningfulQuote(input.answer, input.sentences);
  const hasNaturalSequence =
    /先.+再.+最后/.test(normalizeText(input.answer));

  const context: EvaluationContext = {
    ...input,
    groupCount: explicitGroups.length,
    distinctGroupCount: distinctGroupIds.size
  };

  if (
    input.taskStatus === "met" &&
    validCount &&
    enoughDistinct &&
    !hasEmptyGroup &&
    !hasDuplicateText &&
    !repeatsSameConcept
  ) {
    return assessment({
      skillId: "grouping",
      status: "met",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: `回答明确给出 ${explicitGroups.length} 个部分，并覆盖了 ${distinctGroupIds.size} 个不同理由。`,
      impact: "听众能预先知道信息结构，也能分辨各点之间的边界。",
      action: "保留两到三点结构，再检查各点是否同等重要。",
      context
    });
  }

  if (explicitGroups.length === 0) {
    return assessment({
      skillId: "grouping",
      status: "needs_work",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "回答还没有明确显示两到三点结构。",
      impact: "多个理由连在一起时，听众很难判断边界和优先级。",
      action: "先说明一共有两点或三点，再用明确序号逐点展开。",
      context
    });
  }

  if (!validCount && !(explicitGroups.length === 1 && hasNaturalSequence)) {
    return assessment({
      skillId: "grouping",
      status: "partial",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation:
        explicitGroups.length === 1
          ? "回答出现了分点信号，但还没有形成完整的两到三点结构。"
          : `回答列出 ${explicitGroups.length} 个部分，重点数量偏多。`,
      impact: "听众无法形成稳定、简洁的整体框架。",
      action:
        explicitGroups.length === 1
          ? "补全为两到三点。"
          : "合并相近内容，只保留最重要的两到三点。",
      context
    });
  }

  if (hasEmptyGroup || hasDuplicateText || repeatsSameConcept) {
    return assessment({
      skillId: "grouping",
      status: "needs_work",
      taskStatus: input.taskStatus,
      selfCheckStatus: input.selfCheckStatus,
      evidence,
      observation: "回答看起来有分点，但存在空分点或内容重复，不能算作有效结构。",
      impact: "听众会看到形式上的序号，却仍无法区分真正的不同理由。",
      action: "让每一点承担一个不同且与题目相关的意思。",
      context
    });
  }

  return assessment({
    skillId: "grouping",
    status: "uncertain",
    taskStatus: input.taskStatus,
    selfCheckStatus: input.selfCheckStatus,
    evidence,
    observation: "规则识别到两到三点形式，但无法确认各点是否覆盖了不同的任务理由。",
    impact: "只有序号而没有相关内容时，表面结构会制造虚假达标。",
    action: "让每一点对应题目中的一个独立理由，并删除重复内容。",
    context
  });
}

function assessment(input: {
  skillId: StructuredSkillId;
  status: SkillAssessmentStatus;
  taskStatus: SkillAssessmentStatus;
  selfCheckStatus: SelfCheckStatus;
  evidence: string;
  observation: string;
  impact: string;
  action: string;
  context: EvaluationContext;
}): SkillAssessment {
  return {
    skillId: input.skillId,
    status: input.status,
    statusLabel: statusLabels[input.status],
    taskStatus: input.taskStatus,
    taskStatusLabel: taskStatusLabels[input.taskStatus],
    selfCheckStatus: input.selfCheckStatus,
    selfCheckLabel: selfCheckLabels[input.selfCheckStatus],
    evidence: input.evidence,
    evidenceSpan: resolveEvidenceSpan(
      input.context.answer,
      input.evidence
    ),
    observation: input.observation,
    impact: input.impact,
    action: input.action,
    closestSentenceIndex: input.context.closest.index,
    targetSentenceIndex: input.context.target.index,
    similarity: round(input.context.closest.similarity),
    groupCount: input.context.groupCount ?? null,
    distinctGroupCount: input.context.distinctGroupCount ?? null,
    matchedIntentIds: input.context.matchedIntentIds,
    ruleVersion: RULE_VERSION
  };
}

function findBestConceptSentence(
  sentences: string[],
  concepts: EvaluationConcept[]
) {
  let bestIndex: number | null = null;
  let bestMatchIds: string[] = [];

  sentences.forEach((sentence, index) => {
    const matchIds = matchConcepts(sentence, concepts);
    if (matchIds.length > bestMatchIds.length) {
      bestIndex = index;
      bestMatchIds = matchIds;
    }
  });

  return {
    index: bestIndex,
    matchIds: bestMatchIds
  };
}

function matchConcepts(value: string, concepts: EvaluationConcept[]) {
  const normalized = normalizeText(value);
  return concepts
    .filter((item) =>
      item.terms.some((term) => normalized.includes(normalizeText(term)))
    )
    .map((item) => item.id);
}

function resolveTaskStatus(
  matchCount: number,
  requiredMatches: number
): SkillAssessmentStatus {
  if (matchCount >= requiredMatches) return "met";
  if (matchCount === 0) return "needs_work";
  if (matchCount >= Math.max(1, requiredMatches - 1)) return "partial";
  return "uncertain";
}

function resolveSelfCheckStatus(input: {
  closestIndex: number | null;
  similarity: number;
  targetIndex: number | null;
  targetMatchCount: number;
  requiredTargetMatches: number;
}): SelfCheckStatus {
  if (
    input.targetIndex === null ||
    input.targetMatchCount < input.requiredTargetMatches
  ) {
    return "uncertain";
  }
  if (
    input.closestIndex === input.targetIndex &&
    input.similarity >= 0.25
  ) {
    return "aligned";
  }
  if (
    input.closestIndex === input.targetIndex ||
    input.similarity >= 0.18
  ) {
    return "partial";
  }
  return "misaligned";
}

function extractExplicitGroups(answer: string) {
  const markerPattern =
    /第[一二三四五12345](?:(?:点|个|项)|(?=[，,:：、\s]|先|再|修|核|发|确|说|选|处|评|安|优|客|实|维))[，,:：、\s]*|[一二三四五]是[，,:：、\s]*|(?:首先|其次|再次|最后)[，,:：、\s]*|(?:^|[\n。！？!?；;])\s*[1-5](?:[.、）):：]|\s)\s*|(?:^|\n)\s*[-•]\s+/gm;
  const matches = [...answer.matchAll(markerPattern)];
  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? answer.length;
    return answer
      .slice(start, end)
      .replace(/^[，。！？；：、,.!?;:\s]+|[，。！？；：、,.!?;:\s]+$/g, "")
      .trim();
  });
}

function textSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);

  if (!normalizedLeft || !normalizedRight) return 0;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return (
      Math.min(normalizedLeft.length, normalizedRight.length) /
      Math.max(normalizedLeft.length, normalizedRight.length)
    );
  }

  const leftBigrams = createBigrams(normalizedLeft);
  const rightBigrams = createBigrams(normalizedRight);
  const remaining = new Map<string, number>();
  rightBigrams.forEach((item) => {
    remaining.set(item, (remaining.get(item) ?? 0) + 1);
  });

  let overlap = 0;
  leftBigrams.forEach((item) => {
    const count = remaining.get(item) ?? 0;
    if (count > 0) {
      overlap += 1;
      remaining.set(item, count - 1);
    }
  });

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s，。！？；：、,.!?;:'"“”‘’（）()\[\]【】\-—]/g, "");
}

function containsMetaScoringLanguage(answer: string) {
  return [
    /关键词|命中(?:规则|评分)|评分(?:词|规则)/,
    /结论先行|第一结论|第二原因/,
    /(?:这就是|这算|应该算).{0,6}(?:结论|目的|分组)/
  ].some((pattern) => pattern.test(answer));
}

function containsExplicitDecisionRequest(answer: string) {
  return [
    /(?:请|麻烦|劳烦|希望|需要).{0,30}(?:决定|确认|批准|同意|拍板|定一下|选择)/,
    /(?:您|你|负责人|主管).{0,20}(?:决定|确认|批准|同意|拍板|定一下|选择)/,
    /(?:要不要|是否).{0,30}(?:请|麻烦|确认|决定|批准|拍板)/
  ].some((pattern) => pattern.test(answer));
}

function createBigrams(value: string) {
  if (value.length <= 1) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) =>
    value.slice(index, index + 2)
  );
}

function sentenceQuote(sentences: string[], index: number | null) {
  if (index === null || !sentences[index]) {
    return `“${truncate(sentences[0] ?? "未找到可引用内容")}”`;
  }
  return `“${truncate(sentences[index])}”`;
}

function firstMeaningfulQuote(answer: string, sentences: string[]) {
  const line = answer
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean);
  return `“${truncate(line ?? sentences[0] ?? "未找到可引用内容")}”`;
}

function truncate(value: string) {
  return value.length > 80 ? `${value.slice(0, 77)}…` : value;
}

function resolveEvidenceSpan(answer: string, quotedEvidence: string) {
  const quotedText = quotedEvidence.slice(1, -1);
  const exactText = quotedText.replace(/…$/, "");
  const start = answer.indexOf(exactText);
  if (start < 0) return null;
  return {
    start,
    end: start + exactText.length
  };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function statusRank(status: SkillAssessmentStatus) {
  return {
    needs_work: 0,
    uncertain: 0,
    partial: 1,
    met: 2
  }[status];
}

type EvaluationContext = {
  answer: string;
  sentences: string[];
  taskStatus: SkillAssessmentStatus;
  target: {
    index: number | null;
    matchIds: string[];
  };
  closest: {
    index: number | null;
    similarity: number;
  };
  selfCheckStatus: SelfCheckStatus;
  matchedIntentIds: string[];
  groupCount?: number | null;
  distinctGroupCount?: number | null;
};

const statusLabels: Record<SkillAssessmentStatus, string> = {
  met: "本次已做到",
  partial: "已经接近",
  needs_work: "本次重点修改",
  uncertain: "规则无法确定"
};

const taskStatusLabels: Record<SkillAssessmentStatus, string> = {
  met: "任务信息完整",
  partial: "任务信息接近完整",
  needs_work: "未完成本题任务",
  uncertain: "任务信息不足以判断"
};

const selfCheckLabels: Record<SelfCheckStatus, string> = {
  aligned: "自检与原文一致",
  partial: "自检部分一致",
  misaligned: "自检与原文不一致",
  uncertain: "暂时无法核对自检"
};
