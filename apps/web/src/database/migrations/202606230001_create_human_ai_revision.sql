create extension if not exists "pgcrypto";

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  initial_attempt_id uuid not null references public.attempts(id) on delete restrict,
  final_attempt_id uuid references public.attempts(id) on delete restrict,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  practice_day integer not null check (practice_day between 1 and 7),
  feedback_mode text not null default 'D' check (feedback_mode = 'D'),
  feedback_shown_at timestamp with time zone,
  status text not null default 'feedback_ready' check (
    status in ('feedback_ready', 'rescoring', 'rescore_failed', 'completed')
  ),
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  constraint practice_sessions_initial_attempt_unique unique (initial_attempt_id),
  constraint practice_sessions_final_attempt_unique unique (final_attempt_id),
  constraint practice_sessions_user_idempotency_unique unique (
    user_id,
    idempotency_key
  ),
  constraint practice_sessions_final_attempt_state_check check (
    (status = 'feedback_ready' and final_attempt_id is null)
    or
    (status in ('rescoring', 'rescore_failed', 'completed') and final_attempt_id is not null)
  ),
  constraint practice_sessions_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or
    (status <> 'completed' and completed_at is null)
  )
);

create table if not exists public.revision_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete restrict,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  action text not null check (action in ('accepted', 'rejected', 'edited')),
  edited_text text,
  client_decided_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint revision_events_session_unique unique (session_id),
  constraint revision_events_edit_shape_check check (
    (
      action = 'edited'
      and edited_text is not null
      and length(trim(edited_text)) between 1 and 6000
    )
    or
    (action in ('accepted', 'rejected') and edited_text is null)
  )
);

create index if not exists practice_sessions_user_created_idx
  on public.practice_sessions(user_id, created_at desc);

create index if not exists practice_sessions_status_idx
  on public.practice_sessions(status);

alter table public.practice_sessions enable row level security;
alter table public.revision_events enable row level security;

drop policy if exists "Users can read own practice sessions"
  on public.practice_sessions;
create policy "Users can read own practice sessions"
  on public.practice_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own practice sessions"
  on public.practice_sessions;
create policy "Users can create own practice sessions"
  on public.practice_sessions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and feedback_mode = 'D'
    and status = 'feedback_ready'
    and final_attempt_id is null
    and exists (
      select 1
      from public.attempts
      join public.questions
        on questions.id = attempts.question_id
      where attempts.id = initial_attempt_id
        and attempts.user_id = auth.uid()
        and attempts.status = 'completed'
        and questions.day_number = practice_day
    )
    and exists (
      select 1
      from public.scores
      where scores.attempt_id = initial_attempt_id
    )
    and exists (
      select 1
      from public.ai_feedback
      where ai_feedback.attempt_id = initial_attempt_id
    )
  );

drop policy if exists "Users can read own revision events"
  on public.revision_events;
