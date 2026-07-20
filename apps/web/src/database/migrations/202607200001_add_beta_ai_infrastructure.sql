create extension if not exists "pgcrypto";

-- Product identity and curriculum tables. Questions remain immutable content; their
-- position in a programme is owned by curriculum_items.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_role text,
  interview_type text,
  training_goal text,
  preferred_answer_language text not null default 'zh' check (
    preferred_answer_language in ('zh', 'en')
  ),
  consent_to_anonymized_evals boolean not null default false,
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (length(trim(slug)) > 0),
  version integer not null check (version > 0),
  locale text not null default 'zh-CN',
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (
    status in ('draft', 'published', 'archived')
  ),
  created_at timestamp with time zone not null default now(),
  published_at timestamp with time zone,
  constraint curricula_slug_version_unique unique (slug, version),
  constraint curricula_publish_shape_check check (
    (status = 'published' and published_at is not null)
    or
    (status <> 'published')
  )
);

create table if not exists public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  day_number integer not null check (day_number between 1 and 7),
  display_order integer not null check (display_order > 0),
  skill_key text not null check (length(trim(skill_key)) > 0),
  created_at timestamp with time zone not null default now(),
  constraint curriculum_items_day_unique unique (curriculum_id, day_number),
  constraint curriculum_items_order_unique unique (curriculum_id, display_order),
  constraint curriculum_items_question_unique unique (curriculum_id, question_id)
);

-- A stable content key replaces the former global day-number uniqueness. It
-- keeps seeds idempotent while allowing future curricula to reuse a day number
-- with different question content.
alter table public.questions
  add column if not exists content_key text;

update public.questions
set content_key = 'stg-7day-v1-day-' || day_number::text
where content_key is null
  and day_number between 1 and 7;

create unique index if not exists questions_content_key_unique
  on public.questions(content_key)
  where content_key is not null;

-- Server-written product telemetry. Answers and other free-form PII must never be
-- placed in metadata.
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id text,
  session_id uuid references public.practice_sessions(id) on delete set null,
  attempt_id uuid references public.attempts(id) on delete set null,
  event_name text not null check (event_name in (
    'onboarding_completed',
    'draft_submitted',
    'feedback_viewed',
    'revision_committed',
    'session_completed',
    'day_completed'
  )),
  request_id text,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  occurred_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint product_events_actor_check check (
    user_id is not null or nullif(trim(anonymous_id), '') is not null
  )
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  metric text not null check (metric in ('ai_session', 'input_tokens', 'output_tokens', 'cost_microusd')),
  quantity bigint not null default 0 check (quantity >= 0),
  -- AI-session reservations are bounded by the daily limit, so keeping the
  -- idempotency keys on the daily counter makes quota consumption atomic
  -- without introducing an unbounded ledger.
  idempotency_keys text[] not null default '{}'::text[],
  updated_at timestamp with time zone not null default now(),
  constraint usage_counters_user_date_metric_unique unique (
    user_id,
    usage_date,
    metric
  )
);

alter table public.usage_counters
  add column if not exists idempotency_keys text[] not null default '{}'::text[];

-- Durable background work ledger. The application exposes attempt state, not raw
-- provider/job details, to end users.
create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  stage text not null check (stage in ('analysis', 'coaching', 'repair', 'rescore')),
  status text not null default 'queued' check (
    status in ('queued', 'submitted', 'in_progress', 'completed', 'failed', 'cancelled')
  ),
  provider text not null default 'openai',
  provider_response_id text,
  provider_idempotency_key text not null default (
    'stg-ai-job-' || gen_random_uuid()::text
  ),
  request_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(request_payload) = 'object'
  ),
  model text not null,
  prompt_version text not null,
  rubric_version text not null default 'stg-rubric-v1',
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 2 check (max_retries between 0 and 5),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  cost_microusd bigint check (cost_microusd is null or cost_microusd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  error_message text,
  output_payload jsonb,
  lease_token uuid,
  lease_expires_at timestamp with time zone,
  claimed_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint ai_jobs_provider_response_unique unique (provider, provider_response_id),
  constraint ai_jobs_provider_idempotency_unique unique (
    provider,
    provider_idempotency_key
  ),
  constraint ai_jobs_token_sum_check check (
    total_tokens is null
    or input_tokens is null
    or output_tokens is null
    or total_tokens = input_tokens + output_tokens
  ),
  constraint ai_jobs_completion_shape_check check (
    (status = 'completed' and completed_at is not null)
    or
    (status <> 'completed')
  )
);

create unique index if not exists ai_jobs_one_active_stage_idx
  on public.ai_jobs(attempt_id, stage)
  where status in ('queued', 'submitted', 'in_progress');

create index if not exists ai_jobs_reconcile_idx
  on public.ai_jobs(status, updated_at)
  where status in ('queued', 'submitted', 'in_progress');

create index if not exists product_events_user_occurred_idx
  on public.product_events(user_id, occurred_at desc);

-- Funnel events describe completed business actions, not browser interactions.
-- These identities make retries and idempotency replays safe to count once.
create unique index if not exists product_events_onboarding_once_idx
  on public.product_events(user_id, event_name)
  where user_id is not null
    and event_name = 'onboarding_completed';

create unique index if not exists product_events_attempt_once_idx
  on public.product_events(user_id, event_name, attempt_id)
  where user_id is not null
    and event_name = 'draft_submitted'
    and attempt_id is not null;

create unique index if not exists product_events_session_once_idx
  on public.product_events(user_id, event_name, session_id)
  where user_id is not null
    and event_name in (
      'feedback_viewed',
      'revision_committed',
      'session_completed',
      'day_completed'
    )
    and session_id is not null;

create index if not exists curriculum_items_curriculum_order_idx
  on public.curriculum_items(curriculum_id, display_order);

-- Keep legacy values valid while introducing the public beta state vocabulary.
alter table if exists public.attempts
  drop constraint if exists attempts_status_check;

