import type {
  EvaluationConcept,
  StructuredEvaluationAnchor,
  StructuredPracticePrompt,
  StructuredPracticeScenario,
  StructuredPromptKind,
  StructuredSkillId
} from "@/features/structured-practice/types";

const concept = (
  id: string,
  label: string,
  ...terms: string[]
): EvaluationConcept => ({ id, label, terms });

const anchor = (input: StructuredEvaluationAnchor) => input;

export const structuredPracticeScenarios: StructuredPracticeScenario[] = [
  {
    id: "stg-v04-purpose",
    day: 1,
    skillId: "purpose",
    title: "明确目的",
    shortDescription: "先确定希望对方知道什么、决定什么。",
    prompts: [
      {
        id: "stg-v04-purpose-cold-01",
        kind: "cold",
        audience: "直属主管",
        desiredOutcome: "让主管了解项目将延期，并决定是否调整发布日期。",
        prompt:
          "新用户引导改版比原计划晚三天。你需要向主管说明情况，并请他决定是否把发布日期调整到下周一。请完成一次简短汇报。",
        evaluation: anchor({
          intentConcepts: [
            concept("delay", "延期事实", "延期", "延后", "晚三天", "推迟", "delay"),
            concept("release", "发布日期", "发布日期", "下周一", "上线", "发布"),
            concept("decision", "需要决定", "决定", "确认", "批准", "是否调整", "拍板")
          ],
          requiredIntentMatches: 3,
          conclusionConcepts: [
            concept("delay", "延期事实", "延期", "延后", "晚三天", "推迟", "delay"),
            concept("release", "发布日期", "发布日期", "下周一", "上线", "发布"),
            concept("decision", "需要决定", "决定", "确认", "批准", "是否调整", "拍板")
          ],
          requiredConclusionMatches: 2
        })
      },
      {
        id: "stg-v04-purpose-cold-02",
        kind: "cold",
        audience: "项目负责人",
        desiredOutcome: "让负责人了解预算接近上限，并批准缩小本期范围。",
        prompt:
          "本期预算已经使用九成，但还有两个非核心需求没有开发。请向项目负责人说明情况，并请他批准缩小本期范围。",
        evaluation: anchor({
          intentConcepts: [
            concept("budget", "预算接近上限", "预算", "九成", "上限", "超支"),
            concept("scope", "缩小范围", "缩小范围", "减少需求", "砍掉", "非核心需求"),
            concept("approval", "请求批准", "批准", "确认", "决定", "同意")
          ],
          requiredIntentMatches: 3,
          conclusionConcepts: [
            concept("budget", "预算风险", "预算", "九成", "上限", "超支"),
            concept("scope", "范围调整", "缩小范围", "减少需求", "砍掉"),
            concept("approval", "请求批准", "批准", "确认", "决定", "同意")
          ],
          requiredConclusionMatches: 2
        })
      },
      {
        id: "stg-v04-purpose-cold-03",
        kind: "cold",
        audience: "销售负责人",
        desiredOutcome: "让负责人了解客户交付会晚两天，并确认新的沟通时间。",
        prompt:
          "测试发现一个阻断问题，客户交付预计会晚两天。请向销售负责人说明，并请他确认今天何时通知客户。",
        evaluation: anchor({
          intentConcepts: [
            concept("delivery", "交付延迟", "交付", "晚两天", "延期", "延后"),
            concept("customer", "客户沟通", "客户", "通知", "沟通"),
            concept(
              "confirm",
              "确认时间",
              "确认",
              "决定",
              "定一下",
              "几点",
              "何时"
            )
          ],
          requiredIntentMatches: 3,
          conclusionConcepts: [
            concept("delivery", "交付延迟", "交付", "晚两天", "延期", "延后"),
            concept("customer", "客户沟通", "客户", "通知", "沟通"),
            concept(
              "confirm",
              "确认时间",
              "确认",
              "决定",
              "定一下",
              "几点",
              "何时"
            )
          ],
          requiredConclusionMatches: 2
        })
      },
      {
        id: "stg-v04-purpose-near-01",
        kind: "near_transfer",
        audience: "项目负责人",
        desiredOutcome: "让负责人了解数据仍需核对，并决定周报如何发布。",
        prompt:
          "一项关键数据还需要两天核对。请向项目负责人说明情况，并请他决定延后周报，还是先发布暂定数据。",
        evaluation: anchor({
          intentConcepts: [
            concept("verification", "数据待核对", "核对", "复核", "两天"),
            concept("weekly", "周报发布", "周报", "发布", "延后"),
            concept("decision", "二选一决定", "决定", "确认", "拍板", "延后周报", "暂定数据")
          ],
          requiredIntentMatches: 3,
          conclusionConcepts: [
            concept("verification", "数据待核对", "核对", "复核", "两天"),
            concept("weekly", "周报发布", "周报", "发布", "延后"),
            concept("decision", "二选一决定", "决定", "确认", "拍板", "暂定数据")
          ],
          requiredConclusionMatches: 2
        })
      },
      {
        id: "stg-v04-purpose-far-01",
        kind: "far_transfer",
        audience: "市场负责人",
        desiredOutcome: "让负责人了解活动预算将超限，并决定是否暂停新增投放。",
        prompt:
          "活动预算已经接近上限，继续新增渠道会超支。请向市场负责人说明，并请他决定是否暂停新增投放。",
        evaluation: anchor({
          intentConcepts: [
            concept("budget", "预算风险", "预算", "上限", "超支"),
            concept("spend", "新增投放", "投放", "新增渠道", "新渠道", "暂停", "停投"),
            concept("decision", "需要决定", "决定", "确认", "是否暂停", "要不要")
          ],
          requiredIntentMatches: 3,
          conclusionConcepts: [
            concept("budget", "预算风险", "预算", "上限", "超支"),
            concept("spend", "新增投放", "投放", "新增渠道", "新渠道", "暂停", "停投"),
            concept("decision", "需要决定", "决定", "确认", "是否暂停", "要不要")
          ],
          requiredConclusionMatches: 2
        })
      },
      {
        id: "stg-v04-purpose-delayed-01",
        kind: "delayed",
        audience: "业务负责人",
        desiredOutcome: "让负责人了解合同尚未签署，并决定是否延后项目启动。",
        prompt:
          "合作方合同尚未签署，但团队原定明天启动项目。请向业务负责人说明，并请他决定是否延后启动。",
        evaluation: anchor({
          intentConcepts: [
            concept("contract", "合同未签", "合同", "未签", "尚未签署"),
            concept("start", "项目启动", "项目", "启动"),
            concept("decision", "延后决定", "决定", "确认", "是否延后", "推迟启动")
          ],
          requiredIntentMatches: 3,
          conclusionConcepts: [
            concept("contract", "合同未签", "合同", "未签", "尚未签署"),
            concept("start", "项目启动", "项目", "启动", "延后"),
            concept("decision", "延后决定", "决定", "确认", "是否延后", "推迟")
          ],
          requiredConclusionMatches: 2
        })
      }
    ],
    lesson: {
      principle: "表达之前，先确定受众和希望对方采取的行动。",
      checklist: [
        "核心目的是否真的出现在回答中",
        "对方听完后是否知道需要做什么决定",
        "背景信息是否都服务于这个目的"
      ]
    }
  },
  {
    id: "stg-v04-conclusion",
    day: 2,
    skillId: "conclusion_first",
    title: "结论先行",
    shortDescription: "第一句话先给判断、结果或请求。",
    prompts: [
      {
        id: "stg-v04-conclusion-cold-01",
        kind: "cold",
        audience: "项目主管",
        desiredOutcome: "让主管先知道项目存在上线风险，并听到处理建议。",
        prompt:
          "主管临时问你：本周项目状态怎么样？目前核心功能已经完成，但联调问题可能影响周五上线。请直接回答。",
        evaluation: anchor({
          intentConcepts: [
            concept(
              "risk",
              "上线风险",
              "风险",
              "影响",
              "不能按时",
              "上不了线",
              "无法上线",
              "延期"
            ),
            concept("release", "周五上线", "周五", "上线", "发布"),
            concept("action", "处理建议", "建议", "先解决", "延后", "调整")
          ],
          requiredIntentMatches: 2,
          conclusionConcepts: [
            concept(
              "risk",
              "上线风险",
              "风险",
              "影响",
              "不能按时",
              "上不了线",
              "无法上线",
              "延期"
            ),
            concept("release", "周五上线", "周五", "上线", "发布"),
            concept("action", "处理建议", "建议", "先解决", "延后", "调整")
          ],
          requiredConclusionMatches: 2,
          positionConceptIds: ["risk"]
        })
      },
      {
        id: "stg-v04-conclusion-cold-02",
        kind: "cold",
        audience: "业务负责人",
        desiredOutcome: "让负责人先知道投诉增加源于登录异常，并知道团队正在回滚。",
        prompt:
          "业务负责人问：昨天用户投诉为什么突然增加？你已经确认主要原因是新版本登录异常，团队正在回滚。请直接回答。",
        evaluation: anchor({
          intentConcepts: [
            concept("complaint", "投诉增加", "投诉", "增加", "变多"),
            concept("login", "登录异常", "登录", "异常", "故障"),
            concept("rollback", "正在回滚", "回滚", "恢复", "处理")
          ],
          requiredIntentMatches: 3,
          conclusionConcepts: [
            concept("complaint", "投诉增加", "投诉", "增加", "变多"),
            concept("login", "登录异常", "登录", "异常", "故障"),
            concept("rollback", "正在回滚", "回滚", "恢复", "处理")
          ],
          requiredConclusionMatches: 2,
          positionConceptIds: ["login"]
        })
      },
      {
        id: "stg-v04-conclusion-cold-03",
        kind: "cold",
        audience: "团队主管",
        desiredOutcome: "让主管先知道本周目标能完成，但需要减少一个低优先级需求。",
        prompt:
          "主管问：本周目标还能完成吗？剩余开发时间只有两天，如果减少一个低优先级需求，核心目标可以完成。请直接回答。",
        evaluation: anchor({
          intentConcepts: [
            concept("complete", "目标可完成", "可以完成", "能完成", "按时完成"),
            concept("reduce", "减少需求", "减少", "低优先级", "移除", "不做"),
            concept("time", "时间有限", "两天", "时间", "排期")
          ],
          requiredIntentMatches: 2,
          conclusionConcepts: [
            concept("complete", "目标可完成", "可以完成", "能完成", "按时完成"),
            concept("reduce", "减少需求", "减少", "低优先级", "移除", "不做")
          ],
          requiredConclusionMatches: 2,
          positionConceptIds: ["complete"]
        })
      },
      {
        id: "stg-v04-conclusion-near-01",
        kind: "near_transfer",
        audience: "方案评审人",
        desiredOutcome: "让评审人先知道建议选择方案二，因为上线风险更低。",
        prompt:
          "评审人问：两个成本相近的方案应该选哪个？方案二的上线风险更低。请直接回答。",
        evaluation: anchor({
          intentConcepts: [
            concept("option", "选择方案二", "方案二", "第二个方案", "选二"),
            concept("risk", "风险更低", "风险低", "更稳", "上线风险")
          ],
          requiredIntentMatches: 2,
          conclusionConcepts: [
            concept("option", "选择方案二", "方案二", "第二个方案", "选二"),
            concept("risk", "风险更低", "风险低", "更稳", "上线风险"),
            concept("decision", "明确选择", "建议", "选择", "应该", "选二")
          ],
          requiredConclusionMatches: 3,
          positionConceptIds: ["decision"]
        })
      },
      {
        id: "stg-v04-conclusion-far-01",
        kind: "far_transfer",
        audience: "数据负责人",
        desiredOutcome: "让负责人先知道数据暂时不能发布，因为关键字段仍需复核。",
        prompt:
          "数据负责人问：这份数据今天可以对外发布吗？一个关键字段还没有复核，预计明天完成。请直接回答。",
        evaluation: anchor({
          intentConcepts: [
            concept("hold", "暂不发布", "不能发布", "暂缓", "明天再发", "不建议发布", "先别发"),
            concept("verify", "字段待复核", "字段", "复核", "核对")
          ],
          requiredIntentMatches: 2,
          conclusionConcepts: [
            concept("hold", "暂不发布", "不能发布", "暂缓", "明天再发", "不建议发布", "先别发"),
            concept("verify", "字段待复核", "字段", "复核", "核对")
          ],
          requiredConclusionMatches: 2,
          positionConceptIds: ["hold"]
        })
      },
      {
        id: "stg-v04-conclusion-delayed-01",
        kind: "delayed",
        audience: "市场主管",
        desiredOutcome: "让主管先知道活动效果低于目标，并建议停止追加预算。",
        prompt:
          "市场主管问：活动还要继续追加预算吗？当前转化率只有目标的一半。请直接回答。",
        evaluation: anchor({
          intentConcepts: [
            concept("below", "效果低于目标", "低于目标", "一半", "效果差", "转化率低"),
            concept("stop", "停止追加预算", "停止", "不追加", "暂停", "预算", "别加钱", "加钱")
          ],
          requiredIntentMatches: 2,
          conclusionConcepts: [
            concept("below", "效果低于目标", "低于目标", "一半", "效果差", "转化率低"),
            concept("stop", "停止追加预算", "停止", "不追加", "暂停", "预算", "别加钱", "加钱")
          ],
          requiredConclusionMatches: 2,
          positionConceptIds: ["stop"]
        })
      }
    ],
    lesson: {
      principle: "先回答问题，再补充背景、依据和细节。",
      checklist: [
        "第一句话是否已经给出核心判断",
        "后续内容是否在支撑第一句话",
        "是否删除了不影响判断的开场铺垫"
      ]
    }
  },
  {
    id: "stg-v04-grouping",
    day: 3,
    skillId: "grouping",
    title: "两到三点框架",
    shortDescription: "把多个理由整理成少量、清楚的分组。",
    prompts: [
      {
        id: "stg-v04-grouping-cold-01",
        kind: "cold",
        audience: "产品负责人",
        desiredOutcome: "让负责人理解为什么下一阶段应优先优化新用户引导。",
        prompt:
          "你建议下一阶段优先优化新用户引导。现有信息包括：流失集中在前三步、相关客服咨询很多、改动成本相对较低。请说明理由。",
        evaluation: groupingAnchor({
          intent: concept("recommendation", "优化新用户引导", "优化", "新用户引导", "引导"),
          groups: [
            concept("churn", "前三步流失", "流失", "前三步", "转化"),
            concept("support", "客服咨询", "客服", "咨询", "反馈"),
            concept("cost", "改动成本", "成本", "改动小", "容易改")
          ]
        })
      },
      {
        id: "stg-v04-grouping-cold-02",
        kind: "cold",
        audience: "团队主管",
        desiredOutcome: "让主管理解为什么需要增加一名协作人员。",
        prompt:
          "你希望团队增加一名协作人员。当前问题包括需求并行增加、测试排期冲突、关键成员频繁加班。请说明理由。",
        evaluation: groupingAnchor({
          intent: concept("recommendation", "增加协作人员", "增加", "协作人员", "支援", "人手"),
          groups: [
            concept("demand", "需求增加", "需求", "并行", "工作量"),
            concept("testing", "测试冲突", "测试", "排期", "冲突"),
            concept("overtime", "成员加班", "加班", "负荷", "关键成员")
          ]
        })
      },
      {
        id: "stg-v04-grouping-cold-03",
        kind: "cold",
        audience: "采购负责人",
        desiredOutcome: "让负责人理解为什么建议更换供应商。",
        prompt:
          "你建议更换当前供应商。原因包括报价持续上涨、交付周期不稳定、售后响应较慢。请说明理由。",
        evaluation: groupingAnchor({
          intent: concept("recommendation", "更换供应商", "更换", "供应商", "替换"),
          groups: [
            concept("price", "报价上涨", "报价", "价格", "成本", "上涨"),
            concept("delivery", "交付不稳", "交付", "周期", "不稳定"),
            concept("support", "售后较慢", "售后", "响应", "支持")
          ]
        })
      },
      {
        id: "stg-v04-grouping-near-01",
        kind: "near_transfer",
        audience: "技术负责人",
        desiredOutcome: "让负责人理解故障处理需要分成三个动作。",
        prompt:
          "线上登录故障正在影响用户。接下来需要修复登录问题、核对受影响用户、发布说明。请说明处理安排。",
        evaluation: groupingAnchor({
          intent: concept("recommendation", "故障处理安排", "处理", "安排", "登录故障", "接下来"),
          groups: [
            concept("repair", "修复问题", "修复", "登录问题", "回滚"),
            concept("users", "核对用户", "核对", "影响用户", "用户"),
            concept("notice", "发布说明", "说明", "公告", "通知")
          ]
        })
      },
      {
        id: "stg-v04-grouping-far-01",
        kind: "far_transfer",
        audience: "业务负责人",
        desiredOutcome: "让负责人理解为什么应优先选择方案甲。",
        prompt:
          "你建议优先选择方案甲。它的客户价值更高、实施难度更低、后续维护成本更小。请说明理由。",
        evaluation: groupingAnchor({
          intent: concept("recommendation", "选择方案甲", "方案甲", "选择", "优先"),
          groups: [
            concept("value", "客户价值", "客户", "价值", "收益"),
            concept("difficulty", "实施难度", "实施", "难度", "落地"),
            concept("maintenance", "维护成本", "维护", "成本", "后续")
          ]
        })
      },
      {
        id: "stg-v04-grouping-delayed-01",
        kind: "delayed",
        audience: "部门主管",
        desiredOutcome: "让主管理解为什么应优先安排新人培训。",
        prompt:
          "你建议本月优先安排新人培训。当前新人重复出错较多、带教占用资深成员时间、标准流程还没有统一。请说明理由。",
        evaluation: groupingAnchor({
          intent: concept("recommendation", "优先新人培训", "新人", "培训", "优先", "安排"),
          groups: [
            concept("errors", "重复出错", "出错", "错误", "返工"),
            concept("mentoring", "带教成本", "带教", "资深成员", "时间"),
            concept("process", "流程未统一", "流程", "标准", "统一")
          ]
        })
      }
    ],
    lesson: {
      principle: "听众通常只能稳定记住少量重点，优先整理成两到三点。",
      checklist: [
        "是否明确告诉对方一共有几点",
        "每一点是否只表达一个主要意思",
        "不同点之间是否尽量不重复"
      ]
    }
  }
];

