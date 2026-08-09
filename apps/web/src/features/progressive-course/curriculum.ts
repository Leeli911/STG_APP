import type {
  KnowledgeCheck,
  ProgressiveCourseDay,
  ProgressiveCourseLesson
} from "@/features/progressive-course/types";

export const dayOneKnowledgeChecks: KnowledgeCheck[] = [
  {
    id: "day-1-audience",
    prompt: "这次表达的受众是谁？",
    context:
      "产品负责人请你说明注册流程的问题，并判断是否把优化注册流程列为下周优先事项。",
    options: [
      { id: "team", label: "整个研发团队" },
      { id: "product-lead", label: "产品负责人" },
      { id: "customer", label: "外部客户" }
    ],
    correctOptionId: "product-lead",
    successExplanation: "正确。先确定正在影响谁，才能决定保留哪些信息。",
    retryExplanation: "再看任务中谁要听你的说明并作出判断。"
  },
  {
    id: "day-1-outcome",
    prompt: "你最希望对方听完后做什么？",
    context:
      "产品负责人请你说明注册流程的问题，并判断是否把优化注册流程列为下周优先事项。",
    options: [
      { id: "know-everything", label: "了解你最近做过的所有工作" },
      { id: "approve-priority", label: "决定是否优先优化注册流程" },
      { id: "praise", label: "认可你整理资料很认真" }
    ],
    correctOptionId: "approve-priority",
    successExplanation: "正确。明确期望行动后，表达才有清楚的终点。",
    retryExplanation: "寻找任务里需要对方作出的决定，而不是泛泛地“了解情况”。"
  }
];

export const dayTwoKnowledgeChecks: KnowledgeCheck[] = [
  {
    id: "day-2-clear-purpose",
    prompt: "哪一句最清楚地表达了沟通目的？",
    context: "团队会议与客户演示发生时间冲突，需要主管决定调整哪一个。",
    options: [
      { id: "background", label: "今天的安排比较多，我想汇报一下情况。" },
      {
        id: "clear-purpose",
        label: "团队会议与客户演示时间冲突，请主管今天决定调整哪一个。"
      },
      { id: "detail", label: "团队会议原定下午三点，参会人已经收到邀请。" }
    ],
    correctOptionId: "clear-purpose",
    successExplanation: "正确。它同时说明了问题、受众需要完成的决定和时间要求。",
    retryExplanation: "选择能让对方立刻知道“为什么听、听完要做什么”的句子。"
  }
];

export const dayThreeKnowledgeChecks: KnowledgeCheck[] = [
  {
    id: "day-3-conclusion-first",
    prompt: "哪一句更适合作为回答的第一句？",
    context:
      "主管问：新员工培训是否需要调整？反馈显示新人最容易卡在系统权限配置。",
    options: [
      {
        id: "background-first",
        label: "上个月我们收集了十二份新人反馈，也访谈了三名带教同事。"
      },
      {
        id: "conclusion-first",
        label: "建议先调整权限配置培训，因为这是新人最集中的卡点。"
      },
      {
        id: "process-first",
        label: "我先介绍一下这次调研采用的方法和参与人员。"
      }
    ],
    correctOptionId: "conclusion-first",
    successExplanation: "正确。它先回答“是否调整”，随后还可以再补充调研依据。",
    retryExplanation: "主管先需要听到判断；调研过程和背景可以放在后面。"
  }
];

export const dayThreeOrderExercise = {
  context:
    "负责人问：本周是否按计划发布内部报表？一个关键字段还没有复核，预计明天才能确认。",
  sentences: [
    {
      id: "conclusion",
      text: "建议暂缓发布内部报表，等关键字段明天复核完成后再发布。"
    },
    {
      id: "reason",
      text: "目前一个关键字段仍未完成复核。"
    },
    {
      id: "detail",
      text: "其他字段已经检查完毕，报表格式也已确认。"
    }
  ],
  correctOrder: ["conclusion", "reason", "detail"]
} as const;

