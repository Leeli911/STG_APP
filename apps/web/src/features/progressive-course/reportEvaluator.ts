import { splitChineseSentences } from "@/features/structured-practice/ruleEngine";

export type DaySixAssessmentStatus =
  | "met"
  | "too_short"
  | "missing_conclusion"
  | "missing_points"
  | "weak_evidence"
  | "missing_request"
  | "off_task";

export type DaySixReportCheck = {
  id: "conclusion" | "points" | "evidence" | "request";
  label: string;
  passed: boolean;
  evidence: string;
};

export type DaySixAssessment = {
  status: DaySixAssessmentStatus;
  passed: boolean;
  statusLabel: string;
  observation: string;
  impact: string;
  action: string;
  checks: DaySixReportCheck[];
};

const decisionSignals = ["建议", "应该", "应当", "需要"];
const delaySignals = ["推迟", "延期", "延后"];
const releaseSignals = ["发布", "上线"];
const integrationSignals = ["接口", "联调", "未通过"];
const syncSignals = ["数据同步", "同步失败", "测试"];
const customerSignals = ["客户", "培训", "下周一"];
const requestSignals = ["请", "希望", "申请"];
const approvalSignals = ["批准", "决定", "确认", "同意"];
const todaySignals = ["今天", "今日"];
const metaSignals = ["命中规则", "评分标准", "关键词", "为了通过"];
const groupMarkerPattern =
  /(?:第一|第二|第三|一是|二是|三是)[，,:：、\s]*/g;

export function evaluateDaySixReport(answer: string): DaySixAssessment {
  const normalized = answer.trim();
  const sentences = splitChineseSentences(normalized).filter(Boolean);
  const firstSentence = sentences[0] ?? "";
  const lastSentence = sentences.at(-1) ?? "";
  const groups = extractExplicitGroups(normalized);
  const groupConceptMatches = groups.map((group) =>
    [
      containsAny(group, integrationSignals) ? "integration" : null,
      containsAny(group, syncSignals) ? "sync" : null,
      containsAny(group, customerSignals) ? "customer" : null
    ].filter((value): value is string => value !== null)
  );
  const distinctConcepts = new Set(groupConceptMatches.flat());
  const conceptUseCounts = new Map<string, number>();
  groupConceptMatches.flat().forEach((concept) => {
    conceptUseCounts.set(concept, (conceptUseCounts.get(concept) ?? 0) + 1);
  });

  const hasConclusion =
    containsAny(firstSentence, decisionSignals) &&
    containsAny(firstSentence, delaySignals) &&
    containsAny(firstSentence, releaseSignals) &&
    firstSentence.includes("下周一");
  const hasPointStructure = groups.length === 2 || groups.length === 3;
  const hasDistinctEvidence =
    distinctConcepts.size >= 2 &&
    ![...conceptUseCounts.values()].some((count) => count > 1);
  const hasRequest =
    containsAny(lastSentence, requestSignals) &&
    containsAny(lastSentence, approvalSignals) &&
    containsAny(lastSentence, todaySignals) &&
    containsAny(lastSentence, delaySignals) &&
    lastSentence.includes("下周一");

  const checks: DaySixReportCheck[] = [
    {
      id: "conclusion",
      label: "第一句给出明确结论",
      passed: hasConclusion,
      evidence: quote(firstSentence)
    },
    {
      id: "points",
      label: "使用两到三个清楚分点",
      passed: hasPointStructure,
      evidence: groups.length > 0 ? quote(groups.join("；")) : "未找到明确分点"
    },
    {
      id: "evidence",
      label: "分点覆盖不同任务事实",
      passed: hasDistinctEvidence,
      evidence:
        distinctConcepts.size > 0
          ? `识别到 ${distinctConcepts.size} 类事实`
          : "未识别到题目中的关键事实"
    },
    {
      id: "request",
      label: "最后提出有时限的行动请求",
      passed: hasRequest,
      evidence: quote(lastSentence)
    }
  ];

  if (containsAny(normalized, metaSignals)) {
    return result(
      "off_task",
      "请直接完成工作汇报",
      "回答在描述规则或评分方法，没有完成真实沟通任务。",
      "负责人仍不知道你建议什么，也无法作出决定。",
      "删除规则说明，直接向负责人汇报项目判断。",
      checks
    );
  }

  if (normalized.length < 56) {
    return result(
      "too_short",
      "汇报信息还不完整",
      "当前回答过短，无法同时容纳结论、两个事实分点和行动请求。",
      "负责人可能听到方向，却缺少判断依据或下一步。",
      "保留 4–6 句话：第一句结论，中间两到三点，最后一句请求。",
      checks
    );
  }

  if (!hasConclusion) {
    return result(
      "missing_conclusion",
      "第一句还没有直接给出判断",
      "第一句没有明确建议把发布推迟到下周一。",
      "负责人需要先读背景，才能猜到你的主张。",
      "先只改第一句：建议将本周五发布推迟到下周一。",
      checks
    );
  }

  if (!hasPointStructure) {
    return result(
      "missing_points",
      "中间信息还没有形成两到三点",
      "回答没有用明确序号呈现两到三个支撑点。",
      "多个事实连在一起，负责人不容易区分风险来源。",
      "在结论后使用“第一、第二”，需要时再增加“第三”。",
      checks
    );
  }

  if (!hasDistinctEvidence) {
    return result(
      "weak_evidence",
      "分点形式有了，但事实仍有重复或缺失",
      "分点没有覆盖至少两类不同事实，或同一事实被重复使用。",
      "形式上的序号不能帮助负责人比较不同风险。",
      "让各点分别承担接口联调、数据同步或客户安排中的不同事实。",
      checks
    );
  }

  if (!hasRequest) {
    return result(
      "missing_request",
      "最后还缺一个可执行请求",
      "结论和依据已经清楚，但最后一句没有请负责人今天作出明确决定。",
      "负责人知道情况，却不知道何时、需要批准什么。",
      "最后补一句：请今天批准将发布推迟到下周一。",
      checks
    );
  }

  return result(
    "met",
    "完整汇报结构达标",
    "回答先给结论，用不同事实分点支撑，并以明确行动请求收尾。",
    "负责人可以快速理解判断、核对依据并知道下一步需要作出的决定。",
    "保持这个长度；下一课将在未见情境中检查你能否独立迁移。",
    checks
  );
}

function extractExplicitGroups(value: string) {
  const matches = [...value.matchAll(groupMarkerPattern)];
  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? value.length;
      return value.slice(start, end).split(/请|希望|申请/)[0].trim();
    })
    .filter((group) => group.length >= 2);
}

function result(
  status: DaySixAssessmentStatus,
  statusLabel: string,
  observation: string,
  impact: string,
  action: string,
  checks: DaySixReportCheck[]
): DaySixAssessment {
  return {
    status,
    passed: status === "met",
    statusLabel,
    observation,
    impact,
    action,
    checks
  };
}

function containsAny(value: string, signals: string[]) {
  return signals.some((signal) => value.includes(signal));
}

function quote(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "未找到可引用的原文";
  return trimmed.length > 88 ? `${trimmed.slice(0, 88)}…` : trimmed;
}