alter table if exists public.attempts
  add constraint attempts_status_check check (
    status in (
      'submitted',
      'queued',
      'analyzing',
      'analysis_running',
      'coaching',
      'coaching_running',
      'feedback_ready',
      'rescoring',
      'mock_result_generating',
      'completed',
      'failed'
    )
  );

alter table public.attempts
  add column if not exists rubric_version text not null default 'stg-rubric-v1';

-- Backfill the existing seven questions into one immutable programme version.
insert into public.curricula (
  slug,
  version,
  locale,
  title,
  description,
  status,
  published_at
) values (
  'stg-7day-v1',
  1,
  'zh-CN',
  'STG 七天结构化表达训练',
  '每天聚焦一个表达技能，通过草稿、反馈、修订和复评完成训练。',
  'published',
  now()
)
on conflict (slug, version) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  published_at = coalesce(public.curricula.published_at, excluded.published_at);

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
  on questions.day_number between 1 and 7
  and questions.is_active = true
where curricula.slug = 'stg-7day-v1'
  and curricula.version = 1
on conflict (curriculum_id, day_number) do update set
  question_id = excluded.question_id,
  display_order = excluded.display_order,
  skill_key = excluded.skill_key;

-- Day/order belong to a curriculum version, not to the global question bank.
alter table public.questions
  drop constraint if exists questions_active_day_unique;

create or replace view public.stg_active_curriculum_questions
with (security_invoker = true)
as
select
  questions.id,
  curriculum_items.day_number,
  curriculum_items.display_order,
  curriculum_items.skill_key,
  curricula.id as curriculum_id,
  curricula.slug as curriculum_slug,
  curricula.version as curriculum_version,
  questions.title,
  questions.scenario,
  questions.prompt,
  questions.learning_goal,
  questions.expected_structure,
  questions.evaluation_focus,
  questions.knowledge_card,
  questions.is_active,
  questions.created_at,
  questions.updated_at
from public.curricula
join public.curriculum_items
  on curriculum_items.curriculum_id = curricula.id
join public.questions
  on questions.id = curriculum_items.question_id
where curricula.slug = 'stg-7day-v1'
  and curricula.version = 1
  and curricula.status = 'published'
  and questions.is_active = true;

revoke all on public.stg_active_curriculum_questions from public, anon;
grant select on public.stg_active_curriculum_questions to authenticated;

-- Snapshot the curriculum position on every attempt so history remains stable
-- even if a later curriculum version reuses or replaces a question.
alter table public.attempts
  add column if not exists practice_day integer;

update public.attempts
set practice_day = questions.day_number
from public.questions
where attempts.question_id = questions.id
  and attempts.practice_day is null;

update public.attempts
set practice_day = active_questions.day_number
from public.stg_active_curriculum_questions as active_questions
where attempts.question_id = active_questions.id;

alter table public.attempts
  drop constraint if exists attempts_practice_day_check;
alter table public.attempts
  add constraint attempts_practice_day_check check (practice_day between 1 and 7);
alter table public.attempts
  alter column practice_day set not null;

create or replace function public.assign_attempt_practice_day()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  select active_questions.day_number into new.practice_day
  from public.stg_active_curriculum_questions as active_questions
  where active_questions.id = new.question_id;

  if new.practice_day is null then
    raise exception using errcode = '22023', message = 'QUESTION_NOT_IN_ACTIVE_CURRICULUM';
  end if;

  return new;
end;
$$;

drop trigger if exists attempts_assign_practice_day on public.attempts;
create trigger attempts_assign_practice_day
before insert or update of question_id on public.attempts
for each row execute function public.assign_attempt_practice_day();

alter table public.user_profiles enable row level security;
alter table public.curricula enable row level security;
alter table public.curriculum_items enable row level security;
alter table public.product_events enable row level security;
alter table public.usage_counters enable row level security;
alter table public.ai_jobs enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read published curricula" on public.curricula;
create policy "Authenticated users can read published curricula"
  on public.curricula
  for select
  to authenticated
  using (status = 'published');

drop policy if exists "Authenticated users can read published curriculum items" on public.curriculum_items;
create policy "Authenticated users can read published curriculum items"
  on public.curriculum_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.curricula
      where curricula.id = curriculum_items.curriculum_id
        and curricula.status = 'published'
    )
  );

-- Remove browser-write policies from AI-authoritative tables. The service_role
-- continues to bypass RLS; narrowly scoped SECURITY DEFINER RPCs below provide the
-- transaction boundaries used by workers.
drop policy if exists "Users can create own attempts" on public.attempts;
drop policy if exists "Users can update own attempts" on public.attempts;
drop policy if exists "Users can create own scores" on public.scores;
drop policy if exists "Users can create own ai feedback" on public.ai_feedback;
drop policy if exists "Users can create own growth profile" on public.growth_profiles;
drop policy if exists "Users can update own growth profile" on public.growth_profiles;

revoke insert, update, delete on public.attempts from anon, authenticated;
revoke insert, update, delete on public.scores from anon, authenticated;
revoke insert, update, delete on public.ai_feedback from anon, authenticated;
revoke insert, update, delete on public.growth_profiles from anon, authenticated;
revoke insert, update, delete on public.user_profiles from anon, authenticated;
revoke insert, update, delete on public.curricula from anon, authenticated;
revoke insert, update, delete on public.curriculum_items from anon, authenticated;
revoke insert, update, delete on public.product_events from anon, authenticated;
revoke insert, update, delete on public.usage_counters from anon, authenticated;
revoke insert, update, delete on public.ai_jobs from anon, authenticated;