export const dayFourKnowledgeChecks: KnowledgeCheck[] = [
  {
    id: "day-4-direct-support",
    prompt: "哪一条信息最能直接支撑“本周应更新客服 FAQ”？",
    context:
      "客服主管问是否需要更新 FAQ。上周四十条咨询中，有二十五条都在询问同一个已变更的退款步骤。",
    options: [
      {
        id: "direct-evidence",
        label: "上周四十条咨询中，二十五条都在询问已变更的退款步骤。"
      },
      {
        id: "process-detail",
        label: "现有 FAQ 是三个月前由运营同事整理的。"
      },
      {
        id: "circular",
        label: "因为 FAQ 需要更新，所以我们应该更新 FAQ。"
      }
    ],
    correctOptionId: "direct-evidence",
    successExplanation: "正确。咨询数量与已变更步骤直接说明旧 FAQ 正在造成重复问题。",
    retryExplanation: "选择能证明“为什么现在要更新”的事实，而不是过程信息或重复结论。"
  }
];

export const dayFourGuidedExercise = {
  context:
    "入职负责人问：是否要在本周更新新人入职清单？最近十名新人中有六人漏交权限申请，旧清单没有写这一步。",
  conclusion: "建议本周更新新人入职清单。",
  reasons: [
    {
      id: "direct-reason",
      text: "因为最近十名新人中有六人漏交权限申请，旧清单也没有写这一步。"
    },
    {
      id: "weak-background",
      text: "因为这份清单已经使用了比较长的时间。"
    },
    {
      id: "personal-preference",
      text: "因为我觉得新版清单看起来会更完整。"
    }
  ],
  correctReasonId: "direct-reason"
} as const;

export const dayFourIndependentPrompt = {
  audience: "运营主管",
  prompt:
    "最近四次周报中有三次漏填新增的风险字段，现有提交检查清单没有这个字段。主管问：是否需要调整周报提交流程？请用两句话回答，第一句给判断，第二句只给最关键依据。"
} as const;

export const dayFiveKnowledgeChecks: KnowledgeCheck[] = [
  {
    id: "day-5-distinct-groups",
    prompt: "哪一种分点方式最清楚，而且各点不重复？",
    context:
      "你要说明为什么应优先优化一个流程，手上有用户投诉、交付延期和维护返工三类信息。",
    options: [
      {
        id: "distinct-groups",
        label: "第一，用户影响；第二，交付风险；第三，维护成本。"
      },
      {
        id: "repeated-groups",
        label: "第一，用户投诉；第二，用户不满意；第三，用户体验不好。"
      },
      {
        id: "chronological-groups",
        label: "第一，周一发现的信息；第二，周二发现的信息；第三，其他信息。"
      }
    ],
    correctOptionId: "distinct-groups",
    successExplanation: "正确。三点分别回答不同问题，同时服务于同一个结论。",
    retryExplanation: "不要按句子数量或发现顺序硬分组；每一点应代表一个不同类别。"
  }
];

export const dayFiveGroupingExercise = {
  context:
    "你要向项目负责人说明为什么需要优化内部交付流程。请把六张信息卡放入最合适的三组。",
  groups: [
    { id: "customer-impact", label: "用户影响" },
    { id: "delivery-risk", label: "交付风险" },
    { id: "maintenance-cost", label: "维护成本" }
  ],
  cards: [
    {
      id: "complaints",
      text: "近两周相关用户投诉增加了。",
      groupId: "customer-impact"
    },
    {
      id: "repeat-contact",
      text: "同一问题经常需要用户再次联系确认。",
      groupId: "customer-impact"
    },
    {
      id: "delays",
      text: "最近三个任务中有两个发生延期。",
      groupId: "delivery-risk"
    },
    {
      id: "milestone",
      text: "关键里程碑依赖人工检查，容易被遗漏。",
      groupId: "delivery-risk"
    },
    {
      id: "rework",
      text: "团队每周要花数小时重复返工。",
      groupId: "maintenance-cost"
    },
    {
      id: "manual-check",
      text: "当前每次提交都需要两名同事手工核对。",
      groupId: "maintenance-cost"
    }
  ]
} as const;

export const daySixKnowledgeChecks: KnowledgeCheck[] = [
  {
    id: "day-6-complete-report-order",
    prompt: "哪一种顺序最适合一段需要负责人作决定的完整短汇报？",
    context:
      "项目存在发布风险，你需要说明判断、依据，并请负责人今天作出决定。",
    options: [
      {
        id: "complete-order",
        label: "先给结论，再分点说明依据，最后提出有时限的行动请求。"
      },
      {
        id: "background-order",
        label: "先完整介绍过程，再补充背景，最后视情况决定是否给结论。"
      },
      {
        id: "request-only",
        label: "先重复提出请求，再省略依据，最后补一句模糊判断。"
      }
    ],
    correctOptionId: "complete-order",
    successExplanation: "正确。负责人先知道你的判断，再核对依据，最后可以直接行动。",
    retryExplanation: "完整汇报不能只有背景或请求；寻找“结论—依据—行动”的顺序。"
  }
];