export function getStructuredPracticeScenario(skillId: StructuredSkillId) {
  const scenario = structuredPracticeScenarios.find(
    (item) => item.skillId === skillId
  );

  if (!scenario) {
    throw new Error(`Unknown structured practice skill: ${skillId}`);
  }

  return scenario;
}

export function getStructuredPracticePrompt(
  promptId: string
): StructuredPracticePrompt {
  const prompt = structuredPracticeScenarios
    .flatMap((scenario) => scenario.prompts)
    .find((item) => item.id === promptId);

  if (!prompt) {
    throw new Error(`Unknown structured practice prompt: ${promptId}`);
  }

  return prompt;
}

export function selectStructuredPracticePrompt(input: {
  skillId: StructuredSkillId;
  kinds: StructuredPromptKind[];
  excludedPromptIds?: string[];
}): StructuredPracticePrompt {
  const scenario = getStructuredPracticeScenario(input.skillId);
  const candidates = scenario.prompts.filter((prompt) =>
    input.kinds.includes(prompt.kind)
  );

  if (candidates.length === 0) {
    throw new Error(
      `No structured practice prompts for ${input.skillId}: ${input.kinds.join(",")}`
    );
  }

  const excluded = new Set(input.excludedPromptIds ?? []);
  const unseen = candidates.find((prompt) => !excluded.has(prompt.id));
  if (unseen) return unseen;

  return candidates[excluded.size % candidates.length] ?? candidates[0]!;
}

function groupingAnchor(input: {
  intent: EvaluationConcept;
  groups: EvaluationConcept[];
}): StructuredEvaluationAnchor {
  return {
    intentConcepts: [input.intent, ...input.groups],
    requiredIntentMatches: 3,
    conclusionConcepts: [input.intent],
    requiredConclusionMatches: 1,
    groupingConcepts: input.groups,
    minimumDistinctGroups: 2
  };
}
