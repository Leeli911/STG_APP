import Link from "next/link";

export default function HomePage() {
  return (
    <main className="space-y-12 py-8">
      <section className="max-w-3xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-focus">
          结构化表达训练场
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          从第一句话开始，
          <span className="text-focus">七天完成结构化工作汇报</span>
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-600">
          每天三到六分钟：先看一个知识点和正反例，再从简单选择逐步练到独立表达与毕业项目。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/training-demo"
            className="inline-flex rounded-md bg-focus px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            从第一课开始
          </Link>
          <Link
            href="/training-demo/classic"
            className="inline-flex rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800"
          >
            我有基础，先做水平检查
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          免费训练无需注册，进度保存在当前浏览器，不调用付费模型或数据库。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="训练流程">
        <FeatureCard
          index="01"
          title="先理解一个动作"
          description="用 60–90 秒微课和正反例看懂今天只练什么，不在第一步面对完整难题。"
        />
        <FeatureCard
          index="02"
          title="支架逐步减少"
          description="从选择、填空和排序进入一句话表达；失败时回到最接近的简单步骤。"
        />
        <FeatureCard
          index="03"
          title="最后独立完成"
          description="选择题不算技能达标；无提示表达、修改和未见迁移才形成课程证据。"
        />
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
        <p className="text-sm font-semibold text-focus">为什么不直接让聊天工具改写？</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-9 text-slate-950 sm:text-3xl">
          不是帮你把这一次写得更好，而是训练你下一次自己说清楚
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ComparisonCard
            title="通用聊天工具"
            items={[
              "你需要自己设计训练提示词和判断标准",
              "容易直接得到润色稿，却没有完成主动提取",
              "一次对话结束后，很难证明能否迁移到新情境"
            ]}
          />
          <ComparisonCard
            emphasized
            title="结构化表达训练场"
            items={[
              "知识讲解、正反例与练习沿同一条难度线展开",
              "每次只增加一个难度，卡住时提供对应支架",
              "最终仍需独立表达和迁移，不把选择正确当成已经会用"
            ]}
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  index,
  title,
  description
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-focus">{index}</p>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

function ComparisonCard({
  emphasized = false,
  items,
  title
}: {
  emphasized?: boolean;
  items: string[];
  title: string;
}) {
  return (
    <article
      className={
        emphasized
          ? "rounded-xl border border-blue-200 bg-white p-5 shadow-sm"
          : "rounded-xl border border-slate-200 bg-slate-50 p-5"
      }
    >
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <span aria-hidden="true" className="text-focus">
              {emphasized ? "✓" : "—"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