export const daySixGuidedExercise = {
  context:
    "客服主管需要判断是否本周更新 FAQ。上周四十条咨询中有二十五条询问已变更的退款步骤，客服需要反复解释，而更新预计只需两小时。",
  slots: [
    { id: "conclusion", label: "1. 先给结论", correctBlockId: "conclusion" },
    { id: "point-one", label: "2. 第一项依据", correctBlockId: "point-one" },
    { id: "point-two", label: "3. 第二项依据", correctBlockId: "point-two" },
    { id: "request", label: "4. 行动请求", correctBlockId: "request" }
  ],
  blocks: [
    { id: "conclusion", text: "建议本周更新客服 FAQ。" },
    {
      id: "point-one",
      text: "第一，上周四十条咨询中有二十五条都在询问已变更的退款步骤。"
    },
    { id: "point-two", text: "第二，客服需要反复解释同一个问题。" },
    { id: "request", text: "请主管今天确认把 FAQ 更新列入本周任务。" },
    { id: "background", text: "现有 FAQ 是三个月前整理的。" },
    { id: "duplicate", text: "第二，用户对现有 FAQ 的体验不够好。" },
    { id: "vague-ending", text: "以上是本次需要同步的全部内容。" }
  ]
} as const;

export const daySixIndependentPrompt = {
  audience: "项目负责人",
  prompt:
    "客户上线项目原计划本周五发布。现在核心功能已完成，但两个关键接口仍未通过联调；最近三次测试有两次出现数据同步失败；客户已同意将培训调整到下周一。请用 4–6 句话完成汇报，并请负责人今天决定是否把发布推迟到下周一。"
} as const;

