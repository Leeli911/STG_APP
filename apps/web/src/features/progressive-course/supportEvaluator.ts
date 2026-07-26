import { splitChineseSentences } from "@/features/structured-practice/ruleEngine";

export type DayFourAssessmentStatus =
  | "met"
  | "background_first"
  | "missing_conclusion"
  | "missing_reason";

export type DayFourAssessment = {
  status: DayFourAssessmentStatus;
  passed: boolean;
  statusLabel: string;
  evidence: string;
  observation: string;
  impact: string;
  action: string;
};

const decisionSignals = ["建议", "应该", "应当", "需要", "有必要"];
const actionSignals = ["调整", "更新", "补充", "修改", "加入", "增加"];
const targetSignals = ["周报", "检查清单", "提交流程", "风险字段"];
const omissionSignals = ["漏填", "遗漏", "未填", "没有填写", "未包含"];
const fieldSignals = ["风险字段", "新增字段", "必填字段", "检查清单"];
const frequencySignals = ["三次", "3次", "四次", "4次", "最近"];
const metaSignals = ["命中规则", "关键词", "结论先行", "评分标准"];

export function evaluateDayFourAnswer(answer: string): DayFourAssessment {
  const normalized = answer.trim();
  const sentences = splitChineseSentences(normalized).filter(Boolean);
  const firstSentence = sentences[0] ?? "";
  const laterText = sentences.slice(1).join("");
  const firstHasConclusion = hasConclusion(firstSentence);
  const laterHasConclusion = hasConclusion(laterText);
  const reasonMatchCount = [
    containsAny(laterText, omissionSignals),
    containsAny(laterText, fieldSignals),
    containsAny(laterText, frequencySignals)
  ].filter(Boolean).length;
  const hasDirectReason =
    sentences.length >= 2 &&
    containsAny(laterText, omissionSignals) &&
    reasonMatchCount >= 2;

  if (containsAny(normalized, metaSignals)) {
    return {
      status: "missing_conclusion",
      passed: false,
      statusLabel: "请直接完成沟通任务",
      evidence: quote(firstSentence),
      observation: "回答在描述训练方法或评分规则，没有直接向主管给出业务判断。",
      impact: "形式说明不能替代真实结论，主管仍不知道是否需要调整流程。",
      action: "删除方法名称，第一句直接写“建议／需要调整什么”。"
    };
  }

  if (!firstHasConclusion && laterHasConclusion) {
    return {
      status: "background_first",
      passed: false,
      statusLabel: "结论仍藏在背景之后",
      evidence: quote(firstSentence),
      observation: "第一句先描述现象，真正的调整建议出现在后面。",
      impact: "主管需要先处理背景，才能知道你的判断。",
      action: "把调整建议移到第一句，第二句只保留最关键的事实依据。"
    };
  }

  if (!firstHasConclusion) {
    return {
      status: "missing_conclusion",
      passed: false,
      statusLabel: "缺少明确判断",
      evidence: quote(firstSentence),
      observation: "第一句没有明确说明是否调整周报提交流程。",
      impact: "主管能看到一些信息，但仍要猜测你主张采取什么行动。",
      action: "第一句明确写出“建议调整周报提交流程或更新检查清单”。"
    };
  }

  if (!hasDirectReason) {
    return {
      status: "missing_reason",
      passed: false,
      statusLabel: "理由还不能直接支撑结论",
      evidence: quote(laterText || firstSentence),
      observation:
        sentences.length < 2
          ? "回答只有结论，没有用第二句话给出依据。"
          : "第二句话没有说明漏填风险字段这一最直接的问题证据。",
      impact: "主管听到了建议，却无法判断为什么现在需要调整。",
      action: "第二句补充一个可核对事实：最近多次周报漏填新增风险字段。"
    };
  }

  return {
    status: "met",
    passed: true,
    statusLabel: "结论与理由匹配",
    evidence: quote(laterText),
    observation: "第一句给出调整建议，第二句用漏填风险字段的事实直接支撑。",
    impact: "主管能先听到判断，再用一个关键依据快速判断建议是否成立。",
    action: "保持两句话即可；不要继续堆叠与本次判断无关的背景。"
  };
}

function hasConclusion(value: string) {
  return (
    containsAny(value, decisionSignals) &&
    containsAny(value, actionSignals) &&
    containsAny(value, targetSignals)
  );
}

function containsAny(value: string, signals: string[]) {
  return signals.some((signal) => value.includes(signal));
}

function quote(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "未找到可引用的原文";
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
}
