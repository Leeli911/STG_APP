import type {
  SkillAssessment,
  SkillAssessmentStatus,
  StructuredSkillId
} from "@/features/structured-practice/types";

const RULE_VERSION = "stg-structure-rules-v1" as const;

export function evaluateStructuredAnswer(input: {
  skillId: StructuredSkillId;
  answer: string;
  coreStatement: string;
}): SkillAssessment {
  const answer = input.answer.trim();
  const coreStatement = input.coreStatement.trim();
  const sentences = splitChineseSentences(answer);
  const closest = findClosestSentence(sentences, coreStatement);

  if (input.skillId === "purpose") {
    return evaluatePurpose(sentences, closest);
  }

  if (input.skillId === "conclusion_first") {
    return evaluateConclusionFirst(sentences, closest);
  }

  return evaluateGrouping(answer, sentences, closest);
}

export function splitChineseSentences(answer: string) {
  const sentences = answer
    .trim()
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length > 0 ? sentences : [answer.trim()];
}

export function findClosestSentence(sentences: string[], coreStatement: string) {
  if (sentences.length === 0 || coreStatement.trim().length === 0) {
    return { index: null, similarity: 0 };
  }

  let bestIndex = 0;
  let bestSimilarity = 0;

  sentences.forEach((sentence, index) => {
    const similarity = textSimilarity(sentence, coreStatement);
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
  const markerCounts = [
    countUniqueMatches(answer, /第([一二三四五12345])(?:点|个|项|，|、|:|：|\s)/g),
    countUniqueMatches(answer, /([一二三四五])是/g),
    countUniqueMatches(
      answer,
      /(?:^|[\n。！？!?；;])\s*([1-5])(?:[.、）):：]|\s)/gm
    ),
    countUniqueWords(answer, ["首先", "其次", "再次", "最后"]),
    countBulletLines(answer)
  ];

  return Math.max(...markerCounts);
}

function evaluatePurpose(
  sentences: string[],
  closest: ReturnType<typeof findClosestSentence>
): SkillAssessment {
  const similarity = closest.similarity;
  const status: SkillAssessmentStatus =
    similarity >= 0.4 ? "met" : similarity >= 0.2 ? "partial" : "needs_work";
  const quote = sentenceQuote(sentences, closest.index);

  if (status === "met") {
    return assessment({
      skillId: "purpose",
      status,
      evidence: quote,
      observation: "你写下的核心目的已经明确出现在回答中。",
      impact: "听众能把背景信息和你真正希望推动的决定联系起来。",
      action: "保留这句核心目的，再删除与它无关的背景。",
      closest,
      groupCount: null
    });
  }

  if (status === "partial") {
    return assessment({
      skillId: "purpose",
      status,
      evidence: quote,
      observation: "回答提到了相关情况，但核心目的表达得还不完整。",
      impact: "听众可能知道发生了什么，却不确定你希望他做什么。",
      action: "补成一句完整的话：当前判断是什么，需要对方决定或行动什么。",
      closest,
      groupCount: null
    });
  }

  return assessment({
    skillId: "purpose",
    status,
    evidence: quote,
    observation: "你写下的核心目的还没有清楚进入回答。",
    impact: "听众可能只听到背景，无法判断这次沟通要解决什么。",
    action: "先写一句核心目的，再让其余句子只负责解释或支撑它。",
    closest,
    groupCount: null
  });
}

function evaluateConclusionFirst(
  sentences: string[],
  closest: ReturnType<typeof findClosestSentence>
): SkillAssessment {
  const quote = sentenceQuote(sentences, closest.index);

  if (closest.index === 0 && closest.similarity >= 0.35) {
    return assessment({
      skillId: "conclusion_first",
      status: "met",
      evidence: quote,
      observation: "核心结论已经出现在第一句话。",
      impact: "听众可以先得到答案，再判断后续依据是否充分。",
      action: "保留第一句，并检查后续每句话是否都在支撑它。",
      closest,
      groupCount: null
    });
  }

  if (closest.index !== null && closest.similarity >= 0.2) {
    return assessment({
      skillId: "conclusion_first",
      status: "partial",
      evidence: quote,
      observation:
        closest.index === 0
          ? "核心结论在第一句，但表达还不够完整。"
          : `核心结论到第 ${closest.index + 1} 句才出现。`,
      impact:
        closest.index === 0
          ? "听众能看到方向，但仍要猜测你的完整判断或请求。"
          : "听众需要先处理铺垫，才能知道你真正想表达什么。",
      action:
        closest.index === 0
          ? "把第一句补成完整判断，并明确下一步。"
          : "把这句移到开头，原有背景放到它后面。",
      closest,
      groupCount: null
    });
  }

  return assessment({
    skillId: "conclusion_first",
    status: "needs_work",
    evidence: quote,
    observation: "回答中还没有识别到与你写下的核心结论相近的句子。",
    impact: "听众听完后仍可能不知道你的判断、结果或请求。",
    action: "第一句话直接写出核心结论，再补充发生了什么。",
    closest,
    groupCount: null
  });
}

function evaluateGrouping(
  answer: string,
  sentences: string[],
  closest: ReturnType<typeof findClosestSentence>
): SkillAssessment {
  const groupCount = countExplicitGroups(answer);
  const quote = firstMeaningfulQuote(answer, sentences);

  if (groupCount === 2 || groupCount === 3) {
    return assessment({
      skillId: "grouping",
      status: "met",
      evidence: quote,
      observation: `回答明确标出了 ${groupCount} 个部分。`,
      impact: "听众能预先知道信息结构，更容易跟住并记住重点。",
      action: "检查每一点是否只表达一个意思，并删除彼此重复的内容。",
      closest,
      groupCount
    });
  }

  if (groupCount === 1 || groupCount > 3) {
    return assessment({
      skillId: "grouping",
      status: "partial",
      evidence: quote,
      observation:
        groupCount === 1
          ? "回答出现了分点信号，但没有形成完整分组。"
          : `回答标出了 ${groupCount} 个部分，重点数量偏多。`,
      impact:
        groupCount === 1
          ? "听众预期会听到多个部分，却无法确认整体结构。"
          : "重点过多会增加记忆负担，主次也更难判断。",
      action:
        groupCount === 1
          ? "补全为两到三点，并让每一点承担一个独立理由。"
          : "合并相近内容，只保留最重要的两到三点。",
      closest,
      groupCount
    });
  }

  return assessment({
    skillId: "grouping",
    status: "needs_work",
    evidence: quote,
    observation: "回答还没有明确显示两到三点结构。",
    impact: "多个理由连在一起时，听众很难判断边界和优先级。",
    action: "先写“主要有两点/三点”，再用明确序号逐点展开。",
    closest,
    groupCount
  });
}

function assessment(input: {
  skillId: StructuredSkillId;
  status: SkillAssessmentStatus;
  evidence: string;
  observation: string;
  impact: string;
  action: string;
  closest: ReturnType<typeof findClosestSentence>;
  groupCount: number | null;
}): SkillAssessment {
  return {
    skillId: input.skillId,
    status: input.status,
    statusLabel: statusLabels[input.status],
    evidence: input.evidence,
    observation: input.observation,
    impact: input.impact,
    action: input.action,
    closestSentenceIndex: input.closest.index,
    similarity: round(input.closest.similarity),
    groupCount: input.groupCount,
    ruleVersion: RULE_VERSION
  };
}

function textSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);

  if (!normalizedLeft || !normalizedRight) return 0;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return Math.min(normalizedLeft.length, normalizedRight.length) /
      Math.max(normalizedLeft.length, normalizedRight.length);
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

function createBigrams(value: string) {
  if (value.length <= 1) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) =>
    value.slice(index, index + 2)
  );
}

function countUniqueMatches(answer: string, pattern: RegExp) {
  const values = new Set<string>();
  for (const match of answer.matchAll(pattern)) {
    const value = match[1];
    if (value) values.add(value);
  }
  return values.size;
}

function countUniqueWords(answer: string, words: string[]) {
  return words.filter((word) => answer.includes(word)).length;
}

function countBulletLines(answer: string) {
  return answer
    .split("\n")
    .filter((line) => /^\s*[-•]\s+\S/.test(line)).length;
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

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

const statusLabels: Record<SkillAssessmentStatus, string> = {
  met: "本次已做到",
  partial: "已经接近",
  needs_work: "本次重点修改"
};
