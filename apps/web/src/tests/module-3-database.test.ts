import { readFileSync } from "node:fs";
import { join } from "node:path";

const databaseDir = join(process.cwd(), "src", "database");
const migrationPath = join(
  databaseDir,
  "migrations",
  "202606180001_create_training_core.sql"
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
    expect(sql).toContain("status text not null default 'submitted'");

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

  it("seeds exactly the fixed seven training questions", () => {
    const seed = readSql(seedPath);
    const migration = readSql(migrationPath);

    expect(seed).toContain("insert into public.questions");
    expect(migration).toContain("insert into public.questions");
    expect(seed).toContain("on conflict (day_number)");
    expect(migration).toContain("on conflict (day_number)");

    for (const [day, title] of [
      [1, "conclusion first"],
      [2, "categorization"],
      [3, "star"],
      [4, "evidence"],
      [5, "conflict handling"],
      [6, "stakeholder communication"],
      [7, "final pitch"]
    ] as const) {
      expect(seed).toMatch(new RegExp(`\\(\\s*${day},\\s*'${title}'`));
      expect(migration).toMatch(new RegExp(`\\(\\s*${day},\\s*'${title}'`));
    }

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