create policy "Users can read own revision events"
  on public.revision_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.practice_sessions
      where practice_sessions.id = revision_events.session_id
        and practice_sessions.user_id = auth.uid()
    )
  );

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
  v_feedback public.ai_feedback%rowtype;
  v_final_attempt public.attempts%rowtype;
  v_revision public.revision_events%rowtype;
  v_normalized_key text;
  v_normalized_edit text;
  v_suggestion_text text;
  v_final_text text;
  v_final_attempt_key text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'UNAUTHENTICATED';
  end if;

  v_normalized_key := trim(p_idempotency_key);

  if v_normalized_key is null or length(v_normalized_key) = 0 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_IDEMPOTENCY_KEY';
  end if;

  if p_action not in ('accepted', 'rejected', 'edited') then
    raise exception using
      errcode = '22023',
      message = 'INVALID_REVISION_ACTION';
  end if;

  if p_action in ('accepted', 'rejected') and p_edited_text is not null then
    raise exception using
      errcode = '22023',
      message = 'EDITED_TEXT_NOT_ALLOWED';
  end if;

  v_normalized_edit := case
    when p_edited_text is null then null
    else trim(p_edited_text)
  end;

  if p_action = 'edited' and (
    v_normalized_edit is null
    or length(v_normalized_edit) = 0
    or length(v_normalized_edit) > 6000
  ) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_EDITED_TEXT';
  end if;

  select *
  into v_session
  from public.practice_sessions
  where practice_sessions.id = p_session_id
    and practice_sessions.user_id = auth.uid()
  for update;

  if not found then
    return jsonb_build_object(
      'outcome', 'not_found',
      'session_id', p_session_id
    );
  end if;

  select *
  into v_existing_revision
  from public.revision_events
  where revision_events.session_id = p_session_id;

  if found then
    if v_existing_revision.idempotency_key = v_normalized_key
      and v_existing_revision.action = p_action
      and coalesce(trim(v_existing_revision.edited_text), '') = coalesce(v_normalized_edit, '')
    then
      if v_session.status = 'rescore_failed' then
        update public.practice_sessions
        set
          status = 'rescoring',
          completed_at = null
        where practice_sessions.id = p_session_id;

        return jsonb_build_object(
          'outcome', 'retry_claimed',
          'session_id', p_session_id,
          'revision_event_id', v_existing_revision.id,
          'final_attempt_id', v_session.final_attempt_id
        );
      end if;

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

  select *
  into v_initial_attempt
  from public.attempts
  where attempts.id = v_session.initial_attempt_id
    and attempts.user_id = auth.uid()
    and attempts.status = 'completed';

  if not found then
    raise exception using
      errcode = '23514',
      message = 'INITIAL_ATTEMPT_NOT_READY';
  end if;

  select *
  into v_feedback
  from public.ai_feedback
  where ai_feedback.attempt_id = v_session.initial_attempt_id;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'INITIAL_FEEDBACK_NOT_READY';
  end if;

  v_suggestion_text := trim(v_feedback.rewrite ->> 'text');

  if v_suggestion_text is null or length(v_suggestion_text) = 0 then
    raise exception using
      errcode = '23514',
      message = 'SUGGESTION_TEXT_NOT_AVAILABLE';
  end if;

  v_final_text := case p_action
    when 'accepted' then v_suggestion_text
    when 'rejected' then trim(v_initial_attempt.original_answer)
    when 'edited' then v_normalized_edit
  end;

  if p_action = 'edited' and (
    v_final_text = trim(v_initial_attempt.original_answer)
    or v_final_text = v_suggestion_text
  ) then
    raise exception using
      errcode = '22023',
      message = 'EDITED_TEXT_MUST_DIFFER';
  end if;

  v_final_attempt_key := 'revision:' || p_session_id::text;

  select *
  into v_final_attempt
  from public.attempts
  where attempts.user_id = auth.uid()
    and attempts.idempotency_key = v_final_attempt_key;

  if found then
    if v_final_attempt.question_id <> v_initial_attempt.question_id
      or trim(v_final_attempt.original_answer) <> v_final_text
    then
      return jsonb_build_object(
        'outcome', 'conflict',
        'session_id', p_session_id,
        'reason', 'FINAL_ATTEMPT_KEY_REUSED'
      );
    end if;
  else
    insert into public.attempts (
      user_id,
      question_id,
      original_answer,
      idempotency_key,
      client_started_at,
      status
    ) values (
      auth.uid(),
      v_initial_attempt.question_id,
      v_final_text,
      v_final_attempt_key,
      p_client_decided_at,
      'submitted'
    )
    returning * into v_final_attempt;
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
    p_action,
    case when p_action = 'edited' then v_normalized_edit else null end,
    p_client_decided_at
  )
  returning * into v_revision;

  update public.practice_sessions
  set final_attempt_id = v_final_attempt.id,
      status = 'rescoring',
      completed_at = null
  where practice_sessions.id = p_session_id;

  return jsonb_build_object(
    'outcome', 'committed',
    'session_id', p_session_id,
    'revision_event_id', v_revision.id,
    'final_attempt_id', v_final_attempt.id
  );
end;
$$;

create or replace function public.set_revision_rescore_outcome(
  p_session_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.practice_sessions%rowtype;
  v_final_attempt public.attempts%rowtype;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'UNAUTHENTICATED';
  end if;

  if p_status not in ('completed', 'rescore_failed') then
    raise exception using
      errcode = '22023',
      message = 'INVALID_RESCORE_OUTCOME';
  end if;

  select *
  into v_session
  from public.practice_sessions
  where practice_sessions.id = p_session_id
    and practice_sessions.user_id = auth.uid()
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'SESSION_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if v_session.status <> 'rescoring' or v_session.final_attempt_id is null then
    raise exception using
      errcode = '23514',
      message = 'SESSION_NOT_RESCORING';
  end if;

  select *
  into v_final_attempt
  from public.attempts
  where attempts.id = v_session.final_attempt_id
  for update;

  if not found or v_final_attempt.user_id <> auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'FINAL_ATTEMPT_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if p_status = 'completed' and v_final_attempt.status <> 'completed' then
    raise exception using
      errcode = '23514',
      message = 'FINAL_ATTEMPT_NOT_COMPLETED';
  end if;

  if p_status = 'rescore_failed' and v_final_attempt.status <> 'failed' then
    raise exception using
      errcode = '23514',
      message = 'FINAL_ATTEMPT_NOT_FAILED';
  end if;

  update public.practice_sessions
  set
    status = p_status,
    completed_at = case when p_status = 'completed' then now() else null end
  where practice_sessions.id = p_session_id;
end;
$$;

revoke execute on function public.commit_revision_event(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) from public;

revoke execute on function public.set_revision_rescore_outcome(
  uuid,
  text
) from public;

grant execute on function public.commit_revision_event(
  uuid,
  text,
  text,
  text,
  timestamp with time zone
) to authenticated;

grant execute on function public.set_revision_rescore_outcome(
  uuid,
  text
) to authenticated;
