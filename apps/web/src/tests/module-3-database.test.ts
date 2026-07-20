import { readFileSync } from "node:fs";
import { join } from "node:path";

const databaseDir = join(process.cwd(), "src", "database");
const migrationPath = join(
  databaseDir,
  "migrations",
  "202606180001_create_training_core.sql"
);
const attemptIdempotencyMigrationPath = join(
  databaseDir,
  "migrations",
  "202606190001_add_attempt_idempotency.sql"
);
const mockResultMigrationPath = join(
  databaseDir,
  "migrations",
  "202606190002_create_mock_result_tables.sql"
);
const realAiPipelineMigrationPath = join(
  databaseDir,
  "migrations",
  "202606190003_add_real_ai_pipeline_metadata.sql"
);
const seedPath = join(databaseDir, "seed", "questions.v1.sql");

function readSql(path: string) {
  return readFileSync(path, "utf8").replace(/\s+/g, " ").toLowerCase();
}

describe("Module 3 database layer", () => {
  it("defines the questions table required for the fixed 7-day path", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain("create table if not exists public.questions");
    for (const column of [
      "id uuid primary key",
      "day_number integer not null",
      "title text not null",
      "scenario text not null",
      "prompt text not null",
      "learning_goal text not null",
      "expected_structure text not null",
      "evaluation_focus text not null",
      "knowledge_card jsonb not null default '{}'::jsonb",
      "is_active boolean not null default true",
      "created_at timestamp with time zone not null default now()",
      "updated_at timestamp with time zone not null default now()"
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("check (day_number between 1 and 7)");
    expect(sql).toContain("questions_active_day_unique");
  });

  it("defines attempts and growth_profiles with user-owned relationships", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain("create table if not exists public.attempts");
    expect(sql).toContain("user_id uuid not null references auth.users(id)");
    expect(sql).toContain("question_id uuid not null references public.questions(id)");
    expect(sql).toContain("original_answer text not null");
    expect(sql).toContain("idempotency_key text not null");
    expect(sql).toContain("client_started_at timestamp with time zone");
    expect(sql).toContain("status text not null default 'submitted'");
    expect(sql).toContain("mock_result_generating");
    expect(sql).toContain("attempts_user_idempotency_key_unique");

    expect(sql).toContain("create table if not exists public.scores");
    for (const column of [
      "attempt_id uuid primary key references public.attempts(id)",
      "answer_relevance integer not null",
      "core_message integer not null",
      "structure integer not null",
      "evidence integer not null",
      "interview_impact integer not null",
      "total_score integer not null",
      "scores_total_matches_dimensions"
    ]) {
      expect(sql).toContain(column);
    }

    expect(sql).toContain("create table if not exists public.ai_feedback");
    for (const column of [
      "diagnosis jsonb not null",
      "rewrite jsonb not null",
      "why_better jsonb not null",
      "growth_suggestion jsonb not null"
    ]) {
      expect(sql).toContain(column);
    }

    expect(sql).toContain("create table if not exists public.growth_profiles");
    expect(sql).toContain("user_id uuid primary key references auth.users(id)");
    for (const column of [
      "level_1_score integer not null default 0",
      "level_2_score integer not null default 0",
      "level_3_score integer not null default 0",
      "level_4_score integer not null default 0",
      "current_day integer not null default 1",
      "updated_at timestamp with time zone not null default now()"
    ]) {
      expect(sql).toContain(column);
    }
  });

  it("includes an incremental migration for attempt idempotency", () => {
    const sql = readSql(attemptIdempotencyMigrationPath);

    expect(sql).toContain("add column if not exists idempotency_key text");
    expect(sql).toContain("alter column idempotency_key set not null");
    expect(sql).toContain("add column if not exists client_started_at");
    expect(sql).toContain("attempts_user_idempotency_key_unique");
  });

  it("includes an incremental migration for mock result persistence", () => {
    const sql = readSql(mockResultMigrationPath);

    expect(sql).toContain("mock_result_generating");
    expect(sql).toContain("create table if not exists public.scores");
    expect(sql).toContain("create table if not exists public.ai_feedback");
    expect(sql).toContain("scores_total_matches_dimensions");
    expect(sql).toContain("users can update own attempts");
    expect(sql).toContain("users can read own scores");
    expect(sql).toContain("users can create own ai feedback");
  });

  it("includes an incremental migration for real AI pipeline metadata", () => {
    const sql = readSql(realAiPipelineMigrationPath);

    for (const column of [
      "analysis_prompt_version text",
      "coaching_prompt_version text",
      "ai_model text",
      "repair_count integer not null default 0",
      "error_code text",
      "analysis_latency_ms integer",
      "coaching_latency_ms integer",
      "total_latency_ms integer"
    ]) {
      expect(sql).toContain(column);
    }

    expect(sql).toContain("analysis_running");
    expect(sql).toContain("coaching_running");
    expect(sql).toContain("rubric_evidence jsonb");
    expect(sql).toContain("structure between 0 and 25");
    expect(sql).toContain("interview_impact between 0 and 15");
    expect(sql).toContain("question_analysis jsonb");
    expect(sql).toContain("observable_features jsonb");
    expect(sql).toContain("safety_flags jsonb");
    expect(sql).toContain("attempts_user_status_idx");
  });

  it("seeds exactly the fixed seven training questions", () => {
    const seed = readSql(seedPath);
    const migration = readSql(migrationPath);

    expect(seed).toContain("insert into public.questions");
    expect(migration).toContain("insert into public.questions");
    expect(seed).toContain(
      "on conflict (content_key) where content_key is not null"
    );
    expect(seed).toContain("insert into public.curriculum_items");
    expect(migration).toContain("on conflict (day_number)");

    for (const [day, title] of [
      [1, "结论先行"],
      [2, "分类表达"],
      [3, "完整案例"],
      [4, "事实证据"],
      [5, "冲突处理"],
      [6, "向上沟通"],
      [7, "最终自我推荐"]
    ] as const) {
      expect(seed).toMatch(
        new RegExp(`'stg-7day-v1-day-${day}',\\s*${day},\\s*'${title}'`)
      );
    }

    // The original migration is immutable; the seed and the dedicated
    // localization migration update existing databases to Chinese titles.
    expect(migration).toMatch(/\(\s*1,\s*'conclusion first'/);

    for (const value of [
      "你为什么想做数据分析这份工作？",
      "如果让你用三个理由说明自己适合这个岗位，你会怎么回答？",
      "请讲一次你解决困难问题的经历。",
      "你最大的优势是什么？请用一个真实经历证明。",
      "请讲讲这种情况下你会怎么和业务方沟通。",
      "如果领导突然这样问你，你会如何回答？",
      "请用三分钟完成你的最终自我推荐。",
      "别让面试官猜答案",
      "最后一题是在帮面试官做决定"
    ]) {
      expect(seed).toContain(value.toLowerCase());
      expect(migration).toContain(value.toLowerCase());
    }
  });
});