create or replace function public.claim_ai_job(
  p_attempt_id uuid,
  p_stage text,
  p_model text,
  p_prompt_version text,
  p_request_payload jsonb,
  p_rubric_version text default 'stg-rubric-v1',
  p_lease_seconds integer default 120
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_job public.ai_jobs%rowtype;
  v_job_id uuid;
  v_attempt_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_stage not in ('analysis', 'coaching', 'repair', 'rescore') then
    raise exception using errcode = '22023', message = 'INVALID_AI_JOB_STAGE';
  end if;

  if p_request_payload is null or jsonb_typeof(p_request_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_AI_JOB_REQUEST';
  end if;

  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'INVALID_LEASE_SECONDS';
  end if;

  select * into v_attempt
  from public.attempts
  where attempts.id = p_attempt_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;

  select * into v_job
  from public.ai_jobs
  where ai_jobs.attempt_id = p_attempt_id
    and ai_jobs.stage = p_stage
    and ai_jobs.status in ('queued', 'submitted', 'in_progress')
  for update;

  if not found then
    select * into v_job
    from public.ai_jobs
    where ai_jobs.attempt_id = p_attempt_id
      and ai_jobs.stage = p_stage
      and ai_jobs.status in ('failed', 'cancelled')
    order by ai_jobs.updated_at desc
    limit 1
    for update;
  end if;

  -- Never hand an active lease to a second HTTP request. Submitted/provider-
  -- owned jobs are also a no-op here; Webhook/Reconciler owns their progress.
  if found and (
    v_job.status in ('submitted', 'in_progress')
    or (v_job.lease_expires_at is not null and v_job.lease_expires_at > now())
    or (v_job.status in ('failed', 'cancelled') and v_job.retry_count >= v_job.max_retries)
  ) then
    return null;
  end if;

  if found then
    update public.ai_jobs
    set
      status = 'queued',
      retry_count = retry_count + 1,
      provider_response_id = case
        when v_job.status in ('failed', 'cancelled') then null
        else provider_response_id
      end,
      provider_idempotency_key = case
        when v_job.status in ('failed', 'cancelled')
        then 'stg-ai-job-' || id::text || '-retry-' || (retry_count + 1)::text
        else provider_idempotency_key
      end,
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      claimed_at = now(),
      error_code = null,
      error_message = null,
      output_payload = case
        when v_job.status in ('failed', 'cancelled') then null
        else output_payload
      end,
      started_at = case
        when v_job.status in ('failed', 'cancelled') then null
        else started_at
      end,
      completed_at = null,
      updated_at = now()
    where id = v_job.id
      and retry_count < max_retries
    returning * into v_job;

    if not found then
      raise exception using errcode = '55000', message = 'AI_JOB_RETRY_LIMIT_REACHED';
    end if;
  else
    v_job_id := gen_random_uuid();
    insert into public.ai_jobs (
      id,
      attempt_id,
      user_id,
      stage,
      status,
      provider_idempotency_key,
      request_payload,
      model,
      prompt_version,
      rubric_version,
      lease_token,
      lease_expires_at,
      claimed_at
    ) values (
      v_job_id,
      p_attempt_id,
      v_attempt.user_id,
      p_stage,
      'queued',
      'stg-ai-job-' || v_job_id::text,
      p_request_payload,
      p_model,
      p_prompt_version,
      p_rubric_version,
      gen_random_uuid(),
      now() + make_interval(secs => p_lease_seconds),
      now()
    )
    returning * into v_job;
  end if;

  v_attempt_status := case p_stage
    when 'analysis' then 'analyzing'
    when 'coaching' then 'coaching'
    when 'rescore' then 'rescoring'
    else v_attempt.status
  end;

  update public.attempts
  set status = v_attempt_status
  where id = p_attempt_id;

  return v_job;
end;
$$;

create or replace function public.attach_ai_job_response(
  p_job_id uuid,
  p_lease_token uuid,
  p_provider_response_id text
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ai_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  update public.ai_jobs
  set
    provider_response_id = nullif(trim(p_provider_response_id), ''),
    status = 'submitted',
    started_at = coalesce(started_at, now()),
    lease_token = null,
    lease_expires_at = null,
    updated_at = now()
  where id = p_job_id
    and lease_token = p_lease_token
    and status = 'queued'
  returning * into v_job;

  if not found or v_job.provider_response_id is null then
    raise exception using errcode = '55000', message = 'AI_JOB_LEASE_NOT_OWNED';
  end if;

  return v_job;
end;
$$;

create or replace function public.claim_ai_job_by_response(
  p_provider_response_id text,
  p_lease_seconds integer default 120
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ai_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'INVALID_LEASE_SECONDS';
  end if;

  update public.ai_jobs
  set
    status = 'in_progress',
    lease_token = gen_random_uuid(),
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    claimed_at = now(),
    updated_at = now()
  where provider = 'openai'
    and provider_response_id = p_provider_response_id
    and status in ('submitted', 'in_progress')
    and (lease_expires_at is null or lease_expires_at <= now())
  returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.reconcile_ai_jobs(
  p_stale_before timestamp with time zone,
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns setof public.ai_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_limit < 1 or p_limit > 100 or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'INVALID_RECONCILE_LIMIT';
  end if;

  return query
  with candidates as (
    select ai_jobs.id, ai_jobs.status
    from public.ai_jobs
    where ai_jobs.status in ('queued', 'submitted', 'in_progress')
      and (
        (ai_jobs.status = 'queued'
          and ai_jobs.provider_response_id is null
          and ai_jobs.request_payload is not null
          and ai_jobs.retry_count < ai_jobs.max_retries)
        or
        (ai_jobs.status in ('submitted', 'in_progress')
          and ai_jobs.provider_response_id is not null)
      )
      and ai_jobs.updated_at < p_stale_before
      and (ai_jobs.lease_expires_at is null or ai_jobs.lease_expires_at <= now())
    order by ai_jobs.updated_at
    for update skip locked
    limit p_limit
  )
  update public.ai_jobs
  set
    status = case
      when candidates.status = 'queued' then 'queued'
      else 'in_progress'
    end,
    retry_count = case
      when candidates.status = 'queued' then ai_jobs.retry_count + 1
      else ai_jobs.retry_count
    end,
    lease_token = gen_random_uuid(),
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    claimed_at = now(),
    updated_at = now()
  from candidates
  where ai_jobs.id = candidates.id
  returning ai_jobs.*;
end;
$$;

create or replace function public.fail_ai_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ai_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  update public.ai_jobs
  set
    status = 'failed',
    error_code = nullif(trim(p_error_code), ''),
    error_message = left(nullif(trim(p_error_message), ''), 1000),
    lease_expires_at = null,
    completed_at = null,
    updated_at = now()
  where id = p_job_id
    and lease_token = p_lease_token
    and status in ('queued', 'submitted', 'in_progress')
  returning * into v_job;

  if not found then
    raise exception using errcode = '55000', message = 'AI_JOB_LEASE_NOT_OWNED';
  end if;

  update public.attempts
  set status = 'failed', error_code = v_job.error_code
  where id = v_job.attempt_id;

  if v_job.stage = 'rescore'
    or (v_job.stage = 'repair' and v_job.prompt_version like '%:rescore')
  then
    update public.practice_sessions
    set status = 'rescore_failed', completed_at = null
    where final_attempt_id = v_job.attempt_id
      and status = 'rescoring';
  end if;

  return v_job;
end;
$$;

create or replace function public.complete_ai_job_stage(
  p_job_id uuid,
  p_lease_token uuid,
  p_output_payload jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ai_jobs%rowtype;
  v_input_tokens integer := nullif(p_metadata ->> 'input_tokens', '')::integer;
  v_output_tokens integer := nullif(p_metadata ->> 'output_tokens', '')::integer;
  v_total_tokens integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_output_payload is null or jsonb_typeof(p_output_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_AI_JOB_OUTPUT';
  end if;
  v_total_tokens := coalesce(
    nullif(p_metadata ->> 'total_tokens', '')::integer,
    case
      when v_input_tokens is not null and v_output_tokens is not null
      then v_input_tokens + v_output_tokens
      else null
    end
  );

  update public.ai_jobs
  set
    status = 'completed',
    output_payload = p_output_payload,
    input_tokens = v_input_tokens,
    output_tokens = v_output_tokens,
    total_tokens = v_total_tokens,
    latency_ms = nullif(p_metadata ->> 'latency_ms', '')::integer,
    lease_expires_at = null,
    completed_at = now(),
    updated_at = now()
  where id = p_job_id
    and lease_token = p_lease_token
    and status in ('submitted', 'in_progress')
  returning * into v_job;

  if not found then
    raise exception using errcode = '55000', message = 'AI_JOB_LEASE_NOT_OWNED';
  end if;

  return v_job;
end;
$$;

-- Atomically close one Provider stage and persist the next queued intent. No
-- Provider request is allowed before this transaction returns the leased next
-- job, so a crash can only leave recoverable queued work.
create or replace function public.complete_ai_job_stage_and_enqueue(
  p_job_id uuid,
  p_lease_token uuid,
  p_output_payload jsonb,
  p_metadata jsonb,
  p_next_stage text,
  p_next_model text,
  p_next_prompt_version text,
  p_next_rubric_version text,
  p_next_request_payload jsonb,
  p_lease_seconds integer default 120
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current public.ai_jobs%rowtype;
  v_next public.ai_jobs%rowtype;
  v_next_id uuid := gen_random_uuid();
  v_input_tokens integer := nullif(p_metadata ->> 'input_tokens', '')::integer;
  v_output_tokens integer := nullif(p_metadata ->> 'output_tokens', '')::integer;
  v_total_tokens integer;
  v_attempt_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_output_payload is null or jsonb_typeof(p_output_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_AI_JOB_OUTPUT';
  end if;
  if p_next_request_payload is null
    or jsonb_typeof(p_next_request_payload) <> 'object'
  then
    raise exception using errcode = '22023', message = 'INVALID_AI_JOB_REQUEST';
  end if;
  if p_next_stage not in ('analysis', 'coaching', 'repair', 'rescore') then
    raise exception using errcode = '22023', message = 'INVALID_AI_JOB_STAGE';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'INVALID_LEASE_SECONDS';
  end if;

  v_total_tokens := coalesce(
    nullif(p_metadata ->> 'total_tokens', '')::integer,
    case
      when v_input_tokens is not null and v_output_tokens is not null
      then v_input_tokens + v_output_tokens
      else null
    end
  );

  update public.ai_jobs
  set
    status = 'completed',
    output_payload = p_output_payload,
    input_tokens = v_input_tokens,
    output_tokens = v_output_tokens,
    total_tokens = v_total_tokens,
    latency_ms = nullif(p_metadata ->> 'latency_ms', '')::integer,
    lease_expires_at = null,
    completed_at = now(),
    updated_at = now()
  where id = p_job_id
    and lease_token = p_lease_token
    and status in ('submitted', 'in_progress')
  returning * into v_current;

  if not found then
    raise exception using errcode = '55000', message = 'AI_JOB_LEASE_NOT_OWNED';
  end if;

  insert into public.ai_jobs (
    id,
    user_id,
    attempt_id,
    stage,
    status,
    provider_idempotency_key,
    request_payload,
    model,
    prompt_version,
    rubric_version,
    lease_token,
    lease_expires_at,
    claimed_at
  ) values (
    v_next_id,
    v_current.user_id,
    v_current.attempt_id,
    p_next_stage,
    'queued',
    'stg-ai-job-' || v_next_id::text,
    p_next_request_payload,
    p_next_model,
    p_next_prompt_version,
    p_next_rubric_version,
    gen_random_uuid(),
    now() + make_interval(secs => p_lease_seconds),
    now()
  )
  returning * into v_next;

  v_attempt_status := case p_next_stage
    when 'analysis' then 'analyzing'
    when 'coaching' then 'coaching'
    when 'rescore' then 'rescoring'
    else null
  end;
  if v_attempt_status is not null then
    update public.attempts
    set status = v_attempt_status
    where id = v_current.attempt_id;
  end if;

  return v_next;
end;
$$;

create or replace function public.get_completed_ai_job_output(
  p_attempt_id uuid,
  p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_output jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  select output_payload into v_output
  from public.ai_jobs
  where attempt_id = p_attempt_id
    and stage = p_stage
    and status = 'completed'
    and output_payload is not null
  order by completed_at desc
  limit 1;

  return v_output;
end;
$$;

create or replace function public.complete_ai_attempt(
  p_attempt_id uuid,
  p_score jsonb,
  p_feedback jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_job_id uuid default null,
  p_lease_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_job public.ai_jobs%rowtype;
  v_session public.practice_sessions%rowtype;
  v_job_id uuid;
  v_input_tokens integer;
  v_output_tokens integer;
  v_total_tokens integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_attempt
  from public.attempts
  where attempts.id = p_attempt_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ATTEMPT_NOT_FOUND';
  end if;

  if p_job_id is not null then
    select * into v_job
    from public.ai_jobs
    where ai_jobs.id = p_job_id
      and ai_jobs.attempt_id = p_attempt_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'AI_JOB_NOT_FOUND';
    end if;

    if v_job.status = 'completed' and v_attempt.status = 'completed' then
      select * into v_session
      from public.practice_sessions
      where initial_attempt_id = p_attempt_id
        or final_attempt_id = p_attempt_id
      order by created_at
      limit 1;

      return jsonb_build_object(
        'outcome', 'replayed',
        'attempt_id', p_attempt_id,
        'job_id', v_job.id,
        'session_id', v_session.id
      );
    end if;

    if v_job.lease_token is distinct from p_lease_token
      or v_job.status not in ('queued', 'submitted', 'in_progress')
    then
      raise exception using errcode = '55000', message = 'AI_JOB_LEASE_NOT_OWNED';
    end if;

    v_job_id := v_job.id;
  end if;

  insert into public.scores (
    attempt_id,
    answer_relevance,
    core_message,
    structure,
    evidence,
    interview_impact,
    total_score,
    rubric_evidence
  ) values (
    p_attempt_id,
    (p_score ->> 'answer_relevance')::integer,
    (p_score ->> 'core_message')::integer,
    (p_score ->> 'structure')::integer,
    (p_score ->> 'evidence')::integer,
    (p_score ->> 'interview_impact')::integer,
    (p_score ->> 'total_score')::integer,
    p_score -> 'rubric_evidence'
  )
  on conflict (attempt_id) do update set
    answer_relevance = excluded.answer_relevance,
    core_message = excluded.core_message,
    structure = excluded.structure,
    evidence = excluded.evidence,
    interview_impact = excluded.interview_impact,
    total_score = excluded.total_score,
    rubric_evidence = excluded.rubric_evidence;

  insert into public.ai_feedback (
    attempt_id,
    question_analysis,
    observable_features,
    diagnosis,
    rewrite,
    why_better,
    growth_suggestion,
    safety_flags
  ) values (
    p_attempt_id,
    p_feedback -> 'question_analysis',
    p_feedback -> 'observable_features',
    p_feedback -> 'diagnosis',
    p_feedback -> 'rewrite',
    p_feedback -> 'why_better',
    p_feedback -> 'growth_suggestion',
    coalesce(p_feedback -> 'safety_flags', '[]'::jsonb)
  )
  on conflict (attempt_id) do update set
    question_analysis = excluded.question_analysis,
    observable_features = excluded.observable_features,
    diagnosis = excluded.diagnosis,
    rewrite = excluded.rewrite,
    why_better = excluded.why_better,
    growth_suggestion = excluded.growth_suggestion,
    safety_flags = excluded.safety_flags;

  update public.attempts
  set
    status = 'completed',
    analysis_prompt_version = coalesce(p_metadata ->> 'analysis_prompt_version', analysis_prompt_version),
    coaching_prompt_version = coalesce(p_metadata ->> 'coaching_prompt_version', coaching_prompt_version),
    ai_model = coalesce(p_metadata ->> 'ai_model', ai_model),
    rubric_version = coalesce(p_metadata ->> 'rubric_version', rubric_version),
    repair_count = coalesce((p_metadata ->> 'repair_count')::integer, repair_count),
    error_code = null,
    analysis_latency_ms = coalesce((p_metadata ->> 'analysis_latency_ms')::integer, analysis_latency_ms),
    coaching_latency_ms = coalesce((p_metadata ->> 'coaching_latency_ms')::integer, coaching_latency_ms),
    total_latency_ms = coalesce((p_metadata ->> 'total_latency_ms')::integer, total_latency_ms)
  where id = p_attempt_id;

  v_input_tokens := nullif(p_metadata ->> 'input_tokens', '')::integer;
  v_output_tokens := nullif(p_metadata ->> 'output_tokens', '')::integer;
  v_total_tokens := coalesce(
    nullif(p_metadata ->> 'total_tokens', '')::integer,
    case
      when v_input_tokens is not null and v_output_tokens is not null
      then v_input_tokens + v_output_tokens
      else null
    end
  );

  if v_job_id is null then
    insert into public.ai_jobs (
      attempt_id,
      user_id,
      stage,
      status,
      provider_response_id,
      model,
      prompt_version,
      rubric_version,
      input_tokens,
      output_tokens,
      total_tokens,
      latency_ms,
      completed_at
    ) values (
      p_attempt_id,
      v_attempt.user_id,
      coalesce(nullif(p_metadata ->> 'job_stage', ''), 'coaching'),
      'completed',
      nullif(p_metadata ->> 'provider_response_id', ''),
      coalesce(nullif(p_metadata ->> 'ai_model', ''), 'unknown'),
      coalesce(
        nullif(
          case
            when p_metadata ->> 'job_stage' = 'rescore'
            then p_metadata ->> 'analysis_prompt_version'
            else p_metadata ->> 'coaching_prompt_version'
          end,
          ''
        ),
        'unknown'
      ),
      coalesce(nullif(p_metadata ->> 'rubric_version', ''), 'stg-rubric-v1'),
      v_input_tokens,
      v_output_tokens,
      v_total_tokens,
      nullif(p_metadata ->> 'total_latency_ms', '')::integer,
      now()
    )
    returning id into v_job_id;
  else
    update public.ai_jobs
    set
      status = 'completed',
      output_payload = coalesce(p_metadata -> 'job_output', output_payload),
      input_tokens = v_input_tokens,
      output_tokens = v_output_tokens,
      total_tokens = v_total_tokens,
      latency_ms = nullif(p_metadata ->> 'total_latency_ms', '')::integer,
      lease_expires_at = null,
      completed_at = now(),
      updated_at = now()
    where id = v_job_id;
  end if;

  select * into v_session
  from public.practice_sessions
  where initial_attempt_id = p_attempt_id
    or final_attempt_id = p_attempt_id
  order by created_at
  limit 1
  for update;

  -- Initial Analysis -> Coaching completion creates the human-in-the-loop
  -- session in the same transaction as Score/Feedback. Rescore attempts already
  -- point to an existing session through final_attempt_id and must never create
  -- a second session.
  if not found
    and coalesce(nullif(p_metadata ->> 'job_stage', ''), 'coaching') <> 'rescore'
  then
    insert into public.practice_sessions (
      user_id,
      initial_attempt_id,
      final_attempt_id,
      idempotency_key,
      practice_day,
      feedback_mode,
      feedback_shown_at,
      status,
      completed_at
    ) values (
      v_attempt.user_id,
      p_attempt_id,
      null,
      'ai-attempt:' || p_attempt_id::text,
      v_attempt.practice_day,
      'D',
      null,
      'feedback_ready',
      null
    )
    on conflict (initial_attempt_id) do update
      set initial_attempt_id = excluded.initial_attempt_id
    returning * into v_session;
  end if;

  if p_job_id is not null
    and (
      v_job.stage = 'rescore'
      or p_metadata ->> 'job_stage' = 'rescore'
      or (v_job.stage = 'repair' and v_job.prompt_version like '%:rescore')
    )
  then
    update public.practice_sessions
    set status = 'completed', completed_at = now()
    where final_attempt_id = p_attempt_id
      and status = 'rescoring'
    returning * into v_session;
  end if;

  return jsonb_build_object(
    'outcome', 'completed',
    'attempt_id', p_attempt_id,
    'job_id', v_job_id,
    'session_id', v_session.id
  );
end;
$$;

revoke execute on function public.claim_ai_job(uuid, text, text, text, jsonb, text, integer) from public, anon, authenticated;
revoke execute on function public.attach_ai_job_response(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_ai_job_by_response(text, integer) from public, anon, authenticated;
revoke execute on function public.reconcile_ai_jobs(timestamp with time zone, integer, integer) from public, anon, authenticated;
revoke execute on function public.fail_ai_job(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.complete_ai_job_stage(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.complete_ai_job_stage_and_enqueue(uuid, uuid, jsonb, jsonb, text, text, text, text, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.get_completed_ai_job_output(uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_ai_attempt(uuid, jsonb, jsonb, jsonb, uuid, uuid) from public, anon, authenticated;

grant execute on function public.claim_ai_job(uuid, text, text, text, jsonb, text, integer) to service_role;
grant execute on function public.attach_ai_job_response(uuid, uuid, text) to service_role;
grant execute on function public.claim_ai_job_by_response(text, integer) to service_role;
grant execute on function public.reconcile_ai_jobs(timestamp with time zone, integer, integer) to service_role;
grant execute on function public.fail_ai_job(uuid, uuid, text, text) to service_role;
grant execute on function public.complete_ai_job_stage(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.complete_ai_job_stage_and_enqueue(uuid, uuid, jsonb, jsonb, text, text, text, text, jsonb, integer) to service_role;
grant execute on function public.get_completed_ai_job_output(uuid, text) to service_role;
grant execute on function public.complete_ai_attempt(uuid, jsonb, jsonb, jsonb, uuid, uuid) to service_role;

-- Profile writes are intentionally exposed only through an ownership-checked RPC.
create or replace function public.upsert_user_profile(
  p_target_role text,
  p_interview_type text,
  p_training_goal text,
  p_preferred_answer_language text,
  p_consent_to_anonymized_evals boolean
)
returns public.user_profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.user_profiles%rowtype;
  v_user_id uuid;
  v_target_role text := trim(p_target_role);
  v_interview_type text := trim(p_interview_type);
  v_training_goal text := trim(p_training_goal);
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  if v_target_role is null or length(v_target_role) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'INVALID_TARGET_ROLE';
  end if;
  if v_interview_type is null or length(v_interview_type) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'INVALID_INTERVIEW_TYPE';
  end if;
  if v_training_goal is null or length(v_training_goal) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'INVALID_TRAINING_GOAL';
  end if;
  if p_preferred_answer_language not in ('zh', 'en') then
    raise exception using errcode = '22023', message = 'INVALID_ANSWER_LANGUAGE';
  end if;

  insert into public.user_profiles (
    user_id,
    target_role,
    interview_type,
    training_goal,
    preferred_answer_language,
    consent_to_anonymized_evals,
    onboarding_completed_at,
    updated_at
  ) values (
    v_user_id,
    v_target_role,
    v_interview_type,
    v_training_goal,
    p_preferred_answer_language,
    coalesce(p_consent_to_anonymized_evals, false),
    now(),
    now()
  )
  on conflict (user_id) do update set
    target_role = excluded.target_role,
    interview_type = excluded.interview_type,
    training_goal = excluded.training_goal,
    preferred_answer_language = excluded.preferred_answer_language,
    consent_to_anonymized_evals = excluded.consent_to_anonymized_evals,
    onboarding_completed_at = coalesce(
      public.user_profiles.onboarding_completed_at,
      excluded.onboarding_completed_at
    ),
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke execute on function public.upsert_user_profile(text, text, text, text, boolean)
  from public, anon;
grant execute on function public.upsert_user_profile(text, text, text, text, boolean)
  to authenticated;

-- feedback_shown_at is a server observation, not a client-supplied creation time.
drop policy if exists "Users can create own practice sessions"
  on public.practice_sessions;
create policy "Users can create own practice sessions"
  on public.practice_sessions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and feedback_mode = 'D'
    and feedback_shown_at is null
    and status = 'feedback_ready'
    and final_attempt_id is null
    and exists (
      select 1
      from public.attempts
      where attempts.id = initial_attempt_id
        and attempts.user_id = auth.uid()
        and attempts.status = 'completed'
        and attempts.practice_day = practice_day
    )
    and exists (
      select 1 from public.scores where scores.attempt_id = initial_attempt_id
    )
    and exists (
      select 1 from public.ai_feedback where ai_feedback.attempt_id = initial_attempt_id
    )
  );

create or replace function public.mark_training_session_feedback_viewed(
  p_session_id uuid
)
returns timestamp with time zone
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_feedback_shown_at timestamp with time zone;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  update public.practice_sessions
  set feedback_shown_at = coalesce(feedback_shown_at, now())
  where id = p_session_id
    and user_id = auth.uid()
  returning feedback_shown_at into v_feedback_shown_at;

  if not found then
    raise exception using errcode = '42501', message = 'SESSION_NOT_FOUND_OR_FORBIDDEN';
  end if;

  return v_feedback_shown_at;
end;
$$;

revoke execute on function public.mark_training_session_feedback_viewed(uuid)
  from public, anon;
grant execute on function public.mark_training_session_feedback_viewed(uuid)
  to authenticated;

-- Preserve the existing accepted/edited implementation under an internal name and
-- replace the public entry point so rejection completes without an unnecessary AI
-- call or duplicate attempt.
alter function public.commit_revision_event(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) rename to commit_revision_event_with_rescore;

revoke execute on function public.commit_revision_event_with_rescore(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) from public, anon, authenticated;

create or replace function public.commit_revision_event(
  p_session_id uuid,
  p_idempotency_key text,
  p_action text,
  p_edited_text text,
  p_client_decided_at timestamp with time zone
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.practice_sessions%rowtype;
  v_existing_revision public.revision_events%rowtype;
  v_initial_attempt public.attempts%rowtype;
  v_revision public.revision_events%rowtype;
  v_outcome jsonb;
  v_normalized_key text := trim(p_idempotency_key);
begin
  if p_action <> 'rejected' then
    v_outcome := public.commit_revision_event_with_rescore(
      p_session_id,
      p_idempotency_key,
      p_action,
      p_edited_text,
      p_client_decided_at
    );

    -- Pin every accepted/edited final Attempt to the initial scoring context.
    -- The outer RPC and the legacy implementation share one transaction, so a
    -- rescore worker can never observe a final Attempt with newer model/prompt
    -- versions after a deployment changes defaults.
    if nullif(v_outcome ->> 'final_attempt_id', '') is not null then
      update public.attempts as final_attempt
      set
        analysis_prompt_version = initial_attempt.analysis_prompt_version,
        coaching_prompt_version = initial_attempt.coaching_prompt_version,
        ai_model = initial_attempt.ai_model,
        rubric_version = initial_attempt.rubric_version
      from public.practice_sessions as session
      join public.attempts as initial_attempt
        on initial_attempt.id = session.initial_attempt_id
      where session.id = p_session_id
        and session.user_id = auth.uid()
        and final_attempt.id = (v_outcome ->> 'final_attempt_id')::uuid;
    end if;

    return v_outcome;
  end if;

  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;
  if v_normalized_key is null or length(v_normalized_key) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_edited_text is not null then
    raise exception using errcode = '22023', message = 'EDITED_TEXT_NOT_ALLOWED';
  end if;

  select * into v_session
  from public.practice_sessions
  where practice_sessions.id = p_session_id
    and practice_sessions.user_id = auth.uid()
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'session_id', p_session_id);
  end if;

  select * into v_existing_revision
  from public.revision_events
  where revision_events.session_id = p_session_id;

  if found then
    if v_existing_revision.idempotency_key = v_normalized_key
      and v_existing_revision.action = 'rejected'
    then
      return jsonb_build_object(
        'outcome', 'replayed',
        'session_id', p_session_id,
        'revision_event_id', v_existing_revision.id,
        'final_attempt_id', v_session.final_attempt_id,
        'status', v_session.status
      );
    end if;

    return jsonb_build_object(
      'outcome', 'conflict',
      'session_id', p_session_id,
      'revision_event_id', v_existing_revision.id,
      'final_attempt_id', v_session.final_attempt_id
    );
  end if;

  if v_session.status <> 'feedback_ready' then
    return jsonb_build_object(
      'outcome', 'conflict',
      'session_id', p_session_id,
      'status', v_session.status
    );
  end if;

  select * into v_initial_attempt
  from public.attempts
  where attempts.id = v_session.initial_attempt_id
    and attempts.user_id = auth.uid()
    and attempts.status = 'completed'
  for update;

  if not found then
    raise exception using errcode = '23514', message = 'INITIAL_ATTEMPT_NOT_READY';
  end if;

  insert into public.revision_events (
    session_id,
    idempotency_key,
    action,
    edited_text,
    client_decided_at
  ) values (
    p_session_id,
    v_normalized_key,
    'rejected',
    null,
    p_client_decided_at
  )
  returning * into v_revision;

  update public.practice_sessions
  set
    final_attempt_id = initial_attempt_id,
    status = 'completed',
    completed_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'outcome', 'committed',
    'session_id', p_session_id,
    'revision_event_id', v_revision.id,
    'final_attempt_id', v_initial_attempt.id,
    'status', 'completed'
  );
end;
$$;

revoke execute on function public.commit_revision_event(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) from public, anon;

grant execute on function public.commit_revision_event(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) to authenticated;

-- Product funnel events are authoritative server telemetry. Remove the earlier
-- authenticated-user overload so browsers cannot forge events or metadata.
drop function if exists public.record_product_event(text, uuid, uuid, jsonb, text);

create or replace function public.record_product_event(
  p_user_id uuid,
  p_event_name text,
  p_session_id uuid default null,
  p_attempt_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_request_id text default null
)
returns public.product_events
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.product_events%rowtype;
  v_user_id uuid := p_user_id;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  if v_user_id is null then
    raise exception using errcode = '22023', message = 'USER_ID_REQUIRED';
  end if;
  if p_event_name not in (
    'onboarding_completed',
    'draft_submitted',
    'feedback_viewed',
    'revision_committed',
    'session_completed',
    'day_completed'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_EVENT';
  end if;
  if p_event_name = 'draft_submitted' and p_attempt_id is null then
    raise exception using errcode = '22023', message = 'ATTEMPT_ID_REQUIRED';
  end if;
  if p_event_name in (
    'feedback_viewed',
    'revision_committed',
    'session_completed',
    'day_completed'
  ) and p_session_id is null then
    raise exception using errcode = '22023', message = 'SESSION_ID_REQUIRED';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object'
    or octet_length(p_metadata::text) > 4096
  then
    raise exception using errcode = '22023', message = 'INVALID_EVENT_METADATA';
  end if;
  if p_metadata ?| array['answer', 'answer_text', 'original_answer', 'final_answer', 'rewrite', 'text'] then
    raise exception using errcode = '22023', message = 'EVENT_METADATA_CONTAINS_PII';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.practice_sessions
    where practice_sessions.id = p_session_id
      and practice_sessions.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'SESSION_NOT_FOUND_OR_FORBIDDEN';
  end if;
  if p_attempt_id is not null and not exists (
    select 1 from public.attempts
    where attempts.id = p_attempt_id
      and attempts.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'ATTEMPT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  insert into public.product_events (
    user_id,
    event_name,
    session_id,
    attempt_id,
    metadata,
    request_id
  ) values (
    v_user_id,
    p_event_name,
    p_session_id,
    p_attempt_id,
    p_metadata,
    nullif(trim(p_request_id), '')
  )
  on conflict do nothing
  returning * into v_event;

  if v_event.id is null then
    if p_event_name = 'onboarding_completed' then
      select * into v_event
      from public.product_events
      where product_events.user_id = v_user_id
        and product_events.event_name = p_event_name
      limit 1;
    elsif p_event_name = 'draft_submitted' then
      select * into v_event
      from public.product_events
      where product_events.user_id = v_user_id
        and product_events.event_name = p_event_name
        and product_events.attempt_id = p_attempt_id
      limit 1;
    else
      select * into v_event
      from public.product_events
      where product_events.user_id = v_user_id
        and product_events.event_name = p_event_name
        and product_events.session_id = p_session_id
      limit 1;
    end if;
  end if;

  if v_event.id is null then
    raise exception using errcode = 'P0002', message = 'PRODUCT_EVENT_NOT_FOUND';
  end if;

  return v_event;
end;
$$;

revoke execute on function public.record_product_event(uuid, text, uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_product_event(uuid, text, uuid, uuid, jsonb, text)
  to service_role;

drop function if exists public.consume_ai_quota();

create or replace function public.consume_ai_quota(
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_used bigint;
  v_limit integer := 3;
  v_key text := nullif(trim(p_idempotency_key), '');
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;
  if v_key is null or length(v_key) > 200 then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_KEY';
  end if;

  insert into public.usage_counters (
    user_id,
    usage_date,
    metric,
    quantity,
    idempotency_keys
  )
  values (v_user_id, current_date, 'ai_session', 1, array[v_key])
  on conflict (user_id, usage_date, metric) do update set
    quantity = case
      when v_key = any(public.usage_counters.idempotency_keys)
        then public.usage_counters.quantity
      else public.usage_counters.quantity + 1
    end,
    idempotency_keys = case
      when v_key = any(public.usage_counters.idempotency_keys)
        then public.usage_counters.idempotency_keys
      else array_append(public.usage_counters.idempotency_keys, v_key)
    end,
    updated_at = now()
  where v_key = any(public.usage_counters.idempotency_keys)
     or public.usage_counters.quantity < v_limit
  returning quantity into v_used;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'used', v_used,
      'remaining', greatest(v_limit - v_used, 0),
      'limit', v_limit,
      'resets_on', (current_date + 1)::text
    );
  end if;

  select quantity into v_used
  from public.usage_counters
  where user_id = v_user_id
    and usage_date = current_date
    and metric = 'ai_session';

  return jsonb_build_object(
    'allowed', false,
    'used', coalesce(v_used, v_limit),
    'remaining', 0,
    'limit', v_limit,
    'resets_on', (current_date + 1)::text
  );
end;
$$;

revoke execute on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

-- Convert the Phase B ownership graph from RESTRICT to CASCADE so account-data
-- deletion can be completed in one transaction without orphaning revisions.
alter table public.practice_sessions
  drop constraint if exists practice_sessions_user_id_fkey,
  drop constraint if exists practice_sessions_initial_attempt_id_fkey,
  drop constraint if exists practice_sessions_final_attempt_id_fkey;

alter table public.practice_sessions
  add constraint practice_sessions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint practice_sessions_initial_attempt_id_fkey
    foreign key (initial_attempt_id) references public.attempts(id) on delete cascade,
  add constraint practice_sessions_final_attempt_id_fkey
    foreign key (final_attempt_id) references public.attempts(id) on delete cascade;

alter table public.revision_events
  drop constraint if exists revision_events_session_id_fkey;

alter table public.revision_events
  add constraint revision_events_session_id_fkey
    foreign key (session_id) references public.practice_sessions(id) on delete cascade;

create or replace function public.delete_my_training_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sessions integer := 0;
  v_attempts integer := 0;
  v_events integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'UNAUTHENTICATED';
  end if;

  delete from public.product_events where user_id = v_user_id;
  get diagnostics v_events = row_count;

  delete from public.practice_sessions where user_id = v_user_id;
  get diagnostics v_sessions = row_count;

  delete from public.attempts where user_id = v_user_id;
  get diagnostics v_attempts = row_count;

  delete from public.usage_counters where user_id = v_user_id;
  delete from public.growth_profiles where user_id = v_user_id;
  delete from public.user_profiles where user_id = v_user_id;

  return jsonb_build_object(
    'deleted', true,
    'sessions', v_sessions,
    'attempts', v_attempts,
    'events', v_events
  );
end;
$$;

revoke execute on function public.delete_my_training_data() from public, anon;
grant execute on function public.delete_my_training_data() to authenticated;
