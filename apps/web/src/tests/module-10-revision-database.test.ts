import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "src",
  "database",
  "migrations",
  "202606230001_create_human_ai_revision.sql"
);

function readMigration() {
  const raw = readFileSync(migrationPath, "utf8");
  return {
    raw,
    sql: raw.replace(/\s+/g, " ").toLowerCase()
  };
}

describe("Module 10 human-AI revision migration", () => {
  it("creates exactly the two Phase B tables and their ownership constraints", () => {
    const { raw, sql } = readMigration();

    expect(
      raw.match(/create table if not exists public\./gi) ?? []
    ).toHaveLength(2);
    expect(sql).toContain("create table if not exists public.practice_sessions");
    expect(sql).toContain("create table if not exists public.revision_events");
    expect(sql).toContain("initial_attempt_id uuid not null references public.attempts(id)");
    expect(sql).toContain("final_attempt_id uuid references public.attempts(id)");
    expect(sql).toContain("feedback_mode text not null default 'd'");
    expect(sql).toContain("check (feedback_mode = 'd')");
    expect(sql).toContain("practice_sessions_initial_attempt_unique unique (initial_attempt_id)");
    expect(sql).toContain("practice_sessions_final_attempt_unique unique (final_attempt_id)");
    expect(sql).toContain("revision_events_session_unique unique (session_id)");
    expect(sql).toContain("action in ('accepted', 'rejected', 'edited')");
  });

  it("enables RLS with owned reads and controlled session creation", () => {
    const { sql } = readMigration();

    expect(sql).toContain("alter table public.practice_sessions enable row level security");
    expect(sql).toContain("alter table public.revision_events enable row level security");
    expect(sql).toContain('create policy "users can read own practice sessions"');
    expect(sql).toContain('create policy "users can create own practice sessions"');
    expect(sql).toContain('create policy "users can read own revision events"');
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("attempts.user_id = auth.uid()");
    expect(sql).toContain("attempts.status = 'completed'");
    expect(sql).toContain("questions.day_number = practice_day");
    expect(sql).not.toContain("on public.revision_events for insert");
    expect(sql).not.toContain("on public.revision_events for update");
    expect(sql).not.toContain("on public.revision_events for delete");
  });

  it("defines transaction-safe revision functions with locked ownership checks", () => {
    const { sql } = readMigration();

    expect(sql).toContain("create or replace function public.commit_revision_event(");
    expect(sql).toContain("create or replace function public.set_revision_rescore_outcome(");
    expect(sql.match(/security definer/g) ?? []).toHaveLength(2);
    expect(sql.match(/set search_path = pg_catalog, public/g) ?? []).toHaveLength(2);
    expect(sql.match(/auth\.uid\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(sql.match(/for update/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("practice_sessions.user_id = auth.uid()");
    expect(sql).toContain("revoke execute on function public.commit_revision_event");
    expect(sql).toContain("revoke execute on function public.set_revision_rescore_outcome");
    expect(sql).toContain("grant execute on function public.commit_revision_event");
    expect(sql).toContain("grant execute on function public.set_revision_rescore_outcome");
    expect(sql.match(/to authenticated/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("commits one decision and returns typed replay, conflict, and retry outcomes", () => {
    const { sql } = readMigration();

    expect(sql).toContain("'outcome', 'committed'");
    expect(sql).toContain("'outcome', 'replayed'");
    expect(sql).toContain("'outcome', 'conflict'");
    expect(sql).toContain("'outcome', 'retry_claimed'");
    expect(sql).toContain("select * into v_existing_revision");
    expect(sql).toContain("insert into public.revision_events");
    expect(sql).toContain("insert into public.attempts");
    expect(sql).toContain("'revision:' || p_session_id::text");
    expect(sql).toContain("update public.practice_sessions set final_attempt_id");
    expect(sql).toContain("status = 'rescoring'");
  });

  it("allows only valid rescore outcomes backed by the owned final attempt", () => {
    const { sql } = readMigration();

    expect(sql).toContain("p_status not in ('completed', 'rescore_failed')");
    expect(sql).toContain("v_final_attempt.user_id <> auth.uid()");
    expect(sql).toContain("p_status = 'completed' and v_final_attempt.status <> 'completed'");
    expect(sql).toContain("p_status = 'rescore_failed' and v_final_attempt.status <> 'failed'");
    expect(sql).toContain("completed_at = case when p_status = 'completed' then now() else null end");
  });

  it("contains no destructive data operation or mutable revision policy", () => {
    const { sql } = readMigration();

    expect(sql).not.toMatch(/\bdelete from\b/);
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain('create policy "users can update own revision events"');
    expect(sql).not.toContain('create policy "users can delete own revision events"');
  });
});
