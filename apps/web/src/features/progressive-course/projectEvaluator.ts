import { splitChineseSentences } from "@/features/structured-practice/ruleEngine";

export const DAY_SEVEN_RULE_VERSION = "stg-day-seven-rules-v1" as const;

export type DaySevenScenarioId = "project" | "transfer";

export type DaySevenAssessmentStatus =
  | "met"
  | "too_short"
  | "missing_conclusion"
  | "missing_points"
  | "weak_evidence"
  | "missing_request"
  | "off_task"
  | "unsupported_fact";

export type DaySevenReportCheck = {
  id: "conclusion" | "points" | "evidence" | "request";
  label: string;
  passed: boolean;
  evidence: string;
};

export type DaySevenAssessment = {
  status: DaySevenAssessmentStatus;
  passed: boolean;
  statusLabel: string;
  observation: string;
  impact: string;
  action: string;
  checks: DaySevenReportCheck[];
};

export type DaySevenRevisionAssessment = {
  status:
    | "improved"
    | "maintained"
    | "unchanged"
    | "surface_only"
    | "still_incomplete";
  passed: boolean;
  statusLabel: string;
  observation: string;
  action: string;
};

type ScenarioAnchor = {
  id: DaySevenScenarioId;
  audience: string;
  title: string;
  task: string;
  facts: string[];
  conclusionGroups: string[][];
  evidenceGroups: { id: string; signals: string[] }[];
  requestGroups: string[][];
  allowedNumbers: string[];
  otherScenarioSignals: string[];
  conclusionAction: string;
  requestAction: string;
};

export const daySevenScenarios: Record<DaySevenScenarioId, ScenarioAnchor> = {
  project: {
    id: "project",
    audience: "运营总监",
    title: "毕业项目 A · 客服工单系统切换",
    task: "请完成 4–6 句短汇报，请运营总监今天决定是否将系统切换推迟到下周一。",
    facts: [
      "客服工单系统原定本周三切换。",
      "历史工单目前只迁移了 60%。",
      "试运行中有 8% 的附件缺失。",
      "供应商预计两天可以修复迁移问题。",
      "旧系统合同持续到本月底，周四、周五是客服高峰。"
    ],
    conclusionGroups: [
      ["建议", "应该", "应当", "需要"],
      ["推迟", "延期", "延后"],
      ["系统", "工单"],
      ["切换"],
      ["下周一"]
    ],
    evidenceGroups: [
      { id: "migration", signals: ["历史工单", "迁移", "60%", "六成"] },
      { id: "attachment", signals: ["试运行", "附件", "8%", "缺失"] },
      { id: "repair", signals: ["供应商", "两天", "修复"] },
      { id: "continuity", signals: ["旧系统", "合同", "月底", "客服高峰", "周四", "周五"] }
    ],
    requestGroups: [
      ["请", "希望", "申请"],
      ["批准", "决定", "确认", "同意"],
      ["今天", "今日"],
      ["推迟", "延期", "延后"],
      ["切换"],
      ["下周一"]
    ],
    allowedNumbers: ["60%", "8%"],
    otherScenarioSignals: ["接口", "联调", "数据同步", "客户培训", "本周五发布"],
    conclusionAction: "先只改第一句：建议将客服工单系统切换推迟到下周一。",
    requestAction: "最后补一句：请运营总监今天批准将系统切换推迟到下周一。"
  },
  transfer: {
    id: "transfer",
    audience: "市场负责人",
    title: "未见迁移 B · 剩余预算投放",
    task: "请完成 4–6 句短汇报，请市场负责人今天决定是否把剩余预算集中到渠道 A。",
    facts: [
      "活动明天启动，目标是新增注册用户。",
      "渠道 A 获客成本 82 元，转化率 7.8%。",
      "渠道 B 获客成本 146 元，转化率 3.1%。",
      "剩余预算只够支持一个渠道。",
      "渠道 A 的素材已审核，渠道 B 还需要一天修改。"
    ],
    conclusionGroups: [
      ["建议", "应该", "应当", "需要"],
      ["预算"],
      ["集中", "投放", "选择", "优先"],
      ["渠道 A", "渠道A", "A 渠道", "A渠道"]
    ],
    evidenceGroups: [
      { id: "efficiency", signals: ["82", "7.8%"] },
      { id: "comparison", signals: ["146", "3.1%", "渠道 B", "渠道B"] },
      { id: "budget", signals: ["剩余预算", "一个渠道", "只够"] },
      { id: "readiness", signals: ["素材", "审核", "一天修改", "明天启动"] }
    ],
    requestGroups: [
      ["请", "希望", "申请"],
      ["批准", "决定", "确认", "同意"],
      ["今天", "今日"],
      ["预算"],
      ["集中", "投放", "选择", "优先"],
      ["渠道 A", "渠道A", "A 渠道", "A渠道"]
    ],
    allowedNumbers: ["82", "7.8%", "146", "3.1%"],
    otherScenarioSignals: ["工单", "历史迁移", "附件缺失", "系统切换", "下周一"],
    conclusionAction: "先只改第一句：建议把剩余预算集中投放到渠道 A。",
    requestAction: "最后补一句：请市场负责人今天批准把剩余预算集中到渠道 A。"
  }
};

