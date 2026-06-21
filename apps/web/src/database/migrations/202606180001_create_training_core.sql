create extension if not exists "pgcrypto";

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  day_number integer not null check (day_number between 1 and 7),
  title text not null,
  scenario text not null,
  prompt text not null,
  learning_goal text not null,
  expected_structure text not null,
  evaluation_focus text not null,
  knowledge_card jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint questions_active_day_unique unique (day_number)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  original_answer text not null check (length(trim(original_answer)) > 0),
  idempotency_key text not null,
  client_started_at timestamp with time zone,
  status text not null default 'submitted' check (
    status in ('submitted', 'mock_result_generating', 'completed', 'failed')
  ),
  created_at timestamp with time zone not null default now(),
  constraint attempts_user_idempotency_key_unique unique (
    user_id,
    idempotency_key
  )
);

create table if not exists public.scores (
  attempt_id uuid primary key references public.attempts(id) on delete cascade,
  answer_relevance integer not null check (answer_relevance between 0 and 20),
  core_message integer not null check (core_message between 0 and 20),
  structure integer not null check (structure between 0 and 20),
  evidence integer not null check (evidence between 0 and 20),
  interview_impact integer not null check (interview_impact between 0 and 20),
  total_score integer not null check (total_score between 0 and 100),
  created_at timestamp with time zone not null default now(),
  constraint scores_total_matches_dimensions check (
    total_score = answer_relevance + core_message + structure + evidence + interview_impact
  )
);

create table if not exists public.ai_feedback (
  attempt_id uuid primary key references public.attempts(id) on delete cascade,
  diagnosis jsonb not null,
  rewrite jsonb not null,
  why_better jsonb not null,
  growth_suggestion jsonb not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.growth_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level_1_score integer not null default 0 check (
    level_1_score between 0 and 100
  ),
  level_2_score integer not null default 0 check (
    level_2_score between 0 and 100
  ),
  level_3_score integer not null default 0 check (
    level_3_score between 0 and 100
  ),
  level_4_score integer not null default 0 check (
    level_4_score between 0 and 100
  ),
  current_day integer not null default 1 check (current_day between 1 and 7),
  updated_at timestamp with time zone not null default now()
);

create index if not exists questions_active_day_idx
  on public.questions(day_number)
  where is_active = true;

create index if not exists attempts_user_created_at_idx
  on public.attempts(user_id, created_at desc);

create index if not exists attempts_question_id_idx
  on public.attempts(question_id);

create index if not exists scores_attempt_id_idx
  on public.scores(attempt_id);

create index if not exists ai_feedback_attempt_id_idx
  on public.ai_feedback(attempt_id);

alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.scores enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.growth_profiles enable row level security;

drop policy if exists "Authenticated users can read active questions"
  on public.questions;
create policy "Authenticated users can read active questions"
  on public.questions
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Users can read own attempts"
  on public.attempts;
create policy "Users can read own attempts"
  on public.attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own attempts"
  on public.attempts;
create policy "Users can create own attempts"
  on public.attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own attempts"
  on public.attempts;
create policy "Users can update own attempts"
  on public.attempts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own scores"
  on public.scores;
create policy "Users can read own scores"
  on public.scores
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.attempts
      where attempts.id = scores.attempt_id
        and attempts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create own scores"
  on public.scores;
create policy "Users can create own scores"
  on public.scores
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.attempts
      where attempts.id = scores.attempt_id
        and attempts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own ai feedback"
  on public.ai_feedback;
create policy "Users can read own ai feedback"
  on public.ai_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.attempts
      where attempts.id = ai_feedback.attempt_id
        and attempts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create own ai feedback"
  on public.ai_feedback;
create policy "Users can create own ai feedback"
  on public.ai_feedback
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.attempts
      where attempts.id = ai_feedback.attempt_id
        and attempts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own growth profile"
  on public.growth_profiles;
create policy "Users can read own growth profile"
  on public.growth_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own growth profile"
  on public.growth_profiles;
create policy "Users can create own growth profile"
  on public.growth_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own growth profile"
  on public.growth_profiles;
create policy "Users can update own growth profile"
  on public.growth_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.questions (
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
    1,
    'Conclusion First',
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
    2,
    'Categorization',
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
    3,
    'STAR',
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
    4,
    'Evidence',
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
    5,
    'Conflict Handling',
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
    6,
    'Stakeholder Communication',
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
    7,
    'Final Pitch',
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
on conflict (day_number) do update set
  title = excluded.title,
  scenario = excluded.scenario,
  prompt = excluded.prompt,
  learning_goal = excluded.learning_goal,
  expected_structure = excluded.expected_structure,
  evaluation_focus = excluded.evaluation_focus,
  knowledge_card = excluded.knowledge_card,
  is_active = excluded.is_active;
