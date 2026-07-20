insert into public.questions (
  content_key,
  day_number,
  title,
  scenario,
  prompt,
  learning_goal,
  expected_structure,
  evaluation_focus,
  knowledge_card,
  is_active
) values
  (
    'stg-7day-v1-day-1',
    1,
    '结论先行',
    '面试官问你一个非常简单的问题，希望快速了解你。',
    '你为什么想做数据分析这份工作？',
    '只训练结论先行。',
    '第一句话直接回答原因。后面再补充经历或背景。',
    '核心答案是否出现在第一句话。',
    jsonb_build_object(
      'title', '别让面试官猜答案',
      'content', '很多人会先讲经历，再讲原因。其实更容易的方法是先回答问题。先说“我想做数据分析，因为……”，后面再解释。这样对方马上知道你的重点。'
    ),
    true
  ),
  (
    'stg-7day-v1-day-2',
    2,
    '分类表达',
    '面试官问你为什么适合这个岗位。',
    '如果让你用三个理由说明自己适合这个岗位，你会怎么回答？',
    '只训练分类表达。',
    '先说有三个原因。然后逐条展开。',
    '是否主动分点；每一点是否表达一个独立意思。',
    jsonb_build_object(
      'title', '想到什么说什么最容易乱',
      'content', '当答案超过一分钟时，最好分成几部分。比如经验、技能、学习能力。先告诉面试官有几点，再一条条说，对方更容易听懂。'
    ),
    true
  ),
  (
    'stg-7day-v1-day-3',
    3,
    '完整案例',
    '面试官让你讲一次解决问题的经历。',
    '请讲一次你解决困难问题的经历。',
    '只训练完整案例表达。',
    '发生了什么；你负责什么；你做了什么；最后结果如何。',
    '是否包含场景、任务、行动、结果四部分。',
    jsonb_build_object(
      'title', '不要只讲过程',
      'content', '很多人会一直讲自己做了什么，却没讲为什么做、最后怎么样。一个完整案例至少要让别人知道：问题是什么、你做了什么、结果是什么。'
    ),
    true
  ),
  (
    'stg-7day-v1-day-4',
    4,
    '事实证据',
    '面试官问你的优势是什么。',
    '你最大的优势是什么？请用一个真实经历证明。',
    '只训练用事实支撑观点。',
    '先说优势；再讲经历；最后说明结果。',
    '是否用具体事实证明能力，而不是只做自我评价。',
    jsonb_build_object(
      'title', '能力要靠证据说话',
      'content', '“我学习能力强”“我很认真”很容易说出口，但面试官更想听发生过什么。先说能力，再讲一个真实经历，对方更容易相信。'
    ),
    true
  ),
  (
    'stg-7day-v1-day-5',
    5,
    '冲突处理',
    '业务方坚持认为数据有问题，但你检查后发现数据没有错误。',
    '请讲讲这种情况下你会怎么和业务方沟通。',
    '只训练冲突处理表达。',
    '先理解对方担心什么；再确认事实；然后推动解决问题。',
    '是否避免直接反驳；是否体现解决分歧的思路。',
    jsonb_build_object(
      'title', '别急着证明自己是对的',
      'content', '很多人一遇到质疑就开始解释。其实更好的做法是先弄清楚对方为什么觉得有问题，再一起核对事实。这样更容易解决分歧。'
    ),
    true
  ),
  (
    'stg-7day-v1-day-6',
    6,
    '向上沟通',
    '老板突然问你：最近用户活跃下降了，你怎么看？',
    '如果领导突然这样问你，你会如何回答？',
    '只训练向上汇报。',
    '先给判断；再说依据；最后说下一步。',
    '是否直接回答问题；是否能把情况、原因和行动区分开。',
    jsonb_build_object(
      'title', '领导最怕听半天不知道结论',
      'content', '汇报时不要先讲细节。先告诉领导你的判断，再说依据是什么，最后说准备怎么做。这样别人能更快跟上你的思路。'
    ),
    true
  ),
  (
    'stg-7day-v1-day-7',
    7,
    '最终自我推荐',
    '面试已经结束。面试官最后问：为什么我们应该录用你？',
    '请用三分钟完成你的最终自我推荐。',
    '只训练说服表达。',
    '先给结论；再给两到三个最有力的录用理由；最后回到岗位价值。',
    '是否能够把经历转化成录用理由；是否让面试官更容易做决定。',
    jsonb_build_object(
      'title', '最后一题是在帮面试官做决定',
      'content', '很多人最后只会说“我很感兴趣”。真正有说服力的回答会告诉面试官：我有什么能力，我做过什么事，这些能力为什么对这个岗位有价值。'
    ),
    true
  )
on conflict (content_key) where content_key is not null do update set
  day_number = excluded.day_number,
  title = excluded.title,
  scenario = excluded.scenario,
  prompt = excluded.prompt,
  learning_goal = excluded.learning_goal,
  expected_structure = excluded.expected_structure,
  evaluation_focus = excluded.evaluation_focus,
  knowledge_card = excluded.knowledge_card,
  is_active = excluded.is_active;

-- Supabase applies seed files after all migrations. Rebuild the published
-- curriculum mapping here so a clean database reset exposes Days 1–7 even
-- though the beta migration necessarily ran before these questions existed.
insert into public.curriculum_items (
  curriculum_id,
  question_id,
  day_number,
  display_order,
  skill_key
)
select
  curricula.id,
  questions.id,
  questions.day_number,
  questions.day_number,
  case questions.day_number
    when 1 then 'conclusion_first'
    when 2 then 'categorization'
    when 3 then 'star'
    when 4 then 'evidence'
    when 5 then 'conflict_handling'
    when 6 then 'stakeholder_communication'
    when 7 then 'final_pitch'
  end
from public.curricula
join public.questions
  on questions.content_key = 'stg-7day-v1-day-' || questions.day_number::text
where curricula.slug = 'stg-7day-v1'
  and curricula.version = 1
on conflict (curriculum_id, day_number) do update set
  question_id = excluded.question_id,
  display_order = excluded.display_order,
  skill_key = excluded.skill_key;