const metaSignals = ["命中规则", "评分标准", "关键词", "为了通过", "系统判定"];
const groupMarkerPattern =
  /(?:第一|第二|第三|一是|二是|三是)[，,:：、\s]*/g;

export function evaluateDaySevenReport(
  answer: string,
  scenarioId: DaySevenScenarioId
): DaySevenAssessment {
  const anchor = daySevenScenarios[scenarioId];
  const normalized = answer.trim();
  const sentences = splitChineseSentences(normalized).filter(Boolean);
  const firstSentence = sentences[0] ?? "";
  const lastSentence = sentences.at(-1) ?? "";
  const groups = extractExplicitGroups(normalized);
  const matchedGroups = groups.map((group) =>
    anchor.evidenceGroups
      .filter((concept) => containsAny(group, concept.signals))
      .map((concept) => concept.id)
  );
  const distinctConcepts = new Set(matchedGroups.flat());
  const useCounts = new Map<string, number>();
  matchedGroups.flat().forEach((concept) => {
    useCounts.set(concept, (useCounts.get(concept) ?? 0) + 1);
  });

  const hasConclusion = matchesAllGroups(firstSentence, anchor.conclusionGroups);
  const hasPointStructure = groups.length === 2 || groups.length === 3;
  const hasDistinctEvidence =
    distinctConcepts.size >= 2 &&
    ![...useCounts.values()].some((count) => count > 1);
  const hasRequest = matchesAllGroups(lastSentence, anchor.requestGroups);
  const hasUnsupportedNumber = extractNumbers(normalized).some(
    (number) =>
      !anchor.allowedNumbers.includes(number) &&
      !["1", "2", "3"].includes(number)
  );
  const relevantFactCount = anchor.evidenceGroups.filter((concept) =>
    containsAny(normalized, concept.signals)
  ).length;

  const checks: DaySevenReportCheck[] = [
    {
      id: "conclusion",
      label: "第一句给出明确判断",
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
      label: "分点引用至少两类不同题目事实",
      passed: hasDistinctEvidence && !hasUnsupportedNumber,
      evidence:
        distinctConcepts.size > 0
          ? quote(
              groups
                .filter((_, index) => matchedGroups[index].length > 0)
                .join("；")
            )
          : "未找到可核对的题目事实"
    },
    {
      id: "request",
      label: "最后提出有时限的行动请求",
      passed: hasRequest,
      evidence: quote(lastSentence)
    }
  ];

  if (
    containsAny(normalized, metaSignals) ||
    (containsAny(normalized, anchor.otherScenarioSignals) && relevantFactCount === 0)
  ) {
    return result(
      "off_task",
      "请直接完成当前工作汇报",
      "回答在描述评分方法，或沿用了另一道题的事实。",
      "当前受众仍不知道你对这道题的建议。",
      `只使用“${anchor.title}”卡片中的事实重新作答。`,
      checks
    );
  }

  if (normalized.length < 56) {
    return result(
      "too_short",
      "汇报信息还不完整",
      "当前回答过短，无法同时容纳判断、两个事实分点和行动请求。",
      "负责人可能听到方向，却缺少判断依据或下一步。",
      "保留 4–6 句话：第一句判断，中间两到三点，最后一句请求。",
      checks
    );
  }
  if (!hasConclusion) {
    return result(
      "missing_conclusion",
      "第一句还没有直接给出判断",
      "第一句没有完整说明建议采取的决定。",
      "负责人需要先读背景，才能猜到你的主张。",
      anchor.conclusionAction,
      checks
    );
  }
  if (!hasPointStructure) {
    return result(
      "missing_points",
      "中间信息还没有形成两到三点",
      "回答没有用明确序号呈现两到三个支撑点。",
      "多个事实连在一起，负责人不容易区分判断依据。",
      "在结论后使用“第一、第二”，需要时再增加“第三”。",
      checks
    );
  }
  if (hasUnsupportedNumber) {
    return result(
      "unsupported_fact",
      "出现了题目之外的数字",
      "规则发现回答加入了材料卡中没有提供的数字。",
      "无法核对的新数字会削弱汇报可信度。",
      "删除题目之外的数字，只引用材料卡中可核对的事实。",
      checks
    );
  }
  if (!hasDistinctEvidence) {
    return result(
      "weak_evidence",
      "分点形式有了，但事实仍有重复或缺失",
      "分点没有覆盖至少两类不同事实，或同一事实被重复使用。",
      "形式上的序号不能帮助负责人比较不同依据。",
      "让每个分点分别承担一类不同的题目事实。",
      checks
    );
  }
  if (!hasRequest) {
    return result(
      "missing_request",
      "最后还缺一个可执行请求",
      "结论和依据已经清楚，但最后一句没有请负责人今天作出明确决定。",
      "负责人知道情况，却不知道何时、需要批准什么。",
      anchor.requestAction,
      checks
    );
  }

  return result(
    "met",
    "完整汇报结构达标",
    "回答先给判断，用不同题目事实分点支撑，并以明确行动请求收尾。",
    "负责人可以快速理解判断、核对依据并知道下一步需要作出的决定。",
    scenarioId === "project"
      ? "下一步请在保留原稿的前提下，亲自完成一次实质修改。"
      : "本次未见迁移达到冻结规则；这仍不代表长期保持或真实工作效果。",
    checks
  );
}

