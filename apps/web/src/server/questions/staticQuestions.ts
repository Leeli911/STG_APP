import type { QuestionRow } from "@/server/questions/types";

const seedTimestamp = "2026-06-18T00:00:00.000Z";

export const staticQuestionRows: QuestionRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    day_number: 1,
    title: "结论先行",
    scenario: "面试官问你一个非常简单的问题，希望快速了解你。",
    prompt: "你为什么想做数据分析这份工作？",
    learning_goal: "只训练结论先行。",
    expected_structure: "第一句话直接回答原因。后面再补充经历或背景。",
    evaluation_focus: "核心答案是否出现在第一句话。",
    knowledge_card: {
      title: "别让面试官猜答案",
      content:
        "很多人会先讲经历，再讲原因。其实更容易的方法是先回答问题。先说“我想做数据分析，因为……”，后面再解释。这样对方马上知道你的重点。"
    },
    is_active: true,
    created_at: seedTimestamp,
    updated_at: seedTimestamp
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    day_number: 2,
    title: "分类表达",
    scenario: "面试官问你为什么适合这个岗位。",
    prompt: "如果让你用三个理由说明自己适合这个岗位，你会怎么回答？",
    learning_goal: "只训练分类表达。",
    expected_structure: "先说有三个原因。然后逐条展开。",
    evaluation_focus: "是否主动分点；每一点是否表达一个独立意思。",
    knowledge_card: {
      title: "想到什么说什么最容易乱",
      content:
        "当答案超过一分钟时，最好分成几部分。比如经验、技能、学习能力。先告诉面试官有几点，再一条条说，对方更容易听懂。"
    },
    is_active: true,
    created_at: seedTimestamp,
    updated_at: seedTimestamp
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    day_number: 3,
    title: "完整案例",
    scenario: "面试官让你讲一次解决问题的经历。",
    prompt: "请讲一次你解决困难问题的经历。",
    learning_goal: "只训练完整案例表达。",
    expected_structure: "发生了什么；你负责什么；你做了什么；最后结果如何。",
    evaluation_focus: "是否包含场景、任务、行动、结果四部分。",
    knowledge_card: {
      title: "不要只讲过程",
      content:
        "很多人会一直讲自己做了什么，却没讲为什么做、最后怎么样。一个完整案例至少要让别人知道：问题是什么、你做了什么、结果是什么。"
    },
    is_active: true,
    created_at: seedTimestamp,
    updated_at: seedTimestamp
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    day_number: 4,
    title: "事实证据",
    scenario: "面试官问你的优势是什么。",
    prompt: "你最大的优势是什么？请用一个真实经历证明。",
    learning_goal: "只训练用事实支撑观点。",
    expected_structure: "先说优势；再讲经历；最后说明结果。",
    evaluation_focus: "是否用具体事实证明能力，而不是只做自我评价。",
    knowledge_card: {
      title: "能力要靠证据说话",
      content:
        "“我学习能力强”“我很认真”很容易说出口，但面试官更想听发生过什么。先说能力，再讲一个真实经历，对方更容易相信。"
    },
    is_active: true,
    created_at: seedTimestamp,
    updated_at: seedTimestamp
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    day_number: 5,
    title: "冲突处理",
    scenario: "业务方坚持认为数据有问题，但你检查后发现数据没有错误。",
    prompt: "请讲讲这种情况下你会怎么和业务方沟通。",
    learning_goal: "只训练冲突处理表达。",
    expected_structure: "先理解对方担心什么；再确认事实；然后推动解决问题。",
    evaluation_focus: "是否避免直接反驳；是否体现解决分歧的思路。",
    knowledge_card: {
      title: "别急着证明自己是对的",
      content:
        "很多人一遇到质疑就开始解释。其实更好的做法是先弄清楚对方为什么觉得有问题，再一起核对事实。这样更容易解决分歧。"
    },
    is_active: true,
    created_at: seedTimestamp,
    updated_at: seedTimestamp
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    day_number: 6,
    title: "向上沟通",
    scenario: "老板突然问你：最近用户活跃下降了，你怎么看？",
    prompt: "如果领导突然这样问你，你会如何回答？",
    learning_goal: "只训练向上汇报。",
    expected_structure: "先给判断；再说依据；最后说下一步。",
    evaluation_focus: "是否直接回答问题；是否能把情况、原因和行动区分开。",
    knowledge_card: {
      title: "领导最怕听半天不知道结论",
      content:
        "汇报时不要先讲细节。先告诉领导你的判断，再说依据是什么，最后说准备怎么做。这样别人能更快跟上你的思路。"
    },
    is_active: true,
    created_at: seedTimestamp,
    updated_at: seedTimestamp
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    day_number: 7,
    title: "最终自我推荐",
    scenario: "面试已经结束。面试官最后问：为什么我们应该录用你？",
    prompt: "请用三分钟完成你的最终自我推荐。",
    learning_goal: "只训练说服表达。",
    expected_structure:
      "先给结论；再给两到三个最有力的录用理由；最后回到岗位价值。",
    evaluation_focus: "是否能够把经历转化成录用理由；是否让面试官更容易做决定。",
    knowledge_card: {
      title: "最后一题是在帮面试官做决定",
      content:
        "很多人最后只会说“我很感兴趣”。真正有说服力的回答会告诉面试官：我有什么能力，我做过什么事，这些能力为什么对这个岗位有价值。"
    },
    is_active: true,
    created_at: seedTimestamp,
    updated_at: seedTimestamp
  }
];
