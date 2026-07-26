import type {
  KnowledgeCheck,
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
    implemented: false,
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
    implemented: false,
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
    implemented: false,
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
    implemented: false,
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
    implemented: false,
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

export function getProgressiveLesson(day: 1 | 2) {
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
