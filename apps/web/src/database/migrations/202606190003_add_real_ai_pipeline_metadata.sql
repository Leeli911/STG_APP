alter table if exists public.attempts
  add column if not exists analysis_prompt_version text,
  add column if not exists coaching_prompt_version text,
  add column if not exists ai_model text,
  add column if not exists repair_count integer not null default 0 check (repair_count >= 0),
  add column if not exists error_code text,
  add column if not exists analysis_latency_ms integer check (analysis_latency_ms is null or analysis_latency_ms >= 0),
  add column if not exists coaching_latency_ms integer check (coaching_latency_ms is null or coaching_latency_ms >= 0),
  add column if not exists total_latency_ms integer check (total_latency_ms is null or total_latency_ms >= 0);

alter table if exists public.attempts
  drop constraint if exists attempts_status_check;

alter table if exists public.attempts
  add constraint attempts_status_check check (
    status in (
      'submitted',
      'analysis_running',
      'coaching_running',
      'mock_result_generating',
      'completed',
      'failed'
    )
  );

alter table if exists public.scores
  add column if not exists rubric_evidence jsonb;

alter table if exists public.scores
  drop constraint if exists scores_structure_check;

alter table if exists public.scores
  add constraint scores_structure_check check (structure between 0 and 25);

alter table if exists public.scores
  drop constraint if exists scores_interview_impact_check;

alter table if exists public.scores
  add constraint scores_interview_impact_check check (interview_impact between 0 and 15);

alter table if exists public.ai_feedback
  add column if not exists question_analysis jsonb,
  add column if not exists observable_features jsonb,
  add column if not exists safety_flags jsonb;

create index if not exists attempts_user_status_idx
  on public.attempts(user_id, status);