export const progressiveCourse: ProgressiveCourseLesson[] = [
  {
    id: "stg-v05-day-1-recognize-purpose",
    day: 1,
    difficulty: 1,
    title: "先看懂：表达要有目的",
    conceptGoal: "能识别一次沟通的受众和期望行动",
    estimatedMinutes: 3,
    implemented: true,
    lesson: {
      definition: "结构化表达不是把知道的都说出来，而是围绕一个明确目的组织信息。",
      value: "先确定对谁说、希望对方做什么，才能判断哪些信息值得保留。",
      formula: "对谁说 ＋ 说清什么 ＋ 希望对方做什么",
      badExample: {
        label: "只有背景",
        text: "最近注册流程有一些问题，我整理了不少数据。",
        explanation: "听众知道发生了什么，却不知道为什么现在要听、需要做什么。"
      },
      goodExample: {
        label: "目的明确",
        text: "注册前三步流失较高，请产品负责人决定是否把注册优化列为下周优先事项。",
        explanation: "受众、问题和期望决定都清楚。"
      },
      commonMistake: "把“我想汇报一下”当成目的，却没有说明希望对方知道、决定或执行什么。"
    },
    knowledgeChecks: dayOneKnowledgeChecks,
    exercises: [
      {
        id: "day-1-recognize-audience",
        kind: "recognize",
        scaffoldLevel: "full",
        countsForSkillStatus: false
      },
      {
        id: "day-1-recognize-outcome",
        kind: "recognize",
        scaffoldLevel: "full",
        countsForSkillStatus: false
      }
    ]
  },
  {
    id: "stg-v05-day-2-write-purpose",
    day: 2,
    difficulty: 2,
    title: "写一句明确目的",
    conceptGoal: "能用一句话说明问题和希望对方采取的行动",
    estimatedMinutes: 5,
    implemented: true,
    lesson: {
      definition: "明确目的句要让听众立刻知道：现在的问题是什么，以及需要他做什么。",
      value: "目的清楚后，后续背景和依据才不会散，也能减少来回追问。",
      formula: "我要向［谁］说明［什么］，希望对方［做什么］。",
      badExample: {
        label: "目的模糊",
        text: "我想和主管同步一下最近的项目情况。",
        explanation: "“同步情况”没有告诉主管需要判断或行动什么。"
      },
      goodExample: {
        label: "行动清楚",
        text: "客户演示与团队会议时间冲突，请主管今天决定调整哪一个。",
        explanation: "问题与需要完成的决定都可以直接执行。"
      },
      commonMistake: "写了大量原因和细节，却把真正的请求藏在最后。"
    },
    knowledgeChecks: dayTwoKnowledgeChecks,
    exercises: [
      {
        id: "day-2-recognize-purpose",
        kind: "recognize",
        scaffoldLevel: "full",
        countsForSkillStatus: false
      },
      {
        id: "day-2-fill-purpose",
        kind: "fill",
        scaffoldLevel: "full",
        countsForSkillStatus: false
      },
      {
        id: "day-2-independent-purpose",
        kind: "independent_write",
        scaffoldLevel: "partial",
        countsForSkillStatus: true
      }
    ]
  },
  {
    id: "stg-v05-day-3-conclusion-first",
    day: 3,
    difficulty: 3,
    title: "把结论放到第一句",
    conceptGoal: "能先回答问题，再补背景和依据",
    estimatedMinutes: 5,
    implemented: true,
    lesson: {
      definition: "结论先行是先给出判断、结果或建议，再补充原因和背景。",
      value: "听众先知道答案，就能更快理解后续信息为什么重要。",
      formula: "第一句回答问题 ＋ 后面说明关键依据",
      badExample: {
        label: "背景先行",
        text: "过去两周我们访谈了十位用户，也整理了客服记录，最后发现注册流程需要调整。",
        explanation: "听众要等到句末才知道你真正的判断。"
      },
      goodExample: {
        label: "结论先行",
        text: "建议优先调整注册流程，因为用户流失和客服咨询都集中在前三步。",
        explanation: "第一句先给建议，后半句再说明最关键的依据。"
      },
      commonMistake: "把“我先介绍一下背景”当成开场，让听众一直等待真正答案。"
    },
    knowledgeChecks: dayThreeKnowledgeChecks,
    exercises: [
      {
        id: "day-3-reorder",
        kind: "reorder",
        scaffoldLevel: "full",
        countsForSkillStatus: false
      },
      {
        id: "day-3-independent",
        kind: "independent_write",
        scaffoldLevel: "partial",
        countsForSkillStatus: true
      }
    ]
  },
  {
    id: "stg-v05-day-4-support",
    day: 4,
    difficulty: 4,
    title: "用一个理由支撑结论",
    conceptGoal: "能写出结论与最关键依据",
    estimatedMinutes: 5,
    implemented: true,
    lesson: {
      definition: "支撑理由是能够直接解释“为什么这个结论成立”的事实或依据。",
      value: "只给结论容易像个人看法；补一个最关键依据，听众才有判断和行动的理由。",
      formula: "我的判断是［结论］。最关键的依据是［一个可核对事实］。",
      badExample: {
        label: "重复结论",
        text: "建议更新周报流程，因为这个流程需要更新。",
        explanation: "后半句只是换词重复结论，没有提供新的依据。"
      },
      goodExample: {
        label: "理由直接",
        text: "建议更新周报提交检查清单。最近四次周报有三次漏填新增的风险字段。",
        explanation: "第二句是可核对事实，并且直接解释为什么需要更新。"
      },
      commonMistake: "堆很多背景，却没有挑出一条能直接证明结论的关键事实。"
    },
    knowledgeChecks: dayFourKnowledgeChecks,
    exercises: [
      {
        id: "day-4-guided",
        kind: "guided_write",
        scaffoldLevel: "partial",
        countsForSkillStatus: false
      },
      {
        id: "day-4-independent",
        kind: "independent_write",
        scaffoldLevel: "partial",
        countsForSkillStatus: true
      }
    ]
  },
  {
    id: "stg-v05-day-5-grouping",
    day: 5,
    difficulty: 5,
    title: "把信息整理成两到三点",
    conceptGoal: "能把不同信息分成少量且不重复的组",
    estimatedMinutes: 6,
    implemented: true,
    lesson: {
      definition: "分点表达是把同类信息放在一起，再用两到三个互不重复的要点支撑同一个结论。",
      value: "听众能快速看出信息之间的关系，也能逐点判断你的结论是否成立。",
      formula: "先给结论 ＋ 第一［类别一］＋ 第二［类别二］＋ 第三［类别三］",
      badExample: {
        label: "换词重复",
        text: "第一，用户投诉多；第二，用户不满意；第三，用户体验不好。",
        explanation: "三句话都在说用户感受，没有形成三个不同的信息类别。"
      },
      goodExample: {
        label: "分类清楚",
        text: "建议优先优化流程。第一，它影响用户；第二，它增加交付风险；第三，它带来维护成本。",
        explanation: "三点从不同角度支撑同一个建议，彼此没有重复。"
      },
      commonMistake: "把写出三句话当成分成三点，却没有检查每一点是否代表不同类别。"
    },
    knowledgeChecks: dayFiveKnowledgeChecks,
    exercises: [
      {
        id: "day-5-group-cards",
        kind: "reorder",
        scaffoldLevel: "partial",
        countsForSkillStatus: false
      },
      {
        id: "day-5-independent",
        kind: "independent_write",
        scaffoldLevel: "partial",
        countsForSkillStatus: true
      }
    ]
  },
  {
    id: "stg-v05-day-6-report",
    day: 6,
    difficulty: 6,
    title: "完成一次完整工作汇报",
    conceptGoal: "组合目的、结论、分点和行动请求",
    estimatedMinutes: 7,
    implemented: true,
    lesson: {
      definition: "完整短汇报是先给出判断，再用两到三个不同事实支撑，最后说清希望对方何时做什么。",
      value: "负责人不只知道发生了什么，还能快速理解你的主张、判断依据并直接作出决定。",
      formula: "结论先行 ＋ 两到三点依据 ＋ 有对象、有动作、有时限的请求",
      badExample: {
        label: "只有过程，没有落点",
        text: "我们最近做了不少测试，也和客户沟通过，项目还有一些问题，以上是当前情况。",
        explanation: "听众看到了背景，却不知道你的判断和需要他完成的决定。"
      },
      goodExample: {
        label: "判断、依据、请求完整",
        text: "建议把本周五发布推迟到下周一。第一，关键接口尚未通过联调。第二，数据同步仍不稳定。请负责人今天确认延期决定。",
        explanation: "结论、不同依据和行动请求各自承担一个明确功能。"
      },
      commonMistake: "把 Day 2–5 的句子机械拼在一起，重复同一事实，或汇报完情况却没有提出行动请求。"
    },
    knowledgeChecks: daySixKnowledgeChecks,
    exercises: [
      {
        id: "day-6-guided-report",
        kind: "guided_write",
        scaffoldLevel: "partial",
        countsForSkillStatus: false
      },
      {
        id: "day-6-independent-report",
        kind: "independent_write",
        scaffoldLevel: "none",
        countsForSkillStatus: true
      }
    ]
  },
  {
    id: "stg-v05-day-7-project",
    day: 7,
    difficulty: 7,
    title: "毕业项目：独立完成结构化汇报",
    conceptGoal: "在未见情境中独立规划、表达、修改和迁移",
    estimatedMinutes: 10,
    implemented: true,
    lesson: {
      definition: "毕业项目不再教授新公式，而是检查你能否在两个全新情境中独立使用前六天学过的结构动作。",
      value: "首稿、亲自修改和未见迁移会分别保留，帮助你区分“这道题改好了”和“换一道题也能做到”。",
      formula: "阅读材料 → 独立首稿 → 根据证据修改 → 未见情境迁移",
      badExample: {
        label: "把修改当成迁移",
        text: "在同一道题上反复修改，最后把通过结果当作新情境能力。",
        explanation: "同题修改只能说明本题被修正，不能替代第二个未见情境。"
      },
      goodExample: {
        label: "三份证据互不覆盖",
        text: "保留首稿，在原稿上完成一次实质修改，再独立回答另一道全新工作题。",
        explanation: "这样能诚实观察修改行为和本次即时迁移，仍不等于长期能力提升。"
      },
      commonMistake: "为了命中规则堆关键词，或者只改标点和少量词语，却没有真正修复结构缺口。"
    },
    knowledgeChecks: [],
    exercises: [
      {
        id: "day-7-final-project",
        kind: "final_project",
        scaffoldLevel: "none",
        countsForSkillStatus: true
      },
      {
        id: "day-7-transfer",
        kind: "transfer",
        scaffoldLevel: "none",
        countsForSkillStatus: true
      }
    ]
  }
];

export function getProgressiveLesson(day: ProgressiveCourseDay) {
  const lesson = progressiveCourse.find(
    (item) => item.day === day && item.implemented
  );

  if (!lesson?.lesson || !lesson.knowledgeChecks) {
    throw new Error(`Progressive lesson Day ${day} is not implemented.`);
  }

  return {
    ...lesson,
    lesson: lesson.lesson,
    knowledgeChecks: lesson.knowledgeChecks
  };
}