export function evaluateDaySevenRevision({
  before,
  after,
  beforeAssessment,
  afterAssessment
}: {
  before: string;
  after: string;
  beforeAssessment: DaySevenAssessment;
  afterAssessment: DaySevenAssessment;
}): DaySevenRevisionAssessment {
  const normalizedBefore = normalizeForComparison(before);
  const normalizedAfter = normalizeForComparison(after);

  if (normalizedBefore === normalizedAfter) {
    return revisionResult(
      "unchanged",
      "修改稿还没有发生变化",
      "当前内容与首稿相同。",
      "请根据首稿反馈，在原文上完成一次可观察的修改。"
    );
  }
  if (editDistance(normalizedBefore, normalizedAfter) < 8) {
    return revisionResult(
      "surface_only",
      "这次变化还只是表面修改",
      "空格、标点或少量词语变化不足以说明完成了结构修改。",
      "至少重写一个完整句子，并确保修改后仍满足四项结构检查。"
    );
  }
  if (!afterAssessment.passed) {
    return revisionResult(
      "still_incomplete",
      "修改发生了，但结构仍未完整",
      afterAssessment.observation,
      afterAssessment.action
    );
  }

  return beforeAssessment.passed
    ? revisionResult(
        "maintained",
        "完成实质修改，并保持结构完整",
        "首稿本已达标；修改稿发生了可观察变化，四项检查仍然通过。",
        "现在进入第二个未见情境，检查能否独立迁移。"
      )
    : revisionResult(
        "improved",
        "完成实质修改，并修复了首稿缺口",
        "修改稿发生了可观察变化，并把首稿未通过的结构检查修复为通过。",
        "现在进入第二个未见情境，检查能否独立迁移。"
      );
}

function result(
  status: DaySevenAssessmentStatus,
  statusLabel: string,
  observation: string,
  impact: string,
  action: string,
  checks: DaySevenReportCheck[]
): DaySevenAssessment {
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

function revisionResult(
  status: DaySevenRevisionAssessment["status"],
  statusLabel: string,
  observation: string,
  action: string
): DaySevenRevisionAssessment {
  return {
    status,
    passed: status === "improved" || status === "maintained",
    statusLabel,
    observation,
    action
  };
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

function extractNumbers(value: string) {
  return value.match(/\d+(?:\.\d+)?%?/g) ?? [];
}

function matchesAllGroups(value: string, groups: string[][]) {
  return groups.every((signals) => containsAny(value, signals));
}

function containsAny(value: string, signals: string[]) {
  return signals.some((signal) => value.includes(signal));
}

function normalizeForComparison(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function quote(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "未找到可引用的原文";
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}
