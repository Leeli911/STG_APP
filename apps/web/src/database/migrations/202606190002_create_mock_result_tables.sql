alter table if exists public.attempts
  drop constraint if exists attempts_status_check;

alter table if exists public.attempts
  add constraint attempts_status_check check (
    status in ('submitted', 'mock_result_generating', 'completed', 'failed')
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

create index if not exists scores_attempt_id_idx
  on public.scores(attempt_id);

create index if not exists ai_feedback_attempt_id_idx
  on public.ai_feedback(attempt_id);

alter table public.scores enable row level security;
alter table public.ai_feedback enable row level security;

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
